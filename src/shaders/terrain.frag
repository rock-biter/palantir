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
uniform sampler2D uTrailMap;
uniform sampler2D uTrailMapBlurred;
uniform vec3 uTrailColorCore;
uniform vec3 uTrailColorMid;
uniform vec3 uTrailColorEdge;
uniform float uTrailMaxDist;
uniform float uTrailFalloffCurve;
uniform float uTrailBlur;
uniform float uChromaShift;
uniform float uBrightnessStart;
uniform float uBrightnessMult;

uniform samplerCube uShadowCubeMap;
uniform float uShadowMaxDist;
uniform float uShadowStrength;
uniform float uShadowBias;
uniform float uShadowFalloff;

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
  vec3 lightDir = normalize(vec3(8.0, 4.0, 2.0));
  float NdL = max(dot(N, lightDir), 0.0);
  float ambient = 0.1;
  float lighting = ambient + (1.0 - ambient) * NdL * 2.;

  vec3 color = uColor * diffuseTex * lighting;

  // --- Trail texture projection from sphere center ---
  vec3 projDir = normalize(vWorldPosition); // direction from scene center to terrain point
  // Convert to spherical UVs matching Three.js SphereGeometry mapping
  float theta = acos(clamp(projDir.y, -1.0, 1.0));
  float phi = atan(-projDir.z, projDir.x);
  vec2 trailUV = vec2(phi / (2.0 * 3.14159265) + 0.5, 1.0 - theta / 3.14159265);

  // Distance-based falloff
  float distToCenter = length(vWorldPosition);
  float distFactor = 1.0 - clamp(distToCenter / uTrailMaxDist, 0.0, 1.0);
  distFactor = pow(distFactor, uTrailFalloffCurve);

  // Sample trail — sharp from raw texture, blurred from Kawase pre-pass
  // (avoids mipmap seam at the spherical U=0/1 wrap boundary)
  float mixBlur = smoothstep(0.0, uTrailMaxDist, distToCenter);

  // Chromatic aberration: offset phi for R and B channels
  float phiOffsetR = phi + uChromaShift;
  float phiOffsetB = phi - uChromaShift;
  vec2 trailUV_R = vec2(phiOffsetR / (2.0 * 3.14159265) + 0.5, 1.0 - theta / 3.14159265);
  vec2 trailUV_B = vec2(phiOffsetB / (2.0 * 3.14159265) + 0.5, 1.0 - theta / 3.14159265);

  float trailR_sharp = textureLod(uTrailMap, trailUV_R, 0.0).r;
  float trailR_blur = texture2D(uTrailMapBlurred, trailUV_R).r;
  float trailR = mix(trailR_sharp, trailR_blur, mixBlur);

  float trailG_sharp = textureLod(uTrailMap, trailUV, 0.0).r;
  float trailG_blur = texture2D(uTrailMapBlurred, trailUV).r;
  float trailG = mix(trailG_sharp, trailG_blur, mixBlur);

  float trailB_sharp = textureLod(uTrailMap, trailUV_B, 0.0).r;
  float trailB_blur = texture2D(uTrailMapBlurred, trailUV_B).r;
  float trailB = mix(trailB_sharp, trailB_blur, mixBlur);

  float trail = trailG; // use green channel as main intensity

  // 3-color gradient based on trail intensity (same as sphere)
  vec3 trailColor = pow(uTrailColorMid, vec3(2.2));
  // if(trail > 0.5) {
  //   trailColor = mix(uTrailColorMid, uTrailColorCore, (trail - 0.5) * 2.0);
  // } else {
  //   trailColor = mix(uTrailColorEdge, uTrailColorMid, trail * 2.0);
  // }

  trailColor = pow(trailColor, vec3(1. / 2.0));
  // trailColor = mix(uTrailColorCore, trailColor, smoothstep(0.0, 1.0, trail));
  // trailColor = mix((trailColor + vec3(0.0, 0.3, 0.1)) * 2., trailColor, pow(1.0 - mixBlur, 10.));

  // Intensity: how much the terrain faces the sphere center
  vec3 toCenter = normalize(-vWorldPosition);
  float trailIntensity = max(dot(N, toCenter), 0.0);

  // Omnidirectional shadow: attenuates the trail light where blocked
  // Computed before trail addition so it multiplies only the light contribution
  vec3 shadowDir = normalize(vWorldPosition);
  float shadowStoredDist = texture(uShadowCubeMap, shadowDir).r * uShadowMaxDist;
  float shadowActualDist = length(vWorldPosition);
  float rawDiff = shadowActualDist - shadowStoredDist;
  // effectiveBias: at least 10% of falloff to prevent cube-map resolution acne
  float effectiveBias = max(uShadowBias, uShadowFalloff * 0.01);
  float t = rawDiff - effectiveBias;
  // Contact shadow: u*exp(1-u) starts at 0 at shadow boundary (no dark halo),
  // peaks at u=1 (t = 0.3*falloff inside shadow), then decays exponentially.
  float u = max(t, 0.0) / (uShadowFalloff * 0.3);
  float shadowAmount = min(u * exp(1.0 - u), 1.0);
  float shadowFactor = 1.0 - shadowAmount * uShadowStrength;

  // Apply chromatic aberration per channel
  vec3 trailRGB = vec3(trailR, trailG, trailB);
  color += trailColor * trailRGB * trailIntensity * distFactor * 6. * shadowFactor;

  // Radial brightness attenuation: fades from 1.0 at center to uBrightnessMult at edges
  float bDist = length(vUv - 0.5) * 2.0;
  float bAtten = 1.0 - smoothstep(uBrightnessStart, 1.0, bDist);
  color *= mix(uBrightnessMult, 1.0, bAtten);

  gl_FragColor = vec4(color, alpha);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
