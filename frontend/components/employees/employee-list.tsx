'use client'

import { Trash2, Edit2, Clock, MapPin } from 'lucide-react'
import { Employee } from '@/components/pages/employee-management-page'

interface EmployeeListProps {
  employees: Employee[]
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function EmployeeList({ employees, onEdit, onDelete }: EmployeeListProps) {
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'manager':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
      case 'supervisor':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
      default:
        return 'bg-green-500/10 text-green-600 dark:text-green-400'
    }
  }

  const getAvailabilityStatus = (availability: string) => {
    switch (availability) {
      case 'available':
        return { dot: 'bg-green-500', label: 'Available' }
      case 'busy':
        return { dot: 'bg-yellow-500', label: 'Busy' }
      case 'break':
        return { dot: 'bg-red-500', label: 'Break' }
      default:
        return { dot: 'bg-gray-500', label: 'Unknown' }
    }
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {employees.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No employees found. Add one to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted">
              <tr>
                <th className="text-left px-4 md:px-6 py-3 font-semibold">Name</th>
                <th className="text-left px-4 md:px-6 py-3 font-semibold hidden md:table-cell">Email</th>
                <th className="text-left px-4 md:px-6 py-3 font-semibold">Role</th>
                <th className="text-left px-4 md:px-6 py-3 font-semibold">Status</th>
                <th className="text-right px-4 md:px-6 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => {
                const status = getAvailabilityStatus(emp.availability)
                return (
                  <tr key={emp.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                    <td className="px-4 md:px-6 py-4">
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{emp.email}</div>
                    </td>
                    <td className="px-4 md:px-6 py-4 hidden md:table-cell">
                      <p className="text-sm text-muted-foreground">{emp.email}</p>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-semibold capitalize ${getRoleColor(emp.role)}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${status.dot}`}></div>
                        <span className="text-sm">{status.label}</span>
                      </div>
                    </td>
                    <td className="px-4 md:px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => onEdit(emp.id)}
                        className="inline-p-2 hover:bg-muted rounded transition-colors text-primary hover:text-primary/90"
                        title="Edit employee"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(emp.id)}
                        className="inline-p-2 hover:bg-destructive/10 text-destructive rounded transition-colors"
                        title="Delete employee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
