import { NuxtAuthHandler } from '#auth'
import { authOptions } from '~~/server/utils/auth-options'

export default NuxtAuthHandler(authOptions)
