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
  plugins: inVitest ? [] : [mkcert()],
  build: {
    // A portfolio piece is meant to be read, so ship maps.
    sourcemap: true,
    rollupOptions: {
      // Two pages: the trainer and the instructor view. Paths are relative to
      // the project root.
      input: {
        main: 'index.html',
        instructor: 'instructor.html',
      },
    },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
  },
})
