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
  v.string(),
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
 * Standard domain category picklist for plugin taxonomy, hub routing, and discovery.
 */
export const PluginCategorySchema = v.picklist([
  'essential',
  'gaming',
  'messaging',
  'productivity',
  'developer',
  'system',
  'creative',
  'custom',
])
export type PluginCategory = v.InferOutput<typeof PluginCategorySchema>

/**
 * Declarative settings field types supported by the UI renderer.
 */
export const SettingsFieldTypeSchema = v.picklist([
  'boolean',
  'string',
  'number',
  'select',
  'slider',
  'secret',
  'keybinding',
])
export type SettingsFieldType = v.InferOutput<typeof SettingsFieldTypeSchema>

/**
 * Option definition for select / dropdown settings fields.
 */
export const SettingsFieldOptionSchema = v.object({
  label: v.string(),
  value: v.union([v.string(), v.number(), v.boolean()]),
  description: v.optional(v.string()),
})
export type SettingsFieldOption = v.InferOutput<typeof SettingsFieldOptionSchema>

/**
 * Schema definition for an individual configurable setting item.
 */
export const SettingsFieldDefinitionSchema = v.object({
  key: v.string(),
  type: SettingsFieldTypeSchema,
  label: v.string(),
  description: v.optional(v.string()),
  defaultValue: v.unknown(),
  required: v.optional(v.boolean()),
  options: v.optional(v.array(SettingsFieldOptionSchema)),
  min: v.optional(v.number()),
  max: v.optional(v.number()),
  step: v.optional(v.number()),
  readOnly: v.optional(v.boolean()),
  secret: v.optional(v.boolean()),
  group: v.optional(v.string()),
})
export type SettingsFieldDefinition = v.InferOutput<typeof SettingsFieldDefinitionSchema>

/**
 * Visual section grouping for organizing complex plugin configurations.
 */
export const SettingsGroupDefinitionSchema = v.object({
  id: v.string(),
  title: v.string(),
  description: v.optional(v.string()),
})
export type SettingsGroupDefinition = v.InferOutput<typeof SettingsGroupDefinitionSchema>

/**
 * Complete declarative settings schema exported by an application plugin.
 */
export const PluginSettingsSchema = v.object({
  groups: v.optional(v.array(SettingsGroupDefinitionSchema)),
  fields: v.array(SettingsFieldDefinitionSchema),
})
export type PluginSettings = v.InferOutput<typeof PluginSettingsSchema>

/**
 * Quick action command definition contributed to the chat prompt bar.
 */
export const QuickCommandDefinitionSchema = v.object({
  id: v.string(),
  title: v.string(),
  recipeId: v.string(),
})
export type QuickCommandDefinition = v.InferOutput<typeof QuickCommandDefinitionSchema>

/**
 * Host surface contributions declared by a plugin.
 */
export const PluginContributionsSchema = v.object({
  icon: v.optional(v.string()),
  customSettingsRoute: v.optional(v.string()),
  hasOverlayWidget: v.optional(v.boolean()),
  quickCommands: v.optional(v.array(QuickCommandDefinitionSchema)),
})
export type PluginContributions = v.InferOutput<typeof PluginContributionsSchema>

/**
 * Universal Plugin Manifest Schema (v1-compatible).
 * Defaults category to 'custom' when omitted to preserve backward compatibility with v1 manifests.
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
  category: v.optional(PluginCategorySchema, 'custom'),
  subCategory: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  platform: v.array(PluginPlatformSchema),
  gateway: InterfaceGatewaySchema,
  knowledge: v.optional(SemanticKnowledgeSchema),
  recipes: v.array(ActionRecipeDefinitionSchema),
  settings: v.optional(PluginSettingsSchema),
  contributions: v.optional(PluginContributionsSchema),
})
export type PluginManifest = v.InferOutput<typeof PluginManifestSchema>

/**
 * Strict Plugin Manifest Schema v2 for newly authored plugins.
 * Requires an explicit domain category.
 */
export const PluginManifestSchemaV2 = v.object({
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
  category: PluginCategorySchema,
  subCategory: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),
  platform: v.array(PluginPlatformSchema),
  gateway: InterfaceGatewaySchema,
  knowledge: v.optional(SemanticKnowledgeSchema),
  recipes: v.array(ActionRecipeDefinitionSchema),
  settings: v.optional(PluginSettingsSchema),
  contributions: v.optional(PluginContributionsSchema),
})
export type PluginManifestV2 = v.InferOutput<typeof PluginManifestSchemaV2>

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
 * Parse and validate a plugin manifest against the strict v2 specification.
 */
export function parsePluginManifestV2(input: unknown): PluginManifestV2 {
  return v.parse(PluginManifestSchemaV2, input)
}

/**
 * Safely parse a plugin manifest against the strict v2 specification without throwing.
 */
export function safeParsePluginManifestV2(input: unknown) {
  return v.safeParse(PluginManifestSchemaV2, input)
}

/**
 * Type guard checking whether an object conforms to PluginManifestV2.
 */
export function isPluginManifestV2(input: unknown): input is PluginManifestV2 {
  return safeParsePluginManifestV2(input).success
}

/**
 * Extract or resolve the category of a plugin manifest, defaulting to 'custom'.
 */
export function getCategoryForPlugin(manifest: PluginManifest): PluginCategory {
  return manifest.category ?? 'custom'
}

/**
 * Validates a runtime plugin settings dictionary against a declared PluginSettings schema.
 */
export function validatePluginSettings(
  schema: PluginSettings,
  values: Record<string, unknown>,
): { valid: boolean, errors?: string[] } {
  const errors: string[] = []

  for (const field of schema.fields) {
    const val = values[field.key]

    if (field.required && (val === undefined || val === null || val === '')) {
      errors.push(`Field "${field.key}" (${field.label}) is required.`)
      continue
    }

    if (val === undefined || val === null) {
      continue
    }

    switch (field.type) {
      case 'boolean':
        if (typeof val !== 'boolean') {
          errors.push(`Field "${field.key}" must be a boolean.`)
        }
        break
      case 'string':
      case 'secret':
      case 'keybinding':
        if (typeof val !== 'string') {
          errors.push(`Field "${field.key}" must be a string.`)
        }
        break
      case 'number':
      case 'slider':
        if (typeof val !== 'number' || Number.isNaN(val)) {
          errors.push(`Field "${field.key}" must be a number.`)
        }
        else {
          if (field.min !== undefined && val < field.min) {
            errors.push(`Field "${field.key}" cannot be less than ${field.min}.`)
          }
          if (field.max !== undefined && val > field.max) {
            errors.push(`Field "${field.key}" cannot be greater than ${field.max}.`)
          }
        }
        break
      case 'select':
        if (field.options && field.options.length > 0) {
          const allowedValues = field.options.map(opt => opt.value)
          if (!allowedValues.includes(val as string | number | boolean)) {
            errors.push(`Field "${field.key}" value is not among allowed options.`)
          }
        }
        break
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  }
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

/**
 * Standard manifest filename for NekoAI plugins.
 */
export const PLUGIN_MANIFEST_FILENAME = 'plugin.json'

/**
 * Legacy manifest filenames for backward compatibility.
 */
export const LEGACY_PLUGIN_MANIFEST_FILENAMES = ['plugins.json', 'neko-plugin.json'] as const
export const LEGACY_PLUGIN_MANIFEST_FILENAME = 'neko-plugin.json'
