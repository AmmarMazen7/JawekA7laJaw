// Mock data for development/demo purposes

export const generateMockMetrics = () => {
  const baseCustomers = Math.floor(Math.random() * 40) + 50
  const baseServed = Math.floor(baseCustomers * 0.85)
  
  return {
    totalCustomers: baseCustomers,
    customersServed: baseServed,
    averageServiceTime: (Math.random() * 2 + 3).toFixed(1),
    customersAbandoned: Math.floor(Math.random() * 5),
    queueEfficiency: Math.floor(Math.random() * 20 + 75),
    peakTime: '12:00 PM',
    zones: [
      {
        zoneId: 1,
        customers: Math.floor(Math.random() * 15) + 5,
        avgWaitTime: (Math.random() * 3 + 2).toFixed(1),
      },
      {
        zoneId: 2,
        customers: Math.floor(Math.random() * 12) + 3,
        avgWaitTime: (Math.random() * 3 + 2).toFixed(1),
      },
      {
        zoneId: 3,
        customers: Math.floor(Math.random() * 20) + 8,
        avgWaitTime: (Math.random() * 4 + 3).toFixed(1),
      },
    ],
  }
}

export const generateMockAlerts = () => {
  const alerts = [
    {
      type: 'error' as const,
      title: 'High Queue Alert',
      message: 'Zone 3 queue length exceeded 15 customers',
    },
    {
      type: 'warning' as const,
      title: 'Extended Wait Times',
      message: 'Average wait time increased by 45%',
    },
    {
      type: 'info' as const,
      title: 'Staff Suggestion',
      message: 'Consider calling additional cashiers during peak hours (12-14 PM)',
    },
  ]
  
  return alerts.slice(0, Math.floor(Math.random() * 3) + 1)
}

export const sampleEmployees = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice@store.com',
    role: 'cashier' as const,
    availability: 'available' as const,
    zone: 1,
    startTime: '09:00',
    endTime: '17:00',
    phone: '+1234567890',
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob@store.com',
    role: 'cashier' as const,
    availability: 'busy' as const,
    zone: 2,
    startTime: '10:00',
    endTime: '18:00',
    phone: '+1234567891',
  },
  {
    id: '3',
    name: 'Carol White',
    email: 'carol@store.com',
    role: 'supervisor' as const,
    availability: 'available' as const,
    startTime: '08:00',
    endTime: '16:00',
    phone: '+1234567892',
  },
]
