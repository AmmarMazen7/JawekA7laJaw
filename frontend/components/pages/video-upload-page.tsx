'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, AlertCircle, Download, Trash2, Play, Loader2 } from 'lucide-react'
import { PolygonCanvas } from '@/components/video/polygon-canvas'
import { ZoneAnalyticsDashboard } from '@/components/analytics/zone-analytics-dashboard'
import { setGlobalAnalysisData } from '@/components/pages/analytics-dashboard'
import { Progress } from '@/components/ui/progress'
import { videoApi } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

interface Zone {
  id: number
  points: Array<[number, number]>
  frameIndex: number
  name: string
}

interface VideoInfo {
  video_id: string
  width: number
  height: number
  first_frame: string
  fps: number
  frame_count: number
  duration_sec: number
}

interface AnalysisData {
  zones: Array<{
    zone_name: string
    polygon_id: number
    metrics: {
      avg_wait: number | null
      min_wait: number | null
      max_wait: number | null
      avg_queue_len: number | null
      max_queue_len: number
      num_people_measured: number
      total_people_tracked: number
    }
    queue_timestamps: number[]
    queue_lengths: number[]
    wait_times: number[]
  }>
  output_video_url?: string
  fps: number
  frame_count: number
  duration_sec: number
}

export function VideoUploadPage() {
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [step, setStep] = useState<'upload' | 'drawing' | 'results'>('upload')
  const [zones, setZones] = useState<Zone[]>([])
  const [currentZone, setCurrentZone] = useState(1)
  const [analysisResults, setAnalysisResults] = useState<AnalysisData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('video/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload a valid video file',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setProgress(0)
    setProgressMessage('Uploading video...')
    setVideoFile(file)

    try {
      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(uploadInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      // Create a local blob URL for the video file (for canvas drawing)
      const localVideoUrl = URL.createObjectURL(file)
      
      setProgressMessage('Processing video metadata...')
      // Upload to FastAPI backend
      const response = await videoApi.uploadVideo(file)
      
      clearInterval(uploadInterval)
      setProgress(100)
      
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Upload failed')
      }

      setVideoInfo(response.data)
      setVideoUrl(localVideoUrl) // Use local video file for drawing
      setStep('drawing')
      setZones([])

      toast({
        title: 'Video uploaded',
        description: `Video processed successfully (${response.data?.width || 0}x${response.data?.height || 0}, ${response.data?.fps?.toFixed(1) || 0} FPS)`,
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload video',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setProgress(0)
      setProgressMessage('')
    }
  }

  const handleDownloadConfig = () => {
    const config = zones.map(z => z.points)
    const dataStr = JSON.stringify(config, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'zone-config.json'
    link.click()
  }

  const handleZoneComplete = (points: Array<[number, number]>) => {
    const newZone: Zone = {
      id: currentZone,
      points,
      frameIndex: 1,
      name: `Zone ${currentZone}`
    }
    setZones([...zones, newZone])
    if (currentZone < 3) {
      setCurrentZone(currentZone + 1)
    }
  }

  const handleRemoveZone = (id: number) => {
    setZones(zones.filter(z => z.id !== id))
  }

  const handleAnalyze = async () => {
    if (!videoInfo || zones.length === 0) {
      toast({
        title: 'Cannot analyze',
        description: 'Please define at least one zone first',
        variant: 'destructive',
      })
      return
    }

    setAnalyzing(true)
    setProgress(0)
    setProgressMessage('Initializing analysis...')

    try {
      // Convert zones to the format expected by FastAPI
      // Backend expects: list[list[int]] - array of [x, y] pairs as integers
      const zonesForApi = zones.map(z => ({
        name: z.name,
        polygon: z.points.map(point => [
          Math.round(point[0]), 
          Math.round(point[1])
        ])
      }))

      console.log('Sending zones to API:', zonesForApi)
      console.log('Zones structure:', JSON.stringify(zonesForApi, null, 2))

      // Simulate progress during analysis
      setProgress(10)
      setProgressMessage('Loading YOLO model...')
      
      // Start progress simulation
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 85) {
            clearInterval(progressInterval)
            return 85
          }
          // Slower progress as we get further
          if (prev < 30) return prev + 5
          if (prev < 60) return prev + 3
          return prev + 1
        })
      }, 800)

      // Update progress messages
      setTimeout(() => setProgressMessage('Running object detection...'), 2000)
      setTimeout(() => setProgressMessage('Tracking people across zones...'), 4000)
      setTimeout(() => setProgressMessage('Calculating wait times...'), 6000)
      setTimeout(() => setProgressMessage('Generating annotated video...'), 8000)

      const response = await videoApi.analyzeMultiZone(
        videoInfo.video_id,
        zonesForApi,
        {
          conf: 0.4,
          min_wait_sec_filter: 1.0,
          sample_stride: 40
        }
      )

      clearInterval(progressInterval)
      setProgress(95)
      setProgressMessage('Finalizing results...')

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Analysis failed')
      }

      setProgress(100)
      setProgressMessage('Analysis complete!')
      
      setAnalysisResults(response.data)
      setStep('results')
      
      // Update global analytics dashboard data
      setGlobalAnalysisData(response.data)

      toast({
        title: 'Analysis complete',
        description: `Analyzed ${zones.length} zone(s) successfully`,
      })
    } catch (error) {
      console.error('Analysis error:', error)
      toast({
        title: 'Analysis failed',
        description: error instanceof Error ? error.message : 'Failed to analyze video',
        variant: 'destructive',
      })
    } finally {
      setAnalyzing(false)
      setProgress(0)
      setProgressMessage('')
    }
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Zone Configuration</h1>
        <p className="text-muted-foreground">Upload a video and define detection zones for queue monitoring</p>
      </div>

      {/* Progress Overlay */}
      {(loading || analyzing) && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card rounded-lg border border-border p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
                </div>
              </div>
              
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {loading ? 'Uploading Video' : 'Analyzing Video'}
                  </span>
                  <span className="text-muted-foreground">{Math.round(progress)}%</span>
                </div>
                
                <Progress value={progress} className="h-3" />
                
                {progressMessage && (
                  <p className="text-sm text-muted-foreground text-center animate-pulse">
                    {progressMessage}
                  </p>
                )}
              </div>

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground">
                  {loading ? 'Processing video metadata...' : 'This may take a few minutes depending on video length'}
                </p>
                {analyzing && (
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'upload' && (
        <>
          {/* Upload Section */}
          <div className="bg-card rounded-lg border border-border p-8">
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Upload Video File</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop your video or click to browse (MP4, MOV, AVI)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleVideoUpload}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  fileInputRef.current?.click()
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Select Video
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold mb-2">Zone Drawing Guide</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Upload a video showing your queue area</li>
                  <li>• Draw custom polygons on 3 key frames to define detection zones</li>
                  <li>• Configure up to 3 different zones per video</li>
                  <li>• JSON config will be used by YOLO for detection</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}

      {step === 'drawing' && videoUrl && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <PolygonCanvas
                videoUrl={videoUrl}
                zoneNumber={currentZone}
                onComplete={handleZoneComplete}
                maxZones={3}
                existingZonesCount={zones.length}
              />
            </div>

            <div className="space-y-4">
              <div className="bg-card rounded-lg border border-border p-6">
                <h3 className="font-semibold mb-4">Configured Zones</h3>
                <div className="space-y-2">
                  {zones.map((zone) => (
                    <div key={zone.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{zone.name}</p>
                        <p className="text-xs text-muted-foreground">{zone.points.length} points</p>
                      </div>
                      <button
                        onClick={() => handleRemoveZone(zone.id)}
                        className="p-1 hover:bg-destructive/10 text-destructive rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border p-6">
                <h4 className="font-semibold mb-3">Instructions</h4>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li>1. <strong>Click</strong> on video to add points</li>
                  <li>2. <strong>Double-click</strong> to complete zone</li>
                  <li>3. Create up to 3 zones</li>
                  <li>4. Download JSON config</li>
                </ol>
              </div>

              {zones.length > 0 && (
                <div className="space-y-3">
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        Analyze {zones.length} Zone{zones.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={handleDownloadConfig}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Config
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {step === 'results' && analysisResults && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Analysis Results</h2>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('drawing')
                  setAnalysisResults(null)
                }}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition-colors"
              >
                Back to Zones
              </button>
              <button
                onClick={() => {
                  setStep('upload')
                  setVideoFile(null)
                  setVideoUrl(null)
                  setVideoInfo(null)
                  setZones([])
                  setAnalysisResults(null)
                  setCurrentZone(1)
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                New Analysis
              </button>
            </div>
          </div>

          <ZoneAnalyticsDashboard data={analysisResults} />
        </div>
      )}
    </div>
  )
}
