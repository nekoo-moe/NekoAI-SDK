# Manifest Specification & Capability Permissions

Every NekoAI plugin bundle must declare its metadata, gateway, and capabilities in a root `plugin.json` file (with legacy fallback to `neko-plugin.json`).

---

## 1. Manifest Schema v2

```json
{
  "$schema": "https://v2.nekoai.is-a.dev/schemas/v2.json",
  "id": "com.developer.my-plugin",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Short explanation of what this plugin accomplishes",
  "author": "Your Name <you@example.com>",
  "license": "MIT",
  "category": "productivity",
  "tags": ["tools", "automation"],
  "platform": ["windows", "macos", "linux"],
  "gateway": {
    "type": "native-app",
    "automationSurface": "native-api",
    "requiredPermissions": [
      "system:resource-read",
      "tamagotchi:widget-mount"
    ]
  },
  "settings": {
    "groups": [
      {
        "id": "general",
        "title": "General Configuration",
        "description": "Basic options for the plugin."
      }
    ],
    "fields": [
      {
        "key": "refreshInterval",
        "type": "number",
        "label": "Refresh Interval (seconds)",
        "defaultValue": 60,
        "min": 10,
        "max": 3600,
        "group": "general"
      },
      {
        "key": "apiKey",
        "type": "secret",
        "label": "Service API Key",
        "secret": true,
        "group": "general"
      }
    ]
  },
  "recipes": []
}
```

### Top-Level Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `$schema` | `string` | Optional | JSON Schema reference URI |
| `id` | `string` | **Yes** | Unique reverse-DNS identifier (e.g. `com.example.tool`) |
| `name` | `string` | **Yes** | Human-readable package slug |
| `version` | `string` | **Yes** | SemVer compliance (`MAJOR.MINOR.PATCH`) |
| `description` | `string` | Optional | Summary shown to users in the plugin manager |
| `author` | `string` | Optional | Author contact or attribution |
| `license` | `string` | Optional | SPDX license identifier |
| `category` | `string` | **Yes (v2)** | Domain category (`essential`, `gaming`, `messaging`, `productivity`, `developer`, `system`, `creative`, `custom`) |
| `subCategory` | `string` | Optional | More granular categorization (e.g. `rpg`, `git`, `chat`) |
| `tags` | `string[]` | Optional | Search keywords and tags |
| `platform` | `string[]` | **Yes** | Supported operating systems: `windows`, `macos`, `linux`, `web` |
| `gateway` | `object` | **Yes** | Interface gateway specifying `type`, `automationSurface`, and `requiredPermissions` |
| `knowledge` | `object` | Optional | Automation selectors, keyboard shortcuts, visual anchors, and prompt hints |
| `recipes` | `object[]` | **Yes** | Action recipes with declarative parameters and risk levels |
| `settings` | `object` | Optional | Declarative settings schema rendered dynamically by the host UI |
| `contributions` | `object` | Optional | Host surface UI contributions (icon, overlay widget, quick commands) |

---

## 2. Declarative Settings Schema

Plugins can declare settings schemas that NekoAI automatically renders in the client settings UI without bespoke frontend code.

### Field Types

- `boolean`: Checkbox / switch toggle.
- `string`: Text input field.
- `number`: Numeric input field with optional `min`, `max`, and `step`.
- `slider`: Slider control with numeric bounds.
- `select`: Dropdown select with enumerated `options`.
- `secret`: Obfuscated password/token input with reveal protection.
- `keybinding`: Interactive shortcut recorder.

---

## 3. Standard Capabilities

NekoAI classifies capabilities into three security risk tiers:

### Low Risk (Ambient & Read-Only)

| Capability | Description |
| --- | --- |
| `system:resource-read` | Read non-identifying CPU, RAM, battery, and platform information. |
| `system:display-info` | Read connected display resolutions, scale factors, and refresh rates. |
| `ambient:scheduled-trigger` | Register cron or interval wakeup timers for scheduled background checks. |
| `filesystem:read` | Read files in explicitly permitted directories. |

### Medium Risk (UI & Network)

| Capability | Description |
| --- | --- |
| `network:fetch` | Make outbound HTTP and HTTPS network requests to external APIs. |
| `tamagotchi:widget-mount` | Mount floating desktop HUD widgets on screen. |
| `tamagotchi:gamelet-mount` | Mount interactive 2D mini-game canvas overlays. |
| `tamagotchi:window-manage` | Query and manipulate NekoAI companion client window positions. |
| `filesystem:write` | Write or modify local files. |

### High Risk (Sensitive Control & Screen Perception)

| Capability | Description |
| --- | --- |
| `screen:capture` | Capture full display screenshots or stream desktop video frames. |
| `desktop:synthetic_input` | Simulate OS mouse clicks, mouse movements, and keyboard keystrokes. |
| `browser:cdp` | Connect to Chrome DevTools Protocol instances for browser automation. |

---

## 4. Linter Security Rules

When you run `npx @nekotech/create-neko-plugin lint .`, the linter evaluates your manifest against strict security guidelines:

1. **Manifest File**: Discovers `plugin.json` (falling back to legacy `neko-plugin.json`).
2. **Category Validation**: Ensures manifest v2 specifies a valid category from the recognized list.
3. **No Wildcard Capabilities**: Requesting `*` or unbounded prefixes is prohibited.
4. **Sensitive Combination Warning**: Requesting both `screen:capture` and unrestricted `network:fetch` triggers a warning, ensuring screen telemetry cannot be exfiltrated without explicit user acknowledgment.
5. **Mandatory Consent Gates**: Recipes with `high_risk_external` risk levels require human consent before execution.
