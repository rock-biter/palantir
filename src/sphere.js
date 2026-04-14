import * as THREE from 'three'
import { config } from './config.js'

import sphereVert from './shaders/sphere.vert'
import sphereFrag from './shaders/sphere.frag'

export const sphereMaterial = new THREE.ShaderMaterial({
	vertexShader: sphereVert,
	fragmentShader: sphereFrag,
	uniforms: {
		uTrailMap: { value: null },
		uBaseColor: { value: new THREE.Color(config.baseColor) },
		uTrailColorCore: { value: new THREE.Color(config.trailColorCore) },
		uTrailColorMid: { value: new THREE.Color(config.trailColorMid) },
		uTrailColorEdge: { value: new THREE.Color(config.trailColorEdge) },
	},
})

export let sphere = new THREE.Mesh(
	new THREE.SphereGeometry(config.sphereRadius, 128, 128),
	sphereMaterial,
)

export function rebuildSphere() {
	const oldGeo = sphere.geometry
	sphere.geometry = new THREE.SphereGeometry(config.sphereRadius, 128, 128)
	oldGeo.dispose()
}
