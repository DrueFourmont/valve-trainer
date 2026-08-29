import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/**
 * Loads the authored skid. There is no placeholder any more: the model is the
 * model, and a failure here is a real failure worth showing rather than
 * something to paper over with primitives that would then need keeping in sync.
 */

const MODEL_URL = 'models/skid.glb'

export async function loadSkid(
  onProgress: (fraction: number | null) => void,
): Promise<THREE.Object3D> {
  // Checking response.ok is not enough. Vite's dev server and most static hosts
  // answer an unknown path with index.html and a 200, so a missing model looks
  // present and the GLTF parser then reports a confusing parse error instead of
  // the real problem, which is that the file is not there.
  const head = await fetch(MODEL_URL, { method: 'HEAD' })
  const contentType = head.headers.get('content-type') ?? ''
  if (!head.ok || contentType.includes('text/html')) {
    throw new Error(
      `${MODEL_URL} is not being served (${head.status}, ${contentType || 'no content type'})`,
    )
  }

  // No setDecoderPath. Since r185 DRACOLoader locates its decoder with
  // new URL(..., import.meta.url), which Vite resolves and emits at build time.
  // Pointing it at a hand vendored copy instead makes the bundled one dead
  // weight and the runtime fetch a path that has to be kept in sync by hand.
  const draco = new DRACOLoader()

  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  try {
    const gltf = await loader.loadAsync(MODEL_URL, (event: ProgressEvent) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null)
    })
    gltf.scene.name = 'skid'
    return gltf.scene
  } finally {
    draco.dispose()
  }
}
