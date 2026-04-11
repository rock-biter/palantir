import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { Pane } from 'tweakpane'

import diffusionVert from './shaders/diffusion.vert'
import diffusionFrag from './shaders/diffusion.frag'
import sphereVert from './shaders/sphere.vert'
import sphereFrag from './shaders/sphere.frag'

/**
 * Config
 */
const config = {
	brushSize: 0.2,
	brushStrength: 0.5,
	diffusion: 0.13,
	decay: 0.96,
	waveSpeed: 0.6,
	waveDamping: 0.13,
	curlScale: 2.0,
	curlSpeed: 0.4,
	curlStrength: 0.0035,
	trailColorCore: '#07ff00',
	trailColorMid: '#8a0000',
	trailColorEdge: '#1a7fff',
	baseColor: '#ff2f00',
}

const pane = new Pane()
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

/**
 * Scene
 */
const scene = new THREE.Scene()

const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
}

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
	antialias: window.devicePixelRatio < 2,
})
document.body.appendChild(renderer.domElement)

/**
 * Camera
 */
const fov = 60
const camera = new THREE.PerspectiveCamera(
	fov,
	sizes.width / sizes.height,
	0.1,
	100,
)
camera.position.set(4, 4, 4)
camera.lookAt(new THREE.Vector3(0, 0, 0))

/**
 * OrbitControls
 */
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

/**
 * Ping-pong render targets for trail diffusion
 */
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

/**
 * Full-screen quad for diffusion pass
 */
const diffusionMaterial = new THREE.ShaderMaterial({
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

/**
 * Sphere with trail material
 */
const SPHERE_RADIUS = 2
const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 128, 128)
const sphereMaterial = new THREE.ShaderMaterial({
	vertexShader: sphereVert,
	fragmentShader: sphereFrag,
	uniforms: {
		uTrailMap: { value: rtA.texture },
		uBaseColor: { value: new THREE.Color(config.baseColor) },
		uTrailColorCore: { value: new THREE.Color(config.trailColorCore) },
		uTrailColorMid: { value: new THREE.Color(config.trailColorMid) },
		uTrailColorEdge: { value: new THREE.Color(config.trailColorEdge) },
	},
})
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
scene.add(sphere)

/**
 * Raycasting
 */
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let isHitting = false
const hitPointNormalized = new THREE.Vector3()

function onPointerMove(event) {
	mouse.x = (event.clientX / sizes.width) * 2 - 1
	mouse.y = -(event.clientY / sizes.height) * 2 + 1

	raycaster.setFromCamera(mouse, camera)
	const intersects = raycaster.intersectObject(sphere)

	if (intersects.length > 0) {
		const point = intersects[0].point.clone()
		// Normalize to unit sphere direction (sphere is at origin)
		hitPointNormalized.copy(point).normalize()
		isHitting = true
	} else {
		isHitting = false
	}
}

window.addEventListener('pointermove', onPointerMove)

/**
 * Update tweakpane -> uniforms
 */
pane.on('change', () => {
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

/**
 * Frame loop
 */
const clock = new THREE.Clock()

function tic() {
	controls.update()

	diffusionMaterial.uniforms.uTime.value = clock.getElapsedTime()

	// --- Diffusion pass (ping-pong) ---
	diffusionMaterial.uniforms.uPrevFrame.value = prevRT.texture
	diffusionMaterial.uniforms.uHitPoint.value.copy(hitPointNormalized)
	diffusionMaterial.uniforms.uIsHitting.value = isHitting ? 1.0 : 0.0

	renderer.setRenderTarget(currentRT)
	renderer.render(quadScene, quadCamera)
	renderer.setRenderTarget(null)

	// Bind the freshly rendered trail to the sphere material
	sphereMaterial.uniforms.uTrailMap.value = currentRT.texture

	// Swap buffers
	const temp = currentRT
	currentRT = prevRT
	prevRT = temp

	// --- Main scene pass ---
	renderer.render(scene, camera)

	requestAnimationFrame(tic)
}

handleResize()
requestAnimationFrame(tic)

window.addEventListener('resize', handleResize)

function handleResize() {
	sizes.width = window.innerWidth
	sizes.height = window.innerHeight

	camera.aspect = sizes.width / sizes.height
	camera.updateProjectionMatrix()

	renderer.setSize(sizes.width, sizes.height)

	const pixelRatio = Math.min(window.devicePixelRatio, 2)
	renderer.setPixelRatio(pixelRatio)
}
