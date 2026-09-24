/**
 * Inter-thread message protocol and types for isolated plugin worker sandboxes.
 */

import type { ActionRecipeDefinition, CapabilityPermission, PluginManifest } from '@nekotech/plugin-protocol'

import type { UserConsentRequest } from '../authoring/types'

export type BridgeDomain = 'os' | 'ui' | 'browser' | 'memory'

export interface PluginWorkerInitMessage {
  type: 'init'
  pluginPath?: string
  pluginCode?: string
  manifest: PluginManifest
  grantedCapabilities: CapabilityPermission[]
}

export interface PluginWorkerInitAckMessage {
  type: 'init_ack'
  success: boolean
  recipes: ActionRecipeDefinition[]
  error?: string
}

export interface PluginWorkerExecuteMessage {
  type: 'execute_recipe'
  executionId: string
  recipeId: string
  inputs: Record<string, unknown>
}

export interface PluginWorkerExecuteResultMessage {
  type: 'execute_result'
  executionId: string
  success: boolean
  result?: unknown
  error?: string
}

export interface PluginWorkerBridgeCallMessage {
  type: 'bridge_call'
  callId: string
  domain: BridgeDomain
  method: string
  args: unknown[]
  requiredCapability?: CapabilityPermission
}

export interface PluginWorkerBridgeResultMessage {
  type: 'bridge_result'
  callId: string
  success: boolean
  result?: unknown
  error?: string
}

export interface PluginWorkerConsentRequestMessage {
  type: 'consent_request'
  callId: string
  request: UserConsentRequest
}

export interface PluginWorkerConsentResultMessage {
  type: 'consent_result'
  callId: string
  approved: boolean
}

export interface PluginWorkerConfigUpdateMessage {
  type: 'config_update'
  values: Record<string, unknown>
}

export type HostToWorkerMessage
  = | PluginWorkerInitMessage
    | PluginWorkerExecuteMessage
    | PluginWorkerBridgeResultMessage
    | PluginWorkerConsentResultMessage
    | PluginWorkerConfigUpdateMessage

export type WorkerToHostMessage
  = | PluginWorkerInitAckMessage
    | PluginWorkerExecuteResultMessage
    | PluginWorkerBridgeCallMessage
    | PluginWorkerConsentRequestMessage
