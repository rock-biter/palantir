import * as THREE from 'three'

export const sizes = {
	width: window.innerWidth,
	height: window.innerHeight,
}

export const scene = new THREE.Scene()

export const renderer = new THREE.WebGLRenderer({
	antialias: window.devicePixelRatio < 2,
})
document.body.appendChild(renderer.domElement)

const fov = 60
export const camera = new THREE.PerspectiveCamera(
	fov,
	sizes.width / sizes.height,
	0.1,
	150,
)
camera.position.set(-14, 0.5, -8)
camera.lookAt(new THREE.Vector3(0, 0, 0))

export function handleResize() {
	sizes.width = window.innerWidth
	sizes.height = window.innerHeight

	camera.aspect = sizes.width / sizes.height
	camera.updateProjectionMatrix()

	renderer.setSize(sizes.width, sizes.height)

	const pixelRatio = Math.min(window.devicePixelRatio, 2)
	renderer.setPixelRatio(pixelRatio)
}

handleResize()
window.addEventListener('resize', handleResize)
