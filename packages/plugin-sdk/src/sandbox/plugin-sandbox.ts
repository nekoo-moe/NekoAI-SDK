/**
 * Host-side manager for running untrusted / sideloaded plugins in an isolated Node.js worker_thread.
 */

import type { FSWatcher } from 'node:fs'

import type { ActionRecipeDefinition, CapabilityPermission, PluginManifest } from '@nekotech/plugin-protocol'

import type { PluginExecutionContext, UserConsentRequest } from '../authoring/types'
import type {
  HostToWorkerMessage,
  PluginWorkerBridgeCallMessage,
  PluginWorkerConsentRequestMessage,
  WorkerToHostMessage,
} from './types'

import process from 'node:process'

import { watch } from 'node:fs'
import { dirname } from 'node:path'
import { Worker } from 'node:worker_threads'

import { errorMessageFrom } from '@moeru/std'

export interface PluginSandboxOptions {
  manifest: PluginManifest
  pluginPath?: string
  pluginCode?: string
  hostContext: PluginExecutionContext
  workerScriptPath?: string
  grantedCapabilities?: CapabilityPermission[]
  targetPlatform?: string
  maxCrashes?: number
  autoRestartOnCrash?: boolean
}

/**
 * Creates the default in-memory bootstrap script for the worker thread.
 */
export function createDefaultWorkerBootstrap(targetPlatform: string = process.platform): string {
  return `
    const { parentPort } = require('node:worker_threads');
    const { pathToFileURL } = require('node:url');
    let activePlugin = null;
    const pendingCalls = new Map();
    const pendingConsent = new Map();
    let counter = 0;

    function invokeBridge(domain, method, args, requiredCapability) {
      const callId = 'call-' + (++counter) + '-' + Date.now();
      return new Promise((resolve, reject) => {
        pendingCalls.set(callId, { resolve, reject });
        parentPort.postMessage({ type: 'bridge_call', callId, domain, method, args, requiredCapability });
      });
    }

    function invokeConsent(request) {
      const callId = 'consent-' + (++counter) + '-' + Date.now();
      return new Promise((resolve) => {
        pendingConsent.set(callId, { resolve });
        parentPort.postMessage({ type: 'consent_request', callId, request });
      });
    }

    function createBridgedContext() {
      return {
        os: {
          platform: '${targetPlatform}',
          ensureWindow: async (opts) => {
            const h = await invokeBridge('os', 'ensureWindow', [opts], 'desktop:window_focus');
            return {
              title: h.title,
              executable: h.executable,
              focus: () => invokeBridge('os', 'focusWindow', [{ title: h.title }], 'desktop:window_focus'),
            };
          },
          findWindow: async (opts) => {
            const h = await invokeBridge('os', 'findWindow', [opts], 'desktop:window_focus');
            if (!h) return undefined;
            return {
              title: h.title,
              executable: h.executable,
              focus: () => invokeBridge('os', 'focusWindow', [{ title: h.title }], 'desktop:window_focus'),
            };
          },
          sleep: (ms) => new Promise(r => setTimeout(r, ms)),
          handleFileDialog: (fp) => invokeBridge('os', 'handleFileDialog', [fp], 'filesystem:write'),
        },
        ui: {
          pressKeyChord: (chord) => invokeBridge('ui', 'pressKeyChord', [chord], 'desktop:synthetic_input'),
          pressKey: (key) => invokeBridge('ui', 'pressKey', [key], 'desktop:synthetic_input'),
          typeText: (txt) => invokeBridge('ui', 'typeText', [txt], 'desktop:synthetic_input'),
          clickElement: (opts) => invokeBridge('ui', 'clickElement', [opts], 'desktop:synthetic_input'),
          hasElement: (opts) => invokeBridge('ui', 'hasElement', [opts], 'desktop:synthetic_input'),
        },
        browser: {
          navigate: (url) => invokeBridge('browser', 'navigate', [url], 'browser:navigation'),
          click: (sel) => invokeBridge('browser', 'click', [sel], 'browser:dom'),
          type: (sel, txt, opts) => invokeBridge('browser', 'type', [sel, txt, opts], 'browser:dom'),
          evaluate: (scr) => invokeBridge('browser', 'evaluate', [scr], 'browser:cdp'),
        },
        memory: {
          lookupAlias: (term) => invokeBridge('memory', 'lookupAlias', [term], 'memory:personalization'),
          getVaultAsset: (id) => invokeBridge('memory', 'getVaultAsset', [id], 'memory:personalization'),
          getContact: (name) => invokeBridge('memory', 'getContact', [name], 'memory:personalization'),
        },
        consentGate: (req) => invokeConsent(req),
      };
    }

    parentPort.on('message', async (msg) => {
      if (msg.type === 'init') {
        try {
          if (msg.pluginCode) {
            const fn = new Function('require', 'exports', 'module', msg.pluginCode);
            const modExports = {};
            const mod = { exports: modExports };
            fn(require, modExports, mod);
            activePlugin = mod.exports.default || mod.exports;
          } else if (msg.pluginPath) {
            const fileUrl = msg.pluginPath.startsWith('file://')
              ? msg.pluginPath
              : pathToFileURL(msg.pluginPath).href;
            const imported = await import(fileUrl);
            activePlugin = imported.default || imported;
          }
          if (!activePlugin || typeof activePlugin.setup !== 'function') {
            throw new Error('Plugin does not export a valid setup function');
          }
          await activePlugin.setup();
          parentPort.postMessage({
            type: 'init_ack',
            success: true,
            recipes: activePlugin.recipes.map(r => r.definition),
          });
        } catch (err) {
          parentPort.postMessage({
            type: 'init_ack',
            success: false,
            recipes: [],
            error: err && err.message ? err.message : String(err),
          });
        }
        return;
      }

      if (msg.type === 'bridge_result') {
        const pending = pendingCalls.get(msg.callId);
        if (pending) {
          pendingCalls.delete(msg.callId);
          if (msg.success) pending.resolve(msg.result);
          else pending.reject(new Error(msg.error || 'Bridge call failed'));
        }
        return;
      }

      if (msg.type === 'consent_result') {
        const pending = pendingConsent.get(msg.callId);
        if (pending) {
          pendingConsent.delete(msg.callId);
          pending.resolve(msg.approved);
        }
        return;
      }

      if (msg.type === 'execute_recipe') {
        try {
          const recipe = activePlugin.recipes.find(r => r.id === msg.recipeId);
          if (!recipe) throw new Error('Recipe not found: ' + msg.recipeId);
          const ctx = createBridgedContext();
          const result = await recipe.execute(ctx, msg.inputs);
          parentPort.postMessage({
            type: 'execute_result',
            executionId: msg.executionId,
            success: true,
            result,
          });
        } catch (err) {
          parentPort.postMessage({
            type: 'execute_result',
            executionId: msg.executionId,
            success: false,
            error: err && err.message ? err.message : String(err),
          });
        }
      }
    });
  `
}

/**
 * Isolated execution sandbox for running third-party or sideloaded NekoAI plugins
 * inside a separate Node.js worker thread with restricted capability tokens.
 */
export class PluginSandbox {
  private worker: Worker | null = null
  private readonly manifest: PluginManifest
  private readonly pluginPath?: string
  private readonly pluginCode?: string
  private readonly hostContext: PluginExecutionContext
  private readonly workerScriptPath?: string
  private readonly grantedCapabilities: Set<CapabilityPermission>
  private readonly targetPlatform: string
  private readonly maxCrashes: number
  private readonly autoRestartOnCrash: boolean
  private crashCount = 0
  private isDegraded = false
  private isTerminated = false
  private recipes: ActionRecipeDefinition[] = []
  private watcher: FSWatcher | null = null

  private pendingExecutions = new Map<string, {
    resolve: (val: unknown) => void
    reject: (err: Error) => void
  }>()

  private executionCounter = 0

  constructor(options: PluginSandboxOptions) {
    this.manifest = options.manifest
    this.pluginPath = options.pluginPath
    this.pluginCode = options.pluginCode
    this.hostContext = options.hostContext
    this.workerScriptPath = options.workerScriptPath
    this.targetPlatform = options.targetPlatform ?? process.platform
    this.maxCrashes = options.maxCrashes ?? 3
    this.autoRestartOnCrash = options.autoRestartOnCrash ?? true
    this.grantedCapabilities = new Set(
      options.grantedCapabilities ?? options.manifest.gateway.requiredPermissions,
    )
  }

  /**
   * Spawns the worker thread, initializes the plugin, and returns registered recipe descriptors.
   */
  async start(): Promise<ActionRecipeDefinition[]> {
    if (this.isDegraded) {
      throw new Error(`Sandbox for plugin "${this.manifest.id}" is degraded due to repeated worker crashes (${this.crashCount})`)
    }

    if (this.worker) {
      return this.recipes
    }

    this.isTerminated = false

    return new Promise<ActionRecipeDefinition[]>((resolve, reject) => {
      try {
        if (this.workerScriptPath) {
          this.worker = new Worker(this.workerScriptPath)
        }
        else {
          this.worker = new Worker(createDefaultWorkerBootstrap(this.targetPlatform), { eval: true })
        }

        this.worker.on('message', async (message: WorkerToHostMessage) => {
          await this.handleWorkerMessage(message)
        })

        this.worker.on('error', (err) => {
          reject(new Error(`Plugin worker thread crashed: ${errorMessageFrom(err)}`))
        })

        const initMessage: HostToWorkerMessage = {
          type: 'init',
          pluginPath: this.pluginPath,
          pluginCode: this.pluginCode,
          manifest: this.manifest,
          grantedCapabilities: Array.from(this.grantedCapabilities),
        }

        const handleInitAck = (msg: WorkerToHostMessage) => {
          if (msg.type === 'init_ack') {
            this.worker?.off('message', handleInitAck)
            if (msg.success) {
              this.recipes = msg.recipes
              this.setupWatchdogListeners()
              resolve(msg.recipes)
            }
            else {
              reject(new Error(`Failed to initialize plugin "${this.manifest.id}": ${msg.error}`))
            }
          }
        }

        this.worker.on('message', handleInitAck)
        this.worker.postMessage(initMessage)
      }
      catch (err) {
        reject(new Error(`Could not spawn plugin worker: ${errorMessageFrom(err)}`))
      }
    })
  }

  /**
   * Executes an action recipe in the isolated worker thread with given inputs.
   */
  async executeRecipe<T = unknown>(
    recipeId: string,
    inputs: Record<string, unknown> = {},
  ): Promise<T> {
    if (this.isDegraded) {
      throw new Error(`Sandbox for plugin "${this.manifest.id}" is degraded due to repeated worker crashes (${this.crashCount})`)
    }

    if (!this.worker) {
      throw new Error(`Sandbox for plugin "${this.manifest.id}" is not started`)
    }

    const executionId = `exec-${++this.executionCounter}-${Date.now()}`

    return new Promise<T>((resolve, reject) => {
      this.pendingExecutions.set(executionId, {
        resolve: val => resolve(val as T),
        reject,
      })

      const msg: HostToWorkerMessage = {
        type: 'execute_recipe',
        executionId,
        recipeId,
        inputs,
      }
      this.worker?.postMessage(msg)
    })
  }

  /**
   * Enables hot-reloading by watching the plugin's source file/directory on disk.
   */
  enableHotReload(options: { watchPath?: string, onReload?: () => void } = {}): void {
    const targetPath = options.watchPath ?? this.pluginPath
    if (!targetPath) {
      return
    }

    const watchDir = dirname(targetPath)
    this.watcher = watch(watchDir, { recursive: true }, async () => {
      try {
        await this.terminate()
        await this.start()
        options.onReload?.()
      }
      catch {
        // Silently retry on next change
      }
    })
  }

  /**
   * Terminates the worker thread and cleans up watchers.
   */
  async terminate(): Promise<void> {
    this.isTerminated = true
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }

    if (this.worker) {
      this.worker.removeAllListeners()
      await this.worker.terminate()
      this.worker.unref()
      this.worker = null
    }

    this.pendingExecutions.clear()
  }

  /**
   * Restarts the worker thread after crash or for reload.
   */
  async restart(): Promise<ActionRecipeDefinition[]> {
    if (this.worker) {
      this.worker.removeAllListeners()
      try {
        await this.worker.terminate()
      }
      catch {
        // Ignore termination error on restart
      }
      this.worker = null
    }
    return await this.start()
  }

  getCrashCount(): number {
    return this.crashCount
  }

  isSandboxDegraded(): boolean {
    return this.isDegraded
  }

  resetWatchdog(): void {
    this.crashCount = 0
    this.isDegraded = false
  }

  private setupWatchdogListeners(): void {
    if (!this.worker) {
      return
    }

    this.worker.on('error', (err) => {
      this.handleCrash(new Error(`Plugin worker thread crashed: ${errorMessageFrom(err)}`))
    })

    this.worker.on('exit', (exitCode) => {
      if (exitCode !== 0 && !this.isTerminated) {
        this.handleCrash(new Error(`Plugin worker thread exited unexpectedly with code ${exitCode}`))
      }
    })
  }

  private handleCrash(error: Error): void {
    this.crashCount++
    for (const pending of this.pendingExecutions.values()) {
      pending.reject(error)
    }
    this.pendingExecutions.clear()

    if (this.crashCount >= this.maxCrashes) {
      this.isDegraded = true
      return
    }

    if (this.autoRestartOnCrash && !this.isTerminated) {
      this.restart().catch(() => {
        this.isDegraded = true
      })
    }
  }

  getRegisteredRecipes(): ActionRecipeDefinition[] {
    return this.recipes
  }

  private async handleWorkerMessage(message: WorkerToHostMessage): Promise<void> {
    if (message.type === 'execute_result') {
      const pending = this.pendingExecutions.get(message.executionId)
      if (pending) {
        this.pendingExecutions.delete(message.executionId)
        if (message.success) {
          pending.resolve(message.result)
        }
        else {
          pending.reject(new Error(message.error ?? 'Recipe execution failed in sandbox'))
        }
      }
      return
    }

    if (message.type === 'bridge_call') {
      await this.handleBridgeCall(message)
      return
    }

    if (message.type === 'consent_request') {
      await this.handleConsentRequest(message)
    }
  }

  private async handleBridgeCall(call: PluginWorkerBridgeCallMessage): Promise<void> {
    const { callId, domain, method, args, requiredCapability } = call

    // Enforce capability token boundary: Fail-closed if capability is not granted
    if (requiredCapability && !this.grantedCapabilities.has(requiredCapability)) {
      this.worker?.postMessage({
        type: 'bridge_result',
        callId,
        success: false,
        error: `Capability permission denied: Plugin "${this.manifest.id}" does not hold granted capability "${requiredCapability}"`,
      })
      return
    }

    try {
      const bridgeObj = this.hostContext[domain] as any
      if (!bridgeObj || typeof bridgeObj[method] !== 'function') {
        throw new Error(`Host domain bridge "${domain}.${method}" is not available`)
      }

      let result = await bridgeObj[method](...args)
      // Window handles carry client-side focus() closures which cannot be cloned across worker threads.
      // Normalize to plain serializable descriptors.
      if (result && typeof result === 'object' && ('title' in result || 'focus' in result)) {
        result = {
          title: (result as any).title,
          executable: (result as any).executable,
        }
      }

      this.worker?.postMessage({
        type: 'bridge_result',
        callId,
        success: true,
        result,
      })
    }
    catch (error) {
      this.worker?.postMessage({
        type: 'bridge_result',
        callId,
        success: false,
        error: errorMessageFrom(error),
      })
    }
  }

  private async handleConsentRequest(msg: PluginWorkerConsentRequestMessage): Promise<void> {
    const { callId, request } = msg
    try {
      let approved = true
      if (this.hostContext.consentGate) {
        approved = await this.hostContext.consentGate(request as UserConsentRequest)
      }

      this.worker?.postMessage({
        type: 'consent_result',
        callId,
        approved,
      })
    }
    catch {
      this.worker?.postMessage({
        type: 'consent_result',
        callId,
        approved: false,
      })
    }
  }
}
