import * as THREE from 'three'

import kawaseBlurVert from './shaders/kawase-blur.vert'
import linearBlurFrag from './shaders/linear-blur.frag'
import linearUpsampleFrag from './shaders/linear-upsample.frag'

/**
 * LinearBlur — mipmap-style radial blur.
 *
 * Downsample chain  (level 0 → 1 → … → N-1):
 *   Each level halves the RT dimensions and applies the radial linear blur.
 *   The colour-distance threshold rises each level so blurred colours are
 *   still captured at coarser scales.
 *
 * Upsample chain  (level N-1 → … → 0):
 *   Each level blends the bilinearly-upsampled coarser result into the stored
 *   fine downsample:  output = fine + coarse * upsampleBlend
 *   The GPU's LinearFilter handles the upscaling for free.
 *
 * The final texture lives in upRTs[0] (same size as downRTs[0]).
 */
export class LinearBlur {
	constructor(width, height, opts = {}) {
		const {
			levels = 4,
			resolutionScale = 0.25,
			samples = 10,
			color = new THREE.Color(0x4e0600),
			colorDistance = 0.65,
			colorDistanceIncrement = 0.08,
			upsampleBlend = 0.85,
		} = opts

		this.numLevels = levels
		this.resolutionScale = resolutionScale
		this.numSamples = samples
		this.colorDistance = colorDistance
		this.colorDistanceIncrement = colorDistanceIncrement
		this.upsampleBlend = upsampleBlend

		this._buildMaterials(color, colorDistance)

		const baseW = Math.max(1, Math.floor(width * resolutionScale))
		const baseH = Math.max(1, Math.floor(height * resolutionScale))
		this._buildRTs(baseW, baseH)
	}

	// ─── RT management ───────────────────────────────────────────────────────

	_buildRTs(baseW, baseH) {
		this._baseW = baseW
		this._baseH = baseH

		const rtOpts = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBAFormat,
			type: THREE.HalfFloatType,
			generateMipmaps: false,
		}

		this._downRTs = []
		for (let i = 0; i < this.numLevels; i++) {
			const w = Math.max(1, Math.floor(baseW / 2 ** i))
			const h = Math.max(1, Math.floor(baseH / 2 ** i))
			this._downRTs.push(new THREE.WebGLRenderTarget(w, h, { ...rtOpts }))
		}

		// upRTs[i] has the same size as downRTs[i], for i = 0 … numLevels-2
		this._upRTs = []
		for (let i = 0; i < this.numLevels - 1; i++) {
			const { width: w, height: h } = this._downRTs[i]
			this._upRTs.push(new THREE.WebGLRenderTarget(w, h, { ...rtOpts }))
		}
	}

	_disposeRTs() {
		this._downRTs?.forEach((rt) => rt.dispose())
		this._upRTs?.forEach((rt) => rt.dispose())
		this._downRTs = []
		this._upRTs = []
	}

	/** Rebuild RTs at new screen size (also picks up a changed numLevels). */
	setSize(width, height) {
		const baseW = Math.max(1, Math.floor(width * this.resolutionScale))
		const baseH = Math.max(1, Math.floor(height * this.resolutionScale))
		this._disposeRTs()
		this._buildRTs(baseW, baseH)
	}

	// ─── Material / scene setup ───────────────────────────────────────────────

	_buildMaterials(color, colorDistance) {
		this._blurMat = new THREE.ShaderMaterial({
			vertexShader: kawaseBlurVert,
			fragmentShader: linearBlurFrag,
			uniforms: {
				uTexture: { value: null },
				uMaskTexture: { value: null },
				uTexelSize: { value: new THREE.Vector2() },
				uStepSize: { value: 1.0 },
				uSamples: { value: 10 },
				uColor: { value: color.clone() },
				uColorDistance: { value: colorDistance },
				uCenter: { value: new THREE.Vector2(0.5, 0.5) },
			},
			depthTest: false,
			depthWrite: false,
		})

		this._upMat = new THREE.ShaderMaterial({
			vertexShader: kawaseBlurVert,
			fragmentShader: linearUpsampleFrag,
			uniforms: {
				uFine: { value: null },
				uCoarse: { value: null },
				uBlend: { value: 0.85 },
			},
			depthTest: false,
			depthWrite: false,
		})

		// Public shortcut: main.js writes this every frame
		this.center = this._blurMat.uniforms.uCenter.value

		this._camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
		this._quadGeo = new THREE.PlaneGeometry(2, 2)

		this._blurScene = new THREE.Scene()
		this._blurScene.add(new THREE.Mesh(this._quadGeo, this._blurMat))

		this._upScene = new THREE.Scene()
		this._upScene.add(new THREE.Mesh(this._quadGeo, this._upMat))
	}

	// ─── Render ───────────────────────────────────────────────────────────────

	/**
	 * @param {THREE.WebGLRenderer} renderer
	 * @param {THREE.Texture} inputTexture  Full-res scene texture (sceneRT)
	 * @param {THREE.Texture} maskTexture   Full-res shape mask (maskRT)
	 * @returns {THREE.Texture} Blurred result at level-0 resolution
	 */
	render(renderer, inputTexture, maskTexture) {
		const bMat = this._blurMat
		bMat.uniforms.uMaskTexture.value = maskTexture
		bMat.uniforms.uSamples.value = this.numSamples
		bMat.uniforms.uStepSize.value = 1.0 // resolution halving handles scale

		// ── Downsample chain ─────────────────────────────────────────────────
		for (let i = 0; i < this.numLevels; i++) {
			const rt = this._downRTs[i]
			bMat.uniforms.uTexture.value =
				i === 0 ? inputTexture : this._downRTs[i - 1].texture
			bMat.uniforms.uTexelSize.value.set(1 / rt.width, 1 / rt.height)
			// Colour-distance threshold rises with level so deeper (blurrier)
			// levels can still capture slightly-shifted glow colours.
			bMat.uniforms.uColorDistance.value =
				this.colorDistance + i * this.colorDistanceIncrement

			renderer.setRenderTarget(rt)
			renderer.render(this._blurScene, this._camera)
		}

		// ── Upsample + blend chain ────────────────────────────────────────────
		// Edge case: a single level needs no upsample pass.
		if (this.numLevels < 2) {
			renderer.setRenderTarget(null)
			return this._downRTs[0].texture
		}

		const uMat = this._upMat
		uMat.uniforms.uBlend.value = this.upsampleBlend

		// Start from the coarsest level and blend back toward level 0.
		// The GPU bilinearly upsamples uCoarse for free (LinearFilter).
		let coarseTex = this._downRTs[this.numLevels - 1].texture
		for (let i = this.numLevels - 2; i >= 0; i--) {
			const rt = this._upRTs[i]
			uMat.uniforms.uFine.value = this._downRTs[i].texture
			uMat.uniforms.uCoarse.value = coarseTex

			renderer.setRenderTarget(rt)
			renderer.render(this._upScene, this._camera)

			coarseTex = rt.texture
		}

		renderer.setRenderTarget(null)
		return coarseTex // upRTs[0].texture — level-0 resolution
	}

	// ─── Cleanup ──────────────────────────────────────────────────────────────

	dispose() {
		this._disposeRTs()
		this._blurMat.dispose()
		this._upMat.dispose()
		this._quadGeo.dispose()
	}
}
