/**
 * Project Scaffolding Engine for NekoAI Plugins.
 */

import type { TemplateContext } from './templates/types'

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

import { TEMPLATES } from './templates'

export type PluginTemplateType = 'web-cdp' | 'desktop-ui' | 'visual-grounding' | 'ambient-readonly'

export interface ScaffoldOptions {
  name: string
  id?: string
  targetDir: string
  template?: PluginTemplateType
  description?: string
  author?: string
}

export interface ScaffoldResult {
  targetDir: string
  manifestPath: string
  filesWritten: string[]
  template: PluginTemplateType
}

/**
 * Normalizes a human-readable or package name to kebab-case.
 */
function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+|-+$/g, '')
}

/**
 * Scaffolds a new NekoAI application plugin project on disk.
 */
export async function scaffoldPluginProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const targetDir = resolve(options.targetDir)
  const templateType = options.template ?? 'web-cdp'
  const template = TEMPLATES[templateType]

  if (!template) {
    throw new Error(
      `Unknown template: "${templateType}". Supported templates: ${Object.keys(TEMPLATES).join(', ')}`,
    )
  }

  const kebabName = toKebabCase(options.name || basename(targetDir))
  const pluginId = options.id ?? `com.nekoai.plugin.${kebabName}`
  const pluginName = options.name || kebabName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  const packageName = kebabName.startsWith('@') ? kebabName : `@neko-plugins/${kebabName}`
  const description = options.description ?? `${pluginName} plugin for NekoAI`
  const author = options.author ?? 'NekoAI Community Contributor'

  const ctx: TemplateContext = {
    pluginId,
    pluginName,
    packageName,
    description,
    author,
  }

  // Ensure target directories exist
  await mkdir(resolve(targetDir, 'src'), { recursive: true })

  const filesWritten: string[] = []

  // 1. Write neko-plugin.json manifest
  const manifestPath = resolve(targetDir, 'neko-plugin.json')
  const manifestData = template.generateManifest(ctx)
  await writeFile(manifestPath, JSON.stringify(manifestData, null, 2), 'utf-8')
  filesWritten.push(manifestPath)

  // 2. Write package.json
  const packageJsonPath = resolve(targetDir, 'package.json')
  const packageJsonData = template.generatePackageJson(ctx)
  await writeFile(packageJsonPath, JSON.stringify(packageJsonData, null, 2), 'utf-8')
  filesWritten.push(packageJsonPath)

  // 3. Write tsconfig.json
  const tsconfigPath = resolve(targetDir, 'tsconfig.json')
  const tsconfigData = {
    compilerOptions: {
      target: 'ESNext',
      lib: ['DOM', 'ESNext'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
      skipLibCheck: true,
    },
    include: ['src/**/*.ts'],
  }
  await writeFile(tsconfigPath, JSON.stringify(tsconfigData, null, 2), 'utf-8')
  filesWritten.push(tsconfigPath)

  // 4. Write src/index.ts
  const indexTsPath = resolve(targetDir, 'src/index.ts')
  await writeFile(indexTsPath, template.generateIndexTs(ctx), 'utf-8')
  filesWritten.push(indexTsPath)

  // 5. Write src/index.test.ts
  const testTsPath = resolve(targetDir, 'src/index.test.ts')
  await writeFile(testTsPath, template.generateTestTs(ctx), 'utf-8')
  filesWritten.push(testTsPath)

  // 6. Write README.md
  const readmePath = resolve(targetDir, 'README.md')
  await writeFile(readmePath, template.generateReadme(ctx), 'utf-8')
  filesWritten.push(readmePath)

  return {
    targetDir,
    manifestPath,
    filesWritten,
    template: templateType,
  }
}
