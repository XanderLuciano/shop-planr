defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Delete a location from the library.',
    responses: {
      200: { description: 'Location deleted' },
      404: { description: 'Location not found' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const { libraryService } = getServices()
  libraryService.removeLocation(id)
  return { success: true }
})
