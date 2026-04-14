import { Pane } from 'tweakpane'
import { config } from './config.js'
import { diffusionMaterial } from './trail.js'
import { sphereMaterial, rebuildSphere, rebuildCubeCamera } from './sphere.js'
import { getTerrainMesh } from './terrain.js'

export const pane = new Pane()

// --- Trail folder ---
const trailFolder = pane.addFolder({ title: 'Trail', expanded: false })
trailFolder.addBinding(config, 'brushSize', { min: 0.01, max: 0.5, step: 0.01 })
trailFolder.addBinding(config, 'brushStrength', {
	min: 0.1,
	max: 1.0,
	step: 0.05,
})
trailFolder.addBinding(config, 'diffusion', { min: 0.0, max: 2.0, step: 0.01 })
trailFolder.addBinding(config, 'decay', { min: 0.9, max: 1.0, step: 0.001 })
trailFolder.addBinding(config, 'waveSpeed', { min: 0.0, max: 1.0, step: 0.01 })
trailFolder.addBinding(config, 'waveDamping', {
	min: 0.0,
	max: 0.2,
	step: 0.005,
})
trailFolder.addBinding(config, 'curlScale', { min: 0.5, max: 10.0, step: 0.1 })
trailFolder.addBinding(config, 'curlSpeed', { min: 0.0, max: 3.0, step: 0.05 })
trailFolder.addBinding(config, 'curlStrength', {
	min: 0.0,
	max: 0.02,
	step: 0.0005,
})
trailFolder.addBinding(config, 'trailColorCore')
trailFolder.addBinding(config, 'trailColorMid')
trailFolder.addBinding(config, 'trailColorEdge')
trailFolder.addBinding(config, 'baseColor')

// --- Sphere folder ---
const sphereFolder = pane.addFolder({ title: 'Sphere', expanded: false })
sphereFolder.addBinding(config, 'sphereRadius', {
	label: 'radius',
	min: 0.5,
	max: 5.0,
	step: 0.1,
})
sphereFolder.on('change', () => {
	rebuildSphere()
})

// --- Reflection folder ---
const reflectionFolder = pane.addFolder({
	title: 'Reflection',
	expanded: false,
})
reflectionFolder.addBinding(config, 'cubeCameraResolution', {
	label: 'resolution',
	min: 32,
	max: 512,
	step: 32,
})
reflectionFolder.addBinding(config, 'fresnelExponent', {
	label: 'fresnel exponent',
	min: 0.1,
	max: 10.0,
	step: 0.1,
})
reflectionFolder.addBinding(config, 'reflectionIntensity', {
	label: 'intensity',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
reflectionFolder.on('change', (ev) => {
	if (ev.presetKey === 'cubeCameraResolution') {
		rebuildCubeCamera()
	}
	sphereMaterial.uniforms.uFresnelExponent.value = config.fresnelExponent
	sphereMaterial.uniforms.uReflectionIntensity.value =
		config.reflectionIntensity
})

// --- Terrain folder ---
let onTerrainChange = null

const terrainFolder = pane.addFolder({ title: 'Terrain', expanded: false })
terrainFolder.addBinding(config, 'terrainY', {
	label: 'position Y',
	min: -10.0,
	max: 10.0,
	step: 0.1,
})
terrainFolder.addBinding(config, 'terrainHeight', {
	label: 'height',
	min: 0.0,
	max: 10.0,
	step: 0.1,
})
terrainFolder.addBinding(config, 'terrainOctaves', {
	label: 'octaves',
	min: 1,
	max: 10,
	step: 1,
})
terrainFolder.addBinding(config, 'terrainFrequency', {
	label: 'frequency',
	min: 0.005,
	max: 0.5,
	step: 0.005,
})
terrainFolder.addBinding(config, 'terrainLacunarity', {
	label: 'lacunarity',
	min: 1.0,
	max: 4.0,
	step: 0.1,
})
terrainFolder.addBinding(config, 'terrainGain', {
	label: 'gain',
	min: 0.1,
	max: 0.9,
	step: 0.05,
})
terrainFolder.addBinding(config, 'terrainColor', { label: 'color' })
terrainFolder.addBinding(config, 'terrainSize', {
	label: 'size',
	min: 10,
	max: 100,
	step: 1,
})
terrainFolder.addBinding(config, 'terrainSegments', {
	label: 'segments',
	min: 32,
	max: 512,
	step: 32,
})
terrainFolder.addBinding(config, 'terrainNoiseOffsetX', {
	label: 'noise offset X',
	min: -100.0,
	max: 100.0,
	step: 0.01,
})
terrainFolder.addBinding(config, 'terrainNoiseOffsetY', {
	label: 'noise offset Y',
	min: -100.0,
	max: 100.0,
	step: 0.01,
})
terrainFolder.addBinding(config, 'terrainFalloffStart', {
	label: 'falloff start',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
terrainFolder.addBinding(config, 'terrainFalloffEnd', {
	label: 'falloff end',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
terrainFolder.addBinding(config, 'terrainFalloffNoiseScale', {
	label: 'falloff noise scale',
	min: 0.5,
	max: 20.0,
	step: 0.5,
})
terrainFolder.addBinding(config, 'terrainFalloffNoiseStrength', {
	label: 'falloff noise str',
	min: 0.0,
	max: 0.5,
	step: 0.01,
})
terrainFolder.addBinding(config, 'terrainTexScale', {
	label: 'tex scale',
	min: 0.5,
	max: 40.0,
	step: 0.5,
})
terrainFolder.addBinding(config, 'terrainTexOffsetX', {
	label: 'tex offset X',
	min: -10.0,
	max: 10.0,
	step: 0.1,
})
terrainFolder.addBinding(config, 'terrainTexOffsetY', {
	label: 'tex offset Y',
	min: -10.0,
	max: 10.0,
	step: 0.1,
})

// --- Trail Light folder ---
const trailLightFolder = pane.addFolder({
	title: 'Trail Light',
	expanded: false,
})
trailLightFolder.addBinding(config, 'trailMaxDist', {
	label: 'max distance',
	min: 1.0,
	max: 50.0,
	step: 0.5,
})
trailLightFolder.addBinding(config, 'trailFalloffCurve', {
	label: 'falloff curve',
	min: 0.1,
	max: 5.0,
	step: 0.1,
})
trailLightFolder.addBinding(config, 'trailBlur', {
	label: 'blur',
	min: 0.0,
	max: 8.0,
	step: 0.1,
})
trailLightFolder.addBinding(config, 'chromaShift', {
	label: 'chroma shift',
	min: 0.0,
	max: 0.3,
	step: 0.005,
})

trailLightFolder.on('change', () => {
	const terrain = getTerrainMesh()
	if (terrain) {
		terrain.material.uniforms.uTrailMaxDist.value = config.trailMaxDist
		terrain.material.uniforms.uTrailFalloffCurve.value =
			config.trailFalloffCurve
		terrain.material.uniforms.uTrailBlur.value = config.trailBlur
		terrain.material.uniforms.uChromaShift.value = config.chromaShift
	}
})

// --- Radial Blur folder ---
let radialBlurMaterialRef = null

const radialBlurFolder = pane.addFolder({
	title: 'Radial Blur',
	expanded: false,
})
radialBlurFolder.addBinding(config, 'radialBlurSamples', {
	label: 'samples',
	min: 1,
	max: 160,
	step: 1,
})
radialBlurFolder.addBinding(config, 'radialBlurReduce', {
	label: 'reduce',
	min: 0.01,
	max: 1.0,
	step: 0.01,
})
radialBlurFolder.addBinding(config, 'radialBlurStrength', {
	label: 'strength',
	min: 0.0,
	max: 3.0,
	step: 0.01,
})
radialBlurFolder.addBinding(config, 'radialBlurColor', {
	label: 'color',
})
radialBlurFolder.addBinding(config, 'radialBlurColorDistance', {
	label: 'color distance',
	min: 0.0,
	max: 10.0,
	step: 0.01,
})

radialBlurFolder.on('change', () => {
	if (radialBlurMaterialRef) {
		radialBlurMaterialRef.uniforms.uSamples.value = config.radialBlurSamples
		radialBlurMaterialRef.uniforms.uReduce.value = config.radialBlurReduce
		radialBlurMaterialRef.uniforms.uStrength.value = config.radialBlurStrength
		radialBlurMaterialRef.uniforms.uColor.value.set(config.radialBlurColor)
		radialBlurMaterialRef.uniforms.uColorDistance.value =
			config.radialBlurColorDistance
	}
})

export function setRadialBlurMaterial(mat) {
	radialBlurMaterialRef = mat
}

export function setOnTerrainChange(cb) {
	onTerrainChange = cb
}

// --- Background Terrain folder ---
let onBgTerrainChange = null

const bgTerrainFolder = pane.addFolder({
	title: 'Background Terrain',
	expanded: false,
})
bgTerrainFolder.addBinding(config, 'bgTerrainY', {
	label: 'position Y',
	min: -20.0,
	max: 10.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainHeight', {
	label: 'height',
	min: 0.0,
	max: 30.0,
	step: 0.5,
})
bgTerrainFolder.addBinding(config, 'bgTerrainOctaves', {
	label: 'octaves',
	min: 1,
	max: 8,
	step: 1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainFrequency', {
	label: 'frequency',
	min: 0.001,
	max: 0.1,
	step: 0.001,
})
bgTerrainFolder.addBinding(config, 'bgTerrainLacunarity', {
	label: 'lacunarity',
	min: 1.0,
	max: 4.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainGain', {
	label: 'gain',
	min: 0.1,
	max: 0.9,
	step: 0.05,
})
bgTerrainFolder.addBinding(config, 'bgTerrainColor', { label: 'color' })
bgTerrainFolder.addBinding(config, 'bgTerrainSize', {
	label: 'size',
	min: 50,
	max: 500,
	step: 10,
})
bgTerrainFolder.addBinding(config, 'bgTerrainSegments', {
	label: 'segments',
	min: 16,
	max: 128,
	step: 16,
})
bgTerrainFolder.addBinding(config, 'bgTerrainNoiseOffsetX', {
	label: 'noise offset X',
	min: -100.0,
	max: 100.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainNoiseOffsetY', {
	label: 'noise offset Y',
	min: -100.0,
	max: 100.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainFalloffStart', {
	label: 'falloff start',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
bgTerrainFolder.addBinding(config, 'bgTerrainFalloffEnd', {
	label: 'falloff end',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
bgTerrainFolder.addBinding(config, 'bgTerrainFalloffNoiseScale', {
	label: 'falloff noise scale',
	min: 0.5,
	max: 20.0,
	step: 0.5,
})
bgTerrainFolder.addBinding(config, 'bgTerrainFalloffNoiseStrength', {
	label: 'falloff noise str',
	min: 0.0,
	max: 0.5,
	step: 0.01,
})
bgTerrainFolder.addBinding(config, 'bgTerrainTexScale', {
	label: 'tex scale',
	min: 0.5,
	max: 40.0,
	step: 0.5,
})
bgTerrainFolder.addBinding(config, 'bgTerrainTexOffsetX', {
	label: 'tex offset X',
	min: -10.0,
	max: 10.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainTexOffsetY', {
	label: 'tex offset Y',
	min: -10.0,
	max: 10.0,
	step: 0.1,
})
bgTerrainFolder.addBinding(config, 'bgTerrainEdgeStart', {
	label: 'edge start',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
bgTerrainFolder.addBinding(config, 'bgTerrainEdgeEnd', {
	label: 'edge end',
	min: 0.0,
	max: 1.0,
	step: 0.01,
})
bgTerrainFolder.addBinding(config, 'bgTerrainEdgeHeight', {
	label: 'edge height',
	min: 0.0,
	max: 40.0,
	step: 0.5,
})

bgTerrainFolder.on('change', () => {
	if (onBgTerrainChange) onBgTerrainChange()
})

export function setOnBgTerrainChange(cb) {
	onBgTerrainChange = cb
}

// --- Sync trail uniforms on change ---
trailFolder.on('change', () => {
	diffusionMaterial.uniforms.uBrushSize.value = config.brushSize
	diffusionMaterial.uniforms.uBrushStrength.value = config.brushStrength
	diffusionMaterial.uniforms.uDiffusion.value = config.diffusion
	diffusionMaterial.uniforms.uDecay.value = config.decay
	diffusionMaterial.uniforms.uWaveSpeed.value = config.waveSpeed
	diffusionMaterial.uniforms.uWaveDamping.value = config.waveDamping
	diffusionMaterial.uniforms.uCurlScale.value = config.curlScale
	diffusionMaterial.uniforms.uCurlSpeed.value = config.curlSpeed
	diffusionMaterial.uniforms.uCurlStrength.value = config.curlStrength
	sphereMaterial.uniforms.uBaseColor.value.set(config.baseColor)
	sphereMaterial.uniforms.uTrailColorCore.value.set(config.trailColorCore)
	sphereMaterial.uniforms.uTrailColorMid.value.set(config.trailColorMid)
	sphereMaterial.uniforms.uTrailColorEdge.value.set(config.trailColorEdge)
})

// --- Rebuild terrain on terrain param change ---
terrainFolder.on('change', () => {
	if (onTerrainChange) onTerrainChange()
})
