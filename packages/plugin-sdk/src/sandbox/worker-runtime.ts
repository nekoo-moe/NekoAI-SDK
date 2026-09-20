/**
 * Worker-thread runtime script executed inside the isolated worker environment.
 */

import type {
  BrowserCdpBridge,
  DesktopExecutorBridge,
  NekoPlugin,
  PluginExecutionContext,
  UiAutomationBridge,
  UserConsentRequest,
  UserMemoryBridge,
  WindowHandleBridge,
} from '../authoring/types'
import type {
  BridgeDomain,
  HostToWorkerMessage,
  PluginWorkerBridgeCallMessage,
  PluginWorkerConsentRequestMessage,
  WorkerToHostMessage,
} from './types'

import vm from 'node:vm'

import { parentPort } from 'node:worker_threads'

import { errorMessageFrom } from '@moeru/std'

export function initializeWorkerRuntime() {
  if (!parentPort) {
    throw new Error('initializeWorkerRuntime must be called from within a worker_thread')
  }

  const port = parentPort
  let activePlugin: NekoPlugin | null = null
  const pendingBridgeCalls = new Map<string, {
    resolve: (res: unknown) => void
    reject: (err: Error) => void
  }>()

  const pendingConsentRequests = new Map<string, {
    resolve: (approved: boolean) => void
  }>()

  let callCounter = 0

  function invokeHostBridge<T = unknown>(
    domain: BridgeDomain,
    method: string,
    args: unknown[],
    requiredCapability?: string,
  ): Promise<T> {
    const callId = `call-${++callCounter}-${Date.now()}`
    return new Promise<T>((resolve, reject) => {
      pendingBridgeCalls.set(callId, {
        resolve: res => resolve(res as T),
        reject,
      })

      const msg: PluginWorkerBridgeCallMessage = {
        type: 'bridge_call',
        callId,
        domain,
        method,
        args,
        requiredCapability,
      }
      port.postMessage(msg)
    })
  }

  function invokeHostConsent(request: UserConsentRequest): Promise<boolean> {
    const callId = `consent-${++callCounter}-${Date.now()}`
    return new Promise<boolean>((resolve) => {
      pendingConsentRequests.set(callId, { resolve })
      const msg: PluginWorkerConsentRequestMessage = {
        type: 'consent_request',
        callId,
        request,
      }
      port.postMessage(msg)
    })
  }

  function createBridgedContext(signal?: AbortSignal): PluginExecutionContext {
    const os: DesktopExecutorBridge = {
      platform: 'windows',
      async ensureWindow(options) {
        const handle = await invokeHostBridge<{ title: string, executable?: string }>(
          'os',
          'ensureWindow',
          [options],
          'desktop:window_focus',
        )
        const windowBridge: WindowHandleBridge = {
          title: handle.title,
          executable: handle.executable,
          async focus() {
            await invokeHostBridge('os', 'focusWindow', [{ title: handle.title }], 'desktop:window_focus')
          },
        }
        return windowBridge
      },
      async findWindow(options) {
        const handle = await invokeHostBridge<{ title: string, executable?: string } | undefined>(
          'os',
          'findWindow',
          [options],
          'desktop:window_focus',
        )
        if (!handle) {
          return undefined
        }
        const windowBridge: WindowHandleBridge = {
          title: handle.title,
          executable: handle.executable,
          async focus() {
            await invokeHostBridge('os', 'focusWindow', [{ title: handle.title }], 'desktop:window_focus')
          },
        }
        return windowBridge
      },
      async sleep(ms: number) {
        await new Promise(resolve => setTimeout(resolve, ms))
      },
      async handleFileDialog(filePath: string) {
        await invokeHostBridge('os', 'handleFileDialog', [filePath], 'filesystem:write')
      },
      async launchApp(executable, args) {
        return invokeHostBridge('os', 'launchApp', [executable, args], 'desktop:window_focus')
      },
    }

    const ui: UiAutomationBridge = {
      async pressKeyChord(chord) {
        await invokeHostBridge('ui', 'pressKeyChord', [chord], 'desktop:synthetic_input')
      },
      async pressKey(key) {
        await invokeHostBridge('ui', 'pressKey', [key], 'desktop:synthetic_input')
      },
      async typeText(text) {
        await invokeHostBridge('ui', 'typeText', [text], 'desktop:synthetic_input')
      },
      async clickElement(options) {
        await invokeHostBridge('ui', 'clickElement', [options], 'desktop:synthetic_input')
      },
      async hasElement(options) {
        return invokeHostBridge<boolean>('ui', 'hasElement', [options], 'desktop:synthetic_input')
      },
      async findVisualAnchor(options) {
        return invokeHostBridge('ui', 'findVisualAnchor', [options], 'desktop:synthetic_input')
      },
      async hasVisualAnchor(options) {
        return invokeHostBridge<boolean>('ui', 'hasVisualAnchor', [options], 'desktop:synthetic_input')
      },
      async clickCoordinates(x, y) {
        await invokeHostBridge('ui', 'clickCoordinates', [x, y], 'desktop:synthetic_input')
      },
    }

    const browser: BrowserCdpBridge = {
      async navigate(url) {
        await invokeHostBridge('browser', 'navigate', [url], 'browser:navigation')
      },
      async click(selector) {
        await invokeHostBridge('browser', 'click', [selector], 'browser:dom')
      },
      async type(selector, text, options) {
        await invokeHostBridge('browser', 'type', [selector, text, options], 'browser:dom')
      },
      async evaluate<T = unknown>(script: string) {
        return invokeHostBridge<T>('browser', 'evaluate', [script], 'browser:cdp')
      },
      async waitForSelector(selector, options) {
        return invokeHostBridge<boolean>('browser', 'waitForSelector', [selector, options], 'browser:dom')
      },
    }

    const memory: UserMemoryBridge = {
      async lookupAlias(term) {
        return invokeHostBridge<string | undefined>('memory', 'lookupAlias', [term], 'memory:personalization')
      },
      async getVaultAsset(id) {
        return invokeHostBridge<string | undefined>('memory', 'getVaultAsset', [id], 'memory:personalization')
      },
      async getContact(name) {
        return invokeHostBridge('memory', 'getContact', [name], 'memory:personalization')
      },
    }

    return {
      os,
      ui,
      browser,
      memory,
      signal,
      consentGate: async request => invokeHostConsent(request),
    }
  }

  port.on('message', async (message: HostToWorkerMessage) => {
    if (message.type === 'init') {
      try {
        let loadedModule: any
        if (message.pluginPath) {
          loadedModule = await import(message.pluginPath)
        }
        else if (message.pluginCode) {
          // Dynamic evaluated script for test fixtures
          const modExports = {}
          const mod = { exports: modExports }
          const sandbox = {
            exports: modExports,
            module: mod,
            console,
            setTimeout,
            clearTimeout,
          }
          vm.runInNewContext(message.pluginCode, sandbox)
          loadedModule = mod.exports
        }

        activePlugin = loadedModule?.default ?? loadedModule
        if (!activePlugin || typeof activePlugin.setup !== 'function') {
          throw new Error('Plugin module does not export a valid NekoPlugin instance')
        }

        await activePlugin.setup()

        const ack: WorkerToHostMessage = {
          type: 'init_ack',
          success: true,
          recipes: activePlugin.recipes.map(r => r.definition),
        }
        port.postMessage(ack)
      }
      catch (error) {
        const ack: WorkerToHostMessage = {
          type: 'init_ack',
          success: false,
          recipes: [],
          error: errorMessageFrom(error),
        }
        port.postMessage(ack)
      }
      return
    }

    if (message.type === 'bridge_result') {
      const pending = pendingBridgeCalls.get(message.callId)
      if (pending) {
        pendingBridgeCalls.delete(message.callId)
        if (message.success) {
          pending.resolve(message.result)
        }
        else {
          pending.reject(new Error(message.error ?? 'Bridge invocation failed'))
        }
      }
      return
    }

    if (message.type === 'consent_result') {
      const pending = pendingConsentRequests.get(message.callId)
      if (pending) {
        pendingConsentRequests.delete(message.callId)
        pending.resolve(message.approved)
      }
      return
    }

    if (message.type === 'execute_recipe') {
      if (!activePlugin) {
        port.postMessage({
          type: 'execute_result',
          executionId: message.executionId,
          success: false,
          error: 'Plugin is not initialized',
        })
        return
      }

      const recipe = activePlugin.getRecipe(message.recipeId)
      if (!recipe) {
        port.postMessage({
          type: 'execute_result',
          executionId: message.executionId,
          success: false,
          error: `Recipe "${message.recipeId}" not found in plugin "${activePlugin.id}"`,
        })
        return
      }

      try {
        const context = createBridgedContext()
        const result = await recipe.execute(context, message.inputs)
        port.postMessage({
          type: 'execute_result',
          executionId: message.executionId,
          success: true,
          result,
        })
      }
      catch (error) {
        port.postMessage({
          type: 'execute_result',
          executionId: message.executionId,
          success: false,
          error: errorMessageFrom(error),
        })
      }
    }
  })
}

// If executed directly as the worker thread entrypoint
if (parentPort) {
  initializeWorkerRuntime()
}
