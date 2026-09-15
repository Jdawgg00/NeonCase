import type { Role, UserStatus } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
      status: UserStatus
      username: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
