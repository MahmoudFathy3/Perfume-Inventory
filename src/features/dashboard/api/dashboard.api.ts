import type { DashboardRange, DashboardSummary, WorkspaceOverview } from '@shared/types'
import { invoke } from '@/shared/api/ipc'

export const dashboardApi = {
  summary: (range: DashboardRange) => invoke<DashboardSummary>('dashboard:summary', range),
  overview: () => invoke<WorkspaceOverview[]>('dashboard:overview')
}
