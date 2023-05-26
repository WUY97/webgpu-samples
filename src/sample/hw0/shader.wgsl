@vertex
fn vertexMain(@location(0) position: vec2<f32>) -> @builtin(position) vec4<f32> {
  // Rotate the position by 45 degrees
  let rotationAngle = radians(45.0);
  let cosA = cos(rotationAngle);
  let sinA = sin(rotationAngle);
  let rotationMatrix = mat2x2<f32>(cosA, -sinA, sinA, cosA);
  let rotatedPosition = rotationMatrix * position;

  // Translate the position
  let translatedPosition = rotatedPosition + 0.5;

  // Return the final position
  return vec4<f32>(translatedPosition, 0, 1);
}

@fragment
fn fragmentMain() -> @location(0) vec4<f32> {
  return vec4<f32>(1, 0, 0, 1);
}