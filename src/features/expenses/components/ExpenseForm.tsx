import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Expense, ExpenseInput } from '@shared/types'
import { Field, FormActions, Input, NumberInput } from '@/shared/components/ui'
import { useSubmit } from '@/shared/hooks/useSubmit'
import { todayString } from '@/shared/utils/format'
import { ExpenseTypeSelect } from './ExpenseTypeSelect'

interface ExpenseFormProps {
  initial: Expense | null
  /** الأنواع اللي اتسجلت قبل كده في المخزن ده */
  categories: string[]
  onSubmit: (values: ExpenseInput) => Promise<unknown>
  onCancel: () => void
}

/** مصروف: التاريخ والنوع (من الأنواع المسجلة، أو نوع جديد من نفس القايمة) والمبلغ، ويتخصم من الربح ولا تسجيل بس */
export function ExpenseForm({ initial, categories, onSubmit, onCancel }: ExpenseFormProps) {
  const { t } = useTranslation()
  const [values, setValues] = useState({
    expense_date: initial?.expense_date ?? todayString(),
    category: initial?.category ?? '',
    amount: initial ? String(initial.amount) : '',
    notes: initial?.notes ?? ''
  })
  const [deduct, setDeduct] = useState(initial ? initial.deduct === 1 : true)
  const set = (key: keyof typeof values) => (value: string) => setValues({ ...values, [key]: value })
  const { submit, saving } = useSubmit(() => onSubmit({ ...values, deduct }))

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-2 gap-x-4">
        <Field label={t('expenses.category')}>
          <ExpenseTypeSelect types={categories} value={values.category} onChange={set('category')} creatable placeholder={t('expenses.categoryHint')} />
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={values.expense_date} onChange={(e) => set('expense_date')(e.target.value)} />
        </Field>
      </div>
      <Field label={t('expenses.amount')}>
        <NumberInput value={values.amount} placeholder="0" onChange={(e) => set('amount')(e.target.value)} />
      </Field>
      <label className="mb-3.5 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-primary-600" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
        <span>{t('expenses.deduct')}</span>
      </label>
      <p className="-mt-2 mb-3.5 text-xs text-slate-500">{t(deduct ? 'expenses.deductHint' : 'expenses.recordOnlyHint')}</p>
      <Field label={t('common.notes')}>
        <Input value={values.notes} onChange={(e) => set('notes')(e.target.value)} />
      </Field>
      <FormActions saving={saving} onCancel={onCancel} />
    </form>
  )
}
