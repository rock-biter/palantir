precision highp float;

uniform float uShadowMaxDist;

varying vec3 vWorldPos;

void main() {
  float depth = length(vWorldPos) / uShadowMaxDist;
  gl_FragColor = vec4(depth, 0.0, 0.0, 1.0);
}
