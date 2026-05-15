import * as THREE from 'three'
import { config } from './config.js'

import diffusionVert from './shaders/diffusion.vert'
import diffusionFrag from './shaders/diffusion.frag'
import { KawaseBlur } from './kawaseBlur.js'

const SIM_RES = 512
const rtOptions = {
	minFilter: THREE.LinearMipmapLinearFilter,
	magFilter: THREE.LinearFilter,
	format: THREE.RGBAFormat,
	type: THREE.FloatType,
	generateMipmaps: true,
}
const rtA = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions)
const rtB = new THREE.WebGLRenderTarget(SIM_RES, SIM_RES, rtOptions)
// RepeatWrapping on U so the first Kawase pass can bilinear-sample
// across the spherical seam (u=0 == u=1) without clamping.
rtA.texture.wrapS = THREE.RepeatWrapping
rtB.texture.wrapS = THREE.RepeatWrapping
let currentRT = rtA
let prevRT = rtB

const kawaseBlur = new KawaseBlur(SIM_RES, SIM_RES)

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

	// Manually generate mipmaps for LOD sampling in terrain shader
	const gl = renderer.getContext()
	const texProps = renderer.properties.get(currentRT.texture)
	if (texProps.__webglTexture) {
		gl.bindTexture(gl.TEXTURE_2D, texProps.__webglTexture)
		gl.generateMipmap(gl.TEXTURE_2D)
		gl.bindTexture(gl.TEXTURE_2D, null)
	}

	const trail = currentRT.texture

	// Swap diffusion buffers
	const temp = currentRT
	currentRT = prevRT
	prevRT = temp

	// Run Kawase blur for a seam-free blurred version of the trail
	const blurred = kawaseBlur.render(renderer, trail)

	return { trail, blurred }
}
