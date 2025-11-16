// Form validation helpers

export const validators = {
  email: (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  },

  phone: (phone: string) => {
    const regex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
    return regex.test(phone)
  },

  name: (name: string) => {
    return name.length >= 2 && name.length <= 100
  },

  time: (time: string) => {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    return regex.test(time)
  },

  videoFile: (file: File) => {
    const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo']
    const maxSize = 500 * 1024 * 1024 // 500MB
    return validTypes.includes(file.type) && file.size <= maxSize
  },

  polygonPoints: (points: Array<[number, number]>) => {
    return points.length >= 3 && points.length <= 10
  },
}

export const formatters = {
  time: (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  },

  percentage: (value: number) => {
    return `${Math.round(value)}%`
  },

  currency: (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount)
  },

  date: (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  },

  dateTime: (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  },
}
