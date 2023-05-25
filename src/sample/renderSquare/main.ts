import { makeSample, SampleInit } from '../../components/SampleLayout';

const init: SampleInit = async ({ canvas, pageState }) => {
  // WebGPU device initialization
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
