import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const timeRange = request.nextUrl.searchParams.get('timeRange') || '1h'
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'

    try {
      const response = await fetch(
        `${fastApiUrl}/api/queue/metrics?timeRange=${timeRange}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`)
      }

      const data = await response.json()
      return NextResponse.json({ success: true, data })
    } catch (backendError) {
      console.error('Backend connection error:', backendError)
      // Return mock data for development
      return NextResponse.json({
        success: true,
        data: {
          totalCustomers: 87,
          customersServed: 73,
          averageServiceTime: 4.2,
          customersAbandoned: 2,
          queueEfficiency: 87,
          zones: [
            { zoneId: 1, customers: 12, avgWaitTime: 3.5 },
            { zoneId: 2, customers: 8, avgWaitTime: 2.8 },
            { zoneId: 3, customers: 15, avgWaitTime: 5.2 },
          ],
          message: 'Mock data (backend unavailable)',
        },
      })
    }
  } catch (error) {
    console.error('Metrics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
