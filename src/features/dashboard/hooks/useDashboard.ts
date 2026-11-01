import type { DashboardRange } from '@shared/types'
import { useQuery } from '@/shared/hooks/useQuery'
import { dashboardApi } from '../api/dashboard.api'

/** range فاضي (from / to) = كل الفترة */
export function useDashboard(range: { from: string; to: string }) {
  const query: DashboardRange = { from: range.from || null, to: range.to || null }
  const { data, loading, reload } = useQuery(() => dashboardApi.summary(query), [range.from, range.to])
  return { summary: data, loading, reload }
}
