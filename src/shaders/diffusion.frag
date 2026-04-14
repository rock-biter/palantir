precision highp float;

uniform sampler2D uPrevFrame;
uniform vec2 uResolution;
uniform vec3 uHitPoint;    // intersection point on sphere (normalized direction)
uniform float uBrushSize;  // angular radius in radians
uniform float uBrushStrength;
uniform float uDiffusion;  // 0..1 mixing factor for smooth trail
uniform float uDecay;
uniform float uIsHitting;  // 1.0 if mouse is on sphere, 0.0 otherwise
uniform float uWaveSpeed;  // wave propagation speed
uniform float uWaveDamping; // wave energy loss per frame
uniform float uTime;
uniform float uCurlScale;
uniform float uCurlSpeed;
uniform float uCurlStrength;

varying vec2 vUv;

#define PI  3.14159265359
#define TAU 6.28318530718

/* --- Simplex 3D noise (Ashima Arts) --- */
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec4 permute(vec4 x) {
  return mod289(((x * 34.0) + 10.0) * x);
}
vec4 taylorInvSqrt(vec4 r) {
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

/*
 * Curl noise on the sphere surface.
 * For a scalar noise field N on a sphere, the surface curl is:
 *   curl_s(N) = n × ∇_s(N)
 * where n is the surface normal. We compute ∇N via finite differences in 3D,
 * project to the tangent plane, then cross with the normal.
 * Returns a UV-space offset (dU, dV).
 */
vec2 curlNoiseSphere(vec3 pos, float scale, float time) {
  float eps = 0.01;
  vec3 sp = pos * scale + time;

  // Gradient of noise via central differences
  float dx = snoise(sp + vec3(eps, 0, 0)) - snoise(sp - vec3(eps, 0, 0));
  float dy = snoise(sp + vec3(0, eps, 0)) - snoise(sp - vec3(0, eps, 0));
  float dz = snoise(sp + vec3(0, 0, eps)) - snoise(sp - vec3(0, 0, eps));
  vec3 grad = vec3(dx, dy, dz) / (2.0 * eps);

  // Project gradient onto tangent plane
  vec3 n = normalize(pos);
  vec3 tangentGrad = grad - dot(grad, n) * n;

  // Curl = n × tangentGrad (divergence-free on sphere)
  vec3 curl = cross(n, tangentGrad);

  // Convert 3D curl vector to UV offset
  // dφ component (u-direction): along (-sin(φ), 0, cos(φ))
  // dθ component (v-direction): along (-cos(θ)cos(φ), sin(θ), -cos(θ)sin(φ))  [note: dv = -dθ/π]
  float phi = atan(pos.z, -pos.x);  // match uvToSphere sign convention
  float theta = acos(clamp(pos.y, -1.0, 1.0));
  float sinT = sin(theta);

  vec3 ePhi = vec3(sin(phi), 0.0, cos(phi)); // tangent in φ direction
  vec3 eTheta = vec3(-cos(theta) * cos(phi), -sinT, -cos(theta) * sin(phi)); // tangent in θ dir (towards south)

  float curlPhi = dot(curl, ePhi);
  float curlTheta = dot(curl, eTheta);

  // Map to UV: du = dφ/(2π), dv = -dθ/π
  float du = curlPhi / (sinT * TAU + 1e-6);
  float dv = -curlTheta / PI;

  return vec2(du, dv);
}

/*
 * Convert equirectangular UV to unit‑sphere direction.
 * Must match Three.js SphereGeometry convention:
 *   x = -sin(theta)*cos(phi), y = cos(theta), z = sin(theta)*sin(phi)
 * where  phi = u*2π,  theta = (1-v)*π
 */
vec3 uvToSphere(vec2 uv) {
  float phi = uv.x * TAU;
  float theta = (1.0 - uv.y) * PI;
  float sinT = sin(theta);
  return vec3(-sinT * cos(phi), cos(theta), sinT * sin(phi));
}

void main() {
  vec2 texel = 1.0 / uResolution;

  float theta = (1.0 - vUv.y) * PI;
  float sinT = sin(theta);

  vec2 prev = textureLod(uPrevFrame, vUv, 0.0).rg;
  float height = prev.r;   // wave height / trail value
  float vel = prev.g;   // wave velocity

  // --- Curl noise advection: offset the UV read position ---
  vec3 spherePos = uvToSphere(vUv);
  vec2 curlOffset = curlNoiseSphere(spherePos, uCurlScale, uTime * uCurlSpeed) * uCurlStrength;
  vec2 advectedUV = vUv + curlOffset;
  advectedUV.x = fract(advectedUV.x); // periodic in φ
  advectedUV.y = clamp(advectedUV.y, 0.0, 1.0); // clamp at poles
  float advected = textureLod(uPrevFrame, advectedUV, 0.0).r;

  // --- Neighbor samples (θ = v-direction, clamped at poles) ---
  float vUp = min(vUv.y + texel.y, 1.0);
  float vDown = max(vUv.y - texel.y, 0.0);
  float fUp = textureLod(uPrevFrame, vec2(vUv.x, vUp), 0.0).r;
  float fDown = textureLod(uPrevFrame, vec2(vUv.x, vDown), 0.0).r;

  // φ = u-direction (periodic / wrapping)
  float uRight = fract(vUv.x + texel.x);
  float uLeft = fract(vUv.x - texel.x + 1.0);
  float fRight = textureLod(uPrevFrame, vec2(uRight, vUv.y), 0.0).r;
  float fLeft = textureLod(uPrevFrame, vec2(uLeft, vUv.y), 0.0).r;

  // --- Weighted average with spherical metric compensation ---
  float wPhi = 1.0 / max(sinT * sinT, 0.01);
  float weightSum = 2.0 + 2.0 * wPhi;
  float avg = (fUp + fDown + wPhi * fRight + wPhi * fLeft) / weightSum;

  // --- Smooth diffusion trail (blend between advected and averaged) ---
  float diffused = mix(advected, avg, uDiffusion);

  // --- Wave equation: vel += c² * (avg - height), height += vel ---
  float laplacian = avg - height;
  vel += uWaveSpeed * laplacian;
  vel *= (1.0 - uWaveDamping);  // damping
  diffused += vel;

  // --- Decay ---
  diffused *= uDecay;

  // --- Paint brush ---
  if(uIsHitting > 0.5) {
    vec3 p = uvToSphere(vUv);
    float cosAngle = clamp(dot(p, uHitPoint), -1.0, 1.0);
    float angle = acos(cosAngle);

    float brush = smoothstep(uBrushSize, 0.0, angle) * uBrushStrength;
    // Add as impulse to both height and velocity
    diffused = max(diffused, brush);
    vel += brush * 0.5;
  }

  gl_FragColor = vec4(clamp(diffused, 0.0, 1.0), vel, 0.0, 1.0);
}
