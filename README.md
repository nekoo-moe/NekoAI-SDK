# NekoAI SDK

<p align="center">
  <strong>Official Plugin SDK, Wire Protocols, and Scaffolding CLI for Project NekoAI</strong>
</p>

<p align="center">
  <a href="https://github.com/nekoo-moe/NekoAI-SDK/actions/workflows/ci.yml"><img src="https://github.com/nekoo-moe/NekoAI-SDK/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@nekotech/plugin-sdk"><img src="https://img.shields.io/npm/v/@nekotech/plugin-sdk.svg?color=cb3837" alt="npm version" /></a>
  <a href="https://github.com/nekoo-moe/NekoAI-SDK/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
</p>

---

## Overview

The **NekoAI SDK** gives developers everything needed to build, test, and distribute custom extensions for the [NekoAI](https://github.com/nekoo-moe/NekoAI) desktop companion.

- **Agent Tools**: Equip the companion's AI character with custom functions, web tools, and system integrations.
- **Desktop UI & Kits**: Render floating HUD widgets, companion status panels, and interactive 2D canvas gamelets.
- **Isolated Worker Sandbox**: Built-in crash circuit breaker, memory limits, and automated heartbeat watchdog.
- **Zero-Config Scaffolding**: Create production-ready plugins in seconds with `pnpm create @nekotech/neko-plugin`.
- **Security Linter**: Built-in manifest auditing to detect privilege escalation or excessive capability requests.

---

## Packages in this Repository

| Package | Version | Description |
| --- | --- | --- |
| [`@nekotech/plugin-sdk`](packages/plugin-sdk) | [![npm](https://img.shields.io/npm/v/@nekotech/plugin-sdk.svg)](https://www.npmjs.com/package/@nekotech/plugin-sdk) | Core runtime-agnostic plugin authoring SDK (`definePlugin`, `defineTool`) |
| [`@nekotech/plugin-protocol`](packages/plugin-protocol) | [![npm](https://img.shields.io/npm/v/@nekotech/plugin-protocol.svg)](https://www.npmjs.com/package/@nekotech/plugin-protocol) | Shared Eventa RPC event contracts, capability types, and manifest schemas |
| [`@nekotech/plugin-sdk-tamagotchi`](packages/plugin-sdk-tamagotchi) | [![npm](https://img.shields.io/npm/v/@nekotech/plugin-sdk-tamagotchi.svg)](https://www.npmjs.com/package/@nekotech/plugin-sdk-tamagotchi) | Desktop Tamagotchi client kits (floating widgets, gamelet mounting) |
| [`@nekotech/create-neko-plugin`](packages/create-neko-plugin) | [![npm](https://img.shields.io/npm/v/@nekotech/create-neko-plugin.svg)](https://www.npmjs.com/package/@nekotech/create-neko-plugin) | CLI scaffolding generator (`create-neko-plugin`) & manifest security linter |

---

## Quick Start

### 1. Scaffold a New Plugin Project

```bash
# Using pnpm
pnpm create @nekotech/neko-plugin my-plugin --template desktop-ui

# Using npm
npm create @nekotech/neko-plugin my-plugin --template desktop-ui

# Using npx
npx @nekotech/create-neko-plugin my-plugin --template desktop-ui
```

### 2. Write Your Plugin Code

```ts
import { definePlugin, defineTool } from '@nekotech/plugin-sdk'
import * as v from 'valibot'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',
  setup(ctx) {
    ctx.tools.register(
      defineTool({
        name: 'fetch_user_status',
        description: 'Returns real-time status updates',
        schema: v.object({
          user: v.string(),
        }),
        execute: async ({ user }) => {
          return { status: 'active', user }
        },
      })
    )
  },
})
```

### 3. Lint & Verify

```bash
npx @nekotech/create-neko-plugin lint .
```

---

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Architecture & Security Model](docs/architecture.md)
- [Manifest & Capabilities Specification](docs/manifest-and-capabilities.md)
- [Authoring AI Agent Tools](docs/authoring-tools.md)
- [Tamagotchi Desktop Kits (Widgets & Gamelets)](docs/tamagotchi-kits.md)
- [Scaffolding CLI & Security Linter](docs/scaffolding-and-linting.md)
- [Packaging & Publishing](docs/publishing.md)

---

## Reference Examples

Check out the [examples/](examples) directory for working starter plugins:
- [`examples/acrobat-companion`](examples/acrobat-companion): Desktop PDF form filling and signature vault companion.
- [`examples/daily-briefing`](examples/daily-briefing): Ambient multi-source daily agenda and git harvester.
- [`examples/starter-tool`](examples/starter-tool): Minimal standalone AI tool plugin.

---

## Monorepo Development

To contribute to this SDK:

```bash
# Clone the repository
git clone https://github.com/nekoo-moe/NekoAI-SDK.git
cd NekoAI-SDK

# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Run test suites
pnpm test
```

---

## License

This repository is licensed under the [MIT License](LICENSE).