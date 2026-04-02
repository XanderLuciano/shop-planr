export default defineApiHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const body = await readBody(event)
  const { userService } = getServices()
  return userService.updateUser(id, body)
})
