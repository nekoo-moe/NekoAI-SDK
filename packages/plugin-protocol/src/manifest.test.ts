import type { PluginSettings } from './manifest'

import { describe, expect, it } from 'vitest'

import {
  getCategoryForPlugin,
  hasCapabilityPermission,
  isPluginManifest,
  isPluginManifestV2,
  parsePluginManifest,
  parsePluginManifestV2,
  safeParsePluginManifest,
  safeParsePluginManifestV2,
  validatePluginSettings,
} from './manifest'

describe('plugin manifest schema & validation (issue #157 / milestone 5.1)', () => {
  const validAcrobatManifest = {
    $schema: 'https://nekoai.is-a.dev/schemas/plugin-manifest.v1.json',
    id: 'com.nekoai.plugin.acrobat',
    name: 'Adobe Acrobat PDF Operator',
    version: '1.1.0',
    author: 'NekoTech Foundation',
    license: 'MIT',
    platform: ['windows', 'macos'],
    gateway: {
      type: 'native-app',
      executable: {
        windows: ['Acrobat.exe', 'AcroRd32.exe'],
        macos: ['/Applications/Adobe Acrobat DC/Adobe Acrobat.app'],
      },
      automationSurface: 'ui-automation',
      requiredPermissions: [
        'filesystem:read',
        'filesystem:write',
        'desktop:window_focus',
        'desktop:synthetic_input',
      ],
    },
    knowledge: {
      promptInjection: 'When signing documents in Adobe Acrobat, prefer the Fill & Sign toolbar.',
      shortcuts: {
        fillAndSign: 'Shift+F4',
        save: 'Ctrl+S',
        print: 'Ctrl+P',
      },
      selectors: {
        fillAndSignButton: 'UIA_Button_FillAndSign',
        signMenu: 'UIA_MenuItem_Sign',
        signatureField: 'UIA_Edit_Signature',
      },
    },
    recipes: [
      {
        id: 'sign-pdf',
        name: 'Sign PDF Document',
        description: 'Opens a target PDF, places a preset signature stamp, and saves the file.',
        inputs: {
          filePath: { type: 'string', description: 'Absolute path to PDF file', required: true },
          signatureIdentifier: { type: 'string', description: 'Preset signature name in vault' },
          targetPage: { type: 'integer', default: 1 },
        },
        riskLevel: 'moderate_local_mutation',
      },
    ],
  }

  it('validates a complete, standard application plugin manifest', () => {
    const parsed = parsePluginManifest(validAcrobatManifest)
    expect(parsed.id).toBe('com.nekoai.plugin.acrobat')
    expect(parsed.version).toBe('1.1.0')
    expect(parsed.gateway.type).toBe('native-app')
    expect(parsed.recipes).toHaveLength(1)
    expect(parsed.recipes[0].id).toBe('sign-pdf')
    expect(parsed.recipes[0].riskLevel).toBe('moderate_local_mutation')
  })

  it('validates a visual grounding game manifest with visual anchors', () => {
    const starRailManifest = {
      id: 'com.nekoai.plugin.star-rail',
      name: 'Honkai: Star Rail Companion',
      version: '1.0.0',
      platform: ['windows'],
      gateway: {
        type: 'native-app',
        executable: { windows: 'StarRail.exe' },
        automationSurface: 'visual-grounding',
        requiredPermissions: [
          'desktop:window_focus',
          'desktop:synthetic_input',
        ],
      },
      knowledge: {
        visualAnchors: [
          { id: 'phone_icon', templatePath: 'assets/hud_phone.png', confidenceThreshold: 0.85 },
          { id: 'claim_all', templatePath: 'assets/btn_claim_all.png', confidenceThreshold: 0.9 },
        ],
      },
      recipes: [
        {
          id: 'perform-dailies',
          name: 'Complete Daily Assignments',
          description: 'Collects dispatch rewards via visual anchor template matching.',
          riskLevel: 'reversible_local',
        },
      ],
    }

    expect(isPluginManifest(starRailManifest)).toBe(true)
    const parsed = parsePluginManifest(starRailManifest)
    expect(parsed.recipes[0].riskLevel).toBe('reversible_local')
    expect(hasCapabilityPermission(parsed, 'desktop:window_focus')).toBe(true)
    expect(hasCapabilityPermission(parsed, 'filesystem:write')).toBe(false)
  })

  it('validates a browser cdp plugin manifest', () => {
    const youtubeManifest = {
      id: 'com.nekoai.plugin.youtube',
      name: 'YouTube Web Operator',
      version: '2.0.0',
      platform: ['web', 'windows', 'linux', 'macos'],
      gateway: {
        type: 'browser-cdp',
        automationSurface: 'browser-cdp',
        requiredPermissions: [
          'browser:navigation',
          'browser:dom',
          'browser:cdp',
        ],
      },
      recipes: [
        {
          id: 'search-and-like',
          name: 'Search and Like Video',
          description: 'Searches for a query and likes the target video.',
          riskLevel: 'reversible_local',
          inputs: {
            query: { type: 'string', required: true },
          },
        },
      ],
    }

    expect(isPluginManifest(youtubeManifest)).toBe(true)
  })

  it('rejects manifest with non-reverse-DNS ID', () => {
    const invalid = {
      ...validAcrobatManifest,
      id: 'acrobat-plugin-no-dots',
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
    expect(() => parsePluginManifest(invalid)).toThrowError(/reverse-DNS/)
  })

  it('rejects manifest with invalid semver', () => {
    const invalid = {
      ...validAcrobatManifest,
      version: 'v1.0',
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
    expect(() => parsePluginManifest(invalid)).toThrowError(/SemVer/)
  })

  it('rejects manifest with invalid platform', () => {
    const invalid = {
      ...validAcrobatManifest,
      platform: ['solaris'],
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects manifest with invalid gateway type', () => {
    const invalid = {
      ...validAcrobatManifest,
      gateway: {
        ...validAcrobatManifest.gateway,
        type: 'quantum-transport',
      },
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects recipe ID that is not kebab-case', () => {
    const invalid = {
      ...validAcrobatManifest,
      recipes: [
        {
          id: 'SignPdfCamelCase',
          name: 'Sign PDF',
          description: 'Desc',
          riskLevel: 'read_only',
        },
      ],
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
    expect(() => parsePluginManifest(invalid)).toThrowError(/kebab-case/)
  })

  it('rejects recipe with invalid risk tier', () => {
    const invalid = {
      ...validAcrobatManifest,
      recipes: [
        {
          id: 'sign-pdf',
          name: 'Sign PDF',
          description: 'Desc',
          riskLevel: 'unlimited_danger',
        },
      ],
    }

    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
  })

  it('correctly checks permissions via hasCapabilityPermission', () => {
    const manifest = parsePluginManifest(validAcrobatManifest)
    expect(hasCapabilityPermission(manifest, 'filesystem:read')).toBe(true)
    expect(hasCapabilityPermission(manifest, 'filesystem:write')).toBe(true)
    expect(hasCapabilityPermission(manifest, 'network:external')).toBe(false)
    expect(hasCapabilityPermission(manifest, 'terminal:exec')).toBe(false)
  })
})

describe('plugin manifest schema v2, categorization & declarative settings (issue #171)', () => {
  const validV2GamingManifest = {
    $schema: 'https://nekoai.is-a.dev/schemas/plugin-manifest.v2.json',
    id: 'com.nekoai.plugin.star-rail',
    name: 'Honkai: Star Rail Companion',
    version: '2.0.0',
    description: 'Vision-grounded daily assignment manager and event companion.',
    author: 'NekoTech Pioneers',
    license: 'MIT',
    category: 'gaming',
    subCategory: 'rpg',
    tags: ['turn-based', 'daily-assignments', 'vision-fsm'],
    platform: ['windows'],
    gateway: {
      type: 'native-app',
      executable: { windows: 'StarRail.exe' },
      automationSurface: 'visual-grounding',
      requiredPermissions: ['desktop:window_focus', 'desktop:synthetic_input'],
    },
    knowledge: {
      shortcuts: { menu: 'Escape' },
    },
    recipes: [
      {
        id: 'claim-assignments',
        name: 'Claim Daily Assignments',
        description: 'Collects expedition rewards and redispatches characters.',
        riskLevel: 'reversible_local',
      },
    ],
    settings: {
      groups: [
        {
          id: 'schedule',
          title: 'Schedule & Timing',
          description: 'Configure automated expedition execution hours.',
        },
        {
          id: 'safety',
          title: 'Fair-Play & Safeguards',
          description: 'Anti-cheat and financial perimeter settings.',
        },
      ],
      fields: [
        {
          key: 'dailyResetHour',
          type: 'number',
          label: 'Daily Server Reset Hour (UTC)',
          defaultValue: 4,
          min: 0,
          max: 23,
          group: 'schedule',
        },
        {
          key: 'expeditionRoute',
          type: 'select',
          label: 'Expedition Focus',
          defaultValue: 'credits',
          options: [
            { label: 'Credits & Leveling Materials', value: 'credits' },
            { label: 'Weapon Synthesis Materials', value: 'synthesis' },
            { label: 'Cooking Ingredients', value: 'cooking' },
          ],
          group: 'schedule',
        },
        {
          key: 'zeroSpendLock',
          type: 'boolean',
          label: 'Zero-Spend Financial Lock',
          description: 'Hard-blocks any interaction that could consume Stellar Jade or Oneiric Shards.',
          defaultValue: true,
          readOnly: true,
          group: 'safety',
        },
        {
          key: 'captureFpsLimit',
          type: 'slider',
          label: 'Vision Capture FPS',
          defaultValue: 30,
          min: 15,
          max: 60,
          step: 15,
          group: 'safety',
        },
      ],
    },
    contributions: {
      icon: 'i-solar:gamepad-bold-duotone',
      hasOverlayWidget: true,
      quickCommands: [
        {
          id: 'quick-claim',
          title: 'Run Star Rail Expeditions',
          recipeId: 'claim-assignments',
        },
      ],
    },
  }

  it('validates a complete v2 manifest with category, settings, and contributions', () => {
    const parsed = parsePluginManifestV2(validV2GamingManifest)
    expect(parsed.id).toBe('com.nekoai.plugin.star-rail')
    expect(parsed.category).toBe('gaming')
    expect(parsed.subCategory).toBe('rpg')
    expect(parsed.tags).toContain('daily-assignments')
    expect(parsed.settings?.groups).toHaveLength(2)
    expect(parsed.settings?.fields).toHaveLength(4)
    expect(parsed.contributions?.hasOverlayWidget).toBe(true)
    expect(parsed.contributions?.quickCommands).toHaveLength(1)
    expect(isPluginManifestV2(validV2GamingManifest)).toBe(true)
  })

  it('preserves backward compatibility: v1 manifest without category parses and defaults category to custom', () => {
    const acrobatManifestV1 = {
      id: 'com.nekoai.plugin.acrobat',
      name: 'Adobe Acrobat PDF Operator',
      version: '1.1.0',
      platform: ['windows', 'macos'],
      gateway: {
        type: 'native-app',
        automationSurface: 'ui-automation',
        requiredPermissions: ['filesystem:read'],
      },
      recipes: [
        {
          id: 'sign-pdf',
          name: 'Sign PDF Document',
          description: 'Opens a target PDF and saves the file.',
          riskLevel: 'moderate_local_mutation',
        },
      ],
    }

    const parsed = parsePluginManifest(acrobatManifestV1)
    expect(parsed.id).toBe('com.nekoai.plugin.acrobat')
    expect(parsed.category).toBe('custom')
    expect(getCategoryForPlugin(parsed)).toBe('custom')
  })

  it('resolves explicit category when present in manifest via getCategoryForPlugin', () => {
    const parsed = parsePluginManifest(validV2GamingManifest)
    expect(getCategoryForPlugin(parsed)).toBe('gaming')
  })

  it('rejects v2 manifest when category is missing', () => {
    const { category, ...missingCategory } = validV2GamingManifest
    const result = safeParsePluginManifestV2(missingCategory)
    expect(result.success).toBe(false)
    expect(() => parsePluginManifestV2(missingCategory)).toThrow()
  })

  it('rejects manifest with invalid category', () => {
    const invalid = {
      ...validV2GamingManifest,
      category: 'crypto-mining-arbitrage',
    }
    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects settings field with invalid type', () => {
    const invalid = {
      ...validV2GamingManifest,
      settings: {
        fields: [
          {
            key: 'test',
            type: 'unsupported-widget-type',
            label: 'Test',
            defaultValue: 'abc',
          },
        ],
      },
    }
    const result = safeParsePluginManifest(invalid)
    expect(result.success).toBe(false)
  })

  it('validates runtime settings dictionary against declared schema via validatePluginSettings', () => {
    const schema: PluginSettings = validV2GamingManifest.settings as unknown as PluginSettings

    // Valid values
    const validValues = {
      dailyResetHour: 4,
      expeditionRoute: 'credits',
      zeroSpendLock: true,
      captureFpsLimit: 30,
    }
    expect(validatePluginSettings(schema, validValues).valid).toBe(true)

    // Type mismatch
    const invalidTypeValues = {
      dailyResetHour: 'not-a-number',
      expeditionRoute: 'credits',
      zeroSpendLock: true,
      captureFpsLimit: 30,
    }
    const typeResult = validatePluginSettings(schema, invalidTypeValues)
    expect(typeResult.valid).toBe(false)
    expect(typeResult.errors?.[0]).toMatch(/must be a number/)

    // Number out of range
    const outOfRangeValues = {
      dailyResetHour: 25,
      expeditionRoute: 'credits',
      zeroSpendLock: true,
      captureFpsLimit: 30,
    }
    const rangeResult = validatePluginSettings(schema, outOfRangeValues)
    expect(rangeResult.valid).toBe(false)
    expect(rangeResult.errors?.[0]).toMatch(/cannot be greater than 23/)

    // Select option not in allowed list
    const invalidSelectValues = {
      dailyResetHour: 4,
      expeditionRoute: 'unsupported-option',
      zeroSpendLock: true,
      captureFpsLimit: 30,
    }
    const selectResult = validatePluginSettings(schema, invalidSelectValues)
    expect(selectResult.valid).toBe(false)
    expect(selectResult.errors?.[0]).toMatch(/not among allowed options/)
  })
})
