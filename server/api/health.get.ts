defineRouteMeta({
  openAPI: {
    tags: ['Health'],
    description: 'Returns server health status.',
    responses: {
      200: { description: 'Server is healthy' },
    },
  },
})

export default defineEventHandler(() => ({ status: 'ok' }))
