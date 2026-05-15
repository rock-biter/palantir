// Grass shadow caster vertex shader
// Replicates: instance position, heightmap placement, wind oscillation

uniform sampler2D uHeightMap;
uniform float uTerrainSize;
uniform float uTerrainMinH;
uniform float uTerrainMaxH;
uniform float uTerrainY;

uniform float uTime;
uniform float uWindFrequency;
uniform float uWindSpeed;
uniform float uWindStrength;
uniform float uGrassHeightMax;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vPivotWorldPos;

// ---- Hash-based 2D value noise for wind (identical to grass.vert) ----

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

float windFbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for(int i = 0; i < 3; i++) {
    v += a * valueNoise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vUv = uv;

  vec2 instanceXZ = instanceMatrix[3].xz;

  // Heightmap elevation at blade base
  vec2 hmUv = (instanceXZ + uTerrainSize * 0.5) / uTerrainSize;
  hmUv = clamp(hmUv, 0.001, 0.999);
  float heightNorm = texture2D(uHeightMap, hmUv).g;
  float terrainH = mix(uTerrainMinH, uTerrainMaxH, heightNorm) + uTerrainY;

  // Instance transform
  vec4 worldPos = instanceMatrix * vec4(position, 1.0);
  vPivotWorldPos = (instanceMatrix * vec4(vec3(0.0), 1.0)).xyz;

  // Lift base to terrain surface
  worldPos.y += terrainH;

  // Wind oscillation
  float bladeHeight = length(instanceMatrix[1].xyz);
  float bladeHeightNorm = bladeHeight / uGrassHeightMax;
  float bladeT = position.y * bladeHeightNorm;
  float windT = pow(bladeT, 1.5) * bladeHeightNorm;

  vec2 windUv = instanceXZ * uWindFrequency + vec2(uTime * uWindSpeed, uTime * uWindSpeed * 0.73);
  float wind = (windFbm(windUv) * 2.0 - 1.0) * uWindStrength * windT;
  worldPos.x += wind;
  worldPos.z += wind * 0.35;

  vWorldPos = worldPos.xyz;

  gl_Position = projectionMatrix * modelViewMatrix * worldPos;
}
