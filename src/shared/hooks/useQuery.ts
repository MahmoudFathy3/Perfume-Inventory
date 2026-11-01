import { useCallback, useEffect, useState } from 'react'

interface QueryState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

/** بيجيب داتا من الـ backend ويرجّع { data, loading, error, reload } */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((error: Error) => !cancelled && setState({ data: null, loading: false, error }))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}
