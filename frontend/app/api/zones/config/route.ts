import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { videoId, zones } = body

    if (!videoId || !zones) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'

    try {
      const response = await fetch(`${fastApiUrl}/api/zones/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          videoId,
          zones,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`)
      }

      const data = await response.json()
      return NextResponse.json({ success: true, data })
    } catch (backendError) {
      console.error('Backend connection error:', backendError)
      return NextResponse.json({
        success: true,
        data: {
          configId: `config-${Date.now()}`,
          videoId,
          zones,
          status: 'accepted',
          message: 'Zone config accepted (backend unavailable - using mock)',
        },
      })
    }
  } catch (error) {
    console.error('Zone config error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process zone config' },
      { status: 500 }
    )
  }
}
