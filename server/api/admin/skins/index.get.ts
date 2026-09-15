import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'
import { toSkinDTO } from '~~/types/dto'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const skins = await adminService.listSkins()
  return skins.map(toSkinDTO)
})
