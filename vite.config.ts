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
    // No source maps. Vercel answers .map requests with a 403 in production,
    // so shipping them only advertises a file that cannot be fetched. Read the
    // source on GitHub instead.
    sourcemap: false,
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
