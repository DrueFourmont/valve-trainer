/**
 * On screen messaging. House rule: no console noise, errors surface here.
 * Deliberately tiny. No queue, no animation library, no dependencies.
 */

let host: HTMLDivElement | null = null

function getHost(): HTMLDivElement {
  if (host) return host
  host = document.createElement('div')
  host.className = 'toast-host'
  document.body.appendChild(host)
  return host
}

export type ToastKind = 'info' | 'error'

/** Pass durationMs = 0 to keep the message up until it is dismissed by tap. */
export function showToast(message: string, kind: ToastKind = 'info', durationMs = 4000): void {
  const el = document.createElement('div')
  el.className = `toast toast-${kind}`
  el.textContent = message
  el.addEventListener('click', () => el.remove())
  getHost().appendChild(el)
  if (durationMs > 0) window.setTimeout(() => el.remove(), durationMs)
}
