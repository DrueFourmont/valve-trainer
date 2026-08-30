import * as THREE from 'three'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'

/**
 * Image based lighting from a real industrial interior.
 *
 * Three point lights against a black void made the skid read as a diagram. An
 * environment map is what makes machined metal look machined, because rough
 * metal shows you the room it is standing in rather than a highlight.
 *
 * 1K rather than 2K, deliberately. Every material here is rough with no mirror
 * surfaces, so a higher resolution probe buys almost nothing in the lighting,
 * while a 2K file is 6.4 MB against 1.7 and the same file is downloaded by a
 * headset over wifi. See the asset budget in CLAUDE.md.
 */

const HDRI_URL = 'env/industrial_1k.hdr'

export interface Environment {
  dispose(): void
}

export async function installEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  onProgress?: (fraction: number | null) => void,
): Promise<Environment> {
  const texture = await new HDRLoader().loadAsync(HDRI_URL, (event: ProgressEvent) => {
    onProgress?.(event.lengthComputable ? event.loaded / event.total : null)
  })
  texture.mapping = THREE.EquirectangularReflectionMapping

  // PMREM is the prefiltered probe the standard material samples for roughness.
  // Built once at load, which is the expensive moment on a mobile GPU.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envMap = pmrem.fromEquirectangular(texture).texture
  pmrem.dispose()

  scene.environment = envMap
  scene.background = texture

  // Softened a little so the room reads as context and the equipment stays the
  // subject. The student is here to look at valves, not at the far wall.
  scene.backgroundBlurriness = 0.22
  scene.backgroundIntensity = 0.85

  // Fog faded to a flat colour that no longer matches anything behind it.
  scene.fog = null

  return {
    dispose(): void {
      scene.environment = null
      scene.background = null
      envMap.dispose()
      texture.dispose()
    },
  }
}
