'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Clock } from 'lucide-react'
import { EmployeeForm } from '@/components/employees/employee-form'
import { EmployeeList } from '@/components/employees/employee-list'

export interface Employee {
  id: string
  name: string
  email: string
  role: 'cashier' | 'supervisor' | 'manager'
  availability: 'available' | 'busy' | 'break'
  zone?: number
  startTime?: string
  endTime?: string
  phone?: string
}

export function EmployeeManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      name: 'Alice Johnson',
      email: 'alice@store.com',
      role: 'cashier',
      availability: 'available',
      zone: 1,
      startTime: '09:00',
      endTime: '17:00',
      phone: '+1234567890',
    },
    {
      id: '2',
      name: 'Bob Smith',
      email: 'bob@store.com',
      role: 'cashier',
      availability: 'busy',
      zone: 2,
      startTime: '10:00',
      endTime: '18:00',
      phone: '+1234567891',
    },
    {
      id: '3',
      name: 'Carol White',
      email: 'carol@store.com',
      role: 'supervisor',
      availability: 'available',
      startTime: '08:00',
      endTime: '16:00',
      phone: '+1234567892',
    },
  ])

  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const handleAddEmployee = (employee: Omit<Employee, 'id'>) => {
    const newEmployee: Employee = {
      ...employee,
      id: Date.now().toString(),
    }
    setEmployees([...employees, newEmployee])
    setShowAddForm(false)
  }

  const handleUpdateEmployee = (id: string, employee: Omit<Employee, 'id'>) => {
    setEmployees(
      employees.map((e) => (e.id === id ? { ...employee, id } : e))
    )
    setEditingId(null)
  }

  const handleDeleteEmployee = (id: string) => {
    if (confirm('Are you sure you want to delete this employee?')) {
      setEmployees(employees.filter((e) => e.id !== id))
    }
  }

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const availableCount = employees.filter((e) => e.availability === 'available').length
  const roleBreakdown = {
    cashier: employees.filter((e) => e.role === 'cashier').length,
    supervisor: employees.filter((e) => e.role === 'supervisor').length,
    manager: employees.filter((e) => e.role === 'manager').length,
  }

  return (
    <div className="space-y-6 pb-24 lg:pb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employee Management</h1>
          <p className="text-muted-foreground">Manage team members and their availability</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null)
            setShowAddForm(!showAddForm)
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold w-full md:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Employee
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Employees</p>
          <p className="text-2xl font-bold">{employees.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Available Now</p>
          <p className="text-2xl font-bold text-green-500">{availableCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground mb-1">Cashiers</p>
          <p className="text-2xl font-bold">{roleBreakdown.cashier}</p>
        </div>
      </div>

      {/* Add/Edit Form */}
      {(showAddForm || editingId) && (
        <EmployeeForm
          employee={editingId ? employees.find((e) => e.id === editingId) : undefined}
          onSubmit={(data) => {
            if (editingId) {
              handleUpdateEmployee(editingId, data)
            } else {
              handleAddEmployee(data)
            }
          }}
          onCancel={() => {
            setShowAddForm(false)
            setEditingId(null)
          }}
        />
      )}

      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Employee List */}
      <EmployeeList
        employees={filteredEmployees}
        onEdit={(id) => setEditingId(id)}
        onDelete={handleDeleteEmployee}
      />
    </div>
  )
}
