precision highp float;

// Maximum loop bound — raise if you need more samples.
#define MAX_SAMPLES 64

uniform sampler2D uTexture;      // input: scene RT (pass 0) or previous blur RT
uniform sampler2D uMaskTexture;  // shape mask: sphere trail
uniform vec2 uTexelSize;    // 1/width, 1/height of the low-res blur buffer
uniform float uStepSize;     // step between samples in texels (= passIndex + 1)
uniform int uSamples;      // number of samples per direction (each side)
uniform vec3 uColor;        // target glow color
uniform float uColorDistance;// color distance threshold (increases each pass)
uniform vec2 uCenter;       // sphere center in UV space (0..1)

varying vec2 vUv;

// Returns the sample colour weighted by shape-mask × colour-distance mask.
vec4 maskedSample(vec2 uv) {
  vec4 col = texture2D(uTexture, uv);
  float m = texture2D(uMaskTexture, uv).r;
  float cd = 1.0 - smoothstep(0.0, uColorDistance, distance(uColor, col.rgb));
  return col * (m * cd);
}

void main() {
  // Radial direction from this pixel toward the sphere centre.
  // uTexelSize.x / uTexelSize.y = bufferHeight / bufferWidth, which corrects
  // for non-square UV space so the direction is isotropic on screen.
  vec2 toCenter = uCenter - vUv;
  toCenter.y *= uTexelSize.x / uTexelSize.y;
  vec2 dir = normalize(toCenter);

  vec4 sum = vec4(0.0);
  float count = 0.0;

  // Centre sample
  sum += maskedSample(vUv);
  count += 1.0;

  // Linear samples along the radial direction.
  // Step size (uStepSize) grows with each pass so later passes reach further out.
  for(int i = 1; i <= MAX_SAMPLES; i++) {
    if(i > uSamples)
      break;

    vec2 step = dir * (float(i) * uStepSize) * uTexelSize;

    sum += maskedSample(vUv + step);  // toward centre
    count += 1.0;
  }

  gl_FragColor = sum / count;
}
