export default defineApiHandler(async (event) => {
  const body = await readBody<{
    jobId: string
    pathId: string
    stepId: string
    partIds: string[]
    text: string
  }>(event)
  const userId = getAuthUserId(event)
  const { noteService } = getServices()
  return noteService.createNote({ ...body, userId })
})
