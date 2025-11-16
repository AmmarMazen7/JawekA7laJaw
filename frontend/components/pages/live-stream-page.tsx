"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Video, Activity } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface ZoneData {
  name: string;
  current_count: number;
  avg_wait_time: number;
  max_queue: number;
  total_people: number;
  total_wait_time: number;
}

interface StreamFrame {
  type: string;
  frame_id?: number;
  timestamp?: number;
  frame?: string;
  zones?: ZoneData[];
  fps?: number;
  error?: string;
  message?: string;
}

export default function LiveStreamPage() {
  const [videoId, setVideoId] = useState<string>("");
  const [streamId, setStreamId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string>("");
  const [zonesData, setZonesData] = useState<ZoneData[]>([]);
  const [fps, setFps] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [error, setError] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load video ID from localStorage on mount
  useEffect(() => {
    const savedVideoId = localStorage.getItem('currentVideoId');
    if (savedVideoId) {
      setVideoId(savedVideoId);
    }
  }, []);

  // Start stream
  const startStream = async () => {
    if (!videoId) {
      setError("Please enter a video ID");
      return;
    }

    // Clean video ID (remove "annotated_" prefix if present)
    const cleanVideoId = videoId.replace(/^annotated_/, '').replace('.mp4', '');
    
    setError("");
    
    try {
      // Get zones from localStorage (from video upload page)
      const zonesJson = localStorage.getItem("currentZones");
      if (!zonesJson) {
        setError("No zones defined. Please upload video and define zones first on the Zone Configuration page.");
        return;
      }

      const zones = JSON.parse(zonesJson);

      console.log('Starting stream with:', { video_id: cleanVideoId, zones });

      // Start stream on backend
      const response = await fetch(`${API_URL}/stream/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_id: cleanVideoId,
          zones: zones,
          conf: 0.4,
          min_wait_sec_filter: 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.detail || "Failed to start stream";
        
        // Provide helpful error messages
        if (errorMsg.includes("video_id")) {
          throw new Error(`Video not found: ${cleanVideoId}\n\nMake sure you:\n1. Uploaded the video on Zone Configuration page\n2. Using the correct Video ID (not the annotated version)\n3. Video ID format: video_1234567890123`);
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      setStreamId(data.stream_id);
      
      // Connect to WebSocket
      connectWebSocket(data.stream_id);
      
    } catch (err: any) {
      console.error("Start stream error:", err);
      setError(err.message);
    }
  };

  // Connect to WebSocket
  const connectWebSocket = (streamId: string) => {
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws/stream/${streamId}`;
    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsStreaming(true);
      setError("");
    };

    ws.onmessage = (event) => {
      try {
        const data: StreamFrame = JSON.parse(event.data);
        
        if (data.type === "connected") {
          console.log("Stream connected:", data.message);
        } else if (data.type === "frame") {
          setCurrentFrame(data.frame || "");
          setZonesData(data.zones || []);
          setFps(data.fps || 0);
          setFrameCount(data.frame_id || 0);
        } else if (data.type === "error") {
          console.error("Stream error:", data.error);
          setError(data.error || "Stream error");
          stopStream();
        }
      } catch (err) {
        console.error("Parse message error:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error");
    };

    ws.onclose = () => {
      console.log("WebSocket closed");
      setIsStreaming(false);
    };
  };

  // Stop stream
  const stopStream = async () => {
    // Send stop command via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "stop" }));
      wsRef.current.close();
    }

    // Call backend stop endpoint
    if (streamId) {
      try {
        await fetch(`${API_URL}/stream/stop/${streamId}`, {
          method: "POST"
        });
      } catch (err) {
        console.error("Stop stream error:", err);
      }
    }

    wsRef.current = null;
    setIsStreaming(false);
    setStreamId("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Format time
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs.toFixed(0)}s`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Stream Viewer</h1>
          <p className="text-muted-foreground">Real-time CCTV camera simulation</p>
        </div>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="text-sm font-medium">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Stream Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show saved video ID if available */}
          {localStorage.getItem('currentVideoId') && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                💡 Last uploaded video ID:
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 font-mono mt-1">
                {localStorage.getItem('currentVideoId')}
              </p>
            </div>
          )}
          
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Enter Video ID (e.g., video_1234567890123)"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              disabled={isStreaming}
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {!isStreaming ? (
              <Button onClick={startStream} className="gap-2">
                <Play className="w-4 h-4" />
                Start Stream
              </Button>
            ) : (
              <Button onClick={stopStream} variant="destructive" className="gap-2">
                <Square className="w-4 h-4" />
                Stop Stream
              </Button>
            )}
          </div>

          {isStreaming && (
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">Stream ID:</span>
                <span className="text-muted-foreground">{streamId}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Frame:</span>
                <span className="text-muted-foreground">{frameCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">FPS:</span>
                <span className="text-muted-foreground">{fps.toFixed(1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Display */}
      {currentFrame && (
        <Card>
          <CardHeader>
            <CardTitle>Live Feed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative bg-black rounded-lg overflow-hidden">
              <img
                src={currentFrame}
                alt="Live stream"
                className="w-full h-auto"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Zone Statistics */}
      {zonesData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zonesData.map((zone, idx) => (
            <Card key={idx}>
              <CardHeader>
                <CardTitle className="text-lg">{zone.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Current Count:</span>
                  <span className="font-bold text-2xl text-blue-600">{zone.current_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Avg Wait Time:</span>
                  <span className="font-medium">{formatTime(zone.avg_wait_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Peak Queue:</span>
                  <span className="font-medium">{zone.max_queue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total People:</span>
                  <span className="font-medium">{zone.total_people}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Instructions */}
      {!isStreaming && !currentFrame && (
        <Card>
          <CardHeader>
            <CardTitle>How to use Live Stream</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">⚠️ Important: Video ID Format</p>
              <p className="text-yellow-800 dark:text-yellow-200">
                Use the <strong>original Video ID</strong> (e.g., <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">video_1234567890123</code>), 
                NOT the annotated version (<code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded line-through">annotated_vid_1234567890123</code>)
              </p>
            </div>
            
            <div className="space-y-2 text-muted-foreground">
              <p><strong>Step 1:</strong> Go to "Zone Configuration" page</p>
              <p><strong>Step 2:</strong> Upload a video → You'll see "Video ID: video_XXXXX" - copy this!</p>
              <p><strong>Step 3:</strong> Draw polygon zones on the video frames</p>
              <p><strong>Step 4:</strong> Click "Analyze Video" (this saves zones for streaming)</p>
              <p><strong>Step 5:</strong> Return to this page and paste your Video ID</p>
              <p><strong>Step 6:</strong> Click "Start Stream" to watch live analysis</p>
            </div>
            
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-green-800 dark:text-green-200">
                ✅ The video ID is automatically loaded from your last upload if available (shown above)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
