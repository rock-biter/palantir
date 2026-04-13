import * as THREE from 'three'
import { config } from './config.js'

import diffusionVert from './shaders/diffusion.vert'
import diffusionFrag from './shaders/diffusion.frag'

const SIM_RES = 512
const rtOptions = {
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
	format: THREE.RGBAFormat,
	type: THREE.FloatType,
}
const rtA = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions)
const rtB = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions)
let currentRT = rtA
let prevRT = rtB

export const diffusionMaterial = new THREE.ShaderMaterial({
	vertexShader: diffusionVert,
	fragmentShader: diffusionFrag,
	uniforms: {
		uPrevFrame: { value: null },
		uResolution: { value: new THREE.Vector2(SIM_RES, SIM_RES) },
		uHitPoint: { value: new THREE.Vector3(0, 0, 0) },
		uBrushSize: { value: config.brushSize },
		uBrushStrength: { value: config.brushStrength },
		uDiffusion: { value: config.diffusion },
		uDecay: { value: config.decay },
		uWaveSpeed: { value: config.waveSpeed },
		uWaveDamping: { value: config.waveDamping },
		uIsHitting: { value: 0.0 },
		uTime: { value: 0.0 },
		uCurlScale: { value: config.curlScale },
		uCurlSpeed: { value: config.curlSpeed },
		uCurlStrength: { value: config.curlStrength },
	},
})

const quadGeometry = new THREE.PlaneGeometry(2, 2)
const quadMesh = new THREE.Mesh(quadGeometry, diffusionMaterial)
const quadScene = new THREE.Scene()
quadScene.add(quadMesh)
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

export function updateTrail(renderer, hitPointNormalized, isHitting, time) {
	diffusionMaterial.uniforms.uTime.value = time
	diffusionMaterial.uniforms.uPrevFrame.value = prevRT.texture
	diffusionMaterial.uniforms.uHitPoint.value.copy(hitPointNormalized)
	diffusionMaterial.uniforms.uIsHitting.value = isHitting ? 1.0 : 0.0

	renderer.setRenderTarget(currentRT)
	renderer.render(quadScene, quadCamera)
	renderer.setRenderTarget(null)

	const texture = currentRT.texture

	// Swap buffers
	const temp = currentRT
	currentRT = prevRT
	prevRT = temp

	return texture
}
