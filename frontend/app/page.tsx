'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { VideoUploadPage } from '@/components/pages/video-upload-page'
import { EmployeeManagementPage } from '@/components/pages/employee-management-page'
import { AnalyticsDashboard } from '@/components/pages/analytics-dashboard'
import LiveStreamPage from '@/components/pages/live-stream-page'
import CCTVCamerasPage from '@/components/pages/cctv-cameras-page'
import { MetricsSync } from '@/components/realtime/metrics-sync'

type PageType = 'dashboard' | 'video-zone' | 'cctv-cameras' | 'live-stream' | 'employees'

export default function Home() {
  const [currentPage, setCurrentPage] = useState<PageType>('dashboard')
  const [darkMode, setDarkMode] = useState(true)

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <Sidebar currentPage={currentPage} onPageChange={setCurrentPage} />
        
        <main className="ml-0 lg:ml-64 transition-all duration-300">
          <Header darkMode={darkMode} onDarkModeToggle={setDarkMode} />
          
          <div className="p-4 md:p-6 lg:p-8">
            {currentPage === 'dashboard' && <AnalyticsDashboard />}
            {currentPage === 'video-zone' && <VideoUploadPage />}
            {currentPage === 'cctv-cameras' && <CCTVCamerasPage />}
            {currentPage === 'live-stream' && <LiveStreamPage />}
            {currentPage === 'employees' && <EmployeeManagementPage />}
          </div>

          <MetricsSync />
        </main>
      </div>
    </div>
  )
}
