defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'List all location library entries.',
    responses: {
      200: { description: 'List of locations' },
    },
  },
})

export default defineApiHandler(async () => {
  const { libraryService } = getServices()
  return libraryService.listLocations()
})
