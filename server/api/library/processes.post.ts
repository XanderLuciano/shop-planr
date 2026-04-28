defineRouteMeta({
  openAPI: {
    tags: ['Library'],
    description: 'Add a new process to the library.',
    responses: {
      201: { description: 'Process created' },
      400: { description: 'Validation error' },
    },
  },
})

export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { libraryService } = getServices()
  return libraryService.addProcess(body.name)
})
