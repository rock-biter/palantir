import * as THREE from 'three'
import { config } from './config.js'

const textureLoader = new THREE.TextureLoader()

let bgPlaneMesh = null

export function createBgPlane() {
	const tex = textureLoader.load(
		'/textures/background-example.webp',
		(texture) => {
			const aspect = texture.image.width / texture.image.height
			bgPlaneMesh.geometry.dispose()
			bgPlaneMesh.geometry = new THREE.PlaneGeometry(aspect, 1)
			applyConfig()
		},
	)

	tex.colorSpace = THREE.SRGBColorSpace

	const material = new THREE.MeshBasicMaterial({
		map: tex,
		side: THREE.DoubleSide,
		transparent: true,
	})

	// Temporary 1:1 geometry until image loads
	const geometry = new THREE.PlaneGeometry(1, 1)
	bgPlaneMesh = new THREE.Mesh(geometry, material)
	bgPlaneMesh.visible = config.bgPlaneVisible

	applyConfig()

	return bgPlaneMesh
}

export function applyBgPlaneConfig() {
	applyConfig()
}

function applyConfig() {
	if (!bgPlaneMesh) return
	bgPlaneMesh.visible = config.bgPlaneVisible
	bgPlaneMesh.scale.setScalar(config.bgPlaneScale)
	bgPlaneMesh.position.y = config.bgPlaneY
	bgPlaneMesh.position.z = config.bgPlaneZ
}

export function getBgPlaneMesh() {
	return bgPlaneMesh
}
