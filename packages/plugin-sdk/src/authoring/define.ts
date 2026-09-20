/**
 * Declarative authoring macros for NekoAI plugins and action recipes.
 */

import type { ActionRecipeDefinition, CapabilityPermission, PluginManifest } from '@nekotech/plugin-protocol'

import type {
  ActionRecipe,
  ActionRecipeSpecification,
  NekoPlugin,
  NekoPluginDefinition,
} from './types'

import { parsePluginManifest } from '@nekotech/plugin-protocol'

/**
 * Creates a typed, declarative action recipe.
 *
 * @param spec - Action recipe definition specifying ID, name, risk level, inputs, and execution function.
 */
export function createActionRecipe<TInput = Record<string, unknown>, TOutput = unknown>(
  spec: ActionRecipeSpecification<TInput, TOutput>,
): ActionRecipe<TInput, TOutput> {
  const definition: ActionRecipeDefinition = {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    riskLevel: spec.riskLevel,
    inputs: spec.inputs,
  }

  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    riskLevel: spec.riskLevel,
    inputs: spec.inputs,
    definition,
    execute: (context, inputs) => spec.execute(context, inputs),
  }
}

/**
 * Defines a NekoAI application plugin with declarative recipes, knowledge, and gateway contracts.
 *
 * @param definition - Plugin definition specifying metadata, gateway, knowledge, and setup routine.
 */
export function definePlugin(definition: NekoPluginDefinition): NekoPlugin {
  const recipes: ActionRecipe[] = []
  let setupExecuted = false

  const plugin: NekoPlugin = {
    id: definition.id,
    name: definition.name,
    version: definition.version,
    description: definition.description,
    author: definition.author,
    license: definition.license,
    platform: definition.platform,
    gateway: definition.gateway,
    knowledge: definition.knowledge,
    recipes,

    async setup(): Promise<void> {
      if (setupExecuted) {
        return
      }

      await definition.setup({
        registerRecipe: (recipe) => {
          if (recipes.some(r => r.id === recipe.id)) {
            throw new Error(`Duplicate recipe registration for ID "${recipe.id}" in plugin "${definition.id}"`)
          }
          recipes.push(recipe as ActionRecipe)
        },
      })

      setupExecuted = true
    },

    getRecipe(id: string): ActionRecipe | undefined {
      return recipes.find(r => r.id === id)
    },

    getManifest(): PluginManifest {
      const rawManifest = {
        id: definition.id,
        name: definition.name,
        version: definition.version,
        description: definition.description,
        author: definition.author,
        license: definition.license,
        platform: definition.platform,
        gateway: definition.gateway ?? {
          type: 'native-app',
          automationSurface: 'ui-automation',
          requiredPermissions: [],
        },
        knowledge: definition.knowledge,
        recipes: recipes.map(r => r.definition),
      }

      return parsePluginManifest(rawManifest)
    },

    hasPermission(permission: CapabilityPermission): boolean {
      if (!definition.gateway?.requiredPermissions) {
        return false
      }
      return definition.gateway.requiredPermissions.includes(permission)
    },
  }

  return plugin
}
