precision highp float;

uniform vec3 uColor;
uniform float uTerrainSize;
uniform float uFalloffStart;
uniform float uFalloffEnd;
uniform float uFalloffNoiseScale;
uniform float uFalloffNoiseStrength;
uniform sampler2D uDiffuseMap;
uniform sampler2D uNormalMap;
uniform sampler2D uRoughMap;
uniform float uTexScale;
uniform vec2 uTexOffset;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vNormal;
varying vec3 vTangent;
varying vec3 vBitangent;

// --- Simple 2D hash noise for falloff edge deformation ---
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float snoise2D(vec2 p) {
  const float K1 = 0.366025404; // (sqrt(3)-1)/2
  const float K2 = 0.211324865; // (3-sqrt(3))/6

  vec2 i = floor(p + (p.x + p.y) * K1);
  vec2 a = p - i + (i.x + i.y) * K2;
  float m = step(a.y, a.x);
  vec2 o = vec2(m, 1.0 - m);
  vec2 b = a - o + K2;
  vec2 c = a - 1.0 + 2.0 * K2;

  vec3 h = max(0.5 - vec3(dot(a, a), dot(b, b), dot(c, c)), 0.0);
  h = h * h * h * h;

  vec3 n = h * vec3(dot(a, hash2(i)), dot(b, hash2(i + o)), dot(c, hash2(i + 1.0)));
  return dot(n, vec3(70.0));
}

void main() {
  // Distance from mesh center in local XZ (vUv 0..1, center at 0.5)
  vec2 centered = vUv - 0.5;
  float dist = length(centered) * 2.0; // 0 at center, ~1.414 at corners

  // Noise deformation on the falloff edge
  vec2 noiseCoord = centered * uFalloffNoiseScale;
  float noise = snoise2D(noiseCoord) * uFalloffNoiseStrength;
  float noisyDist = dist + noise;

  // Falloff alpha
  float alpha = 1.0 - smoothstep(uFalloffStart, uFalloffEnd, noisyDist);

  if(alpha < 0.001)
    discard;

  // --- Texture sampling (tiled) ---
  vec2 tiledUV = vUv * uTexScale + uTexOffset;
  vec3 diffuseTex = texture2D(uDiffuseMap, tiledUV).rgb;
  float roughness = texture2D(uRoughMap, tiledUV).r;

  // --- Normal mapping (TBN) ---
  vec3 mapNormal = texture2D(uNormalMap, tiledUV).rgb * 2.0 - 1.0;
  mat3 TBN = mat3(normalize(vTangent), normalize(vBitangent), normalize(vNormal));
  vec3 N = normalize(TBN * mapNormal);

  // Simple directional + ambient lighting
  vec3 lightDir = normalize(vec3(3.0, 10.0, 7.0));
  float NdL = max(dot(N, lightDir), 0.0);
  float ambient = 0.35;
  float lighting = ambient + (1.0 - ambient) * NdL;

  vec3 color = uColor * diffuseTex * lighting;

  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
