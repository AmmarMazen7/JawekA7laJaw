'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { Users, Clock, TrendingUp, AlertCircle, Target, Zap, RefreshCw } from 'lucide-react'

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

export function AnalyticsDashboard() {
  const [metrics, setMetrics] = useState<QueueMetrics>({
    totalCustomers: 87,
    customersServed: 73,
    averageServiceTime: 4.2,
    customersAbandoned: 2,
    queueEfficiency: 87,
    peakTime: '12:00 PM',
    zones: [
      { zoneId: 1, customers: 12, avgWaitTime: 3.5 },
      { zoneId: 2, customers: 8, avgWaitTime: 2.8 },
      { zoneId: 3, customers: 15, avgWaitTime: 5.2 },
    ],
  })

  const [refreshing, setRefreshing] = useState(false)
  const [timeRange, setTimeRange] = useState('1h')

  const queueData = [
    { time: '09:00', customers: 12, served: 8, abandoned: 0 },
    { time: '10:00', customers: 19, served: 14, abandoned: 1 },
    { time: '11:00', customers: 15, served: 15, abandoned: 0 },
    { time: '12:00', customers: 25, served: 18, abandoned: 1 },
    { time: '13:00', customers: 22, served: 20, abandoned: 0 },
    { time: '14:00', customers: 18, served: 18, abandoned: 0 },
  ]

  const waitTimeData = [
    { time: '09:00', zone1: 2, zone2: 1.5, zone3: 3 },
    { time: '10:00', zone1: 3.2, zone2: 2.8, zone3: 4.1 },
    { time: '11:00', zone1: 2.5, zone2: 2, zone3: 3.2 },
    { time: '12:00', zone1: 5.2, zone2: 4.8, zone3: 6.1 },
    { time: '13:00', zone1: 4.8, zone2: 4.2, zone3: 5.5 },
    { time: '14:00', zone1: 3.5, zone2: 3, zone3: 4.2 },
  ]

  const zoneDistribution = [
    { name: 'Zone 1', value: 35 },
    { name: 'Zone 2', value: 25 },
    { name: 'Zone 3', value: 40 },
  ]

  const customerFlow = [
    { time: '09:00', inflow: 12, outflow: 8 },
    { time: '10:00', inflow: 19, outflow: 14 },
    { time: '11:00', inflow: 15, outflow: 15 },
    { time: '12:00', inflow: 25, outflow: 18 },
    { time: '13:00', inflow: 22, outflow: 20 },
    { time: '14:00', inflow: 18, outflow: 18 },
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
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setMetrics({
      ...metrics,
      totalCustomers: Math.floor(Math.random() * 100),
      customersServed: Math.floor(Math.random() * 80),
      averageServiceTime: (Math.random() * 2 + 3).toFixed(1) as any,
      customersAbandoned: Math.floor(Math.random() * 5),
      queueEfficiency: Math.floor(Math.random() * 20 + 70),
    })
    setRefreshing(false)
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Queue Analytics Dashboard</h1>
          <p className="text-muted-foreground">Real-time monitoring and insights</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Time Range Filter */}
      <div className="flex gap-2">
        {['1h', '4h', '24h', '7d'].map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
              timeRange === range
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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

        {/* Recommendations */}
        <div className="bg-card rounded-lg border border-border p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-accent" />
            AI Recommendations
          </h3>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start gap-2 p-3 bg-green-500/5 rounded border border-green-500/20">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
              <span>Call additional staff for Zone 3 to handle peak hours (12-14 PM)</span>
            </li>
            <li className="flex items-start gap-2 p-3 bg-blue-500/5 rounded border border-blue-500/20">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
              <span>Redistribute customers from Zone 3 to Zone 1 for balanced load</span>
            </li>
            <li className="flex items-start gap-2 p-3 bg-purple-500/5 rounded border border-purple-500/20">
              <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5 flex-shrink-0" />
              <span>Optimize service time for Zone 2 (currently fastest)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
