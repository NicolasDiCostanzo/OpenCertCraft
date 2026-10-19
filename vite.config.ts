import { fileURLToPath, URL } from 'node:url'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { isCSSRequest } from 'vite'
import { appName } from './src/brand.ts'
import { purgeCss } from './src/vite/purgecss.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

const SOURCE_EXTENSIONS = ['.html', '.vue', '.ts', '.js', '.mjs', '.cts', '.mts', '.jsx', '.tsx']

const useFakeAuth = process.env.VITE_E2E_FAKE_AUTH === 'true'
const fakeAuthPath = fileURLToPath(new URL('./src/services/auth.fake.ts', import.meta.url))

function appNamePlugin(): Plugin {
  return {
    name: 'app-name',
    transformIndexHtml: (html) => html.replaceAll('%APP_NAME%', appName),
  }
}

function purgecssPlugin(): Plugin {
  let content: Array<{ raw: string; extension: string }> | null = null
  async function loadContent(): Promise<Array<{ raw: string; extension: string }>> {
    if (content !== null) return content
    const collected: Array<{ raw: string; extension: string }> = []
    try {
      collected.push({ raw: await readFile(join(root, 'index.html'), 'utf8'), extension: 'html' })
    } catch {
      // no index.html to scan
    }
    async function walk(dir: string): Promise<void> {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          await walk(full)
        } else if (entry.isFile()) {
          const dot = entry.name.lastIndexOf('.')
          if (dot !== -1 && SOURCE_EXTENSIONS.includes(entry.name.slice(dot))) {
            collected.push({ raw: await readFile(full, 'utf8'), extension: entry.name.slice(dot + 1) })
          }
        }
      }
    }
    await walk(join(root, 'src'))
    content = collected
    return content
  }
  return {
    name: 'purgecss',
    enforce: 'pre',
    async transform(code, id) {
      if (!isCSSRequest(id)) return null
      return { code: await purgeCss(code, await loadContent()), map: null }
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
