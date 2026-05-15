uniform sampler2D uScene;
uniform sampler2D uBlurred;
uniform float uStrength;

varying vec2 vUv;

void main() {
  vec4 scene = texture2D(uScene, vUv);
  vec4 blurred = texture2D(uBlurred, vUv);

  // Additive blend: blurred glow is added on top of the scene
  gl_FragColor = vec4(scene.rgb + blurred.rgb * uStrength, 1.0);

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
