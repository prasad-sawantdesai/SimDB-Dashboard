import { fileURLToPath, URL } from 'node:url'
import { execSync } from 'child_process'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import viteCompression from 'vite-plugin-compression'

// Get version from git
function getVersionFromGit() {
  try {
    const version = execSync('git describe --tags --always', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim()

    console.log(`📦 Building SimDB Dashboard ${version}`)

    return version
  } catch (error) {
    console.warn('⚠️  Could not get version from git, using fallback')
    return '0.0.0-unknown'
  }
}

const version = getVersionFromGit()

// MRHSession cookie from keyring (via dev-auth.sh) or .env.local
// Injected into the proxy so the ITER BIG-IP perimeter lets requests through.
const mrhSession = process.env.VITE_MRH_SESSION ?? ''

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/scenarios': {
        target: 'https://simdb.iter.org',
        changeOrigin: true,
        secure: true,
        ...(mrhSession && {
          headers: { cookie: `MRHSession=${mrhSession}` }
        }),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // Strip Set-Cookie so the BIG-IP session stays server-side only
            delete proxyRes.headers['set-cookie']
          })
        },
      }
    }
  },
  plugins: [
    vue({
      script: {
        defineModel: true,
      }
    }),
    vueJsx(),
    nodePolyfills({
      include: ['buffer', 'stream']
    }),
    viteCompression(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  base: '/dashboard',
  build: {
    target: 'es2015',
  }
})
