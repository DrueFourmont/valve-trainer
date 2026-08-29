import * as THREE from 'three'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createSkid } from './skid'

/**
 * Loads the authored skid, falling back to the primitive placeholder.
 *
 * The placeholder is a fallback, not a fixture: once skid.glb exists it is the
 * real model every time, and skid.ts gets deleted rather than kept in sync.
 */

const MODEL_URL = 'models/skid.glb'
const DRACO_PATH = 'draco/'

export type SkidSource = 'model' | 'placeholder'

export interface LoadedSkid {
  root: THREE.Object3D
  source: SkidSource
  /** Set when a model was present but could not be used. */
  error?: string
}

export async function loadSkid(
  onProgress: (fraction: number | null) => void,
): Promise<LoadedSkid> {
  // A missing file is the expected state until the model is authored, so it
  // must not look like a failure. Anything else is a real error worth showing.
  //
  // Checking response.ok is not enough. Vite's dev server and most static hosts
  // answer an unknown path with index.html and a 200, so a missing model looks
  // present and the GLTF parser then chokes on HTML and reports a bogus error.
  // The content type is what actually distinguishes the two.
  let present = false
  try {
    const head = await fetch(MODEL_URL, { method: 'HEAD' })
    const contentType = head.headers.get('content-type') ?? ''
    present = head.ok && !contentType.includes('text/html')
  } catch {
    present = false
  }

  if (!present) {
    return { root: createSkid(), source: 'placeholder' }
  }

  const draco = new DRACOLoader()
  draco.setDecoderPath(DRACO_PATH)

  const loader = new GLTFLoader()
  loader.setDRACOLoader(draco)

  try {
    const gltf = await loader.loadAsync(MODEL_URL, (event: ProgressEvent) => {
      onProgress(event.lengthComputable ? event.loaded / event.total : null)
    })
    gltf.scene.name = 'skid'
    return { root: gltf.scene, source: 'model' }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return { root: createSkid(), source: 'placeholder', error: message }
  } finally {
    draco.dispose()
  }
}
