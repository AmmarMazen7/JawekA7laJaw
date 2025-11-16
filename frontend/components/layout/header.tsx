'use client'

import { Moon, Sun } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { NotificationCenter } from './notification-center'

interface HeaderProps {
  darkMode: boolean
  onDarkModeToggle: (darkMode: boolean) => void
}

export function Header({ darkMode, onDarkModeToggle }: HeaderProps) {
  return (
    <header className="sticky top-0 bg-card border-b border-border z-40">
      <div className="flex items-center justify-between p-4 md:p-6">
        <div>
          <h2 className="text-2xl font-bold text-balance">Queue Analytics</h2>
          <p className="text-sm text-muted-foreground">Real-time intelligent queue management</p>
        </div>

        <div className="flex items-center gap-3">
          <NotificationCenter />

          <button
            onClick={() => onDarkModeToggle(!darkMode)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <UserButton 
            appearance={{
              elements: {
                avatarBox: "w-9 h-9"
              }
            }}
            afterSignOutUrl="/sign-in"
          />
        </div>
      </div>
    </header>
  )
}
