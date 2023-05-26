struct VertexInput {
    @location(0) position: vec3<f32>,
  };
  
struct VertexOutput {
  @builtin(position) position: vec4<f32>,
};

struct Uniforms {
  rotationDegree : f32,
  axis : f32,
}

@binding(0) @group(0) var<uniform> uniforms: Uniforms;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
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
  output.position = vec4<f32>(rotatedPosition, 1.0);
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  return vec4<f32>(1, 0, 0, 1);
}