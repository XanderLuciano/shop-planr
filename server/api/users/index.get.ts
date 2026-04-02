export default defineApiHandler(async () => {
  const { userService } = getServices()
  return userService.listActiveUsers()
})
