import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import { scene, renderer, camera, sizes } from './renderer.js'
import { sphere, sphereMaterial } from './sphere.js'
import { updateTrail } from './trail.js'
import { createTerrain, getTerrainMesh } from './terrain.js'
import { setOnTerrainChange } from './gui.js'

/**
 * OrbitControls
 */
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true

/**
 * Add objects to scene
 */
scene.add(sphere)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3)
scene.add(ambientLight)
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
dirLight.position.set(5, 10, 7)
scene.add(dirLight)

function rebuildTerrain() {
	const oldMesh = getTerrainMesh()
	if (oldMesh) scene.remove(oldMesh)
	const newMesh = createTerrain()
	scene.add(newMesh)
}
rebuildTerrain()
setOnTerrainChange(rebuildTerrain)

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

	const trailTexture = updateTrail(
		renderer,
		hitPointNormalized,
		isHitting,
		clock.getElapsedTime(),
	)
	sphereMaterial.uniforms.uTrailMap.value = trailTexture

	renderer.render(scene, camera)

	requestAnimationFrame(tic)
}

requestAnimationFrame(tic)
