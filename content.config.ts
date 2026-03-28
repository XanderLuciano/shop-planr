import { defineCollection, defineContentConfig } from '@nuxt/content'
import { z } from 'zod'

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: 'api-docs/**',
      schema: z.object({
        endpoint: z.string().optional(),
        method: z.string().optional(),
        service: z.string().optional(),
        category: z.string().optional(),
        icon: z.string().optional(),
        requestBody: z.string().optional(),
        responseType: z.string().optional(),
        errorCodes: z.array(z.number()).optional()
      })
    })
  }
})
