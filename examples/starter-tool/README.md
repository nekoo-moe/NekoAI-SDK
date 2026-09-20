# Starter Tool Example

A minimal NekoAI plugin example that registers a simple AI agent tool (`greet_companion`).

## Usage

```ts
import { definePlugin, defineTool } from '@nekotech/plugin-sdk'
import * as v from 'valibot'

export default definePlugin({
  name: 'starter-tool',
  version: '1.0.0',
  setup(ctx) {
    ctx.tools.register(
      defineTool({
        name: 'greet_companion',
        description: 'Sends a personalized greeting from the user to the companion',
        schema: v.object({
          userName: v.string(),
          mood: v.optional(v.picklist(['happy', 'tired', 'excited']), 'happy'),
        }),
        execute: async ({ userName, mood }) => {
          return {
            greeting: `Hello ${userName}!`,
          }
        },
      })
    )
  },
})
```
