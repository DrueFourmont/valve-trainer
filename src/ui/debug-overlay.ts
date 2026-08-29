/**
 * Temporary. Exists so checkpoint 1 can be verified without DevTools, and
 * gets deleted in phase 6. Not a logging abstraction, just a box.
 */

const MAX_LINES = 6

let list: HTMLDivElement | null = null

export function debugLog(message: string): void {
  if (!list) {
    list = document.createElement('div')
    list.className = 'debug-overlay'
    document.body.appendChild(list)
  }

  const line = document.createElement('div')
  line.className = 'debug-line'
  line.textContent = message
  list.appendChild(line)

  while (list.childElementCount > MAX_LINES) list.firstElementChild?.remove()
}
