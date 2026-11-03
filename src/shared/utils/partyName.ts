import type { TFunction } from 'i18next'

/** اسم العميل، ولو هو شريك في شراكة بيتكتب جنبه "(الشريك)" (في الشاشات بس، مش في الفاتورة المطبوعة) */
export const customerLabel = (name: string, isPartner: number | boolean | undefined, t: TFunction) =>
  isPartner ? `${name} ${t('common.partnerTag')}` : name
