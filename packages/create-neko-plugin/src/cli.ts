/**
 * Command-Line Interface for create-neko-plugin.
 */

import type { PluginTemplateType } from './scaffold'

import process from 'node:process'

import { errorMessageFrom } from '@moeru/std'
import { cac } from 'cac'

import { lintPluginDirectory } from './linter'
import { scaffoldPluginProject } from './scaffold'

const cli = cac('create-neko-plugin')

cli
  .command('[name]', 'Scaffold a new NekoAI application plugin')
  .option('-t, --template <template>', 'Template type: web-cdp, desktop-ui, visual-grounding, ambient-readonly', {
    default: 'web-cdp',
  })
  .option('-d, --dir <dir>', 'Target directory to scaffold project into')
  .option('--id <id>', 'Reverse-DNS plugin ID (e.g. com.example.plugin)')
  .option('--author <author>', 'Plugin author name')
  .action(async (name: string | undefined, options: { template: string, dir?: string, id?: string, author?: string }) => {
    try {
      const pluginName = name || 'my-neko-plugin'
      const targetDir = options.dir || `./${pluginName}`

      console.info(`Scaffolding NekoAI plugin "${pluginName}" using template "${options.template}"...`)

      const result = await scaffoldPluginProject({
        name: pluginName,
        id: options.id,
        targetDir,
        template: options.template as PluginTemplateType,
        author: options.author,
      })

      console.info(`Plugin successfully created at: ${result.targetDir}`)
      console.info('   Generated files:')
      result.filesWritten.forEach(file => console.info(`     - ${file}`))
      console.info('\nNext steps:')
      console.info(`  cd ${targetDir}`)
      console.info('  pnpm install')
      console.info('  pnpm test')
    }
    catch (err) {
      console.error(`Scaffolding failed: ${errorMessageFrom(err) ?? 'Unknown error'}`)
      process.exit(1)
    }
  })

cli
  .command('lint [dir]', 'Lint and validate a plugin manifest and security boundaries')
  .action(async (dir: string | undefined) => {
    const targetDir = dir || '.'
    console.info(`Linting plugin package at: ${targetDir}...`)

    const result = await lintPluginDirectory(targetDir)

    if (result.warnings.length > 0) {
      console.warn(`\nWarnings (${result.warnings.length}):`)
      result.warnings.forEach((w) => {
        const loc = w.file ? ` (${w.file}${w.line ? `:${w.line}` : ''})` : ''
        console.warn(`   [${w.code}] ${w.message}${loc}`)
      })
    }

    if (result.errors.length > 0) {
      console.error(`\nErrors (${result.errors.length}):`)
      result.errors.forEach((e) => {
        const loc = e.file ? ` (${e.file}${e.line ? `:${e.line}` : ''})` : ''
        console.error(`   [${e.code}] ${e.message}${loc}`)
      })
      console.error('\nPlugin validation failed. Please address errors before publishing or sideloading.')
      process.exit(1)
    }

    console.info('\nPlugin manifest and security boundaries verified successfully.')
  })

cli.help()
cli.version('0.11.4')

cli.parse()
