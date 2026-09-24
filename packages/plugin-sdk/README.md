# @nekotech/plugin-sdk

Runtime-agnostic Plugin SDK for Project NekoAI.

Build autonomous companions, desktop widgets, interactive gamelets, visual analyzers, and AI agent tools that run securely inside the NekoAI ecosystem.

## Overview

The NekoAI Plugin SDK allows developers to extend the NekoAI companion with:
- **Agent Tools**: Expose structured, type-safe functions that NekoAI characters can call dynamically during conversations.
- **Desktop Companion Kits**: Render rich floating widgets, HUD overlays, and interactive gamelets alongside the avatar.
- **Visual Grounding**: Process screen captures and analyze UI components with ambient privacy controls.
- **Isolated Sandboxing**: Worker-thread execution with RPC communication, automated heartbeat watchdog, and resource quotas.

## Installation

```bash
# Core SDK
pnpm add @nekotech/plugin-sdk @nekotech/plugin-protocol

# Optional: Tamagotchi client kits (widgets, gamelet mounts)
pnpm add @nekotech/plugin-sdk-tamagotchi
```

Or scaffold an entire ready-to-code project using the CLI:

```bash
pnpm create @nekotech/neko-plugin my-plugin --template desktop-ui
```

---

## Quick Start

### 1. Define the Manifest (`plugin.json`)

Every NekoAI plugin requires a manifest defining its identity, entrypoints, and requested capability permissions:

```json
{
  "id": "com.example.system-glance",
  "name": "system-glance",
  "version": "1.0.0",
  "description": "Monitors system resources and displays ambient health status",
  "entrypoint": "dist/index.mjs",
  "author": "NekoAI Developer",
  "license": "MIT",
  "capabilities": [
    "system:resource-read",
    "tamagotchi:widget-mount"
  ]
}
```

### 2. Implement the Plugin (`src/index.ts`)

```ts
import { definePlugin, defineTool } from '@nekotech/plugin-sdk'

import * as v from 'valibot'

export default definePlugin({
  name: 'system-glance',
  version: '1.0.0',
  setup(ctx) {
    // Register an AI agent tool
    ctx.tools.register(
      defineTool({
        name: 'get_system_metrics',
        description: 'Returns current memory, CPU usage, and battery state',
        schema: v.object({
          detailLevel: v.optional(v.picklist(['summary', 'verbose']), 'summary'),
        }),
        execute: async ({ detailLevel }) => {
          return {
            memoryUsage: '42%',
            cpuLoad: '12%',
            battery: '88%',
            timestamp: Date.now(),
          }
        },
      })
    )

    // Setup lifecycle teardown callback
    return () => {
      // Clean up intervals, subscriptions, or socket listeners
    }
  },
})
```

---

## Desktop & Tamagotchi Kits (`@nekotech/plugin-sdk-tamagotchi`)

Plugins targeting desktop Tamagotchi clients can use official kits for mounting companion UI components and interactive gamelets.

### Mounting Floating Widgets

```ts
import { definePlugin } from '@nekotech/plugin-sdk'
import { createWidgetKit } from '@nekotech/plugin-sdk-tamagotchi/widgets'

export default definePlugin({
  name: 'glance-widget',
  version: '1.0.0',
  async setup(ctx) {
    const widgets = await ctx.kits.use(createWidgetKit())

    const handle = await widgets.mount({
      id: 'glance-hud',
      title: 'Glance HUD',
      position: { x: 20, y: 50 },
      width: 240,
      height: 120,
      html: '<div class="glance-card">CPU: 12% | RAM: 42%</div>',
    })

    return () => handle.dispose()
  },
})
```

### Interactive Mini-Gamelets

```ts
import { definePlugin } from '@nekotech/plugin-sdk'
import { createGameletKit } from '@nekotech/plugin-sdk-tamagotchi/gamelet'

export default definePlugin({
  name: 'mini-tamagotchi-gamelet',
  version: '1.0.0',
  async setup(ctx) {
    const gamelets = await ctx.kits.use(createGameletKit())

    const session = await gamelets.mount({
      gameId: 'snack-catcher',
      viewport: { width: 320, height: 240 },
    })

    session.onScoreUpdate((score) => {
      ctx.logger.info(`Score updated: ${score}`)
    })

    return () => session.close()
  },
})
```

---

## Security & Capability Permissions

NekoAI enforces strict least-privilege sandboxing. Plugins cannot execute sensitive operations without declaring required capabilities in `plugins.json`.

| Capability | Category | Description |
| --- | --- | --- |
| `system:resource-read` | Low | Read memory, CPU, battery, and platform specs. |
| `network:fetch` | Medium | Perform outbound HTTP/HTTPS requests. |
| `tamagotchi:widget-mount` | Medium | Mount custom UI HUDs or floating widgets. |
| `tamagotchi:gamelet-mount` | Medium | Mount interactive 2D canvas gamelets. |
| `screen:capture` | High | Capture desktop screenshot or window frames. |
| `input:simulate` | High | Emit mouse and keyboard events. |

---

## Testing Plugins

Use Vitest with the included mock runtime helpers:

```ts
import { createMockPluginContext } from '@nekotech/plugin-sdk/testing'
import { describe, expect, it } from 'vitest'

import plugin from './index'

describe('my-plugin', () => {
  it('registers tools during setup', async () => {
    const ctx = createMockPluginContext()
    await plugin.setup(ctx)

    expect(ctx.tools.has('get_system_metrics')).toBe(true)
    const result = await ctx.tools.execute('get_system_metrics', { detailLevel: 'summary' })
    expect(result.memoryUsage).toBe('42%')
  })
})
```

## Architecture

- **Host Process**: Electron main process runs host services, security gatekeepers, and capability validators.
- **Worker Thread Sandbox**: Each active plugin runs in an isolated `node:worker_threads` sandbox with strict memory limits and a 5-second heartbeat watchdog.
- **Eventa IPC**: High-speed, type-safe RPC messaging via `@moeru/eventa`.

## License

[MIT](LICENSE)
