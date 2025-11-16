'use client'

import { useEffect, useState, useCallback } from 'react'
import { Notification } from '@/components/layout/notification-center'
import { queueWs } from '@/lib/api-client'

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    // Connect to WebSocket for real-time notifications
    queueWs.connect()

    // Listen for notification events
    const handleNotification = (data: any) => {
      const newNotif: Notification = {
        id: `notif-${Date.now()}`,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        timestamp: new Date(),
        read: false,
        actionUrl: data.actionUrl,
        actionLabel: data.actionLabel,
      }
      setNotifications((prev) => [newNotif, ...prev].slice(0, 50))
    }

    queueWs.on('notification', handleNotification)
    queueWs.on('queue_alert', handleNotification)
    queueWs.on('staffing_alert', handleNotification)

    return () => {
      queueWs.off('notification', handleNotification)
      queueWs.off('queue_alert', handleNotification)
      queueWs.off('staffing_alert', handleNotification)
    }
  }, [])

  const addNotification = useCallback(
    (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', actionLabel?: string, actionUrl?: string) => {
      const notif: Notification = {
        id: `notif-${Date.now()}`,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false,
        actionLabel,
        actionUrl,
      }
      setNotifications((prev) => [notif, ...prev].slice(0, 50))
      return notif.id
    },
    []
  )

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  return {
    notifications,
    addNotification,
    removeNotification,
    setNotifications,
  }
}
