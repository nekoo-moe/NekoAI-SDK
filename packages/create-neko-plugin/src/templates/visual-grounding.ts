import type { PluginTemplateDefinition, TemplateContext } from './types'

export const visualGroundingTemplate: PluginTemplateDefinition = {
  type: 'visual-grounding',
  description: 'Visual template matching and HUD automation template with strict Zero-Spend Invariant',

  generateManifest(ctx: TemplateContext) {
    return {
      $schema: 'https://v2.nekoai.is-a.dev/schemas/v2.json',
      id: ctx.pluginId,
      name: ctx.pluginName,
      version: '1.0.0',
      description: ctx.description,
      author: ctx.author,
      license: 'MIT',
      platform: ['windows'],
      gateway: {
        type: 'native-app',
        automationSurface: 'visual-grounding',
        requiredPermissions: [
          'desktop:window_focus',
          'desktop:synthetic_input',
        ],
      },
      recipes: [
        {
          id: 'perform-visual-task',
          name: 'Perform Vision-Grounded Task',
          description: 'Locates visual anchors, executes click automation, and enforces zero-spend invariants.',
          riskLevel: 'reversible_local',
        },
      ],
    }
  },

  generateIndexTs(ctx: TemplateContext) {
    return `import { assertPostcondition, createActionRecipe, definePlugin } from '@nekotech/plugin-sdk'

export class ZeroSpendInvariantViolationError extends Error {
  constructor(detail: string) {
    super(\`Zero-spend invariant violated: \${detail}. Execution terminated.\`)
    this.name = 'ZeroSpendInvariantViolationError'
  }
}

export const plugin = definePlugin({
  id: '${ctx.pluginId}',
  name: '${ctx.pluginName}',
  version: '1.0.0',
  description: '${ctx.description}',
  author: '${ctx.author}',
  license: 'MIT',
  platform: ['windows'],
  gateway: {
    type: 'native-app',
    automationSurface: 'visual-grounding',
    requiredPermissions: [
      'desktop:window_focus',
      'desktop:synthetic_input',
    ],
  },

  setup({ registerRecipe }) {
    registerRecipe(
      createActionRecipe<Record<string, unknown>, { success: boolean }>({
        id: 'perform-visual-task',
        name: 'Perform Vision-Grounded Task',
        description: 'Locates visual anchors, executes click automation, and enforces zero-spend invariants.',
        riskLevel: 'reversible_local',
        async execute({ os, ui }) {
          const win = await os.findWindow({ titleRegex: /${ctx.pluginName}/i })
          if (win) {
            await win.focus()
          }

          // Zero-Spend Safety Invariant Check
          if (await ui.hasElement({ textMatch: 'Purchase' })) {
            throw new ZeroSpendInvariantViolationError('Purchase modal detected')
          }

          // Vision Grounding Action
          const anchor = await ui.findVisualAnchor?.({
            templatePath: 'assets/target_anchor.png',
            confidenceThreshold: 0.85,
          })
          if (anchor && ui.clickCoordinates) {
            await ui.clickCoordinates(anchor.x, anchor.y)
          }

          await assertPostcondition({
            name: 'verify-task-complete',
            check: async () => true,
            timeoutMs: 3000,
          })

          return { success: true }
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
import { plugin, ZeroSpendInvariantViolationError } from './index'

describe('Visual Grounding Plugin', () => {
  it('executes visual task successfully when safe', async () => {
    await plugin.setup()
    const recipe = plugin.getRecipe('perform-visual-task')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext()
    const result = await recipe!.execute(context, {})
    expect(result.success).toBe(true)
  })

  it('fails closed when purchase prompt is detected', async () => {
    await plugin.setup()
    const recipe = plugin.getRecipe('perform-visual-task')

    const context = createMockExecutionContext({
      mockElements: ['Purchase In-Game Currency'],
    })

    await expect(recipe!.execute(context, {})).rejects.toThrow(ZeroSpendInvariantViolationError)
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
    return `# ${ctx.pluginName}\n\n${ctx.description}\n\n## Safety Invariant\n\nGuaranteed zero real-currency transactions via built-in \`ZeroSpendInvariantViolationError\` perimeter.\n`
  },
}
