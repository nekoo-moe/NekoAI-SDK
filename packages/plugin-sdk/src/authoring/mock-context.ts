/**
 * Testing fixture utilities for mocking the PluginExecutionContext during test execution.
 */

import type {
  BrowserCdpBridge,
  DesktopExecutorBridge,
  PluginExecutionContext,
  UiAutomationBridge,
  UserMemoryBridge,
  WindowHandleBridge,
} from './types'

export interface MockExecutionContextOptions {
  platform?: 'windows' | 'linux' | 'macos'
  mockWindows?: WindowHandleBridge[]
  mockElements?: string[]
  mockMemoryAliases?: Record<string, string>
  consentApproved?: boolean
}

/**
 * Creates a mocked, in-memory execution context for testing plugin recipes without native OS hooks.
 */
export function createMockExecutionContext(
  options: MockExecutionContextOptions = {},
): PluginExecutionContext {
  const platform = options.platform ?? 'windows'
  const mockWindows = options.mockWindows ?? []
  const mockElements = new Set(options.mockElements ?? [])
  const mockAliases = new Map(Object.entries(options.mockMemoryAliases ?? {}))
  const consentApproved = options.consentApproved ?? true

  const os: DesktopExecutorBridge = {
    platform,
    async ensureWindow({ titleRegex, executable }) {
      const found = mockWindows.find((w) => {
        if (titleRegex && !titleRegex.test(w.title)) {
          return false
        }
        if (executable && w.executable !== executable) {
          return false
        }
        return true
      })

      if (found) {
        return found
      }

      const newWin: WindowHandleBridge = {
        title: executable ?? 'Mock Window',
        executable,
        async focus() {},
      }
      mockWindows.push(newWin)
      return newWin
    },
    async findWindow({ titleRegex, executable }) {
      return mockWindows.find((w) => {
        if (titleRegex && !titleRegex.test(w.title)) {
          return false
        }
        if (executable && w.executable !== executable) {
          return false
        }
        return true
      })
    },
    async focusWindow({ title, executable } = {}) {
      const win = mockWindows.find((w) => {
        if (title && w.title !== title) {
          return false
        }
        if (executable && w.executable !== executable) {
          return false
        }
        return true
      })
      if (win) {
        await win.focus()
      }
    },
    async sleep() {},
    async handleFileDialog() {},
    async launchApp() {
      return { pid: 1234 }
    },
  }

  const ui: UiAutomationBridge = {
    async pressKeyChord() {},
    async pressKey() {},
    async typeText() {},
    async clickElement({ selector }) {
      if (selector) {
        mockElements.add(selector)
      }
    },
    async hasElement({ selector, textMatch }) {
      if (selector && mockElements.has(selector)) {
        return true
      }
      if (textMatch) {
        for (const el of mockElements) {
          if (el.includes(textMatch)) {
            return true
          }
        }
      }
      return false
    },
    async findVisualAnchor() {
      return { x: 100, y: 100 }
    },
    async hasVisualAnchor() {
      return true
    },
    async clickCoordinates() {},
  }

  const browser: BrowserCdpBridge = {
    async navigate() {},
    async click() {},
    async type() {},
    async evaluate() {
      return true as any
    },
    async waitForSelector() {
      return true
    },
  }

  const memory: UserMemoryBridge = {
    async lookupAlias(term) {
      return mockAliases.get(term)
    },
    async getVaultAsset(id) {
      return `vault://${id}`
    },
    async getContact(name) {
      return { id: `contact-${name}`, name }
    },
  }

  return {
    os,
    ui,
    browser,
    memory,
    consentGate: async () => consentApproved,
  }
}
