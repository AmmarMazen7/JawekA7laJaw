'use client'

import { useEffect, useState } from 'react'
import { useRealTimeData } from '@/hooks/use-real-time-data'

export function MetricsSync() {
  const { data: metricsData, isConnected } = useRealTimeData('queue_metrics')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  useEffect(() => {
    if (metricsData) {
      setLastUpdate(new Date())
    }
  }, [metricsData])

  if (!isConnected) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2 max-w-xs">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span>
          Live updates
          {lastUpdate && ` • Updated ${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago`}
        </span>
      </div>
    </div>
  )
}
