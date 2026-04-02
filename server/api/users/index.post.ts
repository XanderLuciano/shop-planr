export default defineApiHandler(async (event) => {
  const body = await readBody(event)
  const { userService } = getServices()
  return userService.createUser(body)
})
