# Manifest Specification & Capability Permissions

Every NekoAI plugin bundle must declare its metadata, entrypoint, and permissions in a root `neko-plugin.json` file.

---

## 1. Manifest Schema

```json
{
  "id": "com.developer.my-plugin",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short explanation of what this plugin accomplishes",
  "entrypoint": "dist/index.mjs",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "homepage": "https://github.com/myorg/my-plugin",
  "capabilities": [
    "system:resource-read",
    "tamagotchi:widget-mount"
  ]
}
```

### Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | **Yes** | Unique reverse-DNS identifier (e.g. `com.example.tool`) |
| `name` | `string` | **Yes** | Human-readable package slug |
| `version` | `string` | **Yes** | Semver compliance (`MAJOR.MINOR.PATCH`) |
| `entrypoint` | `string` | **Yes** | Relative path to compiled ESM entrypoint |
| `description` | `string` | **Yes** | Summary shown to users in the plugin manager |
| `author` | `string` | Optional | Author contact or attribution |
| `license` | `string` | Optional | SPDX license identifier |
| `capabilities` | `string[]` | **Yes** | List of requested capability permission strings |

---

## 2. Standard Capabilities

NekoAI classifies capabilities into three security risk tiers:

### Low Risk (Ambient & Read-Only)

| Capability | Description |
| --- | --- |
| `system:resource-read` | Read non-identifying CPU, RAM, battery, and platform information. |
| `system:display-info` | Read connected display resolutions, scale factors, and refresh rates. |
| `ambient:scheduled-trigger` | Register cron or interval wakeup timers for scheduled background checks. |

### Medium Risk (UI & Network)

| Capability | Description |
| --- | --- |
| `network:fetch` | Make outbound HTTP and HTTPS network requests to external APIs. |
| `tamagotchi:widget-mount` | Mount floating desktop HUD widgets on screen. |
| `tamagotchi:gamelet-mount` | Mount interactive 2D mini-game canvas overlays. |
| `tamagotchi:window-manage` | Query and manipulate NekoAI companion client window positions. |

### High Risk (Sensitive Control & Screen Perception)

| Capability | Description |
| --- | --- |
| `screen:capture` | Capture full display screenshots or stream desktop video frames. |
| `input:simulate` | Simulate OS mouse clicks, mouse movements, and keyboard keystrokes. |
| `browser:cdp-connect` | Connect to external Chrome DevTools Protocol instances for deep automation. |

---

## 3. Linter Security Rules

When you run `npx @nekotech/create-neko-plugin lint .`, the linter evaluates your manifest against strict security guidelines:

1. **No Wildcard Capabilities**: Requesting `*` or unbounded prefixes is prohibited.
2. **Sensitive Combination Warning**: Requesting both `screen:capture` and unrestricted `network:fetch` triggers a warning, ensuring screen telemetry cannot be exfiltrated without explicit user acknowledgment.
3. **Entrypoint Verification**: Verifies that the file specified in `"entrypoint"` exists on disk and exports a valid plugin definition.
