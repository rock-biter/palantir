precision highp float;

uniform sampler2D uTrailMap;
uniform vec3 uBaseColor;
uniform vec3 uTrailColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  float trail = texture2D(uTrailMap, vUv).r;

  // simple directional + ambient lighting
  vec3 lightDir = normalize(vec3(3.0, 10.0, 7.0));
  float NdL = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.35;
  float lighting = ambient + (1.0 - ambient) * NdL;

  vec3 base = uBaseColor * lighting;
  vec3 color = mix(base, uTrailColor, trail);

  // --- Color correction ---
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  gl_FragColor = vec4(color, 1.0);
}
