import { requireRole } from '~~/server/utils/require-auth'
import { adminService } from '~~/server/services/admin.service'

export default defineEventHandler(async (event) => {
  await requireRole(event, ['ADMIN'])
  const cases = await adminService.listCases()

  return cases.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    casePrice: c.casePrice,
    keyPrice: c.keyPrice,
    status: c.status,
    latestVersion: c.versions[0] ? { version: c.versions[0].version, publishedAt: c.versions[0].publishedAt?.toISOString() ?? null } : null,
  }))
})
