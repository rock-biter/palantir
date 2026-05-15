import * as THREE from 'three'
import { config } from './config.js'

import grassShadowVert from './shaders/grass-shadow.vert'
import grassShadowFrag from './shaders/grass-shadow.frag'
import terrainShadowVert from './shaders/terrain-shadow.vert'
import terrainShadowFrag from './shaders/terrain-shadow.frag'

export const SHADOW_MAX_DIST = config.shadowMaxDist

// --- Cube render target ---
const shadowCubeRT = new THREE.WebGLCubeRenderTarget(config.shadowResolution, {
	generateMipmaps: false,
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
	type: THREE.HalfFloatType,
})
export const shadowCubeCamera = new THREE.CubeCamera(
	0.1,
	SHADOW_MAX_DIST,
	shadowCubeRT,
)
export const shadowCubeTexture = shadowCubeRT.texture

// --- Shadow scene (only shadow casters, no sphere) ---
const shadowScene = new THREE.Scene()

// --- Terrain shadow ---
const terrainShadowMaterial = new THREE.ShaderMaterial({
	vertexShader: terrainShadowVert,
	fragmentShader: terrainShadowFrag,
	uniforms: {
		uShadowMaxDist: { value: SHADOW_MAX_DIST },
	},
	side: THREE.DoubleSide,
})

let terrainShadowMesh = null

export function rebuildTerrainShadowMesh(terrainMesh) {
	if (terrainShadowMesh) {
		shadowScene.remove(terrainShadowMesh)
		terrainShadowMesh = null
	}
	if (!terrainMesh) return

	terrainShadowMesh = new THREE.Mesh(
		terrainMesh.geometry,
		terrainShadowMaterial,
	)
	// Copy world transform so the shadow mesh sits at the same position as the real terrain
	terrainMesh.updateWorldMatrix(true, false)
	terrainShadowMesh.matrix.copy(terrainMesh.matrixWorld)
	terrainShadowMesh.matrixAutoUpdate = false
	shadowScene.add(terrainShadowMesh)
}

// --- Grass shadow ---
let grassShadowMesh = null

export function rebuildGrassShadowMesh(grassMesh) {
	if (grassShadowMesh) {
		// Dispose the material we created, but NOT the shared geometry/instanceMatrix
		if (grassShadowMesh.material) grassShadowMesh.material.dispose()
		shadowScene.remove(grassShadowMesh)
		grassShadowMesh = null
	}
	if (!grassMesh) return

	// Share uniform objects from the live grass material so uTime/wind sync automatically
	const gm = grassMesh.material
	const grassShadowMaterial = new THREE.ShaderMaterial({
		vertexShader: grassShadowVert,
		fragmentShader: grassShadowFrag,
		side: THREE.DoubleSide,
		uniforms: {
			uHeightMap: gm.uniforms.uHeightMap,
			uTerrainSize: gm.uniforms.uTerrainSize,
			uTerrainMinH: gm.uniforms.uTerrainMinH,
			uTerrainMaxH: gm.uniforms.uTerrainMaxH,
			uTerrainY: gm.uniforms.uTerrainY,
			uTime: gm.uniforms.uTime, // shared ref → auto-syncs with updateGrassTime()
			uWindFrequency: gm.uniforms.uWindFrequency,
			uWindSpeed: gm.uniforms.uWindSpeed,
			uWindStrength: gm.uniforms.uWindStrength,
			uGrassHeightMax: gm.uniforms.uGrassHeightMax,
			uGrassTexture: gm.uniforms.uGrassTexture,
			uFbmColorMap: gm.uniforms.uFbmColorMap,
			uFrayStrength: gm.uniforms.uFrayStrength,
			uShadowMaxDist: { value: SHADOW_MAX_DIST },
		},
	})

	// Share the instance buffer — no copy needed
	grassShadowMesh = new THREE.InstancedMesh(
		grassMesh.geometry,
		grassShadowMaterial,
		grassMesh.count,
	)
	grassShadowMesh.instanceMatrix = grassMesh.instanceMatrix
	grassShadowMesh.count = grassMesh.count
	grassShadowMesh.frustumCulled = false
	shadowScene.add(grassShadowMesh)
}

// --- Per-frame update ---
export function updateShadowMap(renderer) {
	shadowCubeCamera.position.set(0, 0, 0)
	const prevAutoClear = renderer.autoClear
	renderer.autoClear = true
	shadowCubeCamera.update(renderer, shadowScene)
	renderer.autoClear = prevAutoClear
}
