struct Uniforms {
  rotationDegree : f32,
  axis : f32,
}

struct Scene {
  lightViewProjMatrix : mat4x4<f32>,
  cameraViewProjMatrix : mat4x4<f32>,
  lightPos : vec3<f32>,
}

struct Model {
  modelMatrix: mat4x4<f32>,
}

struct VertexInput {
  @location(0) position: vec3<f32>,
  @location(1) normal: vec3<f32>,
};
  
struct VertexOutput {
  @builtin(position) position: vec4<f32>,

  @location(0) shadowPos: vec3<f32>,
  @location(1) fragPos: vec3<f32>,
  @location(2) fragNorm: vec3<f32>,
};

@binding(0) @group(0) var<uniform> scene: Scene;
@binding(0) @group(1) var<uniform> model: Model;
@binding(0) @group(2) var<uniform> uniforms: Uniforms;

@vertex
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  let rotationAngle = radians(uniforms.rotationDegree);
  let cosTheta = cos(rotationAngle);
  let sinTheta = sin(rotationAngle);

  let xRotationMatrix: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(1.0, 0.0, 0.0),
    vec3<f32>(0.0, cosTheta, -sinTheta),
    vec3<f32>(0.0, sinTheta, cosTheta)
  );
  let yRotationMatrix: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(cosTheta, 0.0, sinTheta),
    vec3<f32>(0.0, 1.0, 0.0),
    vec3<f32>(-sinTheta, 0.0, cosTheta)
  );
  let zRotationMatrix: mat3x3<f32> = mat3x3<f32>(
    vec3<f32>(cosTheta, -sinTheta, 0.0),
    vec3<f32>(sinTheta, cosTheta, 0.0),
    vec3<f32>(0.0, 0.0, 1.0)
  );

  var rotationMatrix: mat3x3<f32>;
  if (uniforms.axis == 0.0) {
    rotationMatrix = xRotationMatrix;
  } else if (uniforms.axis == 1.0) {
    rotationMatrix = yRotationMatrix;
  } else if (uniforms.axis == 2.0) {
    rotationMatrix = zRotationMatrix;
  }

  var rotatedPosition = rotationMatrix * input.position;

  // XY is in (-1, 1) space, Z is in (0, 1) space
  let posFromLight = scene.lightViewProjMatrix * model.modelMatrix * vec4(rotatedPosition, 1.0);
  output.position = scene.cameraViewProjMatrix * model.modelMatrix * vec4(rotatedPosition, 1.0);
  output.fragPos = output.position.xyz;
  output.fragNorm = input.normal;
  output.shadowPos = vec3(
    posFromLight.xy * vec2(0.5, -0.5) + vec2(0.5),
    posFromLight.z
  );
  return output;
}