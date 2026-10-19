import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { appName } from './src/brand.ts'
import { purgeCss } from './src/vite/purgecss.ts'

const useFakeAuth = process.env.VITE_E2E_FAKE_AUTH === 'true'
const fakeAuthPath = fileURLToPath(new URL('./src/services/auth.fake.ts', import.meta.url))

function appNamePlugin(): Plugin {
  return {
    name: 'app-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', appName),
  }
}

// Strips unused CSS selectors from production builds. Runs on the emitted
// bundle (built index.html + JS chunks are the content), never in dev.
function purgecssPlugin(): Plugin {
  return {
    name: 'purgecss',
    enforce: 'post',
    async generateBundle(_, bundle) {
      const content: Array<{ raw: string; extension: string }> = []
      const indexHtml = bundle['index.html']
      if (indexHtml && indexHtml.type === 'asset') {
        content.push({ raw: indexHtml.source as string, extension: 'html' })
      }
      for (const chunk of Object.values(bundle)) {
        if (chunk.type === 'chunk') {
          content.push({ raw: chunk.code, extension: 'js' })
        }
      }
      for (const fileName of Object.keys(bundle)) {
        const asset = bundle[fileName]
        if (
          asset.type === 'asset' &&
          fileName.endsWith('.css') &&
          typeof asset.source === 'string'
        ) {
          asset.source = await purgeCss(asset.source, content)
        }
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [
    vue(),
    appNamePlugin(),
    ...(command === 'build' ? [purgecssPlugin()] : []),
  ],
  resolve: {
    alias: useFakeAuth
      ? [
          { find: './services/auth', replacement: fakeAuthPath },
          { find: '../services/auth', replacement: fakeAuthPath },
        ]
      : [],
  },
  test: {
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
}))
