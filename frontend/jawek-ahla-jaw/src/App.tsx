import React, { useState, useRef, useEffect } from "react";
import type { MouseEvent as ReactMouseEvent, ChangeEvent } from "react";

const API_BASE = "http://localhost:8000";

interface VideoInfo {
  video_id: string;
  width: number;
  height: number;
  first_frame: string;
  fps: number;
  frame_count: number;
  duration_sec: number;
}

interface ROI {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Metrics {
  avg_wait: number | null;
  min_wait: number | null;
  max_wait: number | null;
  avg_queue_len: number | null;
  num_people_measured: number;
}

interface QueueSeries {
  times: number[];
  queue_lengths: number[];
}

interface AnalyzeResponse {
  metrics: Metrics;
  times: number[];
  queue_lengths: number[];
  sample_frames: string[];
  wait_times: number[];
  fps: number;
  frame_count: number;
  duration_sec: number;
}

interface UploadVideoResponse {
  video_id: string;
  width: number;
  height: number;
  first_frame: string;
  fps: number;
  frame_count: number;
  duration_sec: number;
}

interface Alert {
  id: number;
  type: "warning" | "critical" | "info";
  message: string;
  timestamp: Date;
}

interface Recommendation {
  title: string;
  description: string;
  impact: string;
  priority: "high" | "medium" | "low";
}

const App: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [currentView, setCurrentView] = useState<"dashboard" | "analysis">(
    "dashboard"
  );

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [roi, setRoi] = useState<ROI | null>(null);

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [queueSeries, setQueueSeries] = useState<QueueSeries | null>(null);
  const [sampleFrames, setSampleFrames] = useState<string[]>([]);
  const [, setWaitTimes] = useState<number[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const drawAreaRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    if (metrics) {
      generateAlertsAndRecommendations(metrics);
    }
  }, [metrics]);

  const generateAlertsAndRecommendations = (metrics: Metrics) => {
    const newAlerts: Alert[] = [];
    const newRecommendations: Recommendation[] = [];
    let alertId = 1;

    if (metrics.avg_wait !== null) {
      if (metrics.avg_wait > 180) {
        newAlerts.push({
          id: alertId++,
          type: "critical",
          message: `Critical: Average wait time is ${(
            metrics.avg_wait / 60
          ).toFixed(1)} minutes! Customers are leaving!`,
          timestamp: new Date(),
        });
        newRecommendations.push({
          title: "Immediate Action Required",
          description:
            "Add 2-3 additional staff members to reduce wait times immediately",
          impact: "Reduce wait time by 50-60%",
          priority: "high",
        });
      } else if (metrics.avg_wait > 120) {
        newAlerts.push({
          id: alertId++,
          type: "warning",
          message: `Warning: Average wait time is ${(
            metrics.avg_wait / 60
          ).toFixed(1)} minutes`,
          timestamp: new Date(),
        });
        newRecommendations.push({
          title: "Add Staff During Peak Hours",
          description:
            "Deploy 1-2 additional employees during this time period",
          impact: "Reduce wait time by 30-40%",
          priority: "high",
        });
      }
    }

    if (metrics.avg_queue_len !== null) {
      if (metrics.avg_queue_len > 10) {
        newAlerts.push({
          id: alertId++,
          type: "critical",
          message: `Queue overflow: ${metrics.avg_queue_len.toFixed(
            0
          )} people in queue!`,
          timestamp: new Date(),
        });
        newRecommendations.push({
          title: "Optimize Queue Layout",
          description:
            "Restructure queue area to handle more customers efficiently",
          impact: "Improve customer experience and flow",
          priority: "medium",
        });
      } else if (metrics.avg_queue_len > 6) {
        newAlerts.push({
          id: alertId++,
          type: "warning",
          message: `High queue density: ${metrics.avg_queue_len.toFixed(
            0
          )} people waiting`,
          timestamp: new Date(),
        });
      }
    }

    if (metrics.max_wait !== null && metrics.min_wait !== null) {
      const variance = metrics.max_wait - metrics.min_wait;
      if (variance > 240) {
        newAlerts.push({
          id: alertId++,
          type: "warning",
          message: "Inconsistent service times detected",
          timestamp: new Date(),
        });
        newRecommendations.push({
          title: "Standardize Service Process",
          description: "Train staff on consistent service procedures",
          impact: "More predictable wait times",
          priority: "medium",
        });
      }
    }

    if (metrics.num_people_measured > 20) {
      newRecommendations.push({
        title: "Implement Express Lane",
        description: "Create a separate lane for simple orders",
        impact: "Reduce overall wait time by 20-25%",
        priority: "medium",
      });
    }

    if (!newAlerts.length) {
      newAlerts.push({
        id: alertId++,
        type: "info",
        message: "Queue operating within normal parameters ✓",
        timestamp: new Date(),
      });
    }

    newRecommendations.push({
      title: "Real-time Monitoring System",
      description:
        "Install AI-powered queue management for continuous monitoring",
      impact: "30-50% reduction in wait times",
      priority: "high",
    });

    setAlerts(newAlerts);
    setRecommendations(newRecommendations);
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setVideoInfo(null);
    setRoi(null);
    setMetrics(null);
    setQueueSeries(null);
    setSampleFrames([]);
    setWaitTimes([]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/upload-video`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = (await res.json()) as { detail?: string };
        throw new Error(err.detail || "Upload failed");
      }

      const data = (await res.json()) as UploadVideoResponse;
      setVideoInfo({
        video_id: data.video_id,
        width: data.width,
        height: data.height,
        first_frame: data.first_frame,
        fps: data.fps,
        frame_count: data.frame_count,
        duration_sec: data.duration_sec,
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error uploading video: " + msg);
    } finally {
      setUploading(false);
    }
  };

  const getRelativeCoordinates = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!drawAreaRef.current) return { x: 0, y: 0 };
    const rect = drawAreaRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return { x, y };
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!videoInfo) return;
    setIsDrawing(true);
    const { x, y } = getRelativeCoordinates(e);
    setStartPoint({ x, y });
    setRoi(null);
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPoint || !videoInfo) return;
    const { x, y } = getRelativeCoordinates(e);

    const x1 = Math.max(0, Math.min(startPoint.x, x));
    const y1 = Math.max(0, Math.min(startPoint.y, y));
    const x2 = Math.min(videoInfo.width, Math.max(startPoint.x, x));
    const y2 = Math.min(videoInfo.height, Math.max(startPoint.y, y));

    setRoi({ x1, y1, x2, y2 });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleRunAnalysis = async () => {
    if (!videoInfo || !roi) {
      alert("Please upload a video and draw a queue region first.");
      return;
    }

    setAnalyzing(true);
    setMetrics(null);
    setQueueSeries(null);
    setSampleFrames([]);
    setWaitTimes([]);

    try {
      const body = {
        video_id: videoInfo.video_id,
        roi: [roi.x1, roi.y1, roi.x2, roi.y2],
        conf: 0.4,
        min_wait_sec_filter: 1.0,
        sample_stride: 40,
      };

      const res = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json()) as { detail?: string };
        throw new Error(err.detail || "Analysis failed");
      }

      const data = (await res.json()) as AnalyzeResponse;

      setMetrics(data.metrics);
      setQueueSeries({
        times: data.times,
        queue_lengths: data.queue_lengths,
      });
      setSampleFrames(data.sample_frames ?? []);
      setWaitTimes(data.wait_times ?? []);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      alert("Error running analysis: " + msg);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <header
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          padding: "20px 0",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "28px",
                  color: "#1a202c",
                  fontWeight: "700",
                }}
              >
                🎂 Jawek A7la Jaw - Smart Queue Analytics
              </h1>
              <p
                style={{
                  margin: "4px 0 0 0",
                  color: "#718096",
                  fontSize: "14px",
                }}
              >
                AI-Powered Dwell Time Analysis for Modern Patisseries
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setCurrentView("dashboard")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    currentView === "dashboard" ? "#667eea" : "#e2e8f0",
                  color: currentView === "dashboard" ? "#fff" : "#4a5568",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                }}
              >
                📊 Dashboard
              </button>
              <button
                onClick={() => setCurrentView("analysis")}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    currentView === "analysis" ? "#667eea" : "#e2e8f0",
                  color: currentView === "analysis" ? "#fff" : "#4a5568",
                  cursor: "pointer",
                  fontWeight: "600",
                  transition: "all 0.2s",
                }}
              >
                🔬 Analysis
              </button>
            </div>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {currentView === "dashboard" ? (
          <DashboardView
            metrics={metrics}
            alerts={alerts}
            recommendations={recommendations}
            queueSeries={queueSeries}
            sampleFrames={sampleFrames}
          />
        ) : (
          <AnalysisView
            uploading={uploading}
            analyzing={analyzing}
            videoInfo={videoInfo}
            roi={roi}
            metrics={metrics}
            queueSeries={queueSeries}
            sampleFrames={sampleFrames}
            drawAreaRef={drawAreaRef}
            isDrawing={isDrawing}
            startPoint={startPoint}
            handleFileChange={handleFileChange}
            handleMouseDown={handleMouseDown}
            handleMouseMove={handleMouseMove}
            handleMouseUp={handleMouseUp}
            handleRunAnalysis={handleRunAnalysis}
          />
        )}
      </div>
    </div>
  );
};

// Dashboard View Component
interface DashboardViewProps {
  metrics: Metrics | null;
  alerts: Alert[];
  recommendations: Recommendation[];
  queueSeries: QueueSeries | null;
  sampleFrames: string[];
}

const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  alerts,
  recommendations,
  queueSeries,
  sampleFrames,
}) => {
  if (!metrics) {
    return (
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "60px",
          textAlign: "center",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        }}
      >
        <div style={{ fontSize: "64px", marginBottom: "20px" }}>📹</div>
        <h2 style={{ color: "#2d3748", marginBottom: "12px" }}>
          No Analysis Data Yet
        </h2>
        <p style={{ color: "#718096", marginBottom: "24px" }}>
          Upload and analyze a queue video to see insights and recommendations
        </p>
        <p style={{ color: "#a0aec0", fontSize: "14px" }}>
          Switch to <strong>Analysis</strong> tab to get started
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Value Proposition Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
          borderRadius: "16px",
          padding: "32px",
          color: "white",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        }}
      >
        <h2
          style={{ margin: "0 0 12px 0", fontSize: "24px", fontWeight: "700" }}
        >
          💡 Why Your Patisserie Needs This Solution
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <ValueProp icon="⏱️" title="Reduce Wait Times" value="Up to 50%" />
          <ValueProp icon="😊" title="Customer Satisfaction" value="+35%" />
          <ValueProp icon="💰" title="Revenue Increase" value="+25%" />
          <ValueProp icon="👥" title="Staff Optimization" value="Real-time" />
        </div>
      </div>

      {/* Alerts Section */}
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            color: "#2d3748",
            fontSize: "20px",
            fontWeight: "600",
          }}
        >
          🚨 Real-Time Alerts
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px",
        }}
      >
        <MetricCard
          icon="⏰"
          label="Average Wait Time"
          value={
            metrics.avg_wait != null
              ? `${(metrics.avg_wait / 60).toFixed(1)} min`
              : "N/A"
          }
          color="#8b5cf6"
          trend={metrics.avg_wait && metrics.avg_wait > 120 ? "up" : "stable"}
        />
        <MetricCard
          icon="👥"
          label="Average Queue Length"
          value={
            metrics.avg_queue_len != null
              ? `${metrics.avg_queue_len.toFixed(1)} people`
              : "N/A"
          }
          color="#ec4899"
          trend={
            metrics.avg_queue_len && metrics.avg_queue_len > 6 ? "up" : "stable"
          }
        />
        <MetricCard
          icon="📊"
          label="People Analyzed"
          value={String(metrics.num_people_measured)}
          color="#10b981"
          trend="stable"
        />
        <MetricCard
          icon="⚡"
          label="Max Wait Time"
          value={
            metrics.max_wait != null
              ? `${(metrics.max_wait / 60).toFixed(1)} min`
              : "N/A"
          }
          color="#f59e0b"
          trend={metrics.max_wait && metrics.max_wait > 180 ? "up" : "stable"}
        />
      </div>

      {/* Recommendations */}
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            color: "#2d3748",
            fontSize: "20px",
            fontWeight: "600",
          }}
        >
          💼 Strategic Recommendations
        </h3>
        <div style={{ display: "grid", gap: "16px" }}>
          {recommendations.map((rec, idx) => (
            <RecommendationCard key={idx} recommendation={rec} />
          ))}
        </div>
      </div>

      {/* Queue Analytics */}
      {queueSeries && queueSeries.times.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              color: "#2d3748",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            📈 Queue Length Over Time
          </h3>
          <SimpleChart
            times={queueSeries.times}
            values={queueSeries.queue_lengths}
          />
        </div>
      )}

      {/* Sample Frames */}
      {sampleFrames && sampleFrames.length > 0 && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h3
            style={{
              margin: "0 0 16px 0",
              color: "#2d3748",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            🎥 Visual Analysis
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
              gap: "16px",
            }}
          >
            {sampleFrames.slice(0, 6).map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`analysis-${idx}`}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: "3px solid #e2e8f0",
                  boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Analysis View Component
interface AnalysisViewProps {
  uploading: boolean;
  analyzing: boolean;
  videoInfo: VideoInfo | null;
  roi: ROI | null;
  metrics: Metrics | null;
  queueSeries: QueueSeries | null;
  sampleFrames: string[];
  drawAreaRef: React.RefObject<HTMLDivElement | null>;
  isDrawing: boolean;
  startPoint: { x: number; y: number } | null;
  handleFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleMouseDown: (e: ReactMouseEvent<HTMLDivElement>) => void;
  handleMouseMove: (e: ReactMouseEvent<HTMLDivElement>) => void;
  handleMouseUp: () => void;
  handleRunAnalysis: () => void;
}

const AnalysisView: React.FC<AnalysisViewProps> = ({
  uploading,
  analyzing,
  videoInfo,
  roi,
  metrics,
  queueSeries,
  sampleFrames,
  drawAreaRef,
  handleFileChange,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleRunAnalysis,
}) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Upload Section */}
      <div
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px 0",
            color: "#2d3748",
            fontSize: "20px",
            fontWeight: "600",
          }}
        >
          1️⃣ Upload Queue Video
        </h2>
        <p style={{ margin: "0 0 16px 0", color: "#718096", fontSize: "14px" }}>
          Upload CCTV footage of your patisserie queue for AI analysis
        </p>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          style={{
            padding: "12px",
            border: "2px dashed #cbd5e0",
            borderRadius: "8px",
            width: "100%",
            cursor: "pointer",
            fontSize: "14px",
          }}
        />
        {uploading && (
          <div
            style={{
              marginTop: "12px",
              color: "#667eea",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            ⏳ Processing video...
          </div>
        )}

        {videoInfo && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "#f7fafc",
              borderRadius: "8px",
              fontSize: "14px",
              color: "#4a5568",
            }}
          >
            <div>
              <strong>Video ID:</strong> {videoInfo.video_id}
            </div>
            <div>
              <strong>Resolution:</strong> {videoInfo.width} x{" "}
              {videoInfo.height}
            </div>
            <div>
              <strong>FPS:</strong> {videoInfo.fps.toFixed(2)} |{" "}
              <strong>Duration:</strong> {videoInfo.duration_sec.toFixed(1)}s
            </div>
          </div>
        )}
      </div>

      {/* ROI Selection */}
      {videoInfo && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              color: "#2d3748",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            2️⃣ Define Queue Region (ROI)
          </h2>
          <p
            style={{ margin: "0 0 16px 0", color: "#718096", fontSize: "14px" }}
          >
            Click and drag to draw a rectangle over the queue area
          </p>

          <div
            ref={drawAreaRef}
            style={{
              position: "relative",
              width: videoInfo.width,
              height: videoInfo.height,
              maxWidth: "100%",
              border: "2px solid #e2e8f0",
              borderRadius: "8px",
              background: "#000",
              cursor: "crosshair",
              overflow: "hidden",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img
              src={videoInfo.first_frame}
              alt="First frame"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: videoInfo.width,
                height: videoInfo.height,
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />

            {roi && (
              <div
                style={{
                  position: "absolute",
                  border: "3px solid #667eea",
                  background: "rgba(102, 126, 234, 0.2)",
                  left: roi.x1,
                  top: roi.y1,
                  width: roi.x2 - roi.x1,
                  height: roi.y2 - roi.y1,
                  pointerEvents: "none",
                  boxShadow: "0 0 20px rgba(102, 126, 234, 0.5)",
                }}
              />
            )}
          </div>

          {roi && (
            <div
              style={{
                marginTop: "12px",
                padding: "8px",
                background: "#f0f4ff",
                borderRadius: "6px",
                fontSize: "13px",
                color: "#4c51bf",
              }}
            >
              ✓ ROI Selected: x1={Math.round(roi.x1)}, y1={Math.round(roi.y1)},
              x2={Math.round(roi.x2)}, y2={Math.round(roi.y2)}
            </div>
          )}
        </div>
      )}

      {/* Run Analysis */}
      {videoInfo && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              color: "#2d3748",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            3️⃣ Run AI Analysis
          </h2>
          <p
            style={{ margin: "0 0 16px 0", color: "#718096", fontSize: "14px" }}
          >
            Process video with YOLO11 + Computer Vision algorithms
          </p>
          <button
            onClick={handleRunAnalysis}
            disabled={!roi || analyzing}
            style={{
              padding: "14px 32px",
              borderRadius: "8px",
              border: "none",
              background: roi
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "#cbd5e0",
              color: "#fff",
              cursor: roi ? "pointer" : "not-allowed",
              fontSize: "16px",
              fontWeight: "600",
              boxShadow: roi ? "0 4px 15px rgba(102, 126, 234, 0.4)" : "none",
              transition: "all 0.3s",
            }}
          >
            {analyzing ? "⏳ Analyzing..." : "🚀 Start Analysis"}
          </button>
          {!roi && (
            <p style={{ marginTop: "8px", fontSize: "13px", color: "#e53e3e" }}>
              ⚠️ Please draw a queue region first
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {metrics && (
        <div
          style={{
            background: "white",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              color: "#2d3748",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            4️⃣ Analysis Results
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <SimpleMetricCard
              label="Avg Wait Time"
              value={
                metrics.avg_wait != null
                  ? `${metrics.avg_wait.toFixed(1)}s`
                  : "N/A"
              }
            />
            <SimpleMetricCard
              label="Min Wait Time"
              value={
                metrics.min_wait != null
                  ? `${metrics.min_wait.toFixed(1)}s`
                  : "N/A"
              }
            />
            <SimpleMetricCard
              label="Max Wait Time"
              value={
                metrics.max_wait != null
                  ? `${metrics.max_wait.toFixed(1)}s`
                  : "N/A"
              }
            />
            <SimpleMetricCard
              label="Avg Queue Length"
              value={
                metrics.avg_queue_len != null
                  ? `${metrics.avg_queue_len.toFixed(1)}`
                  : "N/A"
              }
            />
            <SimpleMetricCard
              label="People Measured"
              value={String(metrics.num_people_measured)}
            />
          </div>

          {queueSeries && queueSeries.times.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  color: "#4a5568",
                  marginBottom: "8px",
                }}
              >
                Queue Length Data Points (first 15)
              </h3>
              <div
                style={{
                  maxHeight: "200px",
                  overflowY: "auto",
                  fontSize: "13px",
                  color: "#718096",
                  background: "#f7fafc",
                  padding: "12px",
                  borderRadius: "6px",
                }}
              >
                {queueSeries.times.slice(0, 15).map((t, idx) => (
                  <div key={idx} style={{ marginBottom: "4px" }}>
                    t={t.toFixed(1)}s → {queueSeries.queue_lengths[idx]} people
                  </div>
                ))}
              </div>
            </div>
          )}

          {sampleFrames && sampleFrames.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h3
                style={{
                  fontSize: "16px",
                  color: "#4a5568",
                  marginBottom: "12px",
                }}
              >
                Annotated Frames (YOLO Detection)
              </h3>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                  gap: "12px",
                }}
              >
                {sampleFrames.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`frame-${idx}`}
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "2px solid #e2e8f0",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Helper Components
const ValueProp: React.FC<{ icon: string; title: string; value: string }> = ({
  icon,
  title,
  value,
}) => (
  <div style={{ textAlign: "center" }}>
    <div style={{ fontSize: "32px", marginBottom: "8px" }}>{icon}</div>
    <div style={{ fontSize: "13px", opacity: 0.9, marginBottom: "4px" }}>
      {title}
    </div>
    <div style={{ fontSize: "24px", fontWeight: "700" }}>{value}</div>
  </div>
);

const AlertCard: React.FC<{ alert: Alert }> = ({ alert }) => {
  const colors = {
    critical: { bg: "#fed7d7", border: "#f56565", text: "#c53030" },
    warning: { bg: "#feebc8", border: "#ed8936", text: "#c05621" },
    info: { bg: "#bee3f8", border: "#4299e1", text: "#2c5282" },
  };
  const color = colors[alert.type];

  return (
    <div
      style={{
        padding: "16px",
        borderLeft: `4px solid ${color.border}`,
        background: color.bg,
        borderRadius: "8px",
        color: color.text,
        fontSize: "14px",
      }}
    >
      <strong>{alert.type.toUpperCase()}:</strong> {alert.message}
    </div>
  );
};

const RecommendationCard: React.FC<{ recommendation: Recommendation }> = ({
  recommendation,
}) => {
  const priorityColors = {
    high: "#f56565",
    medium: "#ed8936",
    low: "#48bb78",
  };

  return (
    <div
      style={{
        padding: "20px",
        border: "2px solid #e2e8f0",
        borderRadius: "12px",
        background: "#fafafa",
        transition: "all 0.2s",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <h4
          style={{
            margin: 0,
            color: "#2d3748",
            fontSize: "16px",
            fontWeight: "600",
          }}
        >
          {recommendation.title}
        </h4>
        <span
          style={{
            padding: "4px 12px",
            borderRadius: "12px",
            fontSize: "11px",
            fontWeight: "600",
            textTransform: "uppercase",
            background: priorityColors[recommendation.priority],
            color: "white",
          }}
        >
          {recommendation.priority}
        </span>
      </div>
      <p style={{ margin: "8px 0", color: "#4a5568", fontSize: "14px" }}>
        {recommendation.description}
      </p>
      <div
        style={{
          marginTop: "8px",
          padding: "8px 12px",
          background: "#e6fffa",
          borderRadius: "6px",
          fontSize: "13px",
          color: "#047857",
          fontWeight: "500",
        }}
      >
        💡 Impact: {recommendation.impact}
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  icon: string;
  label: string;
  value: string;
  color: string;
  trend: "up" | "down" | "stable";
}> = ({ icon, label, value, color, trend }) => {
  const trendIcon = trend === "up" ? "📈" : trend === "down" ? "📉" : "➡️";

  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        padding: "20px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "32px" }}>{icon}</span>
        <span style={{ fontSize: "20px" }}>{trendIcon}</span>
      </div>
      <div style={{ fontSize: "13px", color: "#718096", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: "700", color: "#2d3748" }}>
        {value}
      </div>
    </div>
  );
};

const SimpleMetricCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      padding: "16px",
      border: "2px solid #e2e8f0",
      borderRadius: "8px",
      background: "#f7fafc",
    }}
  >
    <div style={{ fontSize: "12px", color: "#718096", marginBottom: "4px" }}>
      {label}
    </div>
    <div style={{ fontSize: "20px", fontWeight: "600", color: "#2d3748" }}>
      {value}
    </div>
  </div>
);

const SimpleChart: React.FC<{ times: number[]; values: number[] }> = ({
  times,
  values,
}) => {
  const maxValue = Math.max(...values);
  const chartHeight = 200;

  return (
    <div
      style={{
        position: "relative",
        height: `${chartHeight}px`,
        background: "#f7fafc",
        borderRadius: "8px",
        padding: "20px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          height: "100%",
          alignItems: "flex-end",
          gap: "4px",
        }}
      >
        {values.slice(0, 50).map((val, idx) => {
          const height = (val / maxValue) * 100;
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                height: `${height}%`,
                background: "linear-gradient(to top, #667eea, #764ba2)",
                borderRadius: "2px 2px 0 0",
                minWidth: "4px",
                transition: "all 0.3s",
              }}
              title={`t=${times[idx].toFixed(1)}s: ${val} people`}
            />
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: "4px",
          left: "20px",
          right: "20px",
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#a0aec0",
        }}
      >
        <span>{times[0]?.toFixed(0)}s</span>
        <span>{times[Math.min(49, times.length - 1)]?.toFixed(0)}s</span>
      </div>
    </div>
  );
};

export default App;
