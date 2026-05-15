// Blends a bilinearly-upsampled coarser mipmap level into the stored fine level.
// The GPU handles the actual upsampling for free via LinearFilter on uCoarse.
uniform sampler2D uFine;   // fine downsample level (same resolution as output)
uniform sampler2D uCoarse; // coarser level — bilinearly upsampled by the GPU
uniform float uBlend;  // contribution weight of the coarse level

varying vec2 vUv;

void main() {
  vec4 fine = texture2D(uFine, vUv);
  vec4 coarse = texture2D(uCoarse, vUv);
  gl_FragColor = fine + coarse * uBlend;
}
