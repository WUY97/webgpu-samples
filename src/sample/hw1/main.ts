import { mat4, vec3 } from 'wgpu-matrix';
import { makeSample, SampleInit } from '../../components/SampleLayout';

import shaderWGSL from './shader.wgsl';

import mesh from '../../meshes/teapot';

const init: SampleInit = async ({ canvas, pageState, gui }) => {
  // WebGPU device initialization
  if (!navigator.gpu) {
    throw new Error('WebGPU not supported on this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('No appropriate GPUAdapter found.');
  }

  const device = await adapter.requestDevice();

  if (!pageState.active) return;

  // Canvas configuration
  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  const aspect = canvas.width / canvas.height;
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  const { positions } = mesh;

  let maxCoord = 0;
  for (const position of positions) {
    for (const coord of position) {
      maxCoord = Math.max(maxCoord, Math.abs(coord));
    }
  }

  const scale = 1.5 / maxCoord;

  for (const position of positions) {
    position[0] *= scale;
    position[1] *= scale;
    position[2] *= scale;
  }

  const vertexBuffer = device.createBuffer({
    size: mesh.positions.length * 3 * 2 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  {
    const mapping = new Float32Array(vertexBuffer.getMappedRange());
    for (let i = 0; i < mesh.positions.length; ++i) {
      mapping.set(mesh.positions[i], 6 * i);
      mapping.set(mesh.normals[i], 6 * i + 3);
    }
    vertexBuffer.unmap();
  }

  const indexCount = mesh.triangles.length * 3;
  const indexBuffer = device.createBuffer({
    size: indexCount * Uint16Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.INDEX,
    mappedAtCreation: true,
  });
  {
    const mapping = new Uint16Array(indexBuffer.getMappedRange());
    for (let i = 0; i < mesh.triangles.length; ++i) {
      mapping.set(mesh.triangles[i], 3 * i);
    }
    indexBuffer.unmap();
  }

  const vertexBuffers: Iterable<GPUVertexBufferLayout> = [
    {
      arrayStride: Float32Array.BYTES_PER_ELEMENT * 6,
      attributes: [
        {
          // position
          shaderLocation: 0,
          offset: 0,
          format: 'float32x3',
        },
        {
          // normal
          shaderLocation: 1,
          offset: Float32Array.BYTES_PER_ELEMENT * 3,
          format: 'float32x3',
        },
      ],
    },
  ];

  const uniformBufferBindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: {
          type: 'uniform',
        },
      },
    ],
  });

  const bglForRender = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {
          type: 'uniform',
        },
      },
    ],
  });

  // Create the shader that will render the cells.
  const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: shaderWGSL,
  });

  // Create a pipeline that renders the cell.
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [
        uniformBufferBindGroupLayout,
        bglForRender,
        uniformBufferBindGroupLayout,
      ],
    }),
    vertex: {
      module: cellShaderModule,
      entryPoint: 'vertexMain',
      buffers: vertexBuffers,
    },
    fragment: {
      module: cellShaderModule,
      entryPoint: 'fragmentMain',
      targets: [
        {
          format: presentationFormat,
        },
      ],
    },
  });

  const settings = {
    rotationDegree: 0, // 0-180 degrees
    axis: 'x', // 0:x, 1:y, 2:z
  };

  const uniformBuffer = device.createBuffer({
    size: 2 * Float32Array.BYTES_PER_ELEMENT,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const updateSettings = () => {
    const axis =
      settings.axis === 'x' ? 0.0 : settings.axis === 'y' ? 1.0 : 2.0;
    device.queue.writeBuffer(
      uniformBuffer,
      0,
      new Float32Array([settings.rotationDegree, axis])
    );
  };

  gui.add(settings, 'axis', ['x', 'y', 'z']).onChange((value) => {
    settings.axis = value;
    updateSettings();
  });

  gui.add(settings, 'rotationDegree', 0, 180).onChange(updateSettings);

  const bindGroup = device.createBindGroup({
    layout: uniformBufferBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
    ],
  });

  // Model Uniform
  const modelMatrix = mat4.translation([0, -0.5, 0]);

  const modelUniformBuffer = device.createBuffer({
    size: 4 * 16, // 4x4 matrix
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const modelData = modelMatrix as Float32Array;
  device.queue.writeBuffer(
    modelUniformBuffer,
    0,
    modelData.buffer,
    modelData.byteOffset,
    modelData.byteLength
  );

  const sceneUniformBuffer = device.createBuffer({
    // Two 4x4 viewProj matrices,
    // one for the camera and one for the light.
    // Then a vec3 for the light position.
    // Rounded to the nearest multiple of 16.
    size: 4 * 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const modelBindGroup = device.createBindGroup({
    layout: uniformBufferBindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: modelUniformBuffer,
        },
      },
    ],
  });

  // Scene Uniform
  const eyePosition = vec3.fromValues(0, 1, -1);
  const upVector = vec3.fromValues(0, 1, 0);
  const origin = vec3.fromValues(0, 0, 0);

  const projectionMatrix = mat4.perspective(
    (2 * Math.PI) / 5,
    aspect,
    1,
    2000.0
  );

  const viewMatrix = mat4.inverse(mat4.lookAt(eyePosition, origin, upVector));

  const viewProjMatrix = mat4.multiply(projectionMatrix, viewMatrix);

  const sceneBindGroup = device.createBindGroup({
    layout: bglForRender,
    entries: [
      {
        binding: 0,
        resource: {
          buffer: sceneUniformBuffer,
        },
      },
    ],
  });

  function getCameraViewProjMatrix() {
    const eyePosition = vec3.fromValues(0, 1, -2);

    const rad = Math.PI * (Date.now() / 2000);
    const rotation = mat4.rotateY(mat4.translation(origin), rad);
    vec3.transformMat4(eyePosition, rotation, eyePosition);

    const viewMatrix = mat4.inverse(mat4.lookAt(eyePosition, origin, upVector));

    mat4.multiply(projectionMatrix, viewMatrix, viewProjMatrix);
    return viewProjMatrix as Float32Array;
  }

  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

    const cameraViewProj = getCameraViewProjMatrix();
    device.queue.writeBuffer(
      sceneUniformBuffer,
      0,
      cameraViewProj.buffer,
      cameraViewProj.byteOffset,
      cameraViewProj.byteLength
    );

    // Clear the canvas with a render pass
    const encoder = device.createCommandEncoder();

    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          loadOp: 'clear',
          clearValue: { r: 0, g: 0, b: 0.4, a: 1.0 },
          storeOp: 'store',
        },
      ],
    });

    // Draw the square.
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setBindGroup(1, sceneBindGroup);
    pass.setBindGroup(2, modelBindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, 'uint16');
    pass.drawIndexed(indexCount);

    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

const hw1: () => JSX.Element = () =>
  /* prettier-ignore */
  makeSample({
    name: 'HW1',
    description:
      'renders a rotating 3D teapot model',
    init,
    gui: true,
    sources: [
      {
        name: __filename.substring(__dirname.length + 1),
        contents: __SOURCE__,
      },
      {
        name: './shader.wgsl',
        contents: shaderWGSL,
      },
    ],
    filename: __filename,
  });

export default hw1;
