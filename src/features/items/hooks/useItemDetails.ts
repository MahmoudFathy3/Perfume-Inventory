import { useQuery } from '@/shared/hooks/useQuery'
import { itemsApi } from '../api/items.api'

export function useItemDetails(id: number) {
  const { data, loading, error } = useQuery(() => itemsApi.details({ id }), [id])
  return { details: data, loading, error }
}
