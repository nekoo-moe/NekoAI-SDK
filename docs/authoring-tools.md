# Authoring AI Agent Tools

One of the primary capabilities of NekoAI plugins is exposing structured, callable tools to the companion character's language model.

---

## 1. Tool Anatomy

A tool consists of:
- **`name`**: A unique alphanumeric snake_case identifier (e.g. `get_weather`).
- **`description`**: Clear English prompt instructing the LLM when and why to invoke the tool.
- **`schema`**: A [Valibot](https://valibot.dev/) schema defining parameters and validation rules.
- **`execute`**: An asynchronous execution function that receives validated arguments and returns structured data.

```ts
import { definePlugin, defineTool } from '@nekotech/plugin-sdk'
import * as v from 'valibot'

export default definePlugin({
  name: 'weather-plugin',
  version: '1.0.0',
  setup(ctx) {
    ctx.tools.register(
      defineTool({
        name: 'query_weather',
        description: 'Queries current weather condition and temperature for a given city',
        schema: v.object({
          city: v.pipe(v.string(), v.minLength(1)),
          units: v.optional(v.picklist(['celsius', 'fahrenheit']), 'celsius'),
        }),
        execute: async ({ city, units }) => {
          ctx.logger.info(`Fetching weather for ${city} in ${units}`)

          // Perform logic or network call
          return {
            temperature: 24,
            condition: 'Partly Cloudy',
            units,
          }
        },
      })
    )
  },
})
```

---

## 2. Using Context Helpers

The `ctx` object passed to `setup` provides built-in utilities:

- **`ctx.logger`**: Scoped logger (`info`, `warn`, `error`, `debug`) that streams structured logs to the Tamagotchi devtools console.
- **`ctx.tools`**: Tool registry (`register`, `unregister`, `has`).
- **`ctx.kits`**: Kit client provider for Tamagotchi features (`ctx.kits.use(...)`).

---

## 3. Error Handling

Errors thrown inside `execute()` are serialized cleanly and returned to the LLM agent as tool failure messages, allowing the model to self-correct or inform the user:

```ts
execute: async ({ city }) => {
  if (!isValidCity(city)) {
    throw new Error(`Unrecognized city: "${city}". Please ask the user to specify a known region.`)
  }
}
```

---

## 4. Unit Testing Tools

You can unit-test your tools with `@nekotech/plugin-sdk/testing` and Vitest:

```ts
import { describe, expect, it } from 'vitest'
import { createMockPluginContext } from '@nekotech/plugin-sdk/testing'
import weatherPlugin from './index'

describe('weatherPlugin', () => {
  it('registers and executes query_weather tool', async () => {
    const ctx = createMockPluginContext()
    await weatherPlugin.setup(ctx)

    expect(ctx.tools.has('query_weather')).toBe(true)

    const result = await ctx.tools.execute('query_weather', {
      city: 'Tokyo',
      units: 'celsius',
    })

    expect(result.temperature).toBe(24)
    expect(result.units).toBe('celsius')
  })
})
```
