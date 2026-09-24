/**
 * Types and execution context bridges for the NekoAI Plugin Authoring SDK.
 */

import type {
  ActionRecipeDefinition,
  ActionRiskLevel,
  CapabilityPermission,
  InterfaceGateway,
  PluginCategory,
  PluginContributions,
  PluginManifest,
  PluginManifestV2,
  PluginPlatform,
  PluginSettings,
  RecipeInput,
  SemanticKnowledge,
  SettingsFieldDefinition,
  SettingsGroupDefinition,
} from '@nekotech/plugin-protocol'

export type {
  PluginCategory,
  PluginContributions,
  PluginManifestV2,
  PluginSettings,
  SettingsFieldDefinition,
  SettingsGroupDefinition,
}

/**
 * Window handle abstraction for OS-level window management.
 */
export interface WindowHandleBridge {
  title: string
  executable?: string
  focus: () => Promise<void>
  close?: () => Promise<void>
}

/**
 * OS-level desktop automation bridge.
 */
export interface DesktopExecutorBridge {
  platform: 'windows' | 'linux' | 'macos'
  ensureWindow: (options: {
    titleRegex?: RegExp
    executable?: string
    timeoutMs?: number
  }) => Promise<WindowHandleBridge>
  findWindow: (options: {
    titleRegex?: RegExp
    executable?: string
  }) => Promise<WindowHandleBridge | undefined>
  focusWindow?: (options: { title?: string, executable?: string }) => Promise<void>
  sleep: (ms: number) => Promise<void>
  handleFileDialog: (filePath: string) => Promise<void>
  launchApp?: (executable: string, args?: string[]) => Promise<{ pid?: number }>
}

/**
 * UI Automation and visual grounding bridge.
 */
export interface UiAutomationBridge {
  pressKeyChord: (chord: string) => Promise<void>
  pressKey: (key: string) => Promise<void>
  typeText: (text: string) => Promise<void>
  clickElement: (options: { selector?: string, textMatch?: string }) => Promise<void>
  hasElement: (options: { selector?: string, textMatch?: string }) => Promise<boolean>
  findVisualAnchor?: (options: {
    templatePath: string
    confidenceThreshold?: number
  }) => Promise<{ x: number, y: number } | undefined>
  hasVisualAnchor?: (options: {
    templatePath: string
    confidenceThreshold?: number
  }) => Promise<boolean>
  clickCoordinates?: (x: number, y: number) => Promise<void>
}

/**
 * Browser Chrome DevTools Protocol (CDP) bridge.
 */
export interface BrowserCdpBridge {
  navigate: (url: string) => Promise<void>
  click: (selector: string) => Promise<void>
  type: (selector: string, text: string, options?: { pressEnter?: boolean }) => Promise<void>
  evaluate: <T = unknown>(script: string) => Promise<T>
  waitForSelector: (selector: string, options?: { timeoutMs?: number }) => Promise<boolean>
}

/**
 * User contact record resolved from personalized memory.
 */
export interface UserContactRecord {
  id: string
  name: string
  platformId?: string
  metadata?: Record<string, unknown>
}

/**
 * Personalized long-term memory bridge (Memory Alaya).
 */
export interface UserMemoryBridge {
  lookupAlias: (term: string) => Promise<string | undefined>
  getVaultAsset: (assetIdentifier: string) => Promise<string | undefined>
  getContact: (contactName: string) => Promise<UserContactRecord | undefined>
}

/**
 * Request payload for user consent interception.
 */
export interface UserConsentRequest<TPayload = Record<string, unknown>> {
  actionRef: string
  summary: string
  level?: ActionRiskLevel
  payload?: TPayload
}

/**
 * Execution context injected into an action recipe during runtime.
 */
export interface PluginExecutionContext {
  os: DesktopExecutorBridge
  ui: UiAutomationBridge
  browser?: BrowserCdpBridge
  memory: UserMemoryBridge
  signal?: AbortSignal
  consentGate?: (request: UserConsentRequest) => Promise<boolean>
}

/**
 * Declarative action recipe authoring specification.
 */
export interface ActionRecipeSpecification<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string
  name: string
  description: string
  riskLevel: ActionRiskLevel
  inputs?: Record<string, RecipeInput>
  execute: (context: PluginExecutionContext, inputs: TInput) => Promise<TOutput>
}

/**
 * Instantiated, executable action recipe.
 */
export interface ActionRecipe<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string
  name: string
  description: string
  riskLevel: ActionRiskLevel
  inputs?: Record<string, RecipeInput>
  definition: ActionRecipeDefinition
  execute: (context: PluginExecutionContext, inputs: TInput) => Promise<TOutput>
}

/**
 * Context provided during plugin setup for registering action recipes.
 */
export interface PluginSetupContext {
  registerRecipe: <TIn = Record<string, unknown>, TOut = unknown>(
    recipe: ActionRecipe<TIn, TOut>,
  ) => void
}

/**
 * Declarative plugin authoring definition passed to `definePlugin`.
 */
export interface NekoPluginDefinition {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  category?: PluginCategory
  subCategory?: string
  tags?: string[]
  platform: PluginPlatform[]
  gateway?: InterfaceGateway
  knowledge?: SemanticKnowledge
  settings?: PluginSettings
  contributions?: PluginContributions
  setup: (context: PluginSetupContext) => void | Promise<void>
}

/**
 * Runtime plugin instance produced by `definePlugin`.
 */
export interface NekoPlugin {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  license?: string
  category?: PluginCategory
  subCategory?: string
  tags?: string[]
  platform: PluginPlatform[]
  gateway?: InterfaceGateway
  knowledge?: SemanticKnowledge
  settings?: PluginSettings
  contributions?: PluginContributions
  recipes: ActionRecipe[]
  setup: () => Promise<void>
  getRecipe: (id: string) => ActionRecipe | undefined
  getManifest: () => PluginManifest
  hasPermission: (permission: CapabilityPermission) => boolean
}
