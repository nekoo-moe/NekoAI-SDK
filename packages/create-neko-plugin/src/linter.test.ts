import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { lintPluginDirectory, lintPluginManifest } from './linter'
import { scaffoldPluginProject } from './scaffold'

describe('create-neko-plugin: Registry Security Linter', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'neko-linter-test-'))
  })

  afterEach(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true })
    }
    catch {
      // Ignore cleanup error
    }
  })

  it('validates a valid manifest object successfully', () => {
    const validManifest = {
      $schema: 'https://nekoai.moe/schemas/neko-plugin.v1.json',
      id: 'com.example.valid-plugin',
      name: 'Valid Plugin',
      version: '1.0.0',
      platform: ['windows', 'linux'],
      gateway: {
        type: 'native-app',
        automationSurface: 'ui-automation',
        requiredPermissions: ['desktop:synthetic_input'],
      },
      recipes: [
        {
          id: 'test-recipe',
          name: 'Test Recipe',
          description: 'A simple test recipe',
          riskLevel: 'read_only',
        },
      ],
    }

    const result = lintPluginManifest(validManifest)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects missing surface permissions in manifest', () => {
    const invalidSurfaceManifest = {
      $schema: 'https://nekoai.moe/schemas/neko-plugin.v1.json',
      id: 'com.example.cdp-plugin',
      name: 'CDP Plugin',
      version: '1.0.0',
      platform: ['windows'],
      gateway: {
        type: 'browser-cdp',
        automationSurface: 'browser-cdp',
        requiredPermissions: ['filesystem:read'], // Missing browser:*
      },
      recipes: [],
    }

    const result = lintPluginManifest(invalidSurfaceManifest)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_SURFACE_PERMISSION')).toBe(true)
  })

  it('validates a freshly scaffolded plugin directory as clean', async () => {
    const targetDir = join(tempDir, 'clean-plugin')
    await scaffoldPluginProject({
      name: 'Clean Plugin',
      targetDir,
      template: 'desktop-ui',
    })

    const result = await lintPluginDirectory(targetDir)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('detects dangerous eval() usage in plugin source code', async () => {
    const targetDir = join(tempDir, 'unsafe-plugin')
    await scaffoldPluginProject({
      name: 'Unsafe Plugin',
      targetDir,
      template: 'ambient-readonly',
    })

    // Inject malicious eval into source file
    const srcIndex = join(targetDir, 'src/index.ts')
    await writeFile(srcIndex, 'const dangerous = eval("1 + 1"); export default {}', 'utf-8')

    const result = await lintPluginDirectory(targetDir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'DISALLOWED_EVAL')).toBe(true)
  })

  it('detects process.exit() usage in plugin source code', async () => {
    const targetDir = join(tempDir, 'exit-plugin')
    await scaffoldPluginProject({
      name: 'Exit Plugin',
      targetDir,
      template: 'ambient-readonly',
    })

    const srcIndex = join(targetDir, 'src/index.ts')
    await writeFile(srcIndex, 'process.exit(1); export default {}', 'utf-8')

    const result = await lintPluginDirectory(targetDir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'DISALLOWED_PROCESS_EXIT')).toBe(true)
  })

  it('detects high-risk external recipe missing requireUserConsent', async () => {
    const targetDir = join(tempDir, 'missing-consent-plugin')
    await scaffoldPluginProject({
      name: 'Missing Consent Plugin',
      targetDir,
      template: 'ambient-readonly',
    })

    // Overwrite manifest with high_risk_external recipe
    const manifestPath = join(targetDir, 'plugins.json')
    const manifest = {
      $schema: 'https://nekoai.moe/schemas/neko-plugin.v1.json',
      id: 'com.example.high-risk',
      name: 'High Risk Plugin',
      version: '1.0.0',
      platform: ['windows'],
      gateway: {
        type: 'native-app',
        automationSurface: 'ui-automation',
        requiredPermissions: ['desktop:synthetic_input'],
      },
      recipes: [
        {
          id: 'wire-transfer',
          name: 'Wire Transfer',
          description: 'High risk external transaction',
          riskLevel: 'high_risk_external',
        },
      ],
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

    // Source code does NOT contain requireUserConsent
    const srcIndex = join(targetDir, 'src/index.ts')
    await writeFile(srcIndex, 'export default { id: "com.example.high-risk" }', 'utf-8')

    const result = await lintPluginDirectory(targetDir)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.code === 'MISSING_MANDATORY_CONSENT_GATE')).toBe(true)
  })

  it('validates that all example reference plugins pass the linter', async () => {
    const examples = ['acrobat-companion', 'daily-briefing', 'starter-tool']

    for (const example of examples) {
      const exampleDir = resolve(__dirname, `../../../examples/${example}`)
      const result = await lintPluginDirectory(exampleDir)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.manifest).toBeDefined()
    }
  })
})
