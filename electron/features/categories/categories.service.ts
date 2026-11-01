import type { PageParams } from '@shared/types'
import { AppError } from '../../lib/errors'
import * as repo from './categories.repository'

/** اسم الصنف: مطلوب ومينفعش يتكرر */
function cleanName(v: unknown, excludeId = 0): string {
  const name = String(v ?? '').trim()
  if (!name) throw new AppError('NAME_REQUIRED')
  if (repo.findByName(name, excludeId)) throw new AppError('DUPLICATE_NAME')
  return name
}

export const listCategories = (p: { search?: string }) => repo.findAll(p)
export const pageCategories = (p: { search?: string } & PageParams) => repo.findPage(p, p)
export const createCategory = ({ name }: { name: string }) => repo.insert(cleanName(name))
export const updateCategory = ({ id, name }: { id: number; name: string }) => repo.update(id, cleanName(name, id))
export const removeCategory = ({ id }: { id: number }) => repo.remove(id)
