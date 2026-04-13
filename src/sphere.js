import * as THREE from 'three'
import { config } from './config.js'

import sphereVert from './shaders/sphere.vert'
import sphereFrag from './shaders/sphere.frag'

export const SPHERE_RADIUS = 2

const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 128, 128)
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

export const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
