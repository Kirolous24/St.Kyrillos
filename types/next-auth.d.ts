import type { DefaultSession } from 'next-auth'

export type SessionKind = 'site' | 'portal'
export type PortalRoleName = 'STUDENT' | 'SERVANT' | 'ADMIN' | 'PASTOR'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      kind: SessionKind
      role?: PortalRoleName
      accountId?: string
    }
  }
  interface User {
    kind?: SessionKind
    role?: PortalRoleName
    accountId?: string
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    kind?: SessionKind
    role?: PortalRoleName
    accountId?: string
  }
}
