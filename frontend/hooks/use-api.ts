'use client'

import { useCallback, useEffect, useState } from 'react'

interface UseApiOptions {
  autoFetch?: boolean
  deps?: any[]
}

export function useApi<T = any>(
  fetch: () => Promise<any>,
  options?: UseApiOptions
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch()
      if (response.success) {
        setData(response.data)
      } else {
        setError(response.error || 'Unknown error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [fetch])

  useEffect(() => {
    if (options?.autoFetch) {
      refetch()
    }
  }, [refetch, options?.autoFetch, ...(options?.deps || [])])

  return { data, loading, error, refetch }
}
