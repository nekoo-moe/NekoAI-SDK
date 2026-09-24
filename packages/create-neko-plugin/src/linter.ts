/**
 * Plugin Registry Security and Capability Validation Linter.
 * Enforces schema compliance, capability token verification, and security boundaries.
 */

import type { PluginManifest } from '@nekotech/plugin-protocol'

import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { errorMessageFrom } from '@moeru/std'
import { isStandardCapabilityPermission, safeParsePluginManifest } from '@nekotech/plugin-protocol'

export interface PluginLintIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  file?: string
  line?: number
}

export interface PluginLintResult {
  valid: boolean
  errors: PluginLintIssue[]
  warnings: PluginLintIssue[]
  manifest?: PluginManifest
}

/**
 * Validates a plugin manifest object for schema and capability security boundaries.
 */
export function lintPluginManifest(manifestInput: unknown): PluginLintResult {
  const errors: PluginLintIssue[] = []
  const warnings: PluginLintIssue[] = []

  // 1. Schema Parse Check
  const parseResult = safeParsePluginManifest(manifestInput)
  if (!parseResult.success) {
    for (const issue of parseResult.issues) {
      const path = issue.path?.map(p => p.key).join('.') ?? 'root'
      errors.push({
        level: 'error',
        code: 'INVALID_MANIFEST_SCHEMA',
        message: `${path}: ${issue.message}`,
      })
    }
    return { valid: false, errors, warnings }
  }

  const manifest = parseResult.output

  // 2. Capability Permission Scope Validation
  for (const perm of manifest.gateway.requiredPermissions) {
    const isStandard = isStandardCapabilityPermission(perm)
    if (!isStandard) {
      warnings.push({
        level: 'warning',
        code: 'NON_STANDARD_PERMISSION',
        message: `Permission "${perm}" is not in the standard capability registry.`,
      })
    }
  }

  // 3. Automation Surface to Permission Coherence
  const surface = manifest.gateway.automationSurface
  const perms = new Set(manifest.gateway.requiredPermissions)

  if (surface === 'browser-cdp') {
    const hasBrowserPerm = perms.has('browser:cdp') || perms.has('browser:navigation') || perms.has('browser:dom')
    if (!hasBrowserPerm) {
      errors.push({
        level: 'error',
        code: 'MISSING_SURFACE_PERMISSION',
        message: 'Browser CDP automation surface requires at least one "browser:*" capability permission.',
      })
    }
  }

  if (surface === 'ui-automation' || surface === 'visual-grounding') {
    const hasDesktopPerm = perms.has('desktop:synthetic_input') || perms.has('desktop:window_focus')
    if (!hasDesktopPerm) {
      errors.push({
        level: 'error',
        code: 'MISSING_SURFACE_PERMISSION',
        message: `${surface} surface requires "desktop:synthetic_input" or "desktop:window_focus" permission.`,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
  }
}

/**
 * Recursively scans directory for source files (.ts, .js).
 */
async function findSourceFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist') {
        files.push(...(await findSourceFiles(fullPath)))
      }
      else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath)
      }
    }
  }
  catch {
    // Directory may not exist
  }
  return files
}

/**
 * Lints an entire plugin package directory on disk.
 */
export async function lintPluginDirectory(pluginDir: string): Promise<PluginLintResult> {
  const targetDir = resolve(pluginDir)
  let manifestPath = join(targetDir, 'plugins.json')

  let manifestContent: string
  try {
    manifestContent = await readFile(manifestPath, 'utf-8')
  }
  catch {
    manifestPath = join(targetDir, 'neko-plugin.json')
    try {
      manifestContent = await readFile(manifestPath, 'utf-8')
    }
    catch (err) {
      return {
        valid: false,
        errors: [
          {
            level: 'error',
            code: 'MISSING_MANIFEST',
            message: `Could not find or read plugins.json at ${manifestPath}: ${errorMessageFrom(err) ?? 'Read error'}`,
            file: manifestPath,
          },
        ],
        warnings: [],
      }
    }
  }

  let parsedManifest: unknown
  try {
    parsedManifest = JSON.parse(manifestContent)
  }
  catch (err) {
    return {
      valid: false,
      errors: [
        {
          level: 'error',
          code: 'MALFORMED_JSON',
          message: `Failed to parse JSON in ${manifestPath}: ${errorMessageFrom(err) ?? 'JSON parse error'}`,
          file: manifestPath,
        },
      ],
      warnings: [],
    }
  }

  const manifestResult = lintPluginManifest(parsedManifest)
  const errors = [...manifestResult.errors]
  const warnings = [...manifestResult.warnings]

  if (!manifestResult.manifest) {
    return { valid: false, errors, warnings }
  }

  const manifest = manifestResult.manifest

  // 4. Source Code Static Security Analysis
  const sourceFiles = await findSourceFiles(join(targetDir, 'src'))
  let allSourceContent = ''

  for (const file of sourceFiles) {
    try {
      const content = await readFile(file, 'utf-8')
      allSourceContent += `\n${content}`
      const lines = content.split('\n')

      lines.forEach((line, index) => {
        const lineNum = index + 1

        // Dangerous eval check
        if (/\beval\s*\(/.test(line)) {
          errors.push({
            level: 'error',
            code: 'DISALLOWED_EVAL',
            message: 'Direct invocation of eval() is strictly prohibited in plugins.',
            file,
            line: lineNum,
          })
        }

        // Dynamic Function constructor
        if (/new\s+Function\s*\(/.test(line)) {
          errors.push({
            level: 'error',
            code: 'DISALLOWED_DYNAMIC_FUNCTION',
            message: 'Dynamic Function() constructor is strictly prohibited.',
            file,
            line: lineNum,
          })
        }

        // Hard process exit
        if (/process\.exit\s*\(/.test(line)) {
          errors.push({
            level: 'error',
            code: 'DISALLOWED_PROCESS_EXIT',
            message: 'process.exit() is prohibited; sandbox supervisor manages worker lifecycle.',
            file,
            line: lineNum,
          })
        }

        // Raw child_process imports
        if (/from\s+['"](?:node:)?child_process['"]|require\(['"](?:node:)?child_process['"]\)/.test(line)) {
          warnings.push({
            level: 'warning',
            code: 'UNSANDBOXED_CHILD_PROCESS',
            message: 'Raw child_process import detected. Use context.os.launchApp to preserve sandbox isolation.',
            file,
            line: lineNum,
          })
        }
      })
    }
    catch {
      // Ignore unreadable source files
    }
  }

  // 5. High-Risk Human Consent Gate Enforcement
  const highRiskRecipes = manifest.recipes.filter(r => r.riskLevel === 'high_risk_external')
  if (highRiskRecipes.length > 0 && sourceFiles.length > 0) {
    const hasRequireConsent = /requireUserConsent/.test(allSourceContent)
    if (!hasRequireConsent) {
      errors.push({
        level: 'error',
        code: 'MISSING_MANDATORY_CONSENT_GATE',
        message: `Plugin declares ${highRiskRecipes.length} high-risk external recipe(s) but does not reference requireUserConsent().`,
        file: manifestPath,
      })
    }
  }

  // 6. Zero-Spend Invariant Enforcement for Gaming Plugins
  const isGaming = manifest.gateway.automationSurface === 'visual-grounding'
    || manifest.id.includes('star-rail')
    || manifest.id.includes('game')

  if (isGaming && sourceFiles.length > 0) {
    const hasZeroSpendGuard = /ZeroSpendInvariant|zero-spend|purchase/i.test(allSourceContent)
    if (!hasZeroSpendGuard) {
      warnings.push({
        level: 'warning',
        code: 'MISSING_ZERO_SPEND_INVARIANT',
        message: 'Gaming/visual-grounding plugin should enforce zero-spend invariants to protect user currency.',
        file: manifestPath,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
  }
}
