'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { queueWs } from '@/lib/api-client'

export function useRealTimeData<T = any>(eventName: string) {
  const [data, setData] = useState<T | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const handlersRef = useRef<Function[]>([])

  useEffect(() => {
    queueWs.connect()

    const handleData = (payload: any) => {
      setData(payload)
      handlersRef.current.forEach((handler) => handler(payload))
    }

    queueWs.on(eventName, handleData)
    setIsConnected(true)

    return () => {
      queueWs.off(eventName, handleData)
    }
  }, [eventName])

  const subscribe = useCallback((handler: (data: T) => void) => {
    handlersRef.current.push(handler)
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler)
    }
  }, [])

  return { data, isConnected, subscribe }
}
