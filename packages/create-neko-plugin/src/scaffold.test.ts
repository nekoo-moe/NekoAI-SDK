import type { PluginTemplateType } from './scaffold'

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { safeParsePluginManifest } from '@nekotech/plugin-protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { scaffoldPluginProject } from './scaffold'

describe('create-neko-plugin: Scaffolding Generator', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'neko-plugin-test-'))
  })

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true })
    }
    catch {
      // Ignore cleanup error
    }
  })

  const templates: PluginTemplateType[] = [
    'web-cdp',
    'desktop-ui',
    'visual-grounding',
    'ambient-readonly',
  ]

  for (const template of templates) {
    it(`scaffolds project with template "${template}" successfully`, async () => {
      const targetDir = join(tempDir, `test-${template}`)

      const result = await scaffoldPluginProject({
        name: `Test ${template} Plugin`,
        targetDir,
        template,
        author: 'Neko Tester',
      })

      expect(result.template).toBe(template)
      expect(result.filesWritten.length).toBeGreaterThanOrEqual(6)

      // Verify manifest content
      const manifestRaw = await readFile(result.manifestPath, 'utf-8')
      const manifestJson = JSON.parse(manifestRaw)
      const parseResult = safeParsePluginManifest(manifestJson)

      expect(parseResult.success).toBe(true)
      expect(manifestJson.author).toBe('Neko Tester')

      // Verify package.json
      const packageRaw = await readFile(join(targetDir, 'package.json'), 'utf-8')
      const packageJson = JSON.parse(packageRaw)
      expect(packageJson.scripts.test).toBe('vitest run')

      // Verify source file exists and contains definePlugin
      const indexCode = await readFile(join(targetDir, 'src/index.ts'), 'utf-8')
      expect(indexCode).toContain('definePlugin(')

      // Verify test file exists
      const testCode = await readFile(join(targetDir, 'src/index.test.ts'), 'utf-8')
      expect(testCode).toContain('describe(')
    })
  }

  it('throws descriptive error on unknown template', async () => {
    await expect(
      scaffoldPluginProject({
        name: 'Invalid Template Plugin',
        targetDir: join(tempDir, 'invalid'),
        template: 'unknown-template' as any,
      }),
    ).rejects.toThrow('Unknown template: "unknown-template"')
  })
})
