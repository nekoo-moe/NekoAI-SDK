import { describe, expect, it } from 'vitest'

import {
  hasCapabilityPermission,
  isPluginManifest,
  parsePluginManifest,
  safeParsePluginManifest,
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
