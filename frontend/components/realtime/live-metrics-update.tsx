'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface LiveMetricsProps {
  onMetricsUpdate?: (metrics: any) => void
}

export function LiveMetricsUpdate({ onMetricsUpdate }: LiveMetricsProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [trend, setTrend] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    // Simulate real-time metric updates
    const interval = setInterval(() => {
      const newMetrics = {
        avgServiceTime: (Math.random() * 2 + 3).toFixed(1),
        efficiency: Math.floor(Math.random() * 20 + 75),
        customersInQueue: Math.floor(Math.random() * 30) + 20,
      }

      setMetrics(newMetrics)
      setTrend(Math.random() > 0.5 ? 'up' : 'down')
      onMetricsUpdate?.(newMetrics)
    }, 5000)

    return () => clearInterval(interval)
  }, [onMetricsUpdate])

  if (!metrics) return null

  return (
    <div className="text-xs text-muted-foreground space-y-1">
      <div className="flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Service Time: {metrics.avgServiceTime}m
        {trend === 'down' && <TrendingDown className="w-3 h-3 text-green-500" />}
        {trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
      </div>
    </div>
  )
}
