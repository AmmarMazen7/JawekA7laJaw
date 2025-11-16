"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Square, Video, Activity, MapPin, Calendar, Monitor } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

interface Camera {
  id: string;
  name: string;
  location: string;
  address: string;
  area: string;
  video_file: string;
  resolution: string;
  fps: number;
  installed_date: string;
  status: string;
  zones: Array<{
    name: string;
    type: string;
    polygon: number[][];
    color: string;
    description: string;
  }>;
  metadata: {
    store_id: string;
    region: string;
    store_manager: string;
    camera_model: string;
    recording_mode: string;
    retention_days: number;
    department?: string;
  };
}

interface ZoneData {
  name: string;
  current_count: number;
  avg_wait_time: number;
  max_queue: number;
  total_people: number;
  total_wait_time: number;
}

interface CameraInfo {
  id: string;
  name: string;
  location: string;
  area: string;
  address: string;
  metadata: any;
}

export default function CCTVCamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [streamId, setStreamId] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<string>("");
  const [zonesData, setZonesData] = useState<ZoneData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<CameraInfo | null>(null);
  const [fps, setFps] = useState<number>(0);
  const [frameCount, setFrameCount] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  // Load cameras on mount
  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const response = await fetch(`${API_URL}/cameras`);
      if (!response.ok) throw new Error("Failed to fetch cameras");
      
      const data = await response.json();
      setCameras(data.cameras);
      setLoading(false);
    } catch (err: any) {
      console.error("Fetch cameras error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Start stream from selected camera
  const startCameraStream = async (camera: Camera) => {
    setError("");
    setSelectedCamera(camera);
    
    try {
      const response = await fetch(`${API_URL}/stream/start-camera/${camera.id}`, {
        method: "POST"
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to start camera stream");
      }

      const data = await response.json();
      setStreamId(data.stream_id);
      
      // Connect to WebSocket
      connectWebSocket(data.stream_id);
      
    } catch (err: any) {
      console.error("Start camera stream error:", err);
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
        const data = JSON.parse(event.data);
        
        if (data.type === "connected") {
          console.log("Stream connected:", data.message);
          if (data.camera) {
            setCameraInfo(data.camera);
          }
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
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ action: "stop" }));
      wsRef.current.close();
    }

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
    setCurrentFrame("");
    setZonesData([]);
    setCameraInfo(null);
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
          <h1 className="text-3xl font-bold">CCTV Camera System</h1>
          <p className="text-muted-foreground">Live surveillance monitoring</p>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full">
            <Activity className="w-4 h-4 animate-pulse" />
            <span className="text-sm font-medium">LIVE</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Camera Info Banner */}
      {cameraInfo && isStreaming && (
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3">
                <Monitor className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Camera</p>
                  <p className="font-semibold">{cameraInfo.name}</p>
                  <p className="text-xs text-muted-foreground">{cameraInfo.id}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold">{cameraInfo.location}</p>
                  <p className="text-xs text-muted-foreground">{cameraInfo.area}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Video className="w-5 h-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Store Info</p>
                  <p className="font-semibold">Store #{cameraInfo.metadata?.store_id}</p>
                  <p className="text-xs text-muted-foreground">{cameraInfo.metadata?.region} Region</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Camera Grid - Show if not streaming */}
      {!isStreaming && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">Loading cameras...</p>
            </div>
          ) : cameras.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Video className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cameras available</p>
            </div>
          ) : (
            cameras.map((camera) => (
              <Card key={camera.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{camera.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">{camera.id}</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      camera.status === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {camera.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{camera.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{camera.resolution} @ {camera.fps} FPS</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Since {camera.installed_date}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs font-medium mb-2">Monitoring Zones: {camera.zones.length}</p>
                    <div className="flex flex-wrap gap-1">
                      {camera.zones.map((zone, idx) => (
                        <span 
                          key={idx} 
                          className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded"
                        >
                          {zone.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Button 
                    onClick={() => startCameraStream(camera)}
                    className="w-full gap-2"
                    disabled={camera.status !== 'active'}
                  >
                    <Play className="w-4 h-4" />
                    Start Live Stream
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Live Stream View */}
      {isStreaming && currentFrame && (
        <>
          {/* Stream Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Stream ID:</span>
                    <span className="ml-2 font-mono">{streamId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Frame:</span>
                    <span className="ml-2 font-mono">{frameCount}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">FPS:</span>
                    <span className="ml-2 font-mono">{fps.toFixed(1)}</span>
                  </div>
                </div>
                <Button onClick={stopStream} variant="destructive" className="gap-2">
                  <Square className="w-4 h-4" />
                  Stop Stream
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Video Feed */}
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
        </>
      )}
    </div>
  );
}
