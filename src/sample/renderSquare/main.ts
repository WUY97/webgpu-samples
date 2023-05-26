import { makeSample, SampleInit } from '../../components/SampleLayout';

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
        0.8, 0.8,
       -0.8, 0.8,
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
    code: `
        @vertex
        fn vertexMain(@location(0) position: vec2f)
          -> @builtin(position) vec4f {
          return vec4f(position, 0, 1);
        }

        @fragment
        fn fragmentMain() -> @location(0) vec4f {
          return vec4f(1, 0, 0, 1);
        }
      `,
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

  function frame() {
    // Sample is no longer the active page.
    if (!pageState.active) return;

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
    pass.setPipeline(cellPipeline);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.draw(vertices.length / 2);

    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
};

const renderSquare: () => JSX.Element = () =>
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

export default renderSquare;
