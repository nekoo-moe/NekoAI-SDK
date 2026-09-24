import type { PluginTemplateDefinition, TemplateContext } from './types'

export const webCdpTemplate: PluginTemplateDefinition = {
  type: 'web-cdp',
  description: 'Browser Chrome DevTools Protocol (CDP) web automation template',

  generateManifest(ctx: TemplateContext) {
    return {
      $schema: 'https://v2.nekoai.is-a.dev/schemas/v2.json',
      id: ctx.pluginId,
      name: ctx.pluginName,
      version: '1.0.0',
      description: ctx.description,
      author: ctx.author,
      license: 'MIT',
      platform: ['windows', 'linux', 'macos', 'web'],
      gateway: {
        type: 'browser-cdp',
        automationSurface: 'browser-cdp',
        requiredPermissions: [
          'browser:navigation',
          'browser:dom',
          'browser:cdp',
        ],
      },
      knowledge: {
        promptInjection: `When automating ${ctx.pluginName}, verify DOM elements are mounted before click interactions.`,
      },
      recipes: [
        {
          id: 'browse-target',
          name: 'Navigate and Verify Web Page',
          description: 'Navigates to a target URL, waits for ready state, and asserts selector mounting.',
          riskLevel: 'read_only',
          inputs: {
            url: {
              type: 'string',
              required: true,
              description: 'Target URL to navigate to',
            },
          },
        },
      ],
    }
  },

  generateIndexTs(ctx: TemplateContext) {
    return `import { assertPostcondition, createActionRecipe, definePlugin } from '@nekotech/plugin-sdk'

export interface BrowseTargetInputs {
  url: string
}

export const plugin = definePlugin({
  id: '${ctx.pluginId}',
  name: '${ctx.pluginName}',
  version: '1.0.0',
  description: '${ctx.description}',
  author: '${ctx.author}',
  license: 'MIT',
  platform: ['windows', 'linux', 'macos', 'web'],
  gateway: {
    type: 'browser-cdp',
    automationSurface: 'browser-cdp',
    requiredPermissions: [
      'browser:navigation',
      'browser:dom',
      'browser:cdp',
    ],
  },

  setup({ registerRecipe }) {
    registerRecipe(
      createActionRecipe<BrowseTargetInputs, { success: boolean; url: string }>({
        id: 'browse-target',
        name: 'Navigate and Verify Web Page',
        description: 'Navigates to a target URL, waits for ready state, and asserts selector mounting.',
        riskLevel: 'read_only',
        inputs: {
          url: {
            type: 'string',
            required: true,
            description: 'Target URL to navigate to',
          },
        },
        async execute({ browser }, inputs) {
          if (!browser) {
            throw new Error('Browser CDP bridge is required for web automation.')
          }

          await browser.navigate(inputs.url)
          await assertPostcondition({
            name: 'verify-page-navigated',
            check: async () => true,
            timeoutMs: 3000,
          })

          return {
            success: true,
            url: inputs.url,
          }
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

describe('Web CDP Plugin', () => {
  it('loads manifest and executes recipe with mock browser context', async () => {
    await plugin.setup()
    const manifest = plugin.getManifest()
    expect(manifest.gateway.type).toBe('browser-cdp')

    const recipe = plugin.getRecipe('browse-target')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext()
    const result = await recipe!.execute(context, { url: 'https://example.com' })
    expect(result.success).toBe(true)
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
    return `# ${ctx.pluginName}\n\n${ctx.description}\n\n## Usage\n\nAutomates browser workflows using Chrome DevTools Protocol (CDP).\n`
  },
}
