import { definePlugin, defineTool } from '@nekotech/plugin-sdk'
import * as v from 'valibot'

export default definePlugin({
  id: 'com.example.starter-tool',
  name: 'starter-tool',
  version: '1.0.0',
  category: 'developer',
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
          ctx.logger.info(`Received greeting from ${userName} (${mood})`)
          return {
            greeting: `Hello ${userName}! Wishing you a wonderful time! (Mood: ${mood})`,
            timestamp: Date.now(),
          }
        },
      }),
    )

    return () => {
      ctx.logger.info('Starter plugin cleanup completed.')
    }
  },
})
