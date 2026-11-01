import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { applyLanguage, savedLanguage } from '@/i18n'
import { AuthProvider, useAuth } from './AuthProvider'
import { LockScreen } from './components/LockScreen'
import { RecoveryKeyScreen } from './components/RecoveryKeyScreen'
import { SetupScreen } from './components/SetupScreen'

/** البوابة: التطبيق نفسه مبيتعرضش (ولا بيحمّل أي داتا) غير لما الحالة تكون "مفتوح" ومفتاح الاسترجاع اتأكد */
function Gate({ children }: { children: ReactNode }) {
  const { status, pendingRecoveryKey } = useAuth()
  if (pendingRecoveryKey) return <RecoveryKeyScreen recoveryKey={pendingRecoveryKey} />
  if (status.state === 'setup') return <SetupScreen />
  if (status.state === 'locked') return <LockScreen />
  return <>{children}</>
}

export function AuthGate({ children }: { children: ReactNode }) {
  // لغة شاشات القفل من الجهاز (إعدادات اللغة الأصلية جوه الداتا بيز المقفولة)
  useEffect(() => applyLanguage(savedLanguage()), [])
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  )
}
