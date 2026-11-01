import type { ReactNode } from 'react'

/** عنوان الصفحة + أزرار الإجراءات (بحث، تصدير، إضافة...) */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1>{title}</h1>
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  )
}
