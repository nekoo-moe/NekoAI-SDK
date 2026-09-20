import { createMockExecutionContext } from '@nekotech/plugin-sdk'
import { describe, expect, it } from 'vitest'

import { acrobatPlugin } from './index'

describe('adobe Acrobat PDF Operator Plugin', () => {
  it('initializes and exports valid manifest', async () => {
    await acrobatPlugin.setup()
    const manifest = acrobatPlugin.getManifest()

    expect(manifest.id).toBe('com.nekoai.plugin.acrobat')
    expect(manifest.gateway.type).toBe('native-app')
    expect(manifest.recipes).toHaveLength(1)
    expect(acrobatPlugin.hasPermission('memory:personalization')).toBe(true)
    expect(acrobatPlugin.hasPermission('filesystem:write')).toBe(true)
  })

  it('executes sign-pdf recipe resolving preset signature from memory vault', async () => {
    await acrobatPlugin.setup()
    const recipe = acrobatPlugin.getRecipe('sign-pdf')
    expect(recipe).toBeDefined()

    const context = createMockExecutionContext({
      mockElements: ['UIA_Signed_Badge'],
    })

    const result = await recipe!.execute(context, {
      filePath: 'D:/Enterprise/Invoice12.pdf',
      signatureIdentifier: 'sig_executive_stamp',
    })

    expect(result).toEqual({
      success: true,
      filePath: 'D:/Enterprise/Invoice12.pdf',
      signatureResolved: 'vault://sig_executive_stamp',
      signed: true,
    })
  })
})
