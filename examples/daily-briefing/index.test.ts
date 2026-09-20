import type { BriefingReport } from './index'

import { createMockExecutionContext } from '@nekotech/plugin-sdk'
import { describe, expect, it } from 'vitest'

import { dailyBriefingPlugin } from './index'

describe('daily Ambient Briefing Plugin', () => {
  it('initializes and exports valid manifest', async () => {
    await dailyBriefingPlugin.setup()
    const manifest = dailyBriefingPlugin.getManifest()

    expect(manifest.id).toBe('com.nekoai.plugin.daily-briefing')
    expect(manifest.gateway.automationSurface).toBe('native-api')
    expect(manifest.recipes).toHaveLength(1)
    expect(dailyBriefingPlugin.hasPermission('network:external')).toBe(true)
    expect(dailyBriefingPlugin.hasPermission('filesystem:read')).toBe(true)
  })

  it('harvests multi-source ambient data in read-only mode', async () => {
    await dailyBriefingPlugin.setup()
    const recipe = dailyBriefingPlugin.getRecipe('harvest-briefing')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext()
    const result = (await recipe!.execute(context, {
      includeCalendar: true,
      includeEmail: true,
      includeGit: true,
    })) as BriefingReport

    expect(result.summary).toContain('events scheduled')
    expect(result.calendar).toHaveLength(2)
    expect(result.emails).toHaveLength(2)
    expect(result.gitStatus).toBeDefined()
  })
})
