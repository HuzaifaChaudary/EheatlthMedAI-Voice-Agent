'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { get, put, post } from '@/lib/api'

interface ReminderConfig {
  id?: number
  organization_id: number
  twilio_account_sid: string | null
  twilio_phone_number: string | null
  twilio_enabled: boolean
  smtp_host: string
  smtp_port: number
  smtp_secure: boolean
  smtp_user: string | null
  smtp_from_name: string | null
  smtp_from_email: string | null
  smtp_enabled: boolean
  last_sms_test_at: string | null
  last_sms_test_status: string | null
  last_email_test_at: string | null
  last_email_test_status: string | null
}

export default function RemindersConfigPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingSMS, setTestingSMS] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [config, setConfig] = useState<ReminderConfig | null>(null)
  const [formData, setFormData] = useState({
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    twilio_enabled: false,
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: '',
    smtp_from_email: '',
    smtp_enabled: false
  })
  const [testData, setTestData] = useState({
    test_phone_number: '',
    test_email: ''
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchConfig()
  }, [router])

  const fetchConfig = async () => {
    try {
      const response = await get('/reminder-config')
      if (response.error) {
        console.error('Error fetching config:', response.error)
        return
      }

      if (response.data?.config) {
        const cfg = response.data.config
        setConfig(cfg)
        setFormData({
          twilio_account_sid: cfg.twilio_account_sid || '',
          twilio_auth_token: cfg.twilio_account_sid ? '***configured***' : '', // Don't show actual token
          twilio_phone_number: cfg.twilio_phone_number || '',
          twilio_enabled: cfg.twilio_enabled || false,
          smtp_host: cfg.smtp_host || 'smtp.gmail.com',
          smtp_port: cfg.smtp_port || 587,
          smtp_secure: cfg.smtp_secure || false,
          smtp_user: cfg.smtp_user || '',
          smtp_password: cfg.smtp_user ? '***configured***' : '', // Don't show actual password
          smtp_from_name: cfg.smtp_from_name || '',
          smtp_from_email: cfg.smtp_from_email || '',
          smtp_enabled: cfg.smtp_enabled || false
        })
      }
    } catch (error) {
      console.error('Error fetching config:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Don't send placeholder values
      const updateData: any = { ...formData }
      if (updateData.twilio_auth_token === '***configured***') {
        delete updateData.twilio_auth_token
      }
      if (updateData.smtp_password === '***configured***') {
        delete updateData.smtp_password
      }

      const response = await put('/reminder-config', updateData)

      if (response.error) {
        alert(`Error saving configuration: ${response.error}`)
        return
      }

      alert('Configuration saved successfully!')
      fetchConfig()
    } catch (error: any) {
      alert(`Error saving configuration: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTestSMS = async () => {
    if (!testData.test_phone_number) {
      alert('Please enter a test phone number')
      return
    }

    setTestingSMS(true)
    try {
      const response = await post('/reminder-config/test-sms', {
        test_phone_number: testData.test_phone_number
      })

      if (response.error) {
        alert(`Test failed: ${response.error}`)
      } else {
        alert('Test SMS sent successfully! Check the phone number.')
        fetchConfig() // Refresh to show test results
      }
    } catch (error: any) {
      alert(`Test failed: ${error.message}`)
    } finally {
      setTestingSMS(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testData.test_email) {
      alert('Please enter a test email address')
      return
    }

    setTestingEmail(true)
    try {
      const response = await post('/reminder-config/test-email', {
        test_email: testData.test_email
      })

      if (response.error) {
        alert(`Test failed: ${response.error}`)
      } else {
        alert('Test email sent successfully! Check your inbox.')
        fetchConfig() // Refresh to show test results
      }
    } catch (error: any) {
      alert(`Test failed: ${error.message}`)
    } finally {
      setTestingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading configuration...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
          ← Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Reminder Configuration</h1>
          <p className="text-slate-300">Configure SMS (Twilio) and Email (SMTP) settings for appointment reminders</p>
        </div>

        <form onSubmit={handleSave} className="space-y-8">
          {/* SMS/Twilio Configuration */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">SMS Configuration (Twilio)</h2>
                <p className="text-slate-300 text-sm">Configure Twilio credentials for SMS reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.twilio_enabled}
                  onChange={(e) => setFormData({ ...formData, twilio_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                <span className="ml-3 text-sm font-medium text-white">
                  {formData.twilio_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-2">Twilio Account SID</label>
                <input
                  type="text"
                  value={formData.twilio_account_sid}
                  onChange={(e) => setFormData({ ...formData, twilio_account_sid: e.target.value })}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Twilio Auth Token</label>
                <input
                  type="password"
                  value={formData.twilio_auth_token}
                  onChange={(e) => setFormData({ ...formData, twilio_auth_token: e.target.value })}
                  placeholder={formData.twilio_auth_token === '***configured***' ? 'Already configured (leave blank to keep)' : 'Enter auth token'}
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
                {formData.twilio_auth_token === '***configured***' && (
                  <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing token, or enter new token to update</p>
                )}
              </div>
              <div>
                <label className="block text-slate-300 mb-2">Twilio Phone Number</label>
                <input
                  type="tel"
                  value={formData.twilio_phone_number}
                  onChange={(e) => setFormData({ ...formData, twilio_phone_number: e.target.value })}
                  placeholder="+1234567890"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            {/* Test SMS */}
            {formData.twilio_enabled && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={testData.test_phone_number}
                    onChange={(e) => setTestData({ ...testData, test_phone_number: e.target.value })}
                    placeholder="Enter test phone number (+1234567890)"
                    className="flex-1 bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestSMS}
                    disabled={testingSMS}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingSMS ? 'Testing...' : 'Test SMS'}
                  </button>
                </div>
                {config?.last_sms_test_at && (
                  <p className="text-xs mt-2 text-slate-400">
                    Last test: {new Date(config.last_sms_test_at).toLocaleString()} - {config.last_sms_test_status === 'success' ? '✅ Success' : '❌ Failed'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Email/SMTP Configuration */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Email Configuration (SMTP)</h2>
                <p className="text-slate-300 text-sm">Configure SMTP settings for email reminders</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.smtp_enabled}
                  onChange={(e) => setFormData({ ...formData, smtp_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
                <span className="ml-3 text-sm font-medium text-white">
                  {formData.smtp_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-2">SMTP Host</label>
                <input
                  type="text"
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  placeholder="smtp.gmail.com"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">SMTP Port</label>
                <input
                  type="number"
                  value={formData.smtp_port}
                  onChange={(e) => setFormData({ ...formData, smtp_port: parseInt(e.target.value) })}
                  placeholder="587"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">SMTP User (Email)</label>
                <input
                  type="email"
                  value={formData.smtp_user}
                  onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  placeholder="your-email@gmail.com"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">SMTP Password</label>
                <input
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  placeholder={formData.smtp_password === '***configured***' ? 'Already configured (leave blank to keep)' : 'Enter password or app password'}
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
                {formData.smtp_password === '***configured***' && (
                  <p className="text-xs text-slate-400 mt-1">Leave blank to keep existing password, or enter new password to update</p>
                )}
              </div>
              <div>
                <label className="block text-slate-300 mb-2">From Name</label>
                <input
                  type="text"
                  value={formData.smtp_from_name}
                  onChange={(e) => setFormData({ ...formData, smtp_from_name: e.target.value })}
                  placeholder="Medical Practice"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-2">From Email</label>
                <input
                  type="email"
                  value={formData.smtp_from_email}
                  onChange={(e) => setFormData({ ...formData, smtp_from_email: e.target.value })}
                  placeholder="noreply@medicalpractice.com"
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.smtp_secure}
                  onChange={(e) => setFormData({ ...formData, smtp_secure: e.target.checked })}
                  className="w-4 h-4 text-teal-600 bg-slate-700 border-white/20 rounded focus:ring-teal-500"
                />
                <label className="ml-2 text-slate-300">Use SSL/TLS (usually for port 465)</label>
              </div>
            </div>

            {/* Test Email */}
            {formData.smtp_enabled && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testData.test_email}
                    onChange={(e) => setTestData({ ...testData, test_email: e.target.value })}
                    placeholder="Enter test email address"
                    className="flex-1 bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleTestEmail}
                    disabled={testingEmail}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testingEmail ? 'Testing...' : 'Test Email'}
                  </button>
                </div>
                {config?.last_email_test_at && (
                  <p className="text-xs mt-2 text-slate-400">
                    Last test: {new Date(config.last_email_test_at).toLocaleString()} - {config.last_email_test_status === 'success' ? '✅ Success' : '❌ Failed'}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}

