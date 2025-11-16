'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

interface PolygonCanvasProps {
  videoUrl: string
  zoneNumber: number
  onComplete: (points: Array<[number, number]>) => void
  maxZones: number
  existingZonesCount: number
}

export function PolygonCanvas({
  videoUrl,
  zoneNumber,
  onComplete,
  maxZones,
  existingZonesCount,
}: PolygonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [points, setPoints] = useState<Array<[number, number]>>([])
  const [isDrawing, setIsDrawing] = useState(true)
  const [frameExtracted, setFrameExtracted] = useState(false)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)

  // Extract frame from video and draw it on canvas
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current

    if (!video || !canvas) return

    const handleLoadedMetadata = () => {
      console.log('[PolygonCanvas] Video metadata loaded', {
        duration: video.duration,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight
      })

      // Seek to a frame with content (avoid black frames at start/end)
      const baseTime = 2 // Start at 2 seconds to avoid black intro frames
      const offset = (zoneNumber - 1) * 0.5 // Small offset per zone
      const targetTime = Math.min(baseTime + offset, video.duration * 0.3) // Max 30% into video
      
      console.log('[PolygonCanvas] Seeking to:', targetTime)
      video.currentTime = targetTime
    }

    const handleSeeked = () => {
      console.log('[PolygonCanvas] Video seeked to:', video.currentTime)
      
      const ctx = canvas.getContext('2d')
      if (ctx) {
        // Set canvas size to match video
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        console.log('[PolygonCanvas] Canvas size set to:', canvas.width, 'x', canvas.height)

        // Draw video frame
        ctx.drawImage(video, 0, 0)
        
        // Check if we actually drew something
        const imageData = ctx.getImageData(0, 0, Math.min(100, canvas.width), Math.min(100, canvas.height))
        const hasContent = imageData.data.some(pixel => pixel !== 0)
        console.log('[PolygonCanvas] Frame has content:', hasContent)
        
        setContext(ctx)
        setFrameExtracted(true)
      }
    }

    const handleCanPlay = () => {
      console.log('[PolygonCanvas] Video can play')
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('canplay', handleCanPlay)
    
    // Force load
    video.load()

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('canplay', handleCanPlay)
    }
  }, [videoUrl, zoneNumber])

  // Redraw canvas with points
  useEffect(() => {
    if (!frameExtracted || !context || !videoRef.current || !canvasRef.current) return

    const ctx = context
    const video = videoRef.current

    // Redraw video frame
    ctx.drawImage(video, 0, 0)

    // Draw existing points
    if (points.length > 0) {
      ctx.fillStyle = 'rgba(0, 217, 255, 0.2)'
      ctx.strokeStyle = 'rgb(0, 217, 255)'
      ctx.lineWidth = 2

      // Draw points
      points.forEach(([x, y]) => {
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      })

      // Draw lines between points
      if (points.length > 1) {
        ctx.beginPath()
        ctx.moveTo(points[0][0], points[0][1])
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i][0], points[i][1])
        }
        ctx.stroke()
      }
    }
  }, [points, frameExtracted, context])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * canvasRef.current.width
    const y = ((e.clientY - rect.top) / rect.height) * canvasRef.current.height

    setPoints([...points, [x, y]])
  }

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    if (points.length >= 3) {
      onComplete(points)
      setPoints([])
      setIsDrawing(true)
    }
  }

  const handleUndo = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1))
    }
  }

  const handleClear = () => {
    setPoints([])
    if (context && videoRef.current) {
      context.drawImage(videoRef.current, 0, 0)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Alert */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-sm">
            Zone {zoneNumber} of {maxZones}
          </p>
          <p className="text-sm text-muted-foreground">
            {points.length === 0 && 'Click on the video to add points'}
            {points.length > 0 && points.length < 3 && `${3 - points.length} more points needed`}
            {points.length >= 3 && 'Double-click to complete zone or continue adding points'}
          </p>
        </div>
      </div>

      {/* Canvas Container */}
      <div className="bg-black rounded-lg overflow-hidden border border-border">
        <video
          ref={videoRef}
          src={videoUrl}
          className="hidden"
          crossOrigin="anonymous"
        />
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onDoubleClick={handleDoubleClick}
          className="w-full cursor-crosshair bg-black"
        />
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <button
          onClick={handleUndo}
          disabled={points.length === 0}
          className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={points.length === 0}
          className="flex-1 px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => {
            if (points.length >= 3) {
              onComplete(points)
              setPoints([])
            }
          }}
          disabled={points.length < 3}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          Complete Zone
        </button>
      </div>

      {/* Point Details */}
      {points.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-sm font-semibold mb-3">Points ({points.length}):</p>
          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
            {points.map((point, i) => (
              <div key={i} className="text-xs bg-muted p-2 rounded">
                P{i + 1}: ({Math.round(point[0])}, {Math.round(point[1])})
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
