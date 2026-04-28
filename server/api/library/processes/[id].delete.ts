defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Delete a process from the library.',
    responses: {
      200: { description: 'Process deleted' },
      404: { description: 'Process not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { libraryService } = getServices()
  libraryService.removeProcess(id)
  return { success: true }
})
