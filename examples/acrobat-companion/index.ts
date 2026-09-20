/**
 * Adobe Acrobat PDF Operator Plugin (Productivity & Enterprise)
 * Demonstrates application launching, personalized memory signature vault resolution,
 * UI automation form filling, and closed-loop save verification.
 */

import {
  assertPostcondition,
  createActionRecipe,
  definePlugin,
} from '@nekotech/plugin-sdk'

export interface SignPdfInputs {
  filePath: string
  signatureIdentifier: string
  targetPage?: number
}

export const acrobatPlugin = definePlugin({
  id: 'com.nekoai.plugin.acrobat',
  name: 'Adobe Acrobat PDF Operator',
  version: '1.1.0',
  description: 'PDF form filling, signature stamping from preset vault, export, and cross-application handoff.',
  author: 'NekoAI Official',
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
      'memory:personalization',
    ],
  },
  knowledge: {
    promptInjection: 'When signing documents in Adobe Acrobat, prefer the Fill & Sign toolbar. Default signature stamps are stored in the user signature vault.',
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

  setup({ registerRecipe }) {
    registerRecipe(
      createActionRecipe<SignPdfInputs, { success: boolean, filePath: string, signatureResolved: string, signed: boolean }>({
        id: 'sign-pdf',
        name: 'Sign PDF Document',
        description: 'Opens a target PDF, resolves signature stamp from vault, places the stamp, and saves the file.',
        riskLevel: 'moderate_local_mutation',
        inputs: {
          filePath: {
            type: 'string',
            required: true,
            description: 'Absolute path to PDF file',
          },
          signatureIdentifier: {
            type: 'string',
            required: true,
            description: 'Preset signature name or vault identifier',
          },
          targetPage: {
            type: 'integer',
            required: false,
            default: 1,
            description: 'Target page number for signature stamping',
          },
        },
        async execute(context, inputs) {
          const { os, ui, memory } = context

          // 1. Resolve preset signature asset from personalized memory vault
          const vaultUri = await memory.getVaultAsset(inputs.signatureIdentifier)
          const resolvedSignature = vaultUri ?? inputs.signatureIdentifier

          // 2. Launch Acrobat with target document or ensure active window
          if (os.launchApp) {
            await os.launchApp('Acrobat.exe', [inputs.filePath])
          }

          const acrobatWindow = await os.ensureWindow({
            titleRegex: /Acrobat/i,
            executable: 'Acrobat.exe',
            timeoutMs: 8000,
          })
          await acrobatWindow.focus()

          // 3. Open Fill & Sign toolbar (Shift+F4)
          await ui.pressKeyChord('Shift+F4')
          await os.sleep(500)
          await ui.clickElement({ selector: 'UIA_Button_FillAndSign' })

          // 4. Select Sign tool and place signature stamp
          await ui.clickElement({ selector: 'UIA_MenuItem_Sign' })
          await os.sleep(400)
          await ui.clickElement({ selector: 'UIA_Edit_Signature' })

          // 5. Save modified document (Ctrl+S / Cmd+S)
          await ui.pressKeyChord(os.platform === 'macos' ? 'Meta+S' : 'Ctrl+S')
          await os.sleep(600)

          // 6. Closed-loop postcondition: Verify signature applied
          await assertPostcondition({
            name: 'verify-pdf-signed',
            check: async () => await ui.hasElement({ selector: 'UIA_Signed_Badge' }),
            timeoutMs: 4000,
          })

          return {
            success: true,
            filePath: inputs.filePath,
            signatureResolved: resolvedSignature,
            signed: true,
          }
        },
      }),
    )
  },
})

export default acrobatPlugin
