/**
 * Shown while the skid model downloads. Plain DOM, because loading always
 * happens before a session starts.
 */
export interface LoadingScreen {
  /** Fraction from 0 to 1, or null when the server sends no content length. */
  setProgress(fraction: number | null): void
  dismiss(): void
}

export function createLoadingScreen(): LoadingScreen {
  const root = document.createElement('div')
  root.className = 'loading-screen'

  const title = document.createElement('div')
  title.className = 'loading-title'
  title.textContent = 'Valve Isolation Trainer'
  root.appendChild(title)

  const track = document.createElement('div')
  track.className = 'loading-track'

  const bar = document.createElement('div')
  bar.className = 'loading-bar'
  track.appendChild(bar)
  root.appendChild(track)

  const detail = document.createElement('div')
  detail.className = 'loading-detail'
  detail.textContent = 'Loading equipment'
  root.appendChild(detail)

  document.body.appendChild(root)

  return {
    setProgress(fraction: number | null): void {
      if (fraction === null) {
        // No content length, so a percentage would be a lie. Show motion only.
        track.classList.add('loading-indeterminate')
        bar.style.width = '100%'
        return
      }
      track.classList.remove('loading-indeterminate')
      bar.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`
      detail.textContent = `Loading equipment ${Math.round(fraction * 100)}%`
    },

    dismiss(): void {
      root.classList.add('loading-done')
      window.setTimeout(() => root.remove(), 320)
    },
  }
}
