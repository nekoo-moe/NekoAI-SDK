/**
 * Universal Plugin Protocol and Manifest Specification for NekoAI
 * Defines Valibot schemas, capability permission scopes, and gateway contracts for application plugins.
 */

import * as v from 'valibot'

/**
 * Operating system platforms supported by a plugin.
 */
export const PluginPlatformSchema = v.picklist(['windows', 'linux', 'macos', 'web'])
export type PluginPlatform = v.InferOutput<typeof PluginPlatformSchema>

/**
 * Interface gateway connection types for application automation.
 */
export const GatewayTypeSchema = v.picklist([
  'native-app',
  'browser-cdp',
  'mcp',
  'ui-automation',
  'native-ipc',
])
export type GatewayType = v.InferOutput<typeof GatewayTypeSchema>

/**
 * Target automation surfaces for sensory observation and actuation.
 */
export const AutomationSurfaceSchema = v.picklist([
  'ui-automation',
  'browser-cdp',
  'native-api',
  'visual-grounding',
])
export type AutomationSurface = v.InferOutput<typeof AutomationSurfaceSchema>

/**
 * Standard capability permission tokens required for execution sandboxing.
 */
export const StandardCapabilityPermissionSchema = v.picklist([
  'filesystem:read',
  'filesystem:write',
  'desktop:window_focus',
  'desktop:synthetic_input',
  'browser:navigation',
  'browser:dom',
  'browser:cdp',
  'network:external',
  'terminal:exec',
  'memory:personalization',
])
export type StandardCapabilityPermission = v.InferOutput<typeof StandardCapabilityPermissionSchema>

export const CapabilityPermissionSchema = v.string()
export type CapabilityPermission = string

/**
 * Executable resolution map per platform (e.g. { windows: ["Acrobat.exe"], macos: ["..."] }).
 */
export const PlatformExecutableMapSchema = v.record(
  PluginPlatformSchema,
  v.union([v.string(), v.array(v.string())]),
)
export type PlatformExecutableMap = v.InferOutput<typeof PlatformExecutableMapSchema>

/**
 * Interface gateway definition.
 */
export const InterfaceGatewaySchema = v.object({
  type: GatewayTypeSchema,
  executable: v.optional(PlatformExecutableMapSchema),
  automationSurface: AutomationSurfaceSchema,
  requiredPermissions: v.array(CapabilityPermissionSchema),
})
export type InterfaceGateway = v.InferOutput<typeof InterfaceGatewaySchema>

/**
 * Visual anchor template definition for Computer Vision grounding.
 */
export const VisualAnchorDefinitionSchema = v.object({
  id: v.string(),
  templatePath: v.string(),
  confidenceThreshold: v.optional(v.number()),
})
export type VisualAnchorDefinition = v.InferOutput<typeof VisualAnchorDefinitionSchema>

/**
 * Domain-specific semantic knowledge and heuristics for application operation.
 */
export const SemanticKnowledgeSchema = v.object({
  promptInjection: v.optional(v.string()),
  shortcuts: v.optional(v.record(v.string(), v.string())),
  selectors: v.optional(v.record(v.string(), v.string())),
  visualAnchors: v.optional(v.union([
    v.array(VisualAnchorDefinitionSchema),
    v.record(v.string(), v.string()),
  ])),
})
export type SemanticKnowledge = v.InferOutput<typeof SemanticKnowledgeSchema>

/**
 * Action risk tiers for governance, sandboxing, and human consent evaluation.
 */
export const ActionRiskLevelSchema = v.picklist([
  'read_only', // Tier 1: Zero local/remote side-effects (e.g. read, inspect)
  'reversible_local', // Tier 2: Low-risk local input under rate limiter (e.g. scroll, move, draft)
  'moderate_local_mutation', // Tier 3: Local disk/state mutation (e.g. save file, stamp signature)
  'high_risk_external', // Tier 4: Irreversible external effect requiring MANDATORY user consent
])
export type ActionRiskLevel = v.InferOutput<typeof ActionRiskLevelSchema>

/**
 * Parameter input schema for an action recipe.
 */
export const RecipeInputSchema = v.object({
  type: v.picklist(['string', 'number', 'integer', 'boolean', 'object', 'array']),
  description: v.optional(v.string()),
  required: v.optional(v.boolean()),
  default: v.optional(v.unknown()),
})
export type RecipeInput = v.InferOutput<typeof RecipeInputSchema>

/**
 * Declarative action recipe definition exported by an application plugin.
 */
export const ActionRecipeDefinitionSchema = v.object({
  id: v.pipe(
    v.string(),
    v.regex(/^[a-z0-9-]+$/, 'Recipe ID must be kebab-case (e.g. "sign-pdf")'),
  ),
  name: v.string(),
  description: v.string(),
  riskLevel: ActionRiskLevelSchema,
  inputs: v.optional(v.record(v.string(), RecipeInputSchema)),
})
export type ActionRecipeDefinition = v.InferOutput<typeof ActionRecipeDefinitionSchema>

/**
 * Top-level Plugin Manifest Schema (`neko-plugin.json`).
 */
export const PluginManifestSchema = v.object({
  $schema: v.optional(v.string()),
  id: v.pipe(
    v.string(),
    v.regex(
      /^[\w-]+(\.[\w-]+)+$/,
      'Plugin ID must follow reverse-DNS notation (e.g. "com.nekoai.plugin.acrobat")',
    ),
  ),
  name: v.string(),
  version: v.pipe(
    v.string(),
    v.regex(
      /^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/,
      'Plugin version must follow SemVer (e.g. "1.0.0")',
    ),
  ),
  description: v.optional(v.string()),
  author: v.optional(v.string()),
  license: v.optional(v.string()),
  platform: v.array(PluginPlatformSchema),
  gateway: InterfaceGatewaySchema,
  knowledge: v.optional(SemanticKnowledgeSchema),
  recipes: v.array(ActionRecipeDefinitionSchema),
})
export type PluginManifest = v.InferOutput<typeof PluginManifestSchema>

/**
 * Parse and validate a plugin manifest object, throwing a descriptive error if invalid.
 */
export function parsePluginManifest(input: unknown): PluginManifest {
  return v.parse(PluginManifestSchema, input)
}

/**
 * Safely parse a plugin manifest object without throwing.
 */
export function safeParsePluginManifest(input: unknown) {
  return v.safeParse(PluginManifestSchema, input)
}

/**
 * Type guard checking whether an object conforms to PluginManifest.
 */
export function isPluginManifest(input: unknown): input is PluginManifest {
  return safeParsePluginManifest(input).success
}

/**
 * List of all standard capability permission tokens recognized by NekoAI.
 */
export const STANDARD_CAPABILITY_PERMISSIONS = [
  'filesystem:read',
  'filesystem:write',
  'desktop:window_focus',
  'desktop:synthetic_input',
  'browser:navigation',
  'browser:dom',
  'browser:cdp',
  'network:external',
  'terminal:exec',
  'memory:personalization',
] as const

/**
 * Checks whether a given capability permission token is a standard recognized capability.
 */
export function isStandardCapabilityPermission(permission: string): boolean {
  return v.safeParse(StandardCapabilityPermissionSchema, permission).success
}

/**
 * Checks whether a given manifest declares a specific capability permission token.
 */
export function hasCapabilityPermission(
  manifest: PluginManifest,
  permission: CapabilityPermission,
): boolean {
  return manifest.gateway.requiredPermissions.includes(permission)
}
