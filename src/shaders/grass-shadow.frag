// Grass shadow caster fragment shader
// Replicates: blade alpha mask + frayed edge discard
// Outputs: linear distance from origin, normalized to [0, 1]

precision highp float;

uniform sampler2D uGrassTexture;
uniform sampler2D uFbmColorMap;
uniform float uFrayStrength;
uniform float uShadowMaxDist;

varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vPivotWorldPos;

void main() {
  // Blade shape alpha mask
  vec4 grassTex = texture2D(uGrassTexture, vUv);
  if(grassTex.a < 0.1) discard;

  // Remap U for two side-by-side blades
  float bladeLocalU = fract(vUv.x * 2.0);

  // Frayed edge: stochastic discard near blade edges
  float distFromEdge = min(bladeLocalU, 1.0 - bladeLocalU) * 2.0;
  vec2 frayUV = vec2(bladeLocalU * 0.5 + vPivotWorldPos.x * 0.18, vUv.y * 5.0 + vPivotWorldPos.z * 0.18);
  float frayNoise = texture2D(uFbmColorMap, frayUV).r;
  if(frayNoise < (1.0 - distFromEdge) * uFrayStrength * 3.0) discard;

  // Output linear world-space distance from origin
  gl_FragColor = vec4(length(vWorldPos) / uShadowMaxDist, 0.0, 0.0, 1.0);
}
