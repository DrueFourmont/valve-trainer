import * as THREE from 'three'

/**
 * Where the student stands when a session opens, and where world space UI sits
 * relative to them.
 *
 * These live together and are exported so the clearance between the panels and
 * the equipment can be asserted in a test, rather than discovered in a headset
 * as a card buried inside a pump.
 */

/** Rig position on sessionstart. Floor is y = 0 under local-floor. */
export const STANDING_POSITION = new THREE.Vector3(0, 0, 2.4)

/** Both offsets are rig local, so they follow snap turns. */
export const SCORE_PANEL_OFFSET = new THREE.Vector3(0, 1.45, -1.5)
export const NOTE_PANEL_OFFSET = new THREE.Vector3(0, 1.5, -1.4)
