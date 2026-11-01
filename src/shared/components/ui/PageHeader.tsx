import type { ReactNode } from 'react'

/** عنوان الصفحة + أزرار الإجراءات (بحث، تصدير، إضافة...) */
export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <h1 className="min-w-0">{title}</h1>
      {/* في الشاشات الضيقة الأزرار بتنزل سطر جديد بدل ما تطلع برا الصفحة */}
      <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
    </div>
  )
}
