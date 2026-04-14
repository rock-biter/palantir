precision highp float;

uniform sampler2D uTrailMap;
uniform vec3 uBaseColor;
uniform vec3 uTrailColorCore;  // center (high intensity)
uniform vec3 uTrailColorMid;   // mid intensity
uniform vec3 uTrailColorEdge;  // edges/tail (low intensity)
uniform samplerCube uEnvMap;
uniform float uFresnelExponent;
uniform float uReflectionIntensity;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vViewDir;

void main() {
  float trail = textureLod(uTrailMap, vUv, 0.0).r;

  // --- 3-color gradient based on trail intensity ---
  // trail 1.0 = core (dark), 0.5 = mid, ~0.0 = edge (bright/yellow)
  vec3 trailColor;
  if(trail > 0.5) {
    trailColor = mix(uTrailColorMid, uTrailColorCore, (trail - 0.5) * 2.0);
  } else {
    trailColor = mix(uTrailColorEdge, uTrailColorMid, trail * 2.0);
  }

  // simple directional + ambient lighting
  vec3 lightDir = normalize(vec3(3.0, 10.0, 7.0));
  float NdL = max(dot(vNormal, lightDir), 0.0);
  float ambient = 0.35;
  float lighting = ambient + (1.0 - ambient) * NdL;

  vec3 base = uBaseColor * lighting;
  vec3 color = mix(base, trailColor, trail);

  // --- Fresnel reflection ---
  vec3 reflectDir = reflect(vViewDir, normalize(vWorldNormal));
  vec3 envColor = textureCube(uEnvMap, reflectDir).rgb;
  float fresnel = pow(1.0 - max(dot(normalize(-vViewDir), normalize(vWorldNormal)), 0.0), uFresnelExponent);
  color = mix(color, envColor, fresnel * uReflectionIntensity);

  // --- Color correction ---
  #include <tonemapping_fragment>
  #include <colorspace_fragment>

  gl_FragColor = vec4(color, 1.0);
}
