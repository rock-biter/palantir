uniform sampler2D tDiffuse;
uniform sampler2D uMaskTexture;
uniform vec2 uResolution;
uniform int uSamples;
uniform float uReduce;
uniform float uStrength;
uniform vec3 uColor;
uniform float uColorDistance;

varying vec2 vUv;
varying vec2 vCenter;

void main() {
  vec3 diffuse = texture(tDiffuse, vUv).rgb;

  // Screen-space center of sphere (NDC -> UV)
  vec2 center = vCenter * 0.5 + 0.5;

  vec2 texel = 1.0 / uResolution;
  vec2 difference = center - vUv;
  // Correct for aspect ratio
  difference.xy *= uResolution.xy / uResolution.xx;
  vec2 dir = normalize(difference);

  vec3 rays = vec3(0.0);
  float div = 1.0;

  // Adjust sample count based on color distance at this pixel
  float pixelColorDist = distance(uColor, diffuse);
  float colorFactor = 1.0 - smoothstep(0.0, uColorDistance, pixelColorDist);
  int actualSamples = int(float(uSamples) * colorFactor);

  for(int i = 0; i < uSamples; i++) {
    if(i >= actualSamples)
      break;
    float step = 1.5 + float(i) * 0.05;
    vec2 shift = vec2(float(i * 2)) * texel * dir * step;
    vec2 shift2 = vec2(float(i * 2 + 1)) * texel * dir * step;

    // Don't sample past the center
    if(length(shift) < length(difference)) {
      vec2 uvMap = vUv + shift;
      vec3 colorMap = texture(tDiffuse, uvMap).rgb;
      float mask = texture(uMaskTexture, uvMap).r;

      // Color distance filter: only blur pixels close to target color
      float colorDist = distance(uColor, colorMap);
      float colorMask = 1.0 - smoothstep(0.0, uColorDistance, colorDist);
      mask *= colorMask;

      // Reduce intensity with distance from sample origin
      float reduce = smoothstep(0.0, float(uSamples), float(i));
      reduce = pow(reduce, uReduce);

      float f = (1.0 - reduce) * mask;
      f = smoothstep(0.0, 1.0, f);

      rays += colorMap * f;
      div += f;
    }

    if(length(shift2) < length(difference)) {
      vec2 uvMap = vUv + shift2;
      vec3 colorMap = texture(tDiffuse, uvMap).rgb;
      float mask = texture(uMaskTexture, uvMap).r;

      // Color distance filter: only blur pixels close to target color
      float colorDist = distance(uColor, colorMap);
      float colorMask = 1.0 - smoothstep(0.0, uColorDistance, colorDist);
      mask *= colorMask;

      // Reduce intensity with distance from sample origin
      float reduce = smoothstep(0.0, float(uSamples), float(i));
      reduce = pow(reduce, uReduce);

      float f = (1.0 - reduce) * mask;
      f = smoothstep(0.0, 1.0, f);

      rays += colorMap * f;
      div += f;
    }
  }

  rays /= div;
  diffuse += rays * uStrength;

  gl_FragColor = vec4(diffuse, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
