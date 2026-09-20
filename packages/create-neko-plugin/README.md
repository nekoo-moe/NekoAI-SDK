# @nekotech/create-neko-plugin

Scaffolding CLI generator and registry security linter for NekoAI plugins.

## Features

- 🚀 **Quick Scaffolding**: Generate production-ready plugin projects in seconds.
- 🎨 **Archetype Templates**: Built-in starter templates for `web-cdp`, `desktop-ui`, `visual-grounding`, and `ambient-readonly`.
- 🛡️ **Security & Manifest Linter**: Validates `neko-plugin.json` schemas, declared capabilities, wildcard restrictions, and sensitive capability combinations.
- 📦 **NekoAI SDK Ready**: Pre-configured with `@nekotech/plugin-sdk`, `@nekotech/plugin-protocol`, TypeScript, Vitest, and packaging scripts.

## Quick Start

### Scaffolding via Package Runner

Using `pnpm`:
```bash
pnpm create @nekotech/neko-plugin my-plugin
```

Using `npm`:
```bash
npm create @nekotech/neko-plugin my-plugin
```

Using `npx`:
```bash
npx @nekotech/create-neko-plugin my-plugin
```

### CLI Options

```bash
create-neko-plugin [name] [options]

Options:
  -t, --template <template>   Template archetype:
                                - web-cdp: Browser automation via CDP
                                - desktop-ui: Desktop companion with widget UI
                                - visual-grounding: Screen visual analysis & grounding
                                - ambient-readonly: Passive monitoring & contextual assistance
  -d, --dir <dir>             Target directory (default: ./{name})
  --id <id>                   Reverse-DNS plugin ID (default: com.nekoai.plugin.{name})
  --author <author>           Plugin author name
  -h, --help                  Display this help message
  -v, --version               Display version number
```

#### Example

```bash
pnpm create @nekotech/neko-plugin my-companion \
  --template desktop-ui \
  --id com.myorg.companion \
  --author "Airi"
```

---

## Validating & Linting Plugins

Run the built-in linter to verify your plugin manifest, entrypoint files, and capability declarations before publishing:

```bash
npx @nekotech/create-neko-plugin lint .
```

The linter validates:
- Schema compliance of `neko-plugin.json` (name, version, id, permissions, entrypoint).
- High-risk capability combinations (e.g. demanding both screen control and network egress).
- Wildcard permissions and missing description justifications.
- Existence and export correctness of declared entrypoint modules.

---

## Programmatic API

You can also use the scaffolding and linter programmatically in custom toolchains:

```ts
import { lintPluginDirectory, scaffoldPluginProject } from '@nekotech/create-neko-plugin'

// Scaffold programmatically
const result = await scaffoldPluginProject({
  name: 'my-plugin',
  targetDir: './my-plugin',
  template: 'web-cdp',
})

// Lint programmatically
const report = await lintPluginDirectory('./my-plugin')
if (report.errors.length > 0) {
  console.error('Validation errors:', report.errors)
}
```

## License

[MIT](LICENSE)
