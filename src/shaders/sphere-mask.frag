precision highp float;

uniform sampler2D uTrailMap;
uniform vec3 uTrailColorCore;
uniform vec3 uTrailColorMid;
uniform vec3 uTrailColorEdge;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  float trail = textureLod(uTrailMap, vUv, 0.0).r;

  // Output trail intensity as mask (R channel)
  // and the trail color in RGB for the radial blur to pick up
  vec3 trailColor;
  if(trail > 0.5) {
    trailColor = mix(uTrailColorMid, uTrailColorCore, (trail - 0.5) * 2.0);
  } else {
    trailColor = mix(uTrailColorEdge, uTrailColorMid, trail * 2.0);
  }

  // Output: RGB = trail color weighted by intensity, A = trail mask
  gl_FragColor = vec4(trail, trail, trail, 1.0);
}
