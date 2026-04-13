varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Compute tangent from world-space partial derivatives of position w.r.t. UV
  // For a PlaneGeometry rotated to XZ, tangent ~ X axis, bitangent ~ Z axis
  vec3 T = normalize(normalMatrix * vec3(1.0, 0.0, 0.0));
  vec3 B = normalize(cross(vNormal, T));
  T = normalize(cross(B, vNormal));
  vTangent = T;
  vBitangent = B;

  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
