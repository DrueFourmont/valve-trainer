import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { VRButton } from 'three/addons/webxr/VRButton.js'
import './style.css'
import { createSkid } from './scene/skid'

const mode = new URLSearchParams(location.search).get('mode') === 'vr' ? 'vr' : '2d'

const app = document.querySelector<HTMLDivElement>('#app')!

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e1216)
scene.fog = new THREE.Fog(0x0e1216, 9, 26)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.05, 100)
camera.position.set(2.4, 1.75, 2.6)

// In an XR session the headset pose replaces camera.position outright; the only
// thing that still offsets it is the camera's parent. So the rig is how the
// player gets placed in either mode.
const rig = new THREE.Group()
rig.name = 'player_rig'
rig.add(camera)
scene.add(rig)

const grid = new THREE.GridHelper(24, 24, 0x51606d, 0x262d34)
grid.name = 'floor_grid'
scene.add(grid)

scene.add(new THREE.HemisphereLight(0xa8c0d6, 0x24282d, 1.1))

const keyLight = new THREE.DirectionalLight(0xffffff, 2)
keyLight.position.set(3.5, 6, 4)
scene.add(keyLight)

const fillLight = new THREE.DirectionalLight(0xbcd2e8, 0.5)
fillLight.position.set(-4, 3, -3)
scene.add(fillLight)

scene.add(createSkid())

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.85, 0)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 1
controls.maxDistance = 12
controls.maxPolarAngle = Math.PI * 0.495 // stay above the floor plane
controls.update()

if (mode === 'vr') {
  renderer.xr.enabled = true
  renderer.xr.setReferenceSpaceType('local-floor')
  document.body.appendChild(VRButton.createButton(renderer))

  renderer.xr.addEventListener('sessionstart', () => {
    controls.enabled = false
    rig.position.set(0, 0, 2.4) // stand off the skid, floor at y = 0
  })
  renderer.xr.addEventListener('sessionend', () => {
    rig.position.set(0, 0, 0)
    controls.enabled = true
  })
}

window.addEventListener('resize', () => {
  if (renderer.xr.isPresenting) return
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

renderer.setAnimationLoop(() => {
  if (!renderer.xr.isPresenting) controls.update()
  renderer.render(scene, camera)
})
