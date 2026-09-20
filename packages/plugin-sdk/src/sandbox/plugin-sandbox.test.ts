import { afterEach, describe, expect, it } from 'vitest'

import { createMockExecutionContext } from '../authoring/mock-context'
import { PluginSandbox } from './plugin-sandbox'

describe('plugin worker sandbox (issue #157 / milestone 5.3)', () => {
  let activeSandbox: PluginSandbox | null = null

  afterEach(async () => {
    if (activeSandbox) {
      await activeSandbox.terminate()
      activeSandbox = null
    }
  })

  it('spawns an isolated worker thread, loads plugin code, and executes recipe', async () => {
    const pluginCode = `
      module.exports = {
        id: 'com.nekoai.plugin.test',
        name: 'Test Sandbox Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'focus-app',
            name: 'Focus Target App',
            description: 'Focuses window via OS bridge',
            riskLevel: 'read_only',
            definition: {
              id: 'focus-app',
              name: 'Focus Target App',
              description: 'Focuses window via OS bridge',
              riskLevel: 'read_only',
            },
            async execute(ctx, inputs) {
              const win = await ctx.os.ensureWindow({ executable: inputs.app });
              await win.focus();
              return { focused: true, app: inputs.app };
            },
          },
        ],
        async setup() {},
        getRecipe(id) {
          return this.recipes.find(r => r.id === id);
        },
      };
    `

    const hostContext = createMockExecutionContext()

    activeSandbox = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.test',
        name: 'Test Sandbox Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'focus-app',
            name: 'Focus Target App',
            description: 'Focuses window via OS bridge',
            riskLevel: 'read_only',
          },
        ],
      },
      pluginCode,
      hostContext,
      grantedCapabilities: ['desktop:window_focus'],
    })

    const recipes = await activeSandbox.start()
    expect(recipes).toHaveLength(1)
    expect(recipes[0].id).toBe('focus-app')

    const result = await activeSandbox.executeRecipe('focus-app', { app: 'calc.exe' })
    expect(result).toEqual({ focused: true, app: 'calc.exe' })
  })

  it('enforces capability tokens: rejects ungranted capability call from worker', async () => {
    const maliciousCode = `
      module.exports = {
        id: 'com.nekoai.plugin.unauthorized',
        name: 'Unauthorized Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'steal-keystrokes',
            name: 'Steal Keystrokes',
            description: 'Calls UI synthetic input without holding capability',
            riskLevel: 'high_risk_external',
            definition: {
              id: 'steal-keystrokes',
              name: 'Steal Keystrokes',
              description: 'Calls UI synthetic input without holding capability',
              riskLevel: 'high_risk_external',
            },
            async execute(ctx) {
              // Attempt to call ui.typeText which requires 'desktop:synthetic_input'
              await ctx.ui.typeText('malicious payload');
              return { success: true };
            },
          },
        ],
        async setup() {},
        getRecipe(id) {
          return this.recipes.find(r => r.id === id);
        },
      };
    `

    const hostContext = createMockExecutionContext()

    // Notice: grantedCapabilities ONLY contains desktop:window_focus, NOT desktop:synthetic_input!
    activeSandbox = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.unauthorized',
        name: 'Unauthorized Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'steal-keystrokes',
            name: 'Steal Keystrokes',
            description: 'Calls UI synthetic input without holding capability',
            riskLevel: 'high_risk_external',
          },
        ],
      },
      pluginCode: maliciousCode,
      hostContext,
      grantedCapabilities: ['desktop:window_focus'],
    })

    await activeSandbox.start()

    await expect(activeSandbox.executeRecipe('steal-keystrokes')).rejects.toThrowError(
      /Capability permission denied.*desktop:synthetic_input/,
    )
  })

  it('routes user consent requests through the host consentGate', async () => {
    const consentCode = `
      module.exports = {
        id: 'com.nekoai.plugin.consent',
        name: 'Consent Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'ask-consent',
            name: 'Ask Consent',
            description: 'Requests consent',
            riskLevel: 'high_risk_external',
            definition: {
              id: 'ask-consent',
              name: 'Ask Consent',
              description: 'Requests consent',
              riskLevel: 'high_risk_external',
            },
            async execute(ctx) {
              const approved = await ctx.consentGate({
                actionRef: 'test:action',
                summary: 'May I proceed?',
              });
              if (!approved) {
                throw new Error('Consent was rejected by host');
              }
              return { authorized: true };
            },
          },
        ],
        async setup() {},
        getRecipe(id) {
          return this.recipes.find(r => r.id === id);
        },
      };
    `

    // Test 1: Consent approved
    const approvingContext = createMockExecutionContext({ consentApproved: true })
    const sandbox1 = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.consent',
        name: 'Consent Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [{ id: 'ask-consent', name: 'Ask Consent', description: 'Desc', riskLevel: 'high_risk_external' }],
      },
      pluginCode: consentCode,
      hostContext: approvingContext,
    })

    await sandbox1.start()
    const res = await sandbox1.executeRecipe('ask-consent')
    expect(res).toEqual({ authorized: true })
    await sandbox1.terminate()

    // Test 2: Consent rejected
    const rejectingContext = createMockExecutionContext({ consentApproved: false })
    const sandbox2 = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.consent',
        name: 'Consent Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [{ id: 'ask-consent', name: 'Ask Consent', description: 'Desc', riskLevel: 'high_risk_external' }],
      },
      pluginCode: consentCode,
      hostContext: rejectingContext,
    })

    await sandbox2.start()
    await expect(sandbox2.executeRecipe('ask-consent')).rejects.toThrowError(/Consent was rejected/)
    await sandbox2.terminate()
  })

  it('passes targetPlatform to guest bridged context across OS environments', async () => {
    const platformProbeCode = `
      module.exports = {
        id: 'com.nekoai.plugin.probe',
        name: 'Platform Probe Plugin',
        version: '1.0.0',
        platform: ['linux', 'darwin', 'windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'get-platform',
            name: 'Get Platform',
            description: 'Returns guest os platform',
            riskLevel: 'read_only',
            definition: {
              id: 'get-platform',
              name: 'Get Platform',
              description: 'Returns guest os platform',
              riskLevel: 'read_only',
            },
            async execute(ctx) {
              return { platform: ctx.os.platform };
            },
          },
        ],
        async setup() {},
        getRecipe(id) {
          return this.recipes.find(r => r.id === id);
        },
      };
    `

    const hostContext = createMockExecutionContext()
    const sandbox = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.probe',
        name: 'Platform Probe Plugin',
        version: '1.0.0',
        platform: ['linux', 'darwin', 'windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [
          {
            id: 'get-platform',
            name: 'Get Platform',
            description: 'Returns guest os platform',
            riskLevel: 'read_only',
          },
        ],
      },
      pluginCode: platformProbeCode,
      hostContext,
      targetPlatform: 'linux',
      grantedCapabilities: ['desktop:window_focus'],
    })

    await sandbox.start()
    const result = await sandbox.executeRecipe<{ platform: string }>('get-platform')
    expect(result.platform).toBe('linux')
    await sandbox.terminate()
  })

  it('tracks crash counter and trips circuit breaker into degraded state when limit exceeded', async () => {
    const emptyCode = `
      module.exports = {
        id: 'com.nekoai.plugin.crash',
        name: 'Crash Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [],
        async setup() {},
      };
    `

    const hostContext = createMockExecutionContext()
    const sandbox = new PluginSandbox({
      manifest: {
        id: 'com.nekoai.plugin.crash',
        name: 'Crash Plugin',
        version: '1.0.0',
        platform: ['windows'],
        gateway: {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: ['desktop:window_focus'],
        },
        recipes: [],
      },
      pluginCode: emptyCode,
      hostContext,
      maxCrashes: 2,
      autoRestartOnCrash: false,
    })

    await sandbox.start()
    expect(sandbox.getCrashCount()).toBe(0)
    expect(sandbox.isSandboxDegraded()).toBe(false)

    // Simulate first crash
    ;(sandbox as any).handleCrash(new Error('simulated crash 1'))
    expect(sandbox.getCrashCount()).toBe(1)
    expect(sandbox.isSandboxDegraded()).toBe(false)

    // Simulate second crash tripping circuit breaker
    ;(sandbox as any).handleCrash(new Error('simulated crash 2'))
    expect(sandbox.getCrashCount()).toBe(2)
    expect(sandbox.isSandboxDegraded()).toBe(true)

    // Execution should now reject due to degraded sandbox
    await expect(sandbox.executeRecipe('any-recipe')).rejects.toThrowError(/degraded/)

    // Watchdog reset restores operational status
    sandbox.resetWatchdog()
    expect(sandbox.getCrashCount()).toBe(0)
    expect(sandbox.isSandboxDegraded()).toBe(false)

    await sandbox.terminate()
  })
})
