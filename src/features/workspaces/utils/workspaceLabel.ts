import type { TFunction } from 'i18next'
import type { Workspace } from '@shared/types'

/** الاسم اللي بيظهر للمستخدم: "المخزون الفعلي" أو "شراكة محمود وأحمد" (أو اسم الشراكة المكتوب) */
export function workspaceLabel(ws: Pick<Workspace, 'kind' | 'name' | 'partners'>, t: TFunction): string {
  if (ws.kind === 'personal') return t('workspaces.personal')
  const name = ws.name || ws.partners.map((p) => p.name).join(t('workspaces.and'))
  return t('workspaces.partnershipOf', { name })
}
