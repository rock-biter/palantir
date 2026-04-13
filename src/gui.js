import { Pane } from 'tweakpane'
import { config } from './config.js'
import { diffusionMaterial } from './trail.js'
import { sphereMaterial, rebuildSphere } from './sphere.js'

export const pane = new Pane()

// --- Trail folder ---
const trailFolder = pane.addFolder({ title: 'Trail' })
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
const sphereFolder = pane.addFolder({ title: 'Sphere' })
sphereFolder.addBinding(config, 'sphereRadius', {
	label: 'radius',
	min: 0.5,
	max: 5.0,
	step: 0.1,
})
sphereFolder.on('change', () => {
	rebuildSphere()
})

// --- Terrain folder ---
let onTerrainChange = null

const terrainFolder = pane.addFolder({ title: 'Terrain' })
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

export function setOnTerrainChange(cb) {
	onTerrainChange = cb
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
