import type { PluginTemplateDefinition } from './types'

import { ambientReadonlyTemplate } from './ambient-readonly'
import { desktopUiTemplate } from './desktop-ui'
import { visualGroundingTemplate } from './visual-grounding'
import { webCdpTemplate } from './web-cdp'

export * from './ambient-readonly'
export * from './desktop-ui'
export * from './types'
export * from './visual-grounding'
export * from './web-cdp'

export const TEMPLATES: Record<string, PluginTemplateDefinition> = {
  'web-cdp': webCdpTemplate,
  'desktop-ui': desktopUiTemplate,
  'visual-grounding': visualGroundingTemplate,
  'ambient-readonly': ambientReadonlyTemplate,
}
