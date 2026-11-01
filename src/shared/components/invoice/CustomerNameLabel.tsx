import { useTranslation } from 'react-i18next'

/** اسم العميل لوحده بخط كبير ("أ/ أحمد") للطباعة على الطرد أو الورقة */
export function CustomerNameLabel({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <div className="px-6 py-10 text-center text-[44px] font-bold leading-snug">
      {t('invoice.namePrefix')} {name}
    </div>
  )
}
