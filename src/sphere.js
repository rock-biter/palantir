import * as THREE from 'three'
import { config } from './config.js'

import sphereVert from './shaders/sphere.vert'
import sphereFrag from './shaders/sphere.frag'

// --- CubeCamera for environment reflections ---
const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(
	config.cubeCameraResolution,
	{
		generateMipmaps: true,
		minFilter: THREE.LinearMipmapLinearFilter,
	},
)
export const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeRenderTarget)

export const sphereMaterial = new THREE.ShaderMaterial({
	vertexShader: sphereVert,
	fragmentShader: sphereFrag,
	uniforms: {
		uTrailMap: { value: null },
		uBaseColor: { value: new THREE.Color(config.baseColor) },
		uTrailColorCore: { value: new THREE.Color(config.trailColorCore) },
		uTrailColorMid: { value: new THREE.Color(config.trailColorMid) },
		uTrailColorEdge: { value: new THREE.Color(config.trailColorEdge) },
		uEnvMap: { value: cubeRenderTarget.texture },
		uFresnelExponent: { value: config.fresnelExponent },
		uReflectionIntensity: { value: config.reflectionIntensity },
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

export function rebuildCubeCamera() {
	const oldRT = cubeCamera.renderTarget
	const newRT = new THREE.WebGLCubeRenderTarget(config.cubeCameraResolution, {
		generateMipmaps: true,
		minFilter: THREE.LinearMipmapLinearFilter,
	})
	cubeCamera.renderTarget = newRT
	sphereMaterial.uniforms.uEnvMap.value = newRT.texture
	oldRT.dispose()
}
