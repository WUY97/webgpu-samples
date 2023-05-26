import { makeSample, SampleInit } from '../../components/SampleLayout';

import shaderWGSL from './shader.wgsl';

const GRID_SIZE = 32;
const UPDATE_INTERVAL = 500;

const init: SampleInit = async ({ canvas, pageState }) => {
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
  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format: presentationFormat,
    alphaMode: 'premultiplied',
  });

  // Create a buffer with the vertices for a single cell.
  const vertices =
    /* prettier-ignore */ new Float32Array([
    //   X,    Y
       -0.8, -0.8, // Triangle 1
        0.8, -0.8,
        0.8,  0.8,

       -0.8, -0.8, // Triangle 2
        0.8,  0.8,
       -0.8,  0.8,
  ]);
  const vertexBuffer = device.createBuffer({
    label: 'Cell vertices',
    size: vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertices);

  const vertexBufferLayout: GPUVertexBufferLayout[] = [
    {
      arrayStride: 8,
      attributes: [
        {
          format: 'float32x2',
          offset: 0,
          shaderLocation: 0, // Position. Matches @location(0) in the @vertex shader.
        },
      ],
    },
  ];

  // Create the shader that will render the cells.
  const cellShaderModule = device.createShaderModule({
    label: 'Cell shader',
    code: shaderWGSL,
  });

  // Create a pipeline that renders the cell.
  const cellPipeline = device.createRenderPipeline({
    label: 'Cell pipeline',
    layout: 'auto',
    vertex: {
      module: cellShaderModule,
      entryPoint: 'vertexMain',
      buffers: vertexBufferLayout,
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

  // Create a uniform buffer that describes the grid.
  const uniformArray = new Float32Array([GRID_SIZE, GRID_SIZE]);
  const uniformBuffer = device.createBuffer({
    label: 'Grid Uniforms',
    size: uniformArray.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformArray);

  // Create an array representing the active state of each cell.
  const cellStateArray = new Uint32Array(GRID_SIZE * GRID_SIZE);

  // Create two storage buffers to hold the cell state.
  const cellStateStorage: GPUBuffer[] = [
    device.createBuffer({
      label: 'Cell State A',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
    device.createBuffer({
      label: 'Cell State B',
      size: cellStateArray.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    }),
  ];

  // Mark every third cell of the first grid as active.
  for (let i = 0; i < cellStateArray.length; i += 3) {
    cellStateArray[i] = 1;
  }
  device.queue.writeBuffer(cellStateStorage[0], 0, cellStateArray);

  // Mark every other cell of the second grid as active.
  for (let i = 0; i < cellStateArray.length; ++i) {
    cellStateArray[i] = i % 2;
  }
  device.queue.writeBuffer(cellStateStorage[1], 0, cellStateArray);

  // Create bind groups to pass the grid uniforms and storage buffers with
  const bindGroups: GPUBindGroup[] = [
    device.createBindGroup({
      label: 'Cell renderer bind group A',
      layout: cellPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[0] },
        },
      ],
    }),
    device.createBindGroup({
      label: 'Cell renderer bind group B',
      layout: cellPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: uniformBuffer },
        },
        {
          binding: 1,
          resource: { buffer: cellStateStorage[1] },
        },
      ],
    }),
  ];

  let step = 0;
  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

    // Increment the step count
    step++;

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

    // Draw the grid.
    pass.setPipeline(cellPipeline);
    pass.setBindGroup(0, bindGroups[step % 2]);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2, GRID_SIZE * GRID_SIZE);

    // End the render pass and submit the command buffer
    pass.end();
    device.queue.submit([encoder.finish()]);
  }
  setInterval(frame, UPDATE_INTERVAL);
};

const cellState: () => JSX.Element = () =>
  makeSample({
    name: 'Shadow Mapping',
    description:
      'This example shows how to sample from a depth texture to render shadows.',
    init,
    sources: [
      {
        name: __filename.substring(__dirname.length + 1),
        contents: __SOURCE__,
      },
    ],
    filename: __filename,
  });

export default cellState;
