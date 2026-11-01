import { Mail, Phone, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@/shared/components/ui'
import { ENV } from '@/config/env'

function Row({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 shrink-0 text-primary-700" aria-hidden="true" />
      <span className="w-24 text-sm text-slate-500">{label}</span>
      <bdi className="select-all font-semibold">{value}</bdi>
    </div>
  )
}

/** عن المطوّر: الاسم ووسائل التواصل (من ملف .env) */
export function AboutCard() {
  const { t } = useTranslation()
  const { name, phone, email } = ENV.developer
  return (
    <Card className="space-y-3">
      <h2>{t('about.title')}</h2>
      <Row icon={UserRound} label={t('about.developer')} value={name} />
      {phone && <Row icon={Phone} label={t('about.phone')} value={phone} />}
      {email && <Row icon={Mail} label={t('about.email')} value={email} />}
    </Card>
  )
}
