precision highp float;

uniform sampler2D uTexture;
uniform vec2 uTexelSize;
uniform float uOffset;

varying vec2 vUv;

void main() {
  // Offsets for this pass.
  // wrapS=RepeatWrapping on the input texture handles U-axis wrap
  // (including bilinear filter neighbours crossing the seam) without
  // manual fract(). wrapT=ClampToEdge handles the poles on V.
  vec2 o = (uOffset + 0.5) * uTexelSize;

  vec4 sum = vec4(0.0);
  sum += texture2D(uTexture, vUv + vec2(o.x, o.y));
  sum += texture2D(uTexture, vUv + vec2(-o.x, o.y));
  sum += texture2D(uTexture, vUv + vec2(o.x, -o.y));
  sum += texture2D(uTexture, vUv + vec2(-o.x, -o.y));

  gl_FragColor = sum * 0.25;
}
