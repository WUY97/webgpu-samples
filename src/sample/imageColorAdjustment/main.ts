import { makeSample, SampleInit } from '../../components/SampleLayout';

import colorWGSL from './color.wgsl';

const init: SampleInit = async ({ canvas, pageState, gui }) => {
  // Request a WebGPU adapter
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error('WebGPU not supported');
  }

  // Request a device from the adapter
  const device = await adapter.requestDevice();
  if (!pageState.active) return;
  const context = canvas.getContext('webgpu') as GPUCanvasContext;

  // Get the preferred canvas format
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

  // Set the width and height of the canvas to match the device's pixel ratio
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;

  // Configure the context for the WebGPU device and format
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  // Create a shader module from the imported WGSL code
  const shaderModule = device.createShaderModule({
    code: colorWGSL,
  });

  // Define the vertices for the shader
  const vertices =
    /* prettier-ignore */ new Float32Array([
      // X     Y    Z    W      U    V
      -1.0,  1.0, 0.0, 1.0,   0.0, 1.0,
      -1.0, -1.0, 0.0, 1.0,   0.0, 0.0,
       1.0, -1.0, 0.0, 1.0,   1.0, 0.0,
       1.0, -1.0, 0.0, 1.0,   1.0, 0.0,
       1.0,  1.0, 0.0, 1.0,   1.0, 1.0,
      -1.0,  1.0, 0.0, 1.0,   0.0, 1.0,
    ]);

  // Create a buffer for the vertices
  const verticesBuffer = device.createBuffer({
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  // Copy the vertices into the buffer
  new Float32Array(verticesBuffer.getMappedRange()).set(vertices);
  verticesBuffer.unmap();

  // Fetch the image and create a texture from it
  const response = await fetch(
    new URL('../../../assets/img/Di-3d.png', import.meta.url).toString()
  );
  const imageBitmap = await createImageBitmap(await response.blob());

  // Define the size of the texture based on the image's dimensions
  const textureSize = {
    width: imageBitmap.width,
    height: imageBitmap.height,
  };

  // Create a texture using the image
  const imageTexture = device.createTexture({
    size: textureSize,
    dimension: '2d',
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT |
      GPUTextureUsage.TEXTURE_BINDING,
  });

  // Copy the image into the texture
  device.queue.copyExternalImageToTexture(
    {
      source: await createImageBitmap(imageBitmap),
    },
    {
      texture: imageTexture,
      mipLevel: 0,
    },
    textureSize
  );

  // Initialize settings
  const settings = {
    temp: 0,
    tint: 0,
    vibrance: 0,
    saturation: 0,
  };

  const colorBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  // Create a buffer for the settings
  new Float32Array(colorBuffer.getMappedRange()).set([
    settings.temp,
    settings.tint,
    settings.vibrance,
    settings.saturation,
  ]);
  colorBuffer.unmap();

  // Update the settings
  function updateSettings() {
    device.queue.writeBuffer(
      colorBuffer,
      0,
      new Float32Array([
        settings.temp,
        settings.tint,
        settings.vibrance,
        settings.saturation,
      ])
    );
  }

  // Create GUI controls for the settings
  gui.add(settings, 'temp', -100, 100).onChange(updateSettings);
  gui.add(settings, 'tint', -100, 100).onChange(updateSettings);
  gui.add(settings, 'vibrance', -100, 100).onChange(updateSettings);
  gui.add(settings, 'saturation', -100, 100).onChange(updateSettings);

  updateSettings();

  // Define the layout for the bind group
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: {},
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: {},
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  // Create a texture sampler
  const textureSampler = device.createSampler({
    magFilter: 'nearest',
    minFilter: 'nearest',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  // Create a bind group that connects the resources with the shader
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: textureSampler,
      },
      {
        binding: 1,
        resource: imageTexture.createView(),
      },
      {
        binding: 2,
        resource: {
          buffer: colorBuffer,
        },
      },
    ],
  });

  // Define the pipeline layout
  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  // Define the attributes for the vertices
  const positionVertexAttribute: GPUVertexAttribute = {
    format: 'float32x4',
    offset: 0,
    shaderLocation: 0,
  };
  const texCoordsVertexAttribute: GPUVertexAttribute = {
    format: 'float32x2',
    offset: 16,
    shaderLocation: 1,
  };
  const vertexAttributes: Iterable<GPUVertexAttribute> = [
    positionVertexAttribute,
    texCoordsVertexAttribute,
  ];

  // Define the layout for the vertex buffer
  const vertexBufferLayout: GPUVertexBufferLayout = {
    attributes: vertexAttributes,
    arrayStride: 24,
    stepMode: 'vertex',
  };
  const vertexBuffers: Iterable<GPUVertexBufferLayout> = [vertexBufferLayout];

  // Define the color target state
  const colorTargetState: GPUColorTargetState = {
    format: presentationFormat,
  };

  // Create the rendering pipeline
  const renderPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: 'vertex_main',
      buffers: vertexBuffers,
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fragment_main',
      targets: [colorTargetState],
    },
    primitive: {
      topology: 'triangle-list',
      frontFace: 'ccw',
      cullMode: 'back',
    },
  });

  // Render the image
  function frame() {
    // Check if the page is still active
    if (!pageState.active) return;

    // Create a command encoder
    const commandEncoder = device.createCommandEncoder();

    // Begin a render pass
    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
          storeOp: 'store',
          loadOp: 'clear',
        },
      ],
    });

    // Set the pipeline and vertex buffer
    passEncoder.setPipeline(renderPipeline);
    passEncoder.setVertexBuffer(0, verticesBuffer);
    // Set the bind group
    passEncoder.setBindGroup(0, bindGroup);
    // Draw the vertices
    passEncoder.draw(6, 1, 0, 0);
    passEncoder.end();

    // Submit the commands to the queue
    device.queue.submit([commandEncoder.finish()]);

    // Request the next animation frame
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
};

const ImageColorAdjustment: () => JSX.Element = () =>
  makeSample({
    name: 'Image Color Adjustment',
    description:
      'This example shows how to apply a color adjustor on an image using a WebGPU compute shader.',
    gui: true,
    init,
    sources: [
      {
        name: __filename.substring(__dirname.length + 1),
        contents: __SOURCE__,
      },
      {
        name: './color.wgsl',
        contents: colorWGSL,
        editable: true,
      },
    ],
    filename: __filename,
  });

export default ImageColorAdjustment;
