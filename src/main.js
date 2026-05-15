import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { EffectComposer, RenderPass, ShaderPass } from 'postprocessing'

import { scene, renderer, camera, sizes } from './renderer.js'
import { sphere, sphereMaterial, cubeCamera } from './sphere.js'
import { updateTrail } from './trail.js'
import { createTerrain, getTerrainMesh } from './terrain.js'
import { createBgTerrain, getBgTerrainMesh } from './bgTerrain.js'
import { createBgPlane } from './bgPlane.js'
import {
	setOnTerrainChange,
	setRadialBlurMaterial,
	setOnBgTerrainChange,
} from './gui.js'
import { config } from './config.js'

import radialBlurVert from './shaders/radial-blur.vert'
import radialBlurFrag from './shaders/radial-blur.frag'
import sphereVert from './shaders/sphere.vert'
import sphereMaskFrag from './shaders/sphere-mask.frag'

/**
 * Cubemap background
 */
const cubeTextureLoader = new THREE.CubeTextureLoader()
cubeTextureLoader.setPath('/textures/env/')
const envMap = cubeTextureLoader.load([
	'px.png',
	'nx.png',
	'py.png',
	'ny.png',
	'pz.png',
	'nz.png',
])
scene.background = envMap

/**
 * OrbitControls
 */
const isMobile =
	/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
	('ontouchstart' in window && window.innerWidth < 1024)
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.enabled = !isMobile

/**
 * Add objects to scene
 */
scene.add(sphere)

// const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
// // scene.add(ambientLight)
// const dirLight = new THREE.DirectionalLight(0xffffff, 3.0)
// dirLight.position.set(5, 10, 7)
// // scene.add(dirLight)

function rebuildTerrain() {
	const oldMesh = getTerrainMesh()
	if (oldMesh) scene.remove(oldMesh)
	const newMesh = createTerrain()
	scene.add(newMesh)
}
rebuildTerrain()
setOnTerrainChange(rebuildTerrain)

function rebuildBgTerrain() {
	const oldMesh = getBgTerrainMesh()
	if (oldMesh) scene.remove(oldMesh)
	const newMesh = createBgTerrain()
	scene.add(newMesh)
}
rebuildBgTerrain()
setOnBgTerrainChange(rebuildBgTerrain)

// Background reference plane
const bgPlane = createBgPlane()
scene.add(bgPlane)

/**
 * Mask scene: renders the sphere with trail as a black/white mask
 */
const maskScene = new THREE.Scene()
const maskMaterial = new THREE.ShaderMaterial({
	vertexShader: sphereVert,
	fragmentShader: sphereMaskFrag,
	uniforms: {
		uTrailMap: { value: null },
		uTrailColorCore: sphereMaterial.uniforms.uTrailColorCore,
		uTrailColorMid: sphereMaterial.uniforms.uTrailColorMid,
		uTrailColorEdge: sphereMaterial.uniforms.uTrailColorEdge,
	},
})
const maskSphere = new THREE.Mesh(sphere.geometry, maskMaterial)
maskScene.add(maskSphere)

const maskRT = new THREE.WebGLRenderTarget(sizes.width, sizes.height, {
	minFilter: THREE.LinearFilter,
	magFilter: THREE.LinearFilter,
	format: THREE.RGBAFormat,
	type: THREE.HalfFloatType,
	depthBuffer: true,
})

/**
 * Post-processing: EffectComposer + radial blur ShaderPass
 */
const resolution = new THREE.Vector2()
renderer.getDrawingBufferSize(resolution)

const radialBlurMaterial = new THREE.ShaderMaterial({
	vertexShader: radialBlurVert,
	fragmentShader: radialBlurFrag,
	uniforms: {
		tDiffuse: { value: null },
		uMaskTexture: { value: maskRT.texture },
		uResolution: { value: resolution },
		uSamples: { value: config.radialBlurSamples },
		uReduce: { value: config.radialBlurReduce },
		uStrength: { value: config.radialBlurStrength },
		uColor: { value: new THREE.Color(config.radialBlurColor) },
		uColorDistance: { value: config.radialBlurColorDistance },
		uCenter: { value: new THREE.Vector3(0, 0, 0) },
		uProjectionMatrix: { value: new THREE.Matrix4() },
		uViewMatrix: { value: new THREE.Matrix4() },
	},
})

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const radialBlurPass = new ShaderPass(radialBlurMaterial, 'tDiffuse')
composer.addPass(radialBlurPass)
// const radialBlurPass2 = new ShaderPass(radialBlurMaterial, 'tDiffuse')
// composer.addPass(radialBlurPass2)

export { radialBlurMaterial }

// Connect GUI to radial blur material
setRadialBlurMaterial(radialBlurMaterial)

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
		hitPointNormalized.copy(point).normalize()
		isHitting = true
	} else {
		isHitting = false
	}
}

window.addEventListener('pointermove', onPointerMove)

/**
 * Frame loop
 */
const clock = new THREE.Clock()

function tic() {
	controls.update()

	const { trail: trailTexture, blurred: trailBlurred } = updateTrail(
		renderer,
		hitPointNormalized,
		isHitting,
		clock.getElapsedTime(),
	)
	// trailTexture.wrapS = THREE.RepeatWrapping
	// trailTexture.wrapT = THREE.RepeatWrapping
	sphereMaterial.uniforms.uTrailMap.value = trailTexture

	// Project trail onto terrain
	const terrain = getTerrainMesh()
	if (terrain) {
		terrain.material.uniforms.uTrailMap.value = trailTexture
		terrain.material.uniforms.uTrailMapBlurred.value = trailBlurred
	}

	// Update cube camera for reflections
	sphere.visible = false
	cubeCamera.position.copy(sphere.position)
	renderer.autoClear = true
	cubeCamera.update(renderer, scene)
	renderer.autoClear = false
	sphere.visible = true

	// Render mask scene (sphere trail only, everything else black)
	maskMaterial.uniforms.uTrailMap.value = trailTexture
	renderer.setRenderTarget(maskRT)
	renderer.setClearColor(0x000000, 1)
	renderer.clear()
	renderer.render(maskScene, camera)
	renderer.setRenderTarget(null)

	// Update radial blur uniforms
	radialBlurMaterial.uniforms.uProjectionMatrix.value.copy(
		camera.projectionMatrix,
	)
	radialBlurMaterial.uniforms.uViewMatrix.value.copy(camera.matrixWorldInverse)

	// Render scene via composer (RenderPass + radial blur)
	composer.render()

	requestAnimationFrame(tic)
}

requestAnimationFrame(tic)

/**
 * Handle resize for post-processing resources
 */
window.addEventListener('resize', () => {
	maskRT.setSize(sizes.width, sizes.height)
	composer.setSize(sizes.width, sizes.height)
	renderer.getDrawingBufferSize(resolution)
})
