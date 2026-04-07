import { initServices } from '../utils/services'

export default defineNitroPlugin(async () => {
  await initServices()
})
