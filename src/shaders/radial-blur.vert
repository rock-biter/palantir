varying vec2 vUv;
varying vec2 vCenter;

uniform vec3 uCenter;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;

void main() {
  vUv = uv;

  // Project sphere center (world 0,0,0) to screen space
  vec4 cPosition = uProjectionMatrix * uViewMatrix * vec4(uCenter, 1.0);
  vCenter = cPosition.xy / cPosition.w;

  gl_Position = vec4(position, 1.0);
}
