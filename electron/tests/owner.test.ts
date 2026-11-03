import assert from 'node:assert/strict'
import test from 'node:test'
import * as settings from '../features/settings/settings.service'
import * as ws from '../features/workspaces/workspaces.service'
import { err, useTestDb } from './helpers'

useTestDb()

const partnersOf = (id: number) => ws.listWorkspaces().find((w) => w.id === id)!.partners

test('صاحب المخزون الفعلي: مش متحدد في الأول، والاسم مطلوب', () => {
  assert.equal(ws.getOwner(), null)
  assert.equal(err(() => ws.setOwner({ name: '  ' })), 'NAME_REQUIRED')
  // قبل تحديده: أي شريكين مسموح (البيانات القديمة)
  ws.createWorkspace({ partners: ['سيد', 'علي'] })
})

test('بعد تحديده: لازم يكون شريك في أي شراكة جديدة، وبيتعلّم عليه is_owner', () => {
  ws.setOwner({ name: 'محمود' })
  assert.equal(ws.getOwner(), 'محمود')
  assert.equal(err(() => ws.createWorkspace({ partners: ['أحمد', 'علي'] })), 'OWNER_NOT_PARTNER')

  const id = ws.createWorkspace({ partners: ['محمود', 'أحمد'] })
  assert.deepEqual(partnersOf(id).map((p) => [p.name, p.is_owner]), [['محمود', true], ['أحمد', false]])
  assert.equal(err(() => ws.updateWorkspace({ id, partners: ['أحمد', 'علي'] })), 'OWNER_NOT_PARTNER')

  // شراكة قديمة هو مش فيها: بتتعدّل عادي
  const old = ws.listWorkspaces().find((w) => w.partners.some((p) => p.name === 'سيد'))!
  ws.updateWorkspace({ id: old.id, name: 'قديمة', partners: ['سيد', 'علي'] })
})

test('تغيير اسم صاحب المخزون بيغيّره في كل شراكاته بنفس رقم الشريك', () => {
  const id = ws.createWorkspace({ name: 'مشروع تاني', partners: ['محمود', 'أحمد'] })
  const before = partnersOf(id)[0].id
  ws.setOwner({ name: 'محمود فتحي' })
  const after = partnersOf(id)[0]
  assert.deepEqual([after.id, after.name, after.is_owner], [before, 'محمود فتحي', true])
  assert.equal(ws.listWorkspaces().filter((w) => w.partners.some((p) => p.name === 'محمود')).length, 0)

  // شراكة مع شخص بنفس الاسم الجديد: التغيير بيترفض ومفيش حاجة بتتغيّر
  ws.createWorkspace({ partners: ['محمود فتحي', 'حسن'] })
  ws.createWorkspace({ partners: ['محمود فتحي', 'كريم'] })
  assert.equal(err(() => ws.setOwner({ name: 'كريم' })), 'DUPLICATE_PARTNERS')
  assert.equal(ws.getOwner(), 'محمود فتحي')
})

test('اسم صاحب المخزون بيظهر مع باقي الإعدادات', () => {
  assert.equal(settings.getAll().owner_name, 'محمود فتحي')
})
