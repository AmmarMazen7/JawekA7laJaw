'use client'

// API client for communicating with FastAPI backend
// Configure NEXT_PUBLIC_API_URL in your environment variables

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = API_URL) {
    this.baseUrl = baseUrl
  }

  async fetch<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`
      console.log('[API] Calling', url)

      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      })

      if (!response.ok) {
        console.error('[API] Error:', response.status, response.statusText)
        return {
          success: false,
          error: `${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      console.log('[API] Response:', data)
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error('[API] Exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  get<T = any>(endpoint: string, options?: RequestInit) {
    return this.fetch<T>(endpoint, { method: 'GET', ...options })
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    })
  }

  put<T = any>(endpoint: string, body?: any, options?: RequestInit) {
    return this.fetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    })
  }

  delete<T = any>(endpoint: string, options?: RequestInit) {
    return this.fetch<T>(endpoint, { method: 'DELETE', ...options })
  }
}

export const apiClient = new ApiClient()

// Video Upload API (matches FastAPI backend)
export const videoApi = {
  // Upload video - POST /upload-video
  uploadVideo: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    
    try {
      const url = `${API_URL}/upload-video`
      console.log('[API] Uploading video to', url)
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
      })
      
      if (!response.ok) {
        const error = await response.json()
        return {
          success: false,
          error: error.detail || 'Upload failed',
        }
      }
      
      const data = await response.json()
      console.log('[API] Upload response:', data)
      return {
        success: true,
        data,
      }
    } catch (error) {
      console.error('[API] Upload exception:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  // Single zone analysis - POST /analyze
  analyzeSingleZone: (videoId: string, roi: number[], options?: {
    conf?: number
    min_wait_sec_filter?: number
    sample_stride?: number
  }) =>
    apiClient.post('/analyze', {
      video_id: videoId,
      roi,
      conf: options?.conf || 0.4,
      min_wait_sec_filter: options?.min_wait_sec_filter || 1.0,
      sample_stride: options?.sample_stride || 40,
    }),

  // Multi-zone analysis - POST /analyze-multi-zone
  analyzeMultiZone: (videoId: string, zones: Array<{
    name: string
    polygon: number[][]
  }>, options?: {
    conf?: number
    min_wait_sec_filter?: number
    sample_stride?: number
  }) =>
    apiClient.post('/analyze-multi-zone', {
      video_id: videoId,
      zones,
      conf: options?.conf || 0.4,
      min_wait_sec_filter: options?.min_wait_sec_filter || 1.0,
      sample_stride: options?.sample_stride || 40,
    }),
}

// Legacy Queue Management API (keep for backwards compatibility)
export const queueApi = {
  getMetrics: (timeRange = '1h') =>
    apiClient.get('/api/queue/metrics', {
      method: 'GET',
      headers: { 'X-Time-Range': timeRange },
    }),

  getQueues: () => apiClient.get('/api/queues'),

  getQueueById: (queueId: string) => apiClient.get(`/api/queues/${queueId}`),

  getZoneStats: (zoneId: number) =>
    apiClient.get(`/api/zones/${zoneId}/stats`),

  processZoneConfig: (config: any) =>
    apiClient.post('/api/zones/config', config),
}

// Detection API
export const detectionApi = {
  startDetection: (videoId: string, zoneConfig: any) =>
    apiClient.post(`/api/detection/start`, { videoId, zoneConfig }),

  stopDetection: (detectionId: string) =>
    apiClient.post(`/api/detection/${detectionId}/stop`),

  getDetectionResults: (detectionId: string) =>
    apiClient.get(`/api/detection/${detectionId}/results`),

  getLiveDetectionStream: (detectionId: string) =>
    `${API_URL}/api/detection/${detectionId}/stream`,
}

// Employee API
export const employeeApi = {
  getEmployees: () => apiClient.get('/api/employees'),

  createEmployee: (employee: any) =>
    apiClient.post('/api/employees', employee),

  updateEmployee: (id: string, employee: any) =>
    apiClient.put(`/api/employees/${id}`, employee),

  deleteEmployee: (id: string) => apiClient.delete(`/api/employees/${id}`),

  updateAvailability: (id: string, availability: string) =>
    apiClient.put(`/api/employees/${id}/availability`, { availability }),
}

// Notifications API
export const notificationsApi = {
  getNotifications: () => apiClient.get('/api/notifications'),

  createNotification: (notification: any) =>
    apiClient.post('/api/notifications', notification),

  markAsRead: (id: string) =>
    apiClient.put(`/api/notifications/${id}/read`),

  deleteNotification: (id: string) =>
    apiClient.delete(`/api/notifications/${id}`),
}

// WebSocket for real-time updates
export class QueueWebSocket {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private listeners: Map<string, Function[]> = new Map()

  constructor(url = `${API_URL.replace('http', 'ws')}/api/ws`) {
    this.url = url
  }

  connect() {
    // Temporarily disabled - WebSocket endpoint not implemented yet
    console.log('[WebSocket] Disabled - endpoint not implemented')
    return
  }

  private attemptReconnect() {
    // Disabled
    return
    /*
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000)
      console.log(`[WebSocket] Attempting reconnect in ${delay}ms`)
      setTimeout(() => this.connect(), delay)
    }
    */
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    } else {
      console.warn('[WebSocket] Not connected, cannot send message')
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event)
    if (listeners) {
      this.listeners.set(
        event,
        listeners.filter((cb) => cb !== callback)
      )
    }
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event) || []
    listeners.forEach((cb) => cb(data))
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}

export const queueWs = new QueueWebSocket()
