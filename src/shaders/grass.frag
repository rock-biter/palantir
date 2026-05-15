// Instanced grass blade fragment shader
// Vertical color gradient + ambient occlusion + trail light + distance falloff

precision highp float;

uniform vec3 uColorBase;
uniform vec3 uColorTip;

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

varying float vBladeT;
varying vec2 vUv;
varying vec3 vWorldPos;
varying float vColorVariation;

void main() {
	// Vertical gradient from base to tip color
  vec3 color = mix(uColorBase, uColorTip, vBladeT);

	// Ambient occlusion: darker at the base, full brightness at the tip
  float ao = vBladeT * 0.75 + 0.25;
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

  color += trailColor * trail * distFactor * uTrailStrength;

  gl_FragColor = vec4(color, 1.0);
}
