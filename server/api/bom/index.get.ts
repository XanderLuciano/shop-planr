export default defineApiHandler(async () => {
  const { bomService } = getServices()
  return bomService.listBoms()
})
