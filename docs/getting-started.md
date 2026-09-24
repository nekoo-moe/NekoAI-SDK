# Getting Started with NekoAI SDK

Welcome to the NekoAI Plugin Development Kit. This guide will walk you through setting up your environment, creating your first plugin, and running it locally.

---

## 1. Prerequisites

- **Node.js**: Version 20.x or 24.x (LTS recommended)
- **Package Manager**: `pnpm` (version 9 or 10 recommended), `npm`, or `bun`
- **TypeScript**: Knowledge of modern TypeScript and async programming

---

## 2. Fast Scaffolding with `create-neko-plugin`

The fastest way to start is using the official scaffolding generator:

```bash
# Using pnpm
pnpm create @nekotech/neko-plugin my-first-plugin

# Using npm
npm create @nekotech/neko-plugin my-first-plugin

# Using npx
npx @nekotech/create-neko-plugin my-first-plugin
```

### Selecting an Archetype Template

The CLI provides templates tailored to specific plugin roles:

| Template | Primary Use Case | Key Capabilities Included |
| --- | --- | --- |
| `desktop-ui` | Floating HUD widgets and Tamagotchi companion extensions | `tamagotchi:widget-mount` |
| `web-cdp` | Headless browser automation and scraping | `browser:cdp-connect`, `network:fetch` |
| `visual-grounding` | Screen perception, OCR, and coordinate targeting | `screen:capture`, `vision:grounding` |
| `ambient-readonly` | System metrics monitoring, battery, telemetry | `system:resource-read` |

Example specifying template and author:

```bash
pnpm create @nekotech/neko-plugin system-glance \
  --template ambient-readonly \
  --id com.myname.system-glance \
  --author "Airi Dev"
```

---

## 3. Project Structure

A standard NekoAI plugin repository contains:

```
my-plugin/
├── plugins.json          # Plugin identity, capabilities & entrypoint specification
├── package.json          # Node package dependencies
├── tsconfig.json         # TypeScript compiler config
├── tsdown.config.ts      # Zero-config bundler setup (or rollup/vite)
├── src/
│   ├── index.ts          # Main plugin entrypoint (export default definePlugin(...))
│   └── index.test.ts     # Unit tests with Vitest
└── README.md             # Plugin documentation
```

---

## 4. Developing Your First Plugin

Open `src/index.ts`:

```ts
import { definePlugin, defineTool } from '@nekotech/plugin-sdk'
import * as v from 'valibot'

export default definePlugin({
  name: 'my-first-plugin',
  version: '1.0.0',
  async setup(ctx) {
    ctx.logger.info('Plugin initializing!')

    // Register a tool that the AI companion can invoke
    ctx.tools.register(
      defineTool({
        name: 'say_hello',
        description: 'Returns a friendly greeting to the specified recipient',
        schema: v.object({
          name: v.string(),
        }),
        execute: async ({ name }) => {
          return {
            message: `Hello ${name}! I am running inside NekoAI!`,
          }
        },
      })
    )

    // Return cleanup callback on unload
    return () => {
      ctx.logger.info('Plugin unloading...')
    }
  },
})
```

---

## 5. Building & Verifying

1. Build your distribution bundle:
   ```bash
   pnpm run build
   ```

2. Lint your manifest and capability declarations:
   ```bash
   npx @nekotech/create-neko-plugin lint .
   ```

3. Run automated tests:
   ```bash
   pnpm test
   ```

---

## 6. Next Steps

- Explore [Architecture & Security](architecture.md) to understand the worker sandbox.
- Read [Manifest & Capabilities](manifest-and-capabilities.md) to learn about security permissions.
- See [Tamagotchi Kits](tamagotchi-kits.md) to render custom desktop widgets.
