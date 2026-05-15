import * as THREE from 'three'
import { config } from './config.js'

import terrainVert from './shaders/terrain.vert'
import terrainFrag from './shaders/terrain.frag'

// --- Load terrain textures (same as foreground) ---
const textureLoader = new THREE.TextureLoader()

function loadTex(path) {
	const tex = textureLoader.load(path)
	tex.wrapS = THREE.RepeatWrapping
	tex.wrapT = THREE.RepeatWrapping
	return tex
}

const diffuseMap = loadTex('/textures/coast-sand/coast_sand_05_diff_1k.jpg')
const normalMap = loadTex('/textures/coast-sand/coast_sand_05_nor_gl_1k.jpg')
const roughMap = loadTex('/textures/coast-sand/coast_sand_05_rough_1k.jpg')

// --- CPU-side FBM noise (same as terrain.js) ---

function hash2(x, y) {
	let h = x * 374761393 + y * 668265263
	h = (h ^ (h >> 13)) * 1274126177
	h = h ^ (h >> 16)
	return h
}

function grad2(ix, iy, x, y) {
	const h = hash2(ix, iy) & 3
	const dirs = [
		[1, 1],
		[-1, 1],
		[1, -1],
		[-1, -1],
	]
	const d = dirs[h]
	return d[0] * x + d[1] * y
}

function fade(t) {
	return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
	return a + t * (b - a)
}

function perlin2D(x, y) {
	const xi = Math.floor(x)
	const yi = Math.floor(y)
	const xf = x - xi
	const yf = y - yi

	const u = fade(xf)
	const v = fade(yf)

	const n00 = grad2(xi, yi, xf, yf)
	const n10 = grad2(xi + 1, yi, xf - 1, yf)
	const n01 = grad2(xi, yi + 1, xf, yf - 1)
	const n11 = grad2(xi + 1, yi + 1, xf - 1, yf - 1)

	const nx0 = lerp(n00, n10, u)
	const nx1 = lerp(n01, n11, u)

	return lerp(nx0, nx1, v)
}

function fbm(x, y, octaves, frequency, lacunarity, gain) {
	let value = 0
	let amplitude = 1
	let maxAmp = 0
	let freq = frequency

	for (let i = 0; i < octaves; i++) {
		value += amplitude * perlin2D(x * freq, y * freq)
		maxAmp += amplitude
		amplitude *= gain
		freq *= lacunarity
	}

	return value / maxAmp
}

// --- Background Terrain mesh ---

let bgTerrainMesh = null

export function createBgTerrain() {
	const size = config.bgTerrainSize
	const segments = config.bgTerrainSegments
	const height = config.bgTerrainHeight
	const octaves = config.bgTerrainOctaves
	const frequency = config.bgTerrainFrequency
	const lacunarity = config.bgTerrainLacunarity
	const gain = config.bgTerrainGain
	const ox = config.bgTerrainNoiseOffsetX
	const oz = config.bgTerrainNoiseOffsetY
	const edgeStart = config.bgTerrainEdgeStart
	const edgeEnd = config.bgTerrainEdgeEnd
	const edgeHeight = config.bgTerrainEdgeHeight

	const geometry = new THREE.PlaneGeometry(size, size, segments, segments)
	geometry.rotateX(-Math.PI / 2)

	const positions = geometry.attributes.position.array
	const normals = geometry.attributes.normal.array
	const uvs = geometry.attributes.uv.array
	const eps = size / segments
	const halfSize = size / 2

	for (let i = 0, j = 0; i < positions.length; i += 3, j += 2) {
		const x = positions[i]
		const z = positions[i + 2]

		// Radial distance from center normalized to 0..1
		const dx = x / halfSize
		const dz = z / halfSize
		const radial = Math.sqrt(dx * dx + dz * dz)

		// Edge height boost: smoothstep from edgeStart to edgeEnd
		const edgeFactor = smoothstep(edgeStart, edgeEnd, radial)
		const edgeBoost = edgeFactor * edgeHeight

		const h = fbm(x + ox, z + oz, octaves, frequency, lacunarity, gain)
		positions[i + 1] = h * height + edgeBoost * (0.5 + Math.abs(h))

		// Compute normals via finite differences
		const hR =
			fbm(x + eps + ox, z + oz, octaves, frequency, lacunarity, gain) * height
		const hF =
			fbm(x + ox, z + eps + oz, octaves, frequency, lacunarity, gain) * height
		const hC = h * height

		// Add edge boost to neighbor samples too
		const dxR = (x + eps) / halfSize
		const dzF = (z + eps) / halfSize
		const radialR = Math.sqrt(dxR * dxR + dz * dz)
		const radialF = Math.sqrt(dx * dx + dzF * dzF)
		const hRFull =
			hR +
			smoothstep(edgeStart, edgeEnd, radialR) *
				edgeHeight *
				(0.5 +
					Math.abs(
						fbm(x + eps + ox, z + oz, octaves, frequency, lacunarity, gain),
					))
		const hFFull =
			hF +
			smoothstep(edgeStart, edgeEnd, radialF) *
				edgeHeight *
				(0.5 +
					Math.abs(
						fbm(x + ox, z + eps + oz, octaves, frequency, lacunarity, gain),
					))
		const hCFull = positions[i + 1]

		const nx = -(hRFull - hCFull) * eps
		const ny = eps * eps
		const nz = -(hFFull - hCFull) * eps
		const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

		normals[i] = nx / len
		normals[i + 1] = ny / len
		normals[i + 2] = nz / len
	}

	geometry.attributes.position.needsUpdate = true
	geometry.attributes.normal.needsUpdate = true

	const material = new THREE.ShaderMaterial({
		vertexShader: terrainVert,
		fragmentShader: terrainFrag,
		transparent: true,
		side: THREE.DoubleSide,
		uniforms: {
			uColor: { value: new THREE.Color(config.bgTerrainColor) },
			uTerrainSize: { value: size },
			uFalloffStart: { value: config.bgTerrainFalloffStart },
			uFalloffEnd: { value: config.bgTerrainFalloffEnd },
			uFalloffNoiseScale: { value: config.bgTerrainFalloffNoiseScale },
			uFalloffNoiseStrength: {
				value: config.bgTerrainFalloffNoiseStrength,
			},
			uDiffuseMap: { value: diffuseMap },
			uNormalMap: { value: normalMap },
			uRoughMap: { value: roughMap },
			uTexScale: { value: config.bgTerrainTexScale },
			uTexOffset: {
				value: new THREE.Vector2(
					config.bgTerrainTexOffsetX,
					config.bgTerrainTexOffsetY,
				),
			},
			uTrailMap: { value: null },
			uTrailColorCore: { value: new THREE.Color(0x000000) },
			uTrailColorMid: { value: new THREE.Color(0x000000) },
			uTrailColorEdge: { value: new THREE.Color(0x000000) },
			uTrailMaxDist: { value: 0.0 },
			uTrailFalloffCurve: { value: 1.0 },
			uTrailBlur: { value: 0.0 },
			uChromaShift: { value: 0.0 },
			uBrightnessStart: { value: 0.0 },
			uBrightnessMult: { value: 1.0 },
		},
	})

	if (bgTerrainMesh) {
		bgTerrainMesh.geometry.dispose()
		bgTerrainMesh.material.dispose()
		bgTerrainMesh.parent?.remove(bgTerrainMesh)
	}

	bgTerrainMesh = new THREE.Mesh(geometry, material)
	bgTerrainMesh.position.y = config.bgTerrainY
	bgTerrainMesh.renderOrder = -1 // Render behind main terrain

	return bgTerrainMesh
}

export function getBgTerrainMesh() {
	return bgTerrainMesh
}

function smoothstep(edge0, edge1, x) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)))
	return t * t * (3 - 2 * t)
}
