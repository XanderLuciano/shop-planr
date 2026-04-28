defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'List all process library entries.',
    responses: {
      200: { description: 'List of processes' },
    },
  },
})

export default defineApiHandler(async () => {
  const { libraryService } = getServices()
  return libraryService.listProcesses()
})
