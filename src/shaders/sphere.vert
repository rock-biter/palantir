varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
  vViewDir = normalize(worldPos.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
