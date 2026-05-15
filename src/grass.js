import * as THREE from 'three'
import { config } from './config.js'
import { getTerrainHeightMap, getTerrainHeightRange } from './terrain.js'

import grassVert from './shaders/grass.vert'
import grassFrag from './shaders/grass.frag'

const grassTexture = new THREE.TextureLoader().load(
	'/textures/grass/grass-2.png',
)
grassTexture.wrapS = THREE.ClampToEdgeWrapping
grassTexture.wrapT = THREE.ClampToEdgeWrapping

const fbmColorTexture = new THREE.TextureLoader().load('/textures/fbm-color.png')
fbmColorTexture.wrapS = THREE.RepeatWrapping
fbmColorTexture.wrapT = THREE.RepeatWrapping

// ---- CPU-side value noise for patch distribution ----

function hash2D(x, y) {
	const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
	return n - Math.floor(n)
}

function valueNoise2D(x, y) {
	const ix = Math.floor(x),
		iy = Math.floor(y)
	const fx = x - ix,
		fy = y - iy
	const ux = fx * fx * (3.0 - 2.0 * fx)
	const uy = fy * fy * (3.0 - 2.0 * fy)
	return (
		hash2D(ix, iy) * (1 - ux) * (1 - uy) +
		hash2D(ix + 1, iy) * ux * (1 - uy) +
		hash2D(ix, iy + 1) * (1 - ux) * uy +
		hash2D(ix + 1, iy + 1) * ux * uy
	)
}

function fbmPatch(x, y) {
	let v = 0.0,
		a = 0.5,
		px = x,
		py = y
	for (let i = 0; i < 4; i++) {
		v += a * valueNoise2D(px, py)
		px *= 2.1
		py *= 2.1
		a *= 0.5
	}
	return v // range [0, ~0.94]
}

function smoothstep(a, b, x) {
	const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
	return t * t * (3 - 2 * t)
}

// ---- Blade geometry ----
// Thin plane (width=1, height=1) with `verticalSegments` rows and 1 column.
// Vertices are shifted so the pivot sits at the bottom edge (y ∈ [0, 1]).

function createBladeGeometry(verticalSegments) {
	const geom = new THREE.PlaneGeometry(1, 1, 1, verticalSegments)
	const pos = geom.attributes.position.array
	for (let i = 0; i < pos.length; i += 3) {
		pos[i + 1] += 0.5 // shift: [-0.5, 0.5] → [0, 1]
	}
	geom.attributes.position.needsUpdate = true
	return geom
}

// ---- Module state ----

let grassMesh = null

// ---- Public API ----

export function createGrass() {
	const {
		terrainSize,
		terrainY,
		terrainFalloffStart,
		grassCount,
		grassPatchFrequency,
		grassPatchThreshold,
		grassHeightMin,
		grassHeightMax,
		grassWidthMin,
		grassWidthMax,
		grassWindFrequency,
		grassWindSpeed,
		grassWindStrength,
		grassSphereExclusion,
		grassOuterRadiusFactor,
		grassColorBase,
		grassColorTip,
		grassTrailStrength,
		grassFalloffDistance,
		grassFalloffPower,
		grassColorVariation,
		trailMaxDist,
		trailFalloffCurve,
		trailColorMid,
	} = config

	const heightMap = getTerrainHeightMap()
	const { minH, maxH } = getTerrainHeightRange()

	const bladeGeom = createBladeGeometry(10)

	const material = new THREE.ShaderMaterial({
		vertexShader: grassVert,
		fragmentShader: grassFrag,
		side: THREE.DoubleSide,
		uniforms: {
			uHeightMap: { value: heightMap },
			uTerrainSize: { value: terrainSize },
			uTerrainMinH: { value: minH },
			uTerrainMaxH: { value: maxH },
			uTerrainY: { value: terrainY },
			uTime: { value: 0.0 },
			uWindFrequency: { value: grassWindFrequency },
			uWindSpeed: { value: grassWindSpeed },
			uWindStrength: { value: grassWindStrength },
			uGrassHeightMax: { value: grassHeightMax },
			uColorBase: { value: new THREE.Color(grassColorBase) },
			uColorTip: { value: new THREE.Color(grassColorTip) },
			uTrailMap: { value: null },
			uTrailMapBlurred: { value: null },
			uTrailColorMid: { value: new THREE.Color(trailColorMid) },
			uTrailMaxDist: { value: trailMaxDist },
			uTrailFalloffCurve: { value: trailFalloffCurve },
			uTrailStrength: { value: grassTrailStrength },
			uGrassFalloffDistance: { value: grassFalloffDistance },
			uGrassFalloffPower: { value: grassFalloffPower },
			uColorVariation: { value: grassColorVariation },
			uGrassTexture: { value: grassTexture },
			uFbmColorMap: { value: fbmColorTexture },
			uFbmColorStrength: { value: config.grassFbmColorStrength },
		},
	})

	// Grass only fills the terrain's solid area (inside the falloff ring)
	const outerRadius = terrainSize * 0.5 * grassOuterRadiusFactor
	const maxAttempts = grassCount * 30

	const dummy = new THREE.Object3D()
	const mesh = new THREE.InstancedMesh(bladeGeom, material, grassCount)
	mesh.frustumCulled = false

	let count = 0

	for (
		let attempt = 0;
		attempt < maxAttempts && count < grassCount;
		attempt++
	) {
		const x = (Math.random() * 2 - 1) * outerRadius
		const z = (Math.random() * 2 - 1) * outerRadius
		const r = Math.sqrt(x * x + z * z)

		// Hard exclusion around the central sphere
		if (r < grassSphereExclusion) continue

		// Stay within the terrain's solid area
		if (r > outerRadius) continue

		// Distance-based density: sparse near the sphere, dense at the outer edge
		const distDensity = smoothstep(grassSphereExclusion + 1.0, outerRadius, r)

		// Patch noise: creates natural-looking clumps
		const patch = fbmPatch(x * grassPatchFrequency, z * grassPatchFrequency)
		if (patch < grassPatchThreshold) continue

		// Stochastic rejection by distance density
		if (Math.random() > distDensity) continue

		// Per-blade random dimensions and Y-axis orientation
		const hRand = Math.random()
		const height = grassHeightMin + hRand * (grassHeightMax - grassHeightMin)
		const width = grassWidthMin + hRand * 0.5 * (grassWidthMax - grassWidthMin)
		const rotY = Math.random() * Math.PI * 2

		dummy.position.set(x, 0, z)
		dummy.rotation.set(0, rotY, 0)
		dummy.scale.set(width, height, 1)
		dummy.updateMatrix()
		mesh.setMatrixAt(count, dummy.matrix)
		count++
	}

	mesh.count = count
	mesh.instanceMatrix.needsUpdate = true

	if (grassMesh) {
		grassMesh.geometry.dispose()
		grassMesh.material.dispose()
		grassMesh.parent?.remove(grassMesh)
	}

	grassMesh = mesh
	return mesh
}

export function getGrassMesh() {
	return grassMesh
}

/** Call every frame with the elapsed time to animate wind. */
export function updateGrassTime(time) {
	if (grassMesh) grassMesh.material.uniforms.uTime.value = time
}
