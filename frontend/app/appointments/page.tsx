'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { get, post, put } from '@/lib/api'

interface Appointment {
  id: number
  conversation_id: number | null
  patient_name: string
  patient_phone: string | null
  patient_email: string | null
  appointment_date: string
  appointment_type: string | null
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  agent_id?: number | null
  agent_name?: string | null
  agent_type?: string | null
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState<Appointment | null>(null)
  const [sendingReminder, setSendingReminder] = useState(false)
  const [formData, setFormData] = useState({
    patient_name: '',
    patient_phone: '',
    patient_email: '',
    appointment_date: '',
    appointment_time: '',
    appointment_type: '',
    notes: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchAppointments()
  }, [router])

  const fetchAppointments = async () => {
    try {
      const response = await get('/appointments')
      if (response.error) {
        console.error('Error fetching appointments:', response.error)
        setAppointments([])
      } else if (response.data?.appointments) {
        setAppointments(response.data.appointments)
      }
    } catch (error) {
      console.error('Error fetching appointments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Combine date and time
    const appointmentDateTime = formData.appointment_date && formData.appointment_time
      ? `${formData.appointment_date}T${formData.appointment_time}:00Z`
      : formData.appointment_date

    try {
      const response = await post('/appointments', {
        patient_name: formData.patient_name,
        patient_phone: formData.patient_phone || null,
        patient_email: formData.patient_email || null,
        appointment_date: appointmentDateTime,
        appointment_type: formData.appointment_type || null,
        notes: formData.notes || null
      })

      if (response.error) {
        alert(`Error creating appointment: ${response.error}`)
        return
      }

      setShowCreateModal(false)
      setFormData({
        patient_name: '',
        patient_phone: '',
        patient_email: '',
        appointment_date: '',
        appointment_time: '',
        appointment_type: '',
        notes: ''
      })
      fetchAppointments()
    } catch (error: any) {
      alert(`Error creating appointment: ${error.message}`)
    }
  }

  const handleCancel = async (appointment: Appointment) => {
    if (!confirm(`Cancel appointment for ${appointment.patient_name}?`)) {
      return
    }

    try {
      const response = await put(`/appointments/${appointment.id}`, {
        status: 'cancelled'
      })

      if (response.error) {
        alert(`Error cancelling appointment: ${response.error}`)
        return
      }

      fetchAppointments()
    } catch (error: any) {
      alert(`Error cancelling appointment: ${error.message}`)
    }
  }

  const handleSendReminder = async (method: 'sms' | 'email' | 'both') => {
    if (!showReminderModal) return

    setSendingReminder(true)
    try {
      const response = await post(`/appointments/${showReminderModal.id}/send-reminder`, {
        method
      })

      if (response.error) {
        alert(`Error sending reminder: ${response.error}`)
      } else {
        // Show detailed results
        const results = response.data?.results || []
        const emailResult = results.find((r: any) => r.method === 'email')
        const smsResult = results.find((r: any) => r.method === 'sms')
        
        let message = 'Reminder sent successfully!\n\n'
        
        if (emailResult) {
          if (emailResult.success) {
            message += `Email: ✅ Sent to ${emailResult.accepted?.join(', ') || showReminderModal.patient_email}\n`
            message += `Message ID: ${emailResult.message_id}\n\n`
          } else {
            message += `Email: ❌ Failed - ${emailResult.error || emailResult.details}\n\n`
          }
        }
        
        if (smsResult) {
          if (smsResult.success) {
            message += `SMS: ✅ Sent\n`
            message += `Message SID: ${smsResult.message_sid}\n\n`
          } else {
            message += `SMS: ❌ Failed - ${smsResult.error}\n\n`
          }
        }
        
        message += '\nNote: If you didn\'t receive the email, check your spam folder or verify the email configuration.'
        
        alert(message)
        setShowReminderModal(null)
      }
    } catch (error: any) {
      alert(`Error sending reminder: ${error.message}`)
    } finally {
      setSendingReminder(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'scheduled':
        return 'bg-green-500/20 text-green-300 border-green-500'
      case 'cancelled':
        return 'bg-red-500/20 text-red-300 border-red-500'
      case 'completed':
        return 'bg-blue-500/20 text-blue-300 border-blue-500'
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading appointments...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm">
          ← Dashboard
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Appointments</h1>
            <p className="text-slate-300">Manage patient appointments</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            + Create Appointment
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {appointments.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-12 text-center border border-white/20">
              <p className="text-slate-300 text-lg">No appointments found</p>
            </div>
          ) : (
            appointments.map((appointment) => (
              <div
                key={appointment.id}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-2xl font-bold text-white">{appointment.patient_name}</h3>
                      <span className={`px-3 py-1 text-sm rounded-full border capitalize ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </div>
                    <div className="space-y-2 text-slate-300">
                      <div>
                        <span className="font-semibold">Date & Time:</span>{' '}
                        {formatDate(appointment.appointment_date)}
                      </div>
                      {appointment.appointment_type && (
                        <div>
                          <span className="font-semibold">Type:</span> {appointment.appointment_type}
                        </div>
                      )}
                      {appointment.agent_name && (
                        <div>
                          <span className="font-semibold">Created via:</span>{' '}
                          <span className="text-teal-300">{appointment.agent_name}</span>
                          {appointment.agent_type && (
                            <span className="text-slate-400 text-sm ml-2">({appointment.agent_type})</span>
                          )}
                        </div>
                      )}
                      {!appointment.agent_name && (
                        <div className="text-slate-400 text-sm italic">
                          Manually created (not linked to an agent)
                        </div>
                      )}
                      {appointment.patient_phone && (
                        <div>
                          <span className="font-semibold">Phone:</span> {appointment.patient_phone}
                        </div>
                      )}
                      {appointment.patient_email && (
                        <div>
                          <span className="font-semibold">Email:</span> {appointment.patient_email}
                        </div>
                      )}
                      {appointment.notes && (
                        <div>
                          <span className="font-semibold">Notes:</span> {appointment.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {appointment.status === 'scheduled' && (
                      <>
                        <button
                          onClick={() => setShowReminderModal(appointment)}
                          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm transition-colors"
                        >
                          Send Reminder
                        </button>
                        <button
                          onClick={() => handleCancel(appointment)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Create Appointment</h2>
            <form onSubmit={handleCreate}>
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Patient Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.patient_name}
                    onChange={(e) => setFormData({ ...formData, patient_name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={formData.patient_phone}
                    onChange={(e) => setFormData({ ...formData, patient_phone: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.patient_email}
                    onChange={(e) => setFormData({ ...formData, patient_email: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Date *</label>
                  <input
                    type="date"
                    required
                    value={formData.appointment_date}
                    onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Time *</label>
                  <input
                    type="time"
                    required
                    value={formData.appointment_time}
                    onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Appointment Type</label>
                  <input
                    type="text"
                    value={formData.appointment_type}
                    onChange={(e) => setFormData({ ...formData, appointment_type: e.target.value })}
                    placeholder="e.g., General Checkup, Follow-up"
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reminder Modal */}
      {showReminderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4">Send Reminder</h2>
            <p className="text-slate-300 mb-4">
              Send reminder to {showReminderModal.patient_name} for appointment on {formatDate(showReminderModal.appointment_date)}
            </p>
            <div className="space-y-3">
              {showReminderModal.patient_phone && (
                <button
                  onClick={() => handleSendReminder('sms')}
                  disabled={sendingReminder}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingReminder ? 'Sending...' : 'Send SMS Reminder'}
                </button>
              )}
              {showReminderModal.patient_email && (
                <button
                  onClick={() => handleSendReminder('email')}
                  disabled={sendingReminder}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingReminder ? 'Sending...' : 'Send Email Reminder'}
                </button>
              )}
              {showReminderModal.patient_phone && showReminderModal.patient_email && (
                <button
                  onClick={() => handleSendReminder('both')}
                  disabled={sendingReminder}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingReminder ? 'Sending...' : 'Send Both (SMS + Email)'}
                </button>
              )}
            </div>
            <button
              onClick={() => setShowReminderModal(null)}
              className="mt-4 w-full px-4 py-2 bg-slate-700/50 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

