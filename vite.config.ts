import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

// HTTPS and LAN binding are both required: WebXR only starts in a secure
// context, and the Quest browser reaches this dev server over the LAN.
//
// mkcert is a dev server concern only. Vitest loads this same config file, and
// the plugin tries to install a trusted CA while loading, which fails in a non
// interactive shell and takes the whole test run down with it. So keep it out
// of test runs.
const inVitest = process.env.VITEST === 'true'

export default defineConfig({
  // Temporary, alongside the debug overlay. Lets a stale browser tab be spotted
  // instantly instead of being mistaken for a bug. Removed in phase 6.
  define: {
    __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(11, 19)),
  },
  plugins: inVitest ? [] : [mkcert()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
