# Tamagotchi Kits Guide

The `@nekotech/plugin-sdk-tamagotchi` package provides high-level kits for extending the desktop NekoAI Tamagotchi companion client with floating UI widgets, HUD displays, and interactive gamelets.

---

## 1. Installation

```bash
pnpm add @nekotech/plugin-sdk-tamagotchi
```

Make sure your `plugin.json` declares the matching capabilities:
```json
{
  "capabilities": [
    "tamagotchi:widget-mount",
    "tamagotchi:gamelet-mount"
  ]
}
```

---

## 2. Floating Widgets Kit (`createWidgetKit`)

The widget kit allows mounting lightweight, responsive HTML/CSS or canvas widgets near or around the companion avatar:

```ts
import { definePlugin } from '@nekotech/plugin-sdk'
import { createWidgetKit } from '@nekotech/plugin-sdk-tamagotchi/widgets'

export default definePlugin({
  name: 'clock-widget-plugin',
  version: '1.0.0',
  async setup(ctx) {
    const widgets = await ctx.kits.use(createWidgetKit())

    const clock = await widgets.mount({
      id: 'companion-digital-clock',
      title: 'Digital Clock',
      position: { x: 50, y: 50 },
      width: 180,
      height: 60,
      html: `
        <div style="font-family: monospace; font-size: 20px; color: #fff; background: rgba(0,0,0,0.7); padding: 12px; border-radius: 12px; text-align: center;">
          <span id="time-val">12:00:00</span>
        </div>
      `,
    })

    return () => {
      clock.dispose()
    }
  },
})
```

---

## 3. Interactive Gamelets Kit (`createGameletKit`)

Gamelets are mini interactive canvas overlays or games that the companion character and user can play together:

```ts
import { definePlugin } from '@nekotech/plugin-sdk'
import { createGameletKit } from '@nekotech/plugin-sdk-tamagotchi/gamelet'

export default definePlugin({
  name: 'tamagotchi-gamelet',
  version: '1.0.0',
  async setup(ctx) {
    const gamelets = await ctx.kits.use(createGameletKit())

    const session = await gamelets.mount({
      gameId: 'catch-the-fish',
      viewport: { width: 320, height: 240 },
    })

    session.onScoreUpdate((score) => {
      ctx.logger.info(`Companion score: ${score}`)
    })

    return () => {
      session.close()
    }
  },
})
```
