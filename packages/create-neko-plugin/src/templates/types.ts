/**
 * Template definitions for scaffolding NekoAI plugins.
 */

export interface TemplateContext {
  pluginId: string
  pluginName: string
  packageName: string
  description: string
  author: string
}

export interface PluginTemplateDefinition {
  type: 'web-cdp' | 'desktop-ui' | 'visual-grounding' | 'ambient-readonly'
  description: string
  generateManifest: (ctx: TemplateContext) => Record<string, unknown>
  generateIndexTs: (ctx: TemplateContext) => string
  generateTestTs: (ctx: TemplateContext) => string
  generatePackageJson: (ctx: TemplateContext) => Record<string, unknown>
  generateReadme: (ctx: TemplateContext) => string
}
