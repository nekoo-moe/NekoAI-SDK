import type { PluginTemplateDefinition, TemplateContext } from './types'

export const ambientReadonlyTemplate: PluginTemplateDefinition = {
  type: 'ambient-readonly',
  description: 'Multi-source ambient reader and information aggregator template',

  generateManifest(ctx: TemplateContext) {
    return {
      $schema: 'https://nekoai.moe/schemas/neko-plugin.v1.json',
      id: ctx.pluginId,
      name: ctx.pluginName,
      version: '1.0.0',
      description: ctx.description,
      author: ctx.author,
      license: 'MIT',
      platform: ['windows', 'linux', 'macos'],
      gateway: {
        type: 'native-app',
        automationSurface: 'native-api',
        requiredPermissions: [
          'filesystem:read',
        ],
      },
      recipes: [
        {
          id: 'harvest-data',
          name: 'Harvest System Context',
          description: 'Passively gathers read-only environmental context without mutation.',
          riskLevel: 'read_only',
        },
      ],
    }
  },

  generateIndexTs(ctx: TemplateContext) {
    return `import { assertPostcondition, createActionRecipe, definePlugin } from '@nekotech/plugin-sdk'

export const plugin = definePlugin({
  id: '${ctx.pluginId}',
  name: '${ctx.pluginName}',
  version: '1.0.0',
  description: '${ctx.description}',
  author: '${ctx.author}',
  license: 'MIT',
  platform: ['windows', 'linux', 'macos'],
  gateway: {
    type: 'native-app',
    automationSurface: 'native-api',
    requiredPermissions: [
      'filesystem:read',
    ],
  },

  setup({ registerRecipe }) {
    registerRecipe(
      createActionRecipe<Record<string, unknown>, { timestamp: string; data: string[] }>({
        id: 'harvest-data',
        name: 'Harvest System Context',
        description: 'Passively gathers read-only environmental context without mutation.',
        riskLevel: 'read_only',
        async execute() {
          const result = {
            timestamp: new Date().toISOString(),
            data: ['Sample ambient metric'],
          }

          await assertPostcondition({
            name: 'verify-harvest-success',
            check: () => Boolean(result.timestamp),
            timeoutMs: 1000,
          })

          return result
        },
      }),
    )
  },
})

export default plugin
`
  },

  generateTestTs() {
    return `import { createMockExecutionContext } from '@nekotech/plugin-sdk'
import { describe, expect, it } from 'vitest'
import { plugin } from './index'

describe('Ambient Readonly Plugin', () => {
  it('harvests data safely with read_only risk tier', async () => {
    await plugin.setup()
    const recipe = plugin.getRecipe('harvest-data')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext()
    const result = await recipe!.execute(context, {})
    expect(result.data).toHaveLength(1)
  })
})
`
  },

  generatePackageJson(ctx: TemplateContext) {
    return {
      name: ctx.packageName,
      version: '1.0.0',
      type: 'module',
      private: true,
      description: ctx.description,
      exports: './src/index.ts',
      scripts: {
        test: 'vitest run',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        '@nekotech/plugin-protocol': 'workspace:*',
        '@nekotech/plugin-sdk': 'workspace:*',
      },
    }
  },

  generateReadme(ctx: TemplateContext) {
    return `# ${ctx.pluginName}\n\n${ctx.description}\n\n## Ambient Mode\n\nOperates strictly in Tier 1 read-only mode with no state mutation.\n`
  },
}
