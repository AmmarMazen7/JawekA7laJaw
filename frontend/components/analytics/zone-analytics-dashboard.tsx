'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Users, Clock, BarChart3 } from 'lucide-react'

interface ZoneMetrics {
  avg_wait: number | null
  min_wait: number | null
  max_wait: number | null
  avg_queue_len: number | null
  max_queue_len: number
  num_people_measured: number
  total_people_tracked: number
}

interface ZoneResult {
  zone_name: string
  polygon_id: number
  metrics: ZoneMetrics
  queue_timestamps: number[]
  queue_lengths: number[]
  wait_times: number[]
}

interface AnalysisData {
  zones: ZoneResult[]
  sample_frames: string[]
  fps: number
  frame_count: number
  duration_sec: number
}

interface Props {
  data: AnalysisData
}

export function ZoneAnalyticsDashboard({ data }: Props) {
  const { zones, sample_frames, fps, frame_count, duration_sec } = data

  // Calculate global metrics
  const globalMetrics = {
    totalPeople: zones.reduce((sum, z) => sum + z.metrics.total_people_tracked, 0),
    avgWait: zones.reduce((sum, z) => sum + (z.metrics.avg_wait || 0), 0) / zones.length,
    maxQueueLen: Math.max(...zones.map(z => z.metrics.max_queue_len)),
  }

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return 'N/A'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
  }

  return (
    <div className="space-y-6">
      {/* Video Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Video Analysis Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="text-2xl font-bold">{duration_sec.toFixed(1)}s</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">FPS</p>
              <p className="text-2xl font-bold">{fps.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Frames</p>
              <p className="text-2xl font-bold">{frame_count}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Zones</p>
              <p className="text-2xl font-bold">{zones.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total People Tracked</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.totalPeople}</div>
            <p className="text-xs text-muted-foreground">Across all zones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(globalMetrics.avgWait)}</div>
            <p className="text-xs text-muted-foreground">Average across zones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Queue Length</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalMetrics.maxQueueLen}</div>
            <p className="text-xs text-muted-foreground">Maximum observed</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Zone Analytics */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold">Per-Zone Analytics</h3>
        
        {zones.map((zone, idx) => (
          <Card key={zone.polygon_id} className="border-l-4" style={{ borderLeftColor: getZoneColor(idx) }}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{zone.zone_name}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Zone {zone.polygon_id + 1}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Wait Time</p>
                  <p className="text-xl font-bold">{formatTime(zone.metrics.avg_wait)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Min / Max Wait</p>
                  <p className="text-xl font-bold">
                    {formatTime(zone.metrics.min_wait)} / {formatTime(zone.metrics.max_wait)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Queue Length</p>
                  <p className="text-xl font-bold">
                    {zone.metrics.avg_queue_len?.toFixed(1) || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">People Measured</p>
                  <p className="text-xl font-bold">
                    {zone.metrics.num_people_measured} / {zone.metrics.total_people_tracked}
                  </p>
                </div>
              </div>

              {/* Queue Length Chart */}
              {zone.queue_lengths.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Queue Length Over Time</p>
                  <div className="h-32 flex items-end gap-0.5">
                    {zone.queue_lengths
                      .filter((_, i) => i % Math.ceil(zone.queue_lengths.length / 100) === 0) // Sample for performance
                      .map((length, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-primary/60 hover:bg-primary transition-colors"
                          style={{
                            height: `${(length / Math.max(...zone.queue_lengths)) * 100}%`,
                            minHeight: length > 0 ? '2px' : '0',
                          }}
                          title={`Queue length: ${length}`}
                        />
                      ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0s</span>
                    <span>{(duration_sec / 2).toFixed(0)}s</span>
                    <span>{duration_sec.toFixed(0)}s</span>
                  </div>
                </div>
              )}

              {/* Wait Times Distribution */}
              {zone.wait_times.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Wait Time Distribution</p>
                  <div className="flex gap-2 items-end h-20">
                    {createHistogram(zone.wait_times, 10).map((bucket, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-secondary/60 hover:bg-secondary transition-colors rounded-t"
                        style={{
                          height: `${bucket.percentage}%`,
                          minHeight: bucket.count > 0 ? '2px' : '0',
                        }}
                        title={`${bucket.range}: ${bucket.count} people`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Distribution of {zone.wait_times.length} wait times
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sample Frames */}
      {sample_frames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Annotated Sample Frames</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sample_frames.map((frame, idx) => (
                <div key={idx} className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={frame}
                    alt={`Sample frame ${idx + 1}`}
                    className="w-full h-auto"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    Frame {idx + 1}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper function to get consistent zone colors
function getZoneColor(index: number): string {
  const colors = [
    '#ef4444', // red
    '#10b981', // green
    '#3b82f6', // blue
    '#f59e0b', // yellow
    '#8b5cf6', // purple
  ]
  return colors[index % colors.length]
}

// Helper function to create histogram buckets
function createHistogram(data: number[], buckets: number) {
  if (data.length === 0) return []

  const min = Math.min(...data)
  const max = Math.max(...data)
  const bucketSize = (max - min) / buckets

  const histogram = Array(buckets).fill(0).map((_, i) => ({
    range: `${(min + i * bucketSize).toFixed(0)}-${(min + (i + 1) * bucketSize).toFixed(0)}s`,
    count: 0,
    percentage: 0,
  }))

  data.forEach(value => {
    const bucketIndex = Math.min(Math.floor((value - min) / bucketSize), buckets - 1)
    histogram[bucketIndex].count++
  })

  const maxCount = Math.max(...histogram.map(b => b.count))
  histogram.forEach(bucket => {
    bucket.percentage = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
  })

  return histogram
}
