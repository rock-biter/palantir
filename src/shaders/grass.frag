// Instanced grass blade fragment shader
// Vertical color gradient + ambient occlusion + trail light + distance falloff

precision highp float;

uniform vec3 uColorBase;
uniform vec3 uColorTip;
uniform sampler2D uGrassTexture;
uniform sampler2D uFbmColorMap;
uniform float uFbmColorStrength;
uniform float uFrayStrength;
uniform float uTerrainSize;

// Trail projection
uniform sampler2D uTrailMap;
uniform sampler2D uTrailMapBlurred;
uniform vec3 uTrailColorMid;
uniform float uTrailMaxDist;
uniform float uTrailFalloffCurve;
uniform float uTrailStrength;

// Distance-based brightness falloff from sphere
uniform float uGrassFalloffDistance;
uniform float uGrassFalloffPower;

// Per-instance chromatic variation
uniform float uColorVariation;

// Omnidirectional shadow from sphere center
uniform samplerCube uShadowCubeMap;
uniform float uShadowMaxDist;
uniform float uShadowStrength;
uniform float uShadowBias;
uniform float uShadowFalloff;

varying float vBladeT;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vPivotWorldPos;
varying float vColorVariation;

void main() {
	// Sample grass texture: alpha masks the blade shape, grayscale adds surface detail
  vec4 grassTex = texture2D(uGrassTexture, vUv);
  if(grassTex.a < 0.1)
    discard;
  float grassGray = dot(grassTex.rgb, vec3(0.299, 0.587, 0.114));

  // Remap U for two side-by-side blades: each half → [0, 1]
  float bladeLocalU = fract(vUv.x * 2.0);

  // Frayed edge: stochastic discard near blade edges using fbm noise
  float distFromEdge = min(bladeLocalU, 1.0 - bladeLocalU) * 2.0; // 0=edge, 1=center
  vec2 frayUV = vec2(bladeLocalU * 0.5 + vPivotWorldPos.x * 0.18, vUv.y * 5.0 + vPivotWorldPos.z * 0.18);
  float frayNoise = texture2D(uFbmColorMap, frayUV).r;
  if(frayNoise < (1.0 - distFromEdge) * uFrayStrength * 3.)
    discard;

  // High-contrast version for SSS approximation: crush darks (veins), boost lights (thin blade areas)
  float sssContrast = 1.0 - pow(clamp(grassGray * 2.2 - 0.6, 0.0, 1.0), 10.0);
  // bladeLocalU already computed above
  float sssEdge = pow(abs(bladeLocalU - 0.5) * 2.0, 0.4);
  float sssWeight = sssContrast * sssEdge;

	// Vertical gradient from base to tip color
  vec3 color = mix(uColorBase, uColorTip, vBladeT);

	// Ambient occlusion: darker at the base, full brightness at the tip
  // float ao = vBladeT * 0.75 + 0.25;
  float ao = pow(vBladeT, 0.5);
  color *= ao;

	// Per-instance chromatic variation: brightness ±uColorVariation, warm hue push on brighter blades
  float vary = vColorVariation * 2.0 - 1.0; // remap [0,1] → [-1,1]
  color *= 1.0 + vary * uColorVariation;
  color.r += max(vary, 0.0) * uColorVariation * 0.04;
  color.g += max(vary, 0.0) * uColorVariation * 0.015;

	// Distance-based brightness falloff from sphere (XZ plane)
  float dist = length(vWorldPos.xz);
  float falloff = 1.0 - smoothstep(0.0, uGrassFalloffDistance, dist);
  falloff = pow(max(falloff, 0.0), uGrassFalloffPower);
  color *= falloff;

	// Trail light: project from sphere center using spherical UVs
  vec3 projDir = normalize(vWorldPos);
  float theta = acos(clamp(projDir.y, -1.0, 1.0));
  float phi = atan(-projDir.z, projDir.x);
  vec2 trailUV = vec2(phi / (2.0 * 3.14159265) + 0.5, 1.0 - theta / 3.14159265);

  float distToCenter = length(vWorldPos);
  float mixBlur = smoothstep(0.0, uTrailMaxDist, distToCenter);
  float distFactor = 1.0 - clamp(distToCenter / uTrailMaxDist, 0.0, 1.0);
  distFactor = pow(distFactor, uTrailFalloffCurve);

  float trail_sharp = textureLod(uTrailMap, trailUV, 0.0).r;
  float trail_blur = texture2D(uTrailMapBlurred, trailUV).r;
  float trail = mix(trail_sharp, trail_blur, mixBlur);

  vec3 trailColor = pow(uTrailColorMid, vec3(2.2));
  trailColor = pow(trailColor, vec3(1.0 / 2.0));

  // Omnidirectional shadow: attenuates trail light where blocked
  // Use pivot (base) so the whole blade shares one shadow value, avoiding acne on thin geometry
  vec3 shadowDir = normalize(vPivotWorldPos);
  float shadowStoredDist = texture(uShadowCubeMap, shadowDir).r * uShadowMaxDist;
  float shadowActualDist = length(vPivotWorldPos);
  float rawDiff = shadowActualDist - shadowStoredDist;
  // effectiveBias: at least 10% of falloff to prevent cube-map resolution acne
  float effectiveBias = max(uShadowBias, uShadowFalloff * 0.1);
  float t = rawDiff - effectiveBias;
  // Contact shadow: u*exp(1-u) starts at 0 at shadow boundary (no dark halo),
  // peaks at u=1 (t = 0.3*falloff inside shadow), then decays exponentially.
  float u = max(t, 0.0) / (uShadowFalloff * 0.3);
  float shadowAmount = min(u * exp(1.0 - u), 1.0);
  float shadowFactor = 1.0 - shadowAmount * uShadowStrength;

  color += trailColor * trail * distFactor * uTrailStrength * (1.0 + sssWeight * 4.5);// * shadowFactor;

  // Apply grayscale texture trama to the final blade color
  color *= grassGray;

  // FBM color variation: sample world-space color map and tint the blade
  // vec2 colorMapUV = vWorldPos.xz / uTerrainSize + 0.5;
  vec3 fbmTint = texture2D(uFbmColorMap, vUv * vec2(1., 0.5)).rgb;
  color = mix(color, color * vec3(0.2) * 2.0, uFbmColorStrength);

  gl_FragColor = vec4(color, 1.0);
}
