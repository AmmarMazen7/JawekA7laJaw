'use client'

import { useState, useEffect } from 'react'
import { Bell, X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
  read: boolean
  actionUrl?: string
  actionLabel?: string
}

interface NotificationCenterProps {
  notifications?: Notification[]
}

export function NotificationCenter({ notifications: initialNotifications = [] }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(0)

  // Simulate real-time notifications for demo
  useEffect(() => {
    const interval = setInterval(() => {
      // Add random notifications
      const types: Array<'info' | 'success' | 'warning' | 'error'> = ['info', 'warning']
      const sampleNotifications = [
        {
          title: 'High Queue Alert',
          message: 'Zone 3 queue length exceeded threshold',
          type: 'warning' as const,
        },
        {
          title: 'Staff Request',
          message: 'Additional staff needed for peak hours',
          type: 'error' as const,
        },
        {
          title: 'Efficiency Update',
          message: 'Zone 1 efficiency improved by 5%',
          type: 'success' as const,
        },
      ]

      // Randomly add notification
      if (Math.random() > 0.7 && notifications.length < 10) {
        const sample = sampleNotifications[Math.floor(Math.random() * sampleNotifications.length)]
        const newNotif: Notification = {
          id: `notif-${Date.now()}`,
          title: sample.title,
          message: sample.message,
          type: sample.type,
          timestamp: new Date(),
          read: false,
        }
        setNotifications(prev => [newNotif, ...prev])
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [notifications.length])

  useEffect(() => {
    const count = notifications.filter(n => !n.read).length
    setUnreadCount(count)
  }, [notifications])

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const handleDelete = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />
      default:
        return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="fixed md:absolute right-0 top-full md:right-0 md:top-12 w-full md:w-96 max-h-[500px] bg-card border border-border rounded-lg shadow-lg z-50 md:mt-2">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-semibold">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer ${
                      !notif.read ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => handleMarkAsRead(notif.id)}
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{notif.title}</p>
                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notif.timestamp.toLocaleTimeString()}
                        </p>
                        {notif.actionLabel && (
                          <button className="mt-2 text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded text-primary font-semibold transition-colors">
                            {notif.actionLabel}
                          </button>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(notif.id)
                        }}
                        className="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && unreadCount > 0 && (
            <div className="p-3 border-t border-border text-center">
              <button
                onClick={handleMarkAllAsRead}
                className="text-sm text-primary hover:underline font-semibold"
              >
                Mark all as read
              </button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
