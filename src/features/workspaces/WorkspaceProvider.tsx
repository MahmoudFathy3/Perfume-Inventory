import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Workspace } from '@shared/types'
import { useToast } from '@/shared/toast/ToastProvider'
import { workspacesApi } from './api/workspaces.api'
import { workspaceLabel } from './utils/workspaceLabel'

interface WorkspaceContextValue {
  /** كل المساحات (بما فيها المقفولة) */
  workspaces: Workspace[]
  /** المساحة اللي شغالين عليها دلوقتي */
  active: Workspace
  /** اسم المساحة اللي بيظهر للمستخدم */
  label: (ws: Pick<Workspace, 'kind' | 'name' | 'partners'>) => string
  /** التبديل لمساحة تانية: كل الصفحات بتتحمّل من جديد على بياناتها */
  activate: (id: number) => Promise<void>
  /** إعادة تحميل القايمة (بعد إضافة أو تعديل أو قفل شراكة) */
  reload: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function useWorkspaces(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (!ctx) throw new Error('useWorkspaces must be used inside <WorkspaceProvider>')
  return ctx
}

/** المساحة النشطة محفوظة في الـ backend، والواجهة بتعرضها وبتبدّل بينها */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const toast = useToast()
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null)

  const reload = useCallback(async () => setWorkspaces(await workspacesApi.list()), [])
  useEffect(() => {
    reload().catch(toast.fail)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload])

  const value = useMemo<WorkspaceContextValue | null>(() => {
    const active = workspaces?.find((w) => w.active)
    if (!workspaces || !active) return null
    const label: WorkspaceContextValue['label'] = (ws) => workspaceLabel(ws, t)
    return {
      workspaces,
      active,
      label,
      reload,
      activate: async (id) => {
        await workspacesApi.activate({ id })
        await reload()
        navigate('/') // صفحات التفاصيل (منتج / عميل) تبع المخزن القديم
        toast.info(t('workspaces.switched', { name: label(workspaces.find((w) => w.id === id) ?? active) }))
      }
    }
  }, [workspaces, reload, navigate, toast, t])

  return value ? <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider> : null
}
