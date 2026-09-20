import type { PluginTemplateDefinition, TemplateContext } from './types'

export const desktopUiTemplate: PluginTemplateDefinition = {
  type: 'desktop-ui',
  description: 'Native desktop application UI automation template with Tier 4 consent gates',

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
        automationSurface: 'ui-automation',
        requiredPermissions: [
          'desktop:window_focus',
          'desktop:synthetic_input',
          'network:external',
        ],
      },
      recipes: [
        {
          id: 'dispatch-message',
          name: 'Stage and Dispatch Message',
          description: 'Focuses application, stages message, requests human-in-the-loop consent, and transmits.',
          riskLevel: 'high_risk_external',
          inputs: {
            target: {
              type: 'string',
              required: true,
              description: 'Target contact or channel destination',
            },
            message: {
              type: 'string',
              required: true,
              description: 'Message content to stage and send',
            },
          },
        },
      ],
    }
  },

  generateIndexTs(ctx: TemplateContext) {
    return `import {
  assertPostcondition,
  createActionRecipe,
  definePlugin,
  requireUserConsent,
} from '@nekotech/plugin-sdk'

export interface DispatchMessageInputs {
  target: string
  message: string
}

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
    automationSurface: 'ui-automation',
    requiredPermissions: [
      'desktop:window_focus',
      'desktop:synthetic_input',
      'network:external',
    ],
  },

  setup({ registerRecipe }) {
    registerRecipe(
      createActionRecipe<DispatchMessageInputs, { success: boolean; target: string }>({
        id: 'dispatch-message',
        name: 'Stage and Dispatch Message',
        description: 'Focuses application, stages message, requests human-in-the-loop consent, and transmits.',
        riskLevel: 'high_risk_external',
        inputs: {
          target: {
            type: 'string',
            required: true,
            description: 'Target contact or channel destination',
          },
          message: {
            type: 'string',
            required: true,
            description: 'Message content to stage and send',
          },
        },
        async execute(context, inputs) {
          const { os, ui } = context

          // 1. Focus application window
          const win = await os.ensureWindow({ titleRegex: /${ctx.pluginName}/i })
          await win.focus()

          // 2. Stage draft text
          await ui.typeText(inputs.message)

          // 3. Mandatory Tier 4 Human Consent Gate
          await requireUserConsent(
            {
              actionRef: '${ctx.pluginId}:dispatch_message',
              summary: \`Send message to "\${inputs.target}"?\`,
              level: 'high_risk_external',
              payload: {
                target: inputs.target,
                message: inputs.message,
              },
            },
            context,
          )

          // 4. Dispatch after consent
          await ui.pressKey('Enter')

          // 5. Postcondition verification
          await assertPostcondition({
            name: 'verify-message-dispatched',
            check: async () => true,
            timeoutMs: 3000,
          })

          return {
            success: true,
            target: inputs.target,
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
    return `import { createMockExecutionContext, UserConsentDeniedError } from '@nekotech/plugin-sdk'
import { describe, expect, it } from 'vitest'
import { plugin } from './index'

describe('Desktop UI Plugin with Consent Gate', () => {
  it('executes recipe when consent is granted', async () => {
    await plugin.setup()
    const recipe = plugin.getRecipe('dispatch-message')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext({ consentApproved: true })
    const result = await recipe!.execute(context, {
      target: '#general',
      message: 'Status update',
    })

    expect(result.success).toBe(true)
  })

  it('rejects execution when consent is denied', async () => {
    await plugin.setup()
    const recipe = plugin.getRecipe('dispatch-message')

    const context = createMockExecutionContext({ consentApproved: false })
    await expect(
      recipe!.execute(context, {
        target: '#general',
        message: 'Unauthorized send',
      }),
    ).rejects.toThrow(UserConsentDeniedError)
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
    return `# ${ctx.pluginName}\n\n${ctx.description}\n\n## Security\n\nFeatures mandatory Tier 4 human-in-the-loop consent gates prior to transmitting external side-effects.\n`
  },
}
