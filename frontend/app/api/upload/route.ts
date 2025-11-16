import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Forward to FastAPI backend if available
    const fastApiUrl = process.env.FASTAPI_URL || 'http://localhost:8000'
    const backendFormData = new FormData()
    backendFormData.append('file', file)

    try {
      const response = await fetch(`${fastApiUrl}/api/video/upload`, {
        method: 'POST',
        body: backendFormData,
      })

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`)
      }

      const data = await response.json()
      return NextResponse.json({ success: true, data })
    } catch (backendError) {
      console.error('Backend connection error:', backendError)
      // Fallback: return a mock response for development
      return NextResponse.json({
        success: true,
        data: {
          videoId: `video-${Date.now()}`,
          filename: file.name,
          size: file.size,
          message: 'File accepted (backend unavailable - using mock)',
        },
      })
    }
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    )
  }
}
