import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '../api/ipc'

interface PrintApi {
  /** طباعة عادية (نافذة الطباعة) */
  print: (content: ReactNode) => Promise<void>
  /** حفظ كـ PDF (بيطلب مكان الحفظ) */
  savePdf: (content: ReactNode, defaultName: string) => Promise<void>
  /** بيعرض المحتوى في منطقة الطباعة وبينفّذ action (بتاخد العنصر اللي فيه المحتوى) وبعدين بيشيله */
  render: <T>(content: ReactNode, action: (root: HTMLElement) => Promise<T>) => Promise<T>
}

const PrintContext = createContext<PrintApi | null>(null)

/** بنستنى كام frame علشان React يرسم المحتوى في منطقة الطباعة قبل الطباعة */
const nextFrames = (count: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)))
    step(count)
  })

/**
 * بتعرض أي محتوى (فاتورة / تقرير) في #print-root وقت الطباعة بس.
 * على الشاشة المنطقة دي مخفية، وفي الطباعة التطبيق كله هو اللي بيتخفي (شوف index.css).
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ReactNode>(null)

  const run = useCallback(async <T,>(node: ReactNode, action: (root: HTMLElement) => Promise<T> | T): Promise<T> => {
    setContent(node)
    await nextFrames(3)
    try {
      return await action(document.getElementById('print-root')!)
    } finally {
      setContent(null)
    }
  }, [])

  const api = useMemo<PrintApi>(
    () => ({
      print: (node) => run(node, () => window.print()),
      savePdf: async (node, defaultName) => {
        await run(node, () => invoke('print:pdf', { defaultName }))
      },
      render: (node, action) => run(node, action)
    }),
    [run]
  )

  const root = document.getElementById('print-root')
  return (
    <PrintContext.Provider value={api}>
      {children}
      {root && content && createPortal(content, root)}
    </PrintContext.Provider>
  )
}

export function usePrint(): PrintApi {
  const ctx = useContext(PrintContext)
  if (!ctx) throw new Error('usePrint must be used inside <PrintProvider>')
  return ctx
}
