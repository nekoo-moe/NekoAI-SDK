# Scaffolding & Manifest Linting

The `@nekotech/create-neko-plugin` package provides command-line tools and programmatic APIs to scaffold new plugin projects and lint manifests for security compliance.

---

## 1. Scaffolding Command

```bash
create-neko-plugin [name] [options]
```

### Options

- `-t, --template <template>`: Template archetype
  - `desktop-ui`: Tamagotchi floating widgets and UI companion extensions
  - `web-cdp`: Browser automation using Chrome DevTools Protocol
  - `visual-grounding`: Desktop screen perception and coordinate targeting
  - `ambient-readonly`: Passive background telemetry and system monitoring
- `-d, --dir <dir>`: Target directory (default: `./[name]`)
- `--id <id>`: Reverse-DNS identifier (e.g. `com.example.myplugin`)
- `--author <author>`: Author name and email

### Example

```bash
pnpm create @nekotech/neko-plugin system-hud \
  --template desktop-ui \
  --id com.airi.system-hud \
  --author "Airi <airi@moeru.ai>"
```

---

## 2. Manifest Linter Command

Run the linter inside any plugin directory to audit its security and manifest correctness:

```bash
npx @nekotech/create-neko-plugin lint .
```

### What the Linter Checks

- Valid JSON structure and adherence to `plugins.json` (or `neko-plugin.json`) schema.
- Correct semver version formatting.
- Existence and valid exports of the compiled entrypoint (`dist/index.mjs`).
- Flagging of excessive or wildcard capability requests.
- Auditing high-risk capability pairings (such as screen capture combined with outbound network egress).

---

## 3. Programmatic Usage

You can also embed the linter into custom CI/CD pipelines or build tools:

```ts
import { lintPluginDirectory } from '@nekotech/create-neko-plugin'

const report = await lintPluginDirectory('./my-plugin')

if (report.errors.length > 0) {
  console.error('Linting failed:', report.errors)
  process.exit(1)
}
```
