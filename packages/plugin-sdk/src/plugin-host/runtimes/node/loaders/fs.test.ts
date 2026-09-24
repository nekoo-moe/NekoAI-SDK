import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FileSystemLoader } from './fs'

// https://github.com/nekoo-moe/NekoAI/issues/156
// Issue #156: Windows ESM loader rejects raw C:\ drive paths without file:// protocol
describe('fileSystemLoader (Issue #156)', () => {
  it('resolves runtime-specific entrypoint from manifest', () => {
    const loader = new FileSystemLoader()
    const manifest = {
      manifestVersion: '1.0.0',
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin',
      author: 'Test',
      entrypoints: {
        node: './dist/node.js',
        electron: './dist/electron.js',
        default: './dist/index.js',
      },
      categories: ['productivity'],
      capabilities: [],
      activationEvents: [],
    } as any

    const resolved = loader.resolveEntrypointFor(manifest, { runtime: 'node', cwd: '/mock/app' })
    expect(resolved).toBe('/mock/app/dist/node.js')
  })

  it('formats windows drive letter paths as file:// URLs for Node ESM loader', () => {
    const loader = new FileSystemLoader()
    const winPath = 'C:\\neko\\plugins\\my-plugin\\index.js'
    const manifest = {
      manifestVersion: '1.0.0',
      id: 'win-plugin',
      name: 'Win Plugin',
      version: '1.0.0',
      description: 'Win plugin',
      author: 'Test',
      entrypoints: {
        default: winPath,
      },
      categories: ['productivity'],
      capabilities: [],
      activationEvents: [],
    } as any

    const resolved = loader.resolveEntrypointFor(manifest)
    expect(resolved).toBe(winPath)

    const expectedUrl = pathToFileURL(resolved, { windows: true }).href
    expect(expectedUrl.startsWith('file://')).toBe(true)
    expect(expectedUrl).toContain('C:')
  })
})
