/**
 * Temporary. Exists so checkpoints can be verified without DevTools, and gets
 * deleted in phase 6. Not a logging abstraction, just a box.
 */

const MAX_LINES = 6

let host: HTMLDivElement | null = null
let status: HTMLDivElement | null = null
let log: HTMLDivElement | null = null

function ensure(): void {
  if (host) return
  host = document.createElement('div')
  host.className = 'debug-overlay'

  status = document.createElement('div')
  status.className = 'debug-status'

  log = document.createElement('div')
  log.className = 'debug-log'

  host.append(status, log)
  document.body.appendChild(host)
}

/** One pinned line that gets overwritten, for per frame values. */
export function debugStatus(message: string): void {
  ensure()
  status!.textContent = message
}

export function debugLog(message: string): void {
  ensure()

  const line = document.createElement('div')
  line.className = 'debug-line'
  line.textContent = message
  log!.appendChild(line)

  while (log!.childElementCount > MAX_LINES) log!.firstElementChild?.remove()
}
