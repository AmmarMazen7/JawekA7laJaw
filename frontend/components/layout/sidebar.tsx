'use client'

import { BarChart3, Users, Video, Zap, Radio, Camera } from 'lucide-react'
import Link from 'next/link'

interface SidebarProps {
  currentPage: string
  onPageChange: (page: any) => void
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'video-zone', label: 'Zone Configuration', icon: Video },
    { id: 'cctv-cameras', label: 'CCTV Cameras', icon: Camera },
    { id: 'live-stream', label: 'Live Stream', icon: Radio },
    { id: 'employees', label: 'Employee Management', icon: Users },
  ]

  return (
    <>
      {/* Mobile Sidebar Backdrop */}
      <div className="hidden lg:block fixed inset-0 z-40 pointer-events-none"></div>

      {/* Sidebar */}
      <aside className="hidden lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:w-64 lg:flex lg:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-balance">Queue AI</h1>
              <p className="text-xs text-sidebar-foreground/60">Analytics Pro</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <div className="bg-sidebar-accent/20 rounded-lg p-4 text-center">
            <p className="text-sm text-sidebar-foreground/80">
              Real-time queue insights powered by AI
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-sidebar border-t border-sidebar-border z-50">
        <div className="flex justify-around">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                onClick={() => onPageChange(item.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors ${
                  isActive
                    ? 'text-sidebar-primary'
                    : 'text-sidebar-foreground/60'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
