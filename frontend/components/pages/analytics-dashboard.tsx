'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Users, Clock, TrendingUp, AlertCircle, Target, Zap, RefreshCw, Upload } from 'lucide-react'
import { FloatingAIButton } from '@/components/ai/floating-ai-button'
import { AIRecommendationsPanel } from '@/components/ai/ai-recommendations-panel'

interface QueueMetrics {
  totalCustomers: number
  customersServed: number
  averageServiceTime: number
  customersAbandoned: number
  queueEfficiency: number
  peakTime: string
  zones: {
    zoneId: number
    customers: number
    avgWaitTime: number
  }[]
}

// Store for analysis results from the video upload page
let globalAnalysisData: any = null

export function setGlobalAnalysisData(data: any) {
  globalAnalysisData = data
}

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<QueueMetrics>({
    totalCustomers: 0,
    customersServed: 0,
    averageServiceTime: 0,
    customersAbandoned: 0,
    queueEfficiency: 0,
    peakTime: '--',
    zones: [],
  })

  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('1h')
  const [hasData, setHasData] = useState(false)

  // Function to scroll to AI recommendations
  const scrollToRecommendations = () => {
    if (typeof window !== 'undefined' && (window as any).scrollToRecommendations) {
      (window as any).scrollToRecommendations()
    }
  }

  // Load data from backend analysis results
  useEffect(() => {
    const loadAnalysisData = () => {
      if (globalAnalysisData && globalAnalysisData.zones) {
        const zones = globalAnalysisData.zones

        // Calculate metrics from actual backend data
        const totalPeople = zones.reduce((sum: number, z: any) => sum + z.metrics.total_people_tracked, 0)
        const measuredPeople = zones.reduce((sum: number, z: any) => sum + z.metrics.num_people_measured, 0)
        const avgWait = zones.reduce((sum: number, z: any) => sum + (z.metrics.avg_wait || 0), 0) / (zones.length || 1)

        // Find peak time based on max queue length
        let peakTime = '--'
        zones.forEach((z: any) => {
          if (z.queue_lengths && z.queue_timestamps) {
            const maxIdx = z.queue_lengths.indexOf(Math.max(...z.queue_lengths))
            if (maxIdx >= 0 && z.queue_timestamps[maxIdx]) {
              const seconds = z.queue_timestamps[maxIdx]
              const date = new Date(seconds * 1000)
              peakTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            }
          }
        })

        setMetrics({
          totalCustomers: totalPeople,
          customersServed: measuredPeople,
          averageServiceTime: avgWait / 60, // Convert seconds to minutes
          customersAbandoned: totalPeople - measuredPeople, // People who left before threshold
          queueEfficiency: totalPeople > 0 ? Math.round((measuredPeople / totalPeople) * 100) : 0,
          peakTime: peakTime,
          zones: zones.map((z: any, idx: number) => ({
            zoneId: idx + 1,
            customers: z.metrics.total_people_tracked,
            avgWaitTime: z.metrics.avg_wait ? (z.metrics.avg_wait / 60).toFixed(1) : 0, // Convert to minutes
          }))
        })
        setHasData(true)
      } else {
        setHasData(false)
      }
    }

    loadAnalysisData()

    // Poll for updates every 5 seconds
    const interval = setInterval(loadAnalysisData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Generate time-series data from backend results
  const generateTimeSeriesData = () => {
    if (!globalAnalysisData || !globalAnalysisData.zones || globalAnalysisData.zones.length === 0) {
      return []
    }

    const zone = globalAnalysisData.zones[0]
    if (!zone.queue_timestamps || !zone.queue_lengths) {
      return []
    }

    // Sample data points (every 10% of the video)
    const sampleSize = Math.min(6, zone.queue_timestamps.length)
    const step = Math.floor(zone.queue_timestamps.length / sampleSize)

    return Array.from({ length: sampleSize }, (_, i) => {
      const idx = i * step
      const timestamp = zone.queue_timestamps[idx]
      const date = new Date(timestamp * 1000)
      const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

      const dataPoint: any = { time: timeStr }

      // Add data for each zone
      globalAnalysisData.zones.forEach((z: any, zIdx: number) => {
        dataPoint[`customers_z${zIdx + 1}`] = z.queue_lengths[idx] || 0
        dataPoint[`zone${zIdx + 1}`] = z.queue_lengths[idx] ? (z.wait_times[Math.min(idx, z.wait_times.length - 1)] || 0) / 60 : 0
      })

      return dataPoint
    })
  }

  const queueData = hasData ? generateTimeSeriesData() : []
  const waitTimeData = hasData ? generateTimeSeriesData() : []

  const customerFlow = hasData && globalAnalysisData ? generateTimeSeriesData().map((d: any) => ({
    time: d.time,
    inflow: d.customers_z1 || 0,
    outflow: Math.max(0, (d.customers_z1 || 0) - 2), // Approximate outflow
  })) : []

  const zoneDistribution = hasData && metrics.zones.length > 0 ? metrics.zones.map(z => ({
    name: `Zone ${z.zoneId}`,
    value: z.customers
  })) : [
    { name: 'No Data', value: 1 }
  ]

  const COLORS = ['#00d9ff', '#0080ff', '#ff6b9d']

  const stats = [
    {
      label: 'Avg Service Time',
      value: `${metrics.averageServiceTime} min`,
      icon: Clock,
      change: '-12%',
      color: 'text-blue-500',
    },
    {
      label: 'Active Customers',
      value: metrics.totalCustomers,
      icon: Users,
      change: '+5%',
      color: 'text-cyan-500',
    },
    {
      label: 'Queue Efficiency',
      value: `${metrics.queueEfficiency}%`,
      icon: TrendingUp,
      change: '+3%',
      color: 'text-green-500',
    },
    {
      label: 'Abandoned (1h)',
      value: metrics.customersAbandoned,
      icon: AlertCircle,
      change: '-1%',
      color: 'text-red-500',
    },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    // Reload from global data
    await new Promise(resolve => setTimeout(resolve, 500))
    if (globalAnalysisData && globalAnalysisData.zones) {
      // Data is already loaded from useEffect
    }
    setRefreshing(false)
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Queue Analytics Dashboard</h1>
          <p className="text-muted-foreground">
            {hasData ? 'Real-time monitoring and insights' : 'Upload and analyze a video to see metrics'}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || !hasData}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* No Data Message */}
      {!hasData && (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Analysis Data Yet</h3>
          <p className="text-muted-foreground mb-6">
            Upload a video and run zone analysis to see dashboard metrics and insights.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold"
          >
            <Upload className="w-4 h-4" />
            Go to Video Upload
          </a>
        </div>
      )}

      {/* Stats Grid - Only show if we have data */}
      {hasData && (
        <>
          {/* Time Range Filter */}
          <div className="flex gap-2">
            {['1h', '4h', '24h', '7d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${timeRange === range
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                  }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon
              return (
                <div key={i} className="bg-card rounded-lg border border-border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Icon className={`w-6 h-6 ${stat.color}`} />
                    </div>
                    <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                      {stat.change}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              )
            })}
          </div>

          {/* Zone Performance */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Zone Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metrics.zones.map((zone) => (
                <div key={zone.zoneId} className="p-4 bg-muted rounded-lg">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Zone {zone.zoneId}</p>
                      <p className="text-2xl font-bold">{zone.customers}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                  <p className="text-sm">
                    Avg Wait: <span className="font-semibold">{zone.avgWaitTime}m</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Line Chart - Queue Activity */}
            <div className="lg:col-span-2 bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Queue Activity</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={queueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="time" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    stroke="var(--primary)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Total Customers"
                  />
                  <Line
                    type="monotone"
                    dataKey="served"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Customers Served"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart - Load Distribution */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">Load Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={zoneDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {zoneDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Wait Time Trends */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Wait Time Trends (by Zone)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={waitTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" label={{ value: 'Wait Time (min)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="zone1"
                  stroke={COLORS[0]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Zone 1"
                />
                <Line
                  type="monotone"
                  dataKey="zone2"
                  stroke={COLORS[1]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Zone 2"
                />
                <Line
                  type="monotone"
                  dataKey="zone3"
                  stroke={COLORS[2]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Zone 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Customer Flow */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h3 className="text-lg font-semibold mb-4">Customer Flow In/Out</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={customerFlow}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" stroke="var(--muted-foreground)" />
                <YAxis stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stackId="1"
                  stroke={COLORS[0]}
                  fill={COLORS[0]}
                  fillOpacity={0.4}
                  name="Inflow"
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stackId="1"
                  stroke={COLORS[1]}
                  fill={COLORS[1]}
                  fillOpacity={0.4}
                  name="Outflow"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Alerts & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alerts */}
            <div className="bg-card rounded-lg border border-border p-6">
              <h3 className="text-lg font-semibold mb-4">System Alerts</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 bg-red-500/5 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">High Queue Alert - Zone 3</p>
                    <p className="text-sm text-muted-foreground">Queue length exceeded 15 customers.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-yellow-500/5 rounded-lg border border-yellow-500/20">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">Extended Wait Times</p>
                    <p className="text-sm text-muted-foreground">Zone 3 wait time increased by 45%.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Recommendations Panel - Replaces old static recommendations */}
            <AIRecommendationsPanel
              analyticsData={globalAnalysisData}
              className="lg:col-span-2"
            />
          </div>

          {/* Floating AI Recommendations Button */}
          <FloatingAIButton
            onScrollToRecommendations={scrollToRecommendations}
            analyticsData={globalAnalysisData}
          />
        </>
      )}
    </div>
  )
}
