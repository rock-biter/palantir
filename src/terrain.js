import * as THREE from 'three'
import { config } from './config.js'

import terrainVert from './shaders/terrain.vert'
import terrainFrag from './shaders/terrain.frag'

// --- Load terrain textures ---
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

// --- CPU-side FBM noise ---

// Simple 2D gradient noise (hash-based)
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

// --- Terrain mesh ---

let terrainMesh = null
let terrainHeightMap = null
let terrainHeightRange = { minH: 0, maxH: 1 }

export function createTerrain() {
	const {
		terrainSize,
		terrainSegments,
		terrainHeight,
		terrainOctaves,
		terrainFrequency,
		terrainLacunarity,
		terrainGain,
	} = config

	const geometry = new THREE.PlaneGeometry(
		terrainSize,
		terrainSize,
		terrainSegments,
		terrainSegments,
	)
	geometry.rotateX(-Math.PI / 2)

	const positions = geometry.attributes.position.array
	const normals = geometry.attributes.normal.array
	const eps = terrainSize / terrainSegments

	for (let i = 0; i < positions.length; i += 3) {
		const x = positions[i]
		const z = positions[i + 2]
		const ox = config.terrainNoiseOffsetX
		const oz = config.terrainNoiseOffsetY

		const h = fbm(
			x + ox,
			z + oz,
			terrainOctaves,
			terrainFrequency,
			terrainLacunarity,
			terrainGain,
		)
		positions[i + 1] = h * terrainHeight

		// Sample two neighbors for analytical normal
		const hR =
			fbm(
				x + eps + ox,
				z + oz,
				terrainOctaves,
				terrainFrequency,
				terrainLacunarity,
				terrainGain,
			) * terrainHeight
		const hF =
			fbm(
				x + ox,
				z + eps + oz,
				terrainOctaves,
				terrainFrequency,
				terrainLacunarity,
				terrainGain,
			) * terrainHeight
		const hC = h * terrainHeight

		// Tangent vectors
		// T1 = (eps, hR - hC, 0)
		// T2 = (0, hF - hC, eps)
		// Normal = T1 x T2
		const nx = -(hR - hC) * eps
		const ny = eps * eps
		const nz = -(hF - hC) * eps
		const len = Math.sqrt(nx * nx + ny * ny + nz * nz)

		normals[i] = nx / len
		normals[i + 1] = ny / len
		normals[i + 2] = nz / len
	}

	geometry.attributes.position.needsUpdate = true
	geometry.attributes.normal.needsUpdate = true

	// --- Build heightmap texture (RGBA float: r=x, g=y, b=z, a=1) ---
	{
		const size = terrainSegments + 1
		const data = new Float32Array(size * size * 4)

		// x and z are symmetric: [-terrainSize/2, +terrainSize/2] → [0, 1]
		const half = terrainSize / 2

		// Find min/max Y to normalize height to [0, 1]
		let minH = Infinity
		let maxH = -Infinity
		for (let i = 0; i < positions.length; i += 3) {
			const h = positions[i + 1]
			if (h < minH) minH = h
			if (h > maxH) maxH = h
		}
		const rangeH = maxH - minH || 1
		terrainHeightRange = { minH, maxH }

		// PlaneGeometry vertices are row-major: index = row * size + col
		// DataTexture row 0 = bottom of texture; PlaneGeometry row 0 = far-Z edge.
		// Store directly 1:1 (row 0 of vertices → row 0 of texture data).
		for (let row = 0; row < size; row++) {
			for (let col = 0; col < size; col++) {
				const vIdx = row * size + col
				const px = positions[vIdx * 3 + 0]
				const py = positions[vIdx * 3 + 1]
				const pz = positions[vIdx * 3 + 2]
				const tIdx = vIdx * 4
				data[tIdx + 0] = (px + half) / terrainSize // r = x [0,1]
				data[tIdx + 1] = (py - minH) / rangeH // g = y [0,1]
				data[tIdx + 2] = (pz + half) / terrainSize // b = z [0,1]
				data[tIdx + 3] = 1.0 // a = 1
			}
		}

		if (terrainHeightMap) terrainHeightMap.dispose()
		terrainHeightMap = new THREE.DataTexture(
			data,
			size,
			size,
			THREE.RGBAFormat,
			THREE.FloatType,
		)
		terrainHeightMap.magFilter = THREE.LinearFilter
		terrainHeightMap.minFilter = THREE.LinearFilter
		terrainHeightMap.needsUpdate = true
	}

	const material = new THREE.ShaderMaterial({
		vertexShader: terrainVert,
		fragmentShader: terrainFrag,
		transparent: true,
		side: THREE.DoubleSide,
		// wireframe: true,
		uniforms: {
			uColor: { value: new THREE.Color(config.terrainColor) },
			uTerrainSize: { value: config.terrainSize },
			uFalloffStart: { value: config.terrainFalloffStart },
			uFalloffEnd: { value: config.terrainFalloffEnd },
			uFalloffNoiseScale: { value: config.terrainFalloffNoiseScale },
			uFalloffNoiseStrength: { value: config.terrainFalloffNoiseStrength },
			uDiffuseMap: { value: diffuseMap },
			uNormalMap: { value: normalMap },
			uRoughMap: { value: roughMap },
			uTexScale: { value: config.terrainTexScale },
			uTexOffset: {
				value: new THREE.Vector2(
					config.terrainTexOffsetX,
					config.terrainTexOffsetY,
				),
			},
			uTrailMap: { value: null },
			uTrailMapBlurred: { value: null },
			uTrailColorCore: { value: new THREE.Color(config.trailColorCore) },
			uTrailColorMid: { value: new THREE.Color(config.trailColorMid) },
			uTrailColorEdge: { value: new THREE.Color(config.trailColorEdge) },
			uTrailMaxDist: { value: config.trailMaxDist },
			uTrailFalloffCurve: { value: config.trailFalloffCurve },
			uTrailBlur: { value: config.trailBlur },
			uChromaShift: { value: config.chromaShift },
			uBrightnessStart: { value: config.terrainBrightnessStart },
			uBrightnessMult: { value: config.terrainBrightnessMult },
			uShadowCubeMap: { value: null },
			uShadowMaxDist: { value: config.shadowMaxDist },
			uShadowStrength: { value: config.shadowStrength },
			uShadowBias: { value: config.shadowBias },
		},
	})

	if (terrainMesh) {
		terrainMesh.geometry.dispose()
		terrainMesh.material.dispose()
		terrainMesh.parent?.remove(terrainMesh)
	}

	terrainMesh = new THREE.Mesh(geometry, material)
	terrainMesh.position.y = config.terrainY

	return terrainMesh
}

export function getTerrainMesh() {
	return terrainMesh
}

export function getTerrainHeightMap() {
	return terrainHeightMap
}

export function getTerrainHeightRange() {
	return terrainHeightRange
}
