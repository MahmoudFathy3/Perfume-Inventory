import type { Item } from '@shared/types'
import { CONDITIONS } from '../../lib/constants'
import { normalizeArabic } from '../../lib/normalizeArabic'
import { withWorkspace } from '../../lib/workspace'
import * as workspaces from '../workspaces/workspaces.repository'
import * as repo from './items.repository'

/** بيضيف كميات منتج من مخزن تاني على المنتج المجمّع، والسعر الفاضي بيتكمّل منه */
function merge(target: Item, other: Item): void {
  for (const c of CONDITIONS) {
    target[`${c}_quantity`] += other[`${c}_quantity`]
    for (const price of ['purchase', 'selling', 'wholesale'] as const) {
      const key = `${c}_${price}_price` as const
      if (!(target[key] > 0)) target[key] = other[key]
    }
  }
}

/**
 * منتجات المخزون الفعلي وكل الشراكات المفتوحة في قايمة واحدة من غير تكرار.
 * المنتج هو هو لو اسمه (عربي أو إنجليزي) واحد من غير تفرقة همزة/تاء مربوطة (زي التحويلات).
 * الكميات بتتجمع، والأسعار من المخزون الفعلي الأول (هو أول واحد في الترتيب) ولو مش موجود فيه من الشراكة.
 */
export function listAllStores(): Item[] {
  const result: Item[] = []
  const byName = new Map<string, Item>()
  for (const ws of workspaces.findAll().filter((w) => !w.closed_at && w.kind !== 'warehouse')) {
    for (const item of withWorkspace(ws.id, () => repo.findAll())) {
      const names = [item.name_ar, item.name_en].filter(Boolean).map((n) => normalizeArabic(n!))
      const existing = names.map((n) => byName.get(n)).find(Boolean)
      if (existing) {
        merge(existing, item)
        continue
      }
      const copy = { ...item }
      result.push(copy)
      for (const n of names) byName.set(n, copy)
    }
  }
  return result
}
