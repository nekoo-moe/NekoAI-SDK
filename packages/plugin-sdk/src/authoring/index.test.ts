import { describe, expect, it } from 'vitest'

import {
  assertPostcondition,
  createActionRecipe,
  createMockExecutionContext,
  definePlugin,
  PostconditionFailedError,
  requireUserConsent,
  UserConsentDeniedError,
} from './index'

describe('plugin authoring sdk (issue #157 / milestone 5.2)', () => {
  describe('definePlugin & createActionRecipe', () => {
    it('defines a plugin, registers recipes, and produces a validated manifest', async () => {
      const plugin = definePlugin({
        id: 'com.nekoai.plugin.acrobat',
        name: 'Adobe Acrobat PDF Operator',
        version: '1.0.0',
        platform: ['windows', 'macos'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['filesystem:read', 'filesystem:write'],
        },
        setup({ registerRecipe }) {
          registerRecipe(
            createActionRecipe({
              id: 'sign-pdf',
              name: 'Sign PDF Document',
              description: 'Applies vector signature to target PDF.',
              riskLevel: 'moderate_local_mutation',
              inputs: {
                filePath: { type: 'string', required: true },
              },
              async execute({ os }, inputs: { filePath: string }) {
                await os.sleep(10)
                return { signed: true, path: inputs.filePath }
              },
            }),
          )
        },
      })

      await plugin.setup()

      expect(plugin.id).toBe('com.nekoai.plugin.acrobat')
      expect(plugin.recipes).toHaveLength(1)
      expect(plugin.getRecipe('sign-pdf')).toBeDefined()
      expect(plugin.getRecipe('non-existent')).toBeUndefined()
      expect(plugin.hasPermission('filesystem:read')).toBe(true)
      expect(plugin.hasPermission('network:external')).toBe(false)

      const manifest = plugin.getManifest()
      expect(manifest.id).toBe('com.nekoai.plugin.acrobat')
      expect(manifest.recipes).toHaveLength(1)
      expect(manifest.recipes[0].id).toBe('sign-pdf')
      expect(manifest.recipes[0].riskLevel).toBe('moderate_local_mutation')
    })

    it('throws error when registering duplicate recipe IDs', async () => {
      const plugin = definePlugin({
        id: 'com.nekoai.plugin.duplicate',
        name: 'Duplicate Test',
        version: '1.0.0',
        platform: ['windows'],
        setup({ registerRecipe }) {
          const recipe1 = createActionRecipe({
            id: 'duplicate-id',
            name: 'First',
            description: 'First',
            riskLevel: 'read_only',
            execute: async () => {},
          })
          const recipe2 = createActionRecipe({
            id: 'duplicate-id',
            name: 'Second',
            description: 'Second',
            riskLevel: 'read_only',
            execute: async () => {},
          })

          registerRecipe(recipe1)
          registerRecipe(recipe2)
        },
      })

      await expect(plugin.setup()).rejects.toThrowError(/Duplicate recipe registration/)
    })
  })

  describe('assertPostcondition', () => {
    it('resolves immediately when predicate is true', async () => {
      let evaluated = false
      await assertPostcondition({
        name: 'immediate-check',
        check: () => {
          evaluated = true
          return true
        },
        timeoutMs: 1000,
      })

      expect(evaluated).toBe(true)
    })

    it('polls until predicate becomes true', async () => {
      let attempts = 0
      await assertPostcondition({
        name: 'poll-check',
        check: () => {
          attempts++
          return attempts >= 3
        },
        timeoutMs: 1000,
        pollIntervalMs: 50,
      })

      expect(attempts).toBe(3)
    })

    it('throws PostconditionFailedError when timeout elapses', async () => {
      await expect(
        assertPostcondition({
          name: 'failing-state',
          check: () => false,
          timeoutMs: 150,
          pollIntervalMs: 50,
        }),
      ).rejects.toThrowError(PostconditionFailedError)
    })

    it('retries when predicate throws and fails with custom message', async () => {
      await expect(
        assertPostcondition({
          name: 'throwing-predicate',
          check: () => {
            throw new Error('DOM element detached')
          },
          timeoutMs: 150,
          pollIntervalMs: 50,
          failureMessage: 'Custom failure message',
        }),
      ).rejects.toThrowError(/Custom failure message/)
    })
  })

  describe('requireUserConsent', () => {
    it('passes cleanly when consentGate returns true', async () => {
      const mockContext = createMockExecutionContext({ consentApproved: true })

      await expect(
        requireUserConsent(
          {
            actionRef: 'test:action',
            summary: 'Allow network send?',
            level: 'high_risk_external',
          },
          mockContext,
        ),
      ).resolves.toBeUndefined()
    })

    it('throws UserConsentDeniedError when consentGate returns false', async () => {
      const mockContext = createMockExecutionContext({ consentApproved: false })

      await expect(
        requireUserConsent(
          {
            actionRef: 'test:action',
            summary: 'Allow network send?',
            level: 'high_risk_external',
          },
          mockContext,
        ),
      ).rejects.toThrowError(UserConsentDeniedError)
    })

    it('passes through when no consentGate is configured in context', async () => {
      const bareContext = {
        ...createMockExecutionContext(),
        consentGate: undefined,
      }

      await expect(
        requireUserConsent(
          {
            actionRef: 'test:action',
            summary: 'Allow network send?',
          },
          bareContext,
        ),
      ).resolves.toBeUndefined()
    })
  })

  describe('end-to-end recipe execution with mock context', () => {
    it('executes a multi-step recipe with OS window focus, UI input, consent, and postcondition', async () => {
      const recipe = createActionRecipe<{ destination: string, message: string }>({
        id: 'send-message',
        name: 'Send Message Recipe',
        description: 'Simulates Discord quick switcher and staged send.',
        riskLevel: 'high_risk_external',
        async execute(ctx, inputs) {
          // 1. Focus target window
          const win = await ctx.os.ensureWindow({ executable: 'Discord.exe' })
          await win.focus()

          // 2. Press shortcut
          await ctx.ui.pressKeyChord('Ctrl+K')
          await ctx.ui.typeText(inputs.destination)
          await ctx.ui.pressKey('Enter')

          // 3. Consent gate
          await requireUserConsent(
            {
              actionRef: 'discord:send',
              summary: `Post to ${inputs.destination}?`,
              level: 'high_risk_external',
            },
            ctx,
          )

          // 4. Send and stage element in UI
          await ctx.ui.clickElement({ selector: `card:${inputs.destination}` })

          // 5. Assert postcondition
          await assertPostcondition({
            name: 'verify-sent',
            check: async () => await ctx.ui.hasElement({ selector: `card:${inputs.destination}` }),
            timeoutMs: 500,
          })

          return { success: true, target: inputs.destination }
        },
      })

      const context = createMockExecutionContext({ consentApproved: true })
      const result = await recipe.execute(context, {
        destination: '#general',
        message: 'Hello from NekoAI!',
      })

      expect(result).toEqual({ success: true, target: '#general' })
    })

    it('aborts recipe execution when consent is denied', async () => {
      const recipe = createActionRecipe({
        id: 'dangerous-action',
        name: 'Dangerous Action',
        description: 'Requires consent',
        riskLevel: 'high_risk_external',
        async execute(ctx) {
          await requireUserConsent(
            {
              actionRef: 'danger:delete',
              summary: 'Delete data?',
            },
            ctx,
          )
          return { done: true }
        },
      })

      const context = createMockExecutionContext({ consentApproved: false })
      await expect(recipe.execute(context, {})).rejects.toThrowError(UserConsentDeniedError)
    })
  })
})
