import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthStatus } from '@shared/types'
import { authApi } from './api/auth.api'

/** أقل فترة بين رسالتين "أنا لسه شغال" للـ main (علشان القفل بالخمول) */
const PING_EVERY_MS = 15_000
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'wheel', 'touchstart'] as const

interface AuthContextValue {
  status: AuthStatus
  /** مفتاح استرجاع لسه ما اتأكدش المستخدم إنه حفظه (التطبيق بيستنى) */
  pendingRecoveryKey: string | null
  setup: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  recover: (recoveryKey: string, password: string) => Promise<void>
  lock: () => Promise<void>
  refresh: () => Promise<void>
  confirmRecoveryKey: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** حالة كلمة السر: أول إعداد / مقفول / مفتوح. الـ main هو اللي بيقرر القفل، والواجهة بتتبع. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus | null>(null)
  const [pendingRecoveryKey, setPendingRecoveryKey] = useState<string | null>(null)
  const lastPing = useRef(0)

  const refresh = useCallback(async () => setStatus(await authApi.status()), [])
  useEffect(() => {
    refresh().catch(() => setStatus({ state: 'locked', waitSeconds: 0, idleMinutes: 10 }))
    return window.api.onLocked(() => void refresh())
  }, [refresh])

  const unlocked = status?.state === 'unlocked'
  useEffect(() => {
    if (!unlocked) return
    const onActivity = () => {
      const now = Date.now()
      if (now - lastPing.current < PING_EVERY_MS) return
      lastPing.current = now
      authApi.ping().catch(() => undefined)
    }
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true })
    return () => ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, onActivity))
  }, [unlocked])

  const value = useMemo<AuthContextValue | null>(
    () =>
      status && {
        status,
        pendingRecoveryKey,
        async setup(password) {
          const { recoveryKey } = await authApi.setup({ password })
          setPendingRecoveryKey(recoveryKey)
          await refresh()
        },
        async unlock(password) {
          try {
            await authApi.unlock({ password })
          } finally {
            await refresh() // علشان عدّاد الانتظار يتحدّث حتى لو فشل
          }
        },
        async recover(recoveryKey, password) {
          try {
            const res = await authApi.recover({ recoveryKey, password })
            setPendingRecoveryKey(res.recoveryKey)
          } finally {
            await refresh()
          }
        },
        lock: async () => {
          await authApi.lock()
          await refresh()
        },
        refresh,
        confirmRecoveryKey: () => setPendingRecoveryKey(null)
      },
    [status, pendingRecoveryKey, refresh]
  )

  return value ? <AuthContext.Provider value={value}>{children}</AuthContext.Provider> : null
}
