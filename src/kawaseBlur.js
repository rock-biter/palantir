import * as THREE from 'three'

import kawaseBlurVert from './shaders/kawase-blur.vert'
import kawaseBlurFrag from './shaders/kawase-blur.frag'

/**
 * KawaseBlur — reusable multi-pass Kawase blur.
 *
 * Usage:
 *   const blur = new KawaseBlur(512, 512)
 *   const blurredTexture = blur.render(renderer, sourceTexture)
 *   // ...
 *   blur.dispose()
 *
 * @param {number} width   - Width of the internal render targets.
 * @param {number} height  - Height of the internal render targets.
 * @param {object} [opts]
 * @param {number[]} [opts.passes=[0,1,2,3]] - Kawase offset per pass.
 * @param {THREE.TextureDataType} [opts.type=THREE.FloatType]
 * @param {number} [opts.format=THREE.RGBAFormat]
 */
export class KawaseBlur {
	constructor(width, height, opts = {}) {
		const {
			passes = [0, 1, 2, 3],
			type = THREE.FloatType,
			format = THREE.RGBAFormat,
		} = opts

		this.passes = passes

		const rtOptions = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format,
			type,
			generateMipmaps: false,
		}
		this._rtA = new THREE.WebGLRenderTarget(width, height, rtOptions)
		this._rtB = new THREE.WebGLRenderTarget(width, height, rtOptions)
		// RepeatWrapping on U so bilinear filter neighbours wrap across the
		// spherical seam (u=0 == u=1) when these RTs become inputs for later passes.
		this._rtA.texture.wrapS = THREE.RepeatWrapping
		this._rtB.texture.wrapT = THREE.RepeatWrapping

		this._rtB.texture.wrapS = THREE.RepeatWrapping
		this._rtB.texture.wrapT = THREE.RepeatWrapping

		this._material = new THREE.ShaderMaterial({
			vertexShader: kawaseBlurVert,
			fragmentShader: kawaseBlurFrag,
			uniforms: {
				uTexture: { value: null },
				uTexelSize: { value: new THREE.Vector2(1.0 / width, 1.0 / height) },
				uOffset: { value: 0.0 },
			},
		})

		this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
		this._scene = new THREE.Scene()
		this._scene.add(
			new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this._material),
		)
	}

	/**
	 * Run all Kawase passes on `inputTexture`.
	 * @param {THREE.WebGLRenderer} renderer
	 * @param {THREE.Texture} inputTexture
	 * @returns {THREE.Texture} The blurred texture (owned by an internal RT).
	 */
	render(renderer, inputTexture) {
		let src = inputTexture
		for (let i = 0; i < this.passes.length; i++) {
			const dst = i % 2 === 0 ? this._rtA : this._rtB
			this._material.uniforms.uTexture.value = src
			this._material.uniforms.uOffset.value = this.passes[i]
			renderer.setRenderTarget(dst)
			renderer.render(this._scene, this._camera)
			renderer.setRenderTarget(null)
			src = dst.texture
		}
		return src
	}

	/** Resize the internal render targets. */
	setSize(width, height) {
		this._rtA.setSize(width, height)
		this._rtB.setSize(width, height)
		this._material.uniforms.uTexelSize.value.set(1.0 / width, 1.0 / height)
	}

	dispose() {
		this._rtA.dispose()
		this._rtB.dispose()
		this._material.dispose()
		this._scene.children[0].geometry.dispose()
	}
}
