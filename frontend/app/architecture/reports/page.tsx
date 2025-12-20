'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { post, get } from '@/lib/api'
import { sanitizeInput } from '@/lib/security'
import { isAuthenticated, getAuthHeader } from '@/lib/auth'

interface ReportTemplate {
  id: number
  name: string
  type: string
  description: string | null
  format: string
  schedule: string | null
  recipients: string[]
  created_at: string
}

interface GeneratedReport {
  id: number
  template_id: number
  template_name: string
  template_type: string
  status: string
  format: string
  completed_at: string | null
  created_at: string
  parameters: any
}

export default function ReportsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'templates' | 'generated' | 'builder' | 'scheduled'>('templates')
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'call_analytics',
    description: '',
    format: 'pdf',
    schedule: '',
    recipients: [] as string[]
  })
  const [generateFormData, setGenerateFormData] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    organization_id: null as number | null
  })
  // Custom builder state
  const [customBuilderMetrics, setCustomBuilderMetrics] = useState<string[]>(['call_volume', 'agent_performance'])
  const [customBuilderFilters, setCustomBuilderFilters] = useState({
    agent: '',
    status: '',
    direction: ''
  })

  const reportTypes = [
    { value: 'call_analytics', label: 'Call Analytics' },
    { value: 'agent_performance', label: 'Agent Performance' },
    { value: 'conversation_log', label: 'Conversation Log' },
    { value: 'billing_summary', label: 'Billing Summary' }
  ]

  const formats = [
    { value: 'pdf', label: 'PDF' },
    { value: 'xlsx', label: 'Excel (XLSX)' },
    { value: 'csv', label: 'CSV' },
    { value: 'html', label: 'HTML' }
  ]

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchTemplates()
    fetchGeneratedReports()
  }, [router])

  const fetchTemplates = async () => {
    try {
      const response = await get('/reports/templates')
      if (response.data?.templates) {
        setTemplates(response.data.templates)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGeneratedReports = async () => {
    try {
      const response = await get('/reports/generated')
      if (response.data?.reports) {
        setGeneratedReports(response.data.reports)
      }
    } catch (error) {
      console.error('Error fetching generated reports:', error)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleEditScheduledReport = (template: ReportTemplate) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      type: template.type,
      description: template.description || '',
      format: template.format,
      schedule: template.schedule || '',
      recipients: template.recipients || []
    })
    setShowEditModal(true)
  }

  const handleUpdateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    setCreateError('')
    setCreateLoading(true)

    try {
      const response = await post(`/reports/templates/${selectedTemplate.id}`, {
        name: sanitizeInput(formData.name),
        type: formData.type,
        description: formData.description ? sanitizeInput(formData.description) : null,
        format: formData.format,
        schedule: formData.schedule || null,
        recipients: formData.recipients,
        query_config: {}
      })

      if (response.error) {
        setCreateError(response.error || 'Failed to update template')
        return
      }

      showMessage('success', 'Template updated successfully!')
      setShowEditModal(false)
      setSelectedTemplate(null)
      fetchTemplates()
    } catch (error: any) {
      setCreateError(error.message || 'Error updating template')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDisableSchedule = async (template: ReportTemplate) => {
    if (!confirm(`Disable schedule for "${template.name}"?`)) return

    try {
      const response = await post(`/reports/templates/${template.id}`, {
        ...template,
        schedule: null,
        recipients: []
      })

      if (response.error) {
        showMessage('error', response.error || 'Failed to disable schedule')
        return
      }

      showMessage('success', 'Schedule disabled successfully!')
      fetchTemplates()
    } catch (error: any) {
      showMessage('error', error.message || 'Error disabling schedule')
    }
  }

  const handleSaveAsTemplate = async () => {
    if (!formData.name) {
      const name = prompt('Enter a name for this template:')
      if (!name) return
      setFormData(prev => ({ ...prev, name }))
    }

    setCreateLoading(true)
    try {
      const response = await post('/reports/templates', {
        name: formData.name || 'Custom Report',
        type: 'custom',
        description: `Custom report with metrics: ${customBuilderMetrics.join(', ')}`,
        format: formData.format,
        schedule: null,
        recipients: [],
        query_config: {
          metrics: customBuilderMetrics,
          filters: customBuilderFilters
        }
      })

      if (response.error) {
        showMessage('error', response.error || 'Failed to save template')
        return
      }

      showMessage('success', 'Template saved successfully!')
      fetchTemplates()
      setActiveTab('templates')
    } catch (error: any) {
      showMessage('error', error.message || 'Error saving template')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleGenerateCustomReport = async () => {
    setCreateLoading(true)
    try {
      // First create a temporary template
      const templateResponse = await post('/reports/templates', {
        name: `Custom Report - ${new Date().toLocaleDateString()}`,
        type: 'custom',
        description: `Custom report with metrics: ${customBuilderMetrics.join(', ')}`,
        format: formData.format,
        schedule: null,
        recipients: [],
        query_config: {
          metrics: customBuilderMetrics,
          filters: customBuilderFilters
        }
      })

      if (templateResponse.error) {
        showMessage('error', templateResponse.error || 'Failed to create custom report')
        return
      }

      const templateId = templateResponse.data?.template?.id
      if (!templateId) {
        showMessage('error', 'Failed to create custom report template')
        return
      }

      // Now generate the report
      const reportResponse = await post('/reports/generate', {
        template_id: templateId,
        parameters: {
          start_date: generateFormData.start_date,
          end_date: generateFormData.end_date,
          metrics: customBuilderMetrics,
          filters: customBuilderFilters
        }
      })

      if (reportResponse.error) {
        showMessage('error', reportResponse.error || 'Failed to generate report')
        return
      }

      showMessage('success', 'Custom report generated! Check the Generated Reports tab.')
      setTimeout(() => {
        fetchGeneratedReports()
        setActiveTab('generated')
      }, 2000)
    } catch (error: any) {
      showMessage('error', error.message || 'Error generating custom report')
    } finally {
      setCreateLoading(false)
    }
  }

  const toggleMetric = (metricId: string) => {
    setCustomBuilderMetrics(prev => 
      prev.includes(metricId) 
        ? prev.filter(m => m !== metricId)
        : [...prev, metricId]
    )
  }

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreateLoading(true)

    if (!formData.name || !formData.type) {
      setCreateError('Name and type are required')
      setCreateLoading(false)
      return
    }

    try {
      const response = await post('/reports/templates', {
        name: sanitizeInput(formData.name),
        type: formData.type,
        description: formData.description ? sanitizeInput(formData.description) : null,
        format: formData.format,
        schedule: formData.schedule || null,
        recipients: formData.recipients,
        query_config: {}
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to create template')
        return
      }

      if (response.data?.template) {
        await fetchTemplates()
        setFormData({
          name: '',
          type: 'call_analytics',
          description: '',
          format: 'pdf',
          schedule: '',
          recipients: []
        })
        setShowCreateModal(false)
      } else {
        setCreateError('Failed to create template')
      }
    } catch (error: any) {
      console.error('Error creating template:', error)
      setCreateError(error.message || 'Error creating template')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTemplate) return

    setCreateError('')
    setCreateLoading(true)

    try {
      const response = await post('/reports/generate', {
        template_id: selectedTemplate.id,
        parameters: {
          start_date: generateFormData.start_date,
          end_date: generateFormData.end_date,
          organization_id: generateFormData.organization_id
        }
      })

      if (response.error) {
        setCreateError(response.error || response.message || 'Failed to generate report')
        return
      }

      if (response.data?.report) {
        alert('Report generation started! It will be ready in a few seconds. Check the "Generated Reports" tab.')
        setShowGenerateModal(false)
        setSelectedTemplate(null)
        // Wait a bit then refresh
        setTimeout(() => {
          fetchGeneratedReports()
        }, 3000)
      } else {
        setCreateError('Failed to generate report')
      }
    } catch (error: any) {
      console.error('Error generating report:', error)
      setCreateError(error.message || 'Error generating report')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDownloadReport = async (report: GeneratedReport) => {
    if (report.status !== 'completed') {
      alert('Report is still being generated. Please wait a moment and try again.')
      return
    }

    try {
      // Use the API helper which handles auth automatically
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
      const authHeader = getAuthHeader()

      if (!authHeader) {
        alert('Please login again to download reports')
        router.push('/login')
        return
      }

      const response = await fetch(`${API_URL}/reports/${report.id}/download`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader
          // Don't set Content-Type for downloads - let the server set it
        },
        credentials: 'include'
      })

      if (!response.ok) {
        // Try to get error message, but don't fail if response isn't JSON
        let errorMessage = `Download failed: ${response.status} ${response.statusText}`
        try {
          const contentType = response.headers.get('content-type')
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json()
            errorMessage = errorData.message || errorData.error || errorMessage
          } else {
            const text = await response.text()
            if (text) errorMessage = text.substring(0, 200)
          }
        } catch (e) {
          // If we can't parse the error, use the default message
          console.error('Could not parse error response:', e)
        }
        throw new Error(errorMessage)
      }

      // Get the blob
      const blob = await response.blob()

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('content-disposition')
      let filename = `report-${report.id}.${report.format || 'pdf'}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create download link
      const fileUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(fileUrl)
        document.body.removeChild(a)
      }, 100)
    } catch (error: any) {
      console.error('Download error:', error)
      alert(`Failed to download report: ${error.message || 'Please try again.'}`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      <header className="container mx-auto px-6 py-6 flex justify-between items-center bg-transparent">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-semibold text-white">Report Management</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm">
          ← Architecture
        </Link>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500/20 text-green-400' 
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.type === 'success' ? '✓' : '⚠'}
            {message.text}
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Report Management</h1>
          <p className="text-slate-400 mt-2">Create report templates and generate downloadable reports in Excel, PDF, CSV, or HTML formats</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex space-x-4 border-b border-white/20">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'templates'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Report Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('generated')}
            className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'generated'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Generated Reports ({generatedReports.length})
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'builder'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Custom Builder
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-6 py-3 font-semibold transition-colors ${activeTab === 'scheduled'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
              }`}
          >
            Scheduled Reports ({templates.filter(t => t.schedule).length})
          </button>
        </div>

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div className="text-slate-300">
                {templates.length} {templates.length === 1 ? 'template' : 'templates'} configured
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
              >
                + Create Template
              </button>
            </div>

            {templates.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-slate-300 mb-4">No report templates configured yet.</div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Create Your First Template
                </button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{template.name}</h3>
                        <p className="text-slate-400 text-sm">{template.type.replace(/_/g, ' ')}</p>
                      </div>
                      <span className="px-2 py-1 text-xs rounded bg-teal-500/20 text-teal-300 border border-teal-500 uppercase">
                        {template.format}
                      </span>
                    </div>

                    {template.description && (
                      <p className="text-slate-300 text-sm mb-4">{template.description}</p>
                    )}

                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => {
                          setSelectedTemplate(template)
                          setShowGenerateModal(true)
                        }}
                        className="flex-1 bg-teal-600/20 hover:bg-teal-600/30 text-teal-300 px-4 py-2 rounded-lg text-sm transition-colors"
                      >
                        Generate Report
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Generated Reports Tab */}
        {activeTab === 'generated' && (
          <div>
            <div className="mb-6">
              <div className="text-slate-300">
                {generatedReports.length} {generatedReports.length === 1 ? 'report' : 'reports'} generated
              </div>
            </div>

            {generatedReports.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-slate-300 mb-4">No reports generated yet.</div>
                <p className="text-slate-400 text-sm">Go to "Report Templates" tab to create a template and generate your first report.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {generatedReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-white">{report.template_name}</h3>
                          <span className={`px-2 py-1 text-xs rounded ${report.status === 'completed'
                              ? 'bg-green-500/20 text-green-300 border border-green-500'
                              : report.status === 'generating'
                                ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500'
                                : 'bg-red-500/20 text-red-300 border border-red-500'
                            }`}>
                            {report.status}
                          </span>
                          <span className="px-2 py-1 text-xs rounded bg-teal-500/20 text-teal-300 border border-teal-500 uppercase">
                            {report.format || 'pdf'}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm mb-2">
                          Type: {report.template_type.replace(/_/g, ' ')}
                        </p>
                        <p className="text-slate-400 text-xs">
                          Created: {new Date(report.created_at).toLocaleString()}
                          {report.completed_at && (
                            <> | Completed: {new Date(report.completed_at).toLocaleString()}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {report.status === 'completed' ? (
                          <button
                            onClick={() => handleDownloadReport(report)}
                            className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            Download
                          </button>
                        ) : (
                          <button
                            disabled
                            className="bg-slate-600/50 text-slate-400 px-4 py-2 rounded-lg text-sm cursor-not-allowed"
                          >
                            Generating...
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create Template Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Create Report Template</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateTemplate} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g., Monthly Call Analytics"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Report Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  >
                    {reportTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Format *</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  >
                    {formats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    rows={3}
                    placeholder="Optional description for this template"
                  />
                </div>

                {/* Schedule Options */}
                <div>
                  <label className="block text-slate-300 mb-2">Schedule (Optional)</label>
                  <select
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">No Schedule (Manual Only)</option>
                    <option value="daily">Daily (every day at 6:00 AM)</option>
                    <option value="weekly">Weekly (every Monday at 6:00 AM)</option>
                    <option value="monthly">Monthly (1st of each month)</option>
                  </select>
                </div>

                {formData.schedule && (
                  <div>
                    <label className="block text-slate-300 mb-2">Email Recipients (comma-separated)</label>
                    <input
                      type="text"
                      placeholder="email1@example.com, email2@example.com"
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                      })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                    <p className="text-slate-400 text-xs mt-1">Reports will be automatically emailed to these addresses</p>
                  </div>
                )}

                {createError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Creating...' : 'Create Template'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Custom Builder Tab */}
        {activeTab === 'builder' && (
          <div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
              <h2 className="text-xl font-bold text-white mb-4">Custom Report Builder</h2>
              <p className="text-slate-400 mb-6">Build a custom report by selecting specific metrics, filters, and output format.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date Range */}
                <div>
                  <label className="block text-slate-300 mb-2">Date Range</label>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={generateFormData.start_date}
                      onChange={(e) => setGenerateFormData({ ...generateFormData, start_date: e.target.value })}
                      className="bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="date"
                      value={generateFormData.end_date}
                      onChange={(e) => setGenerateFormData({ ...generateFormData, end_date: e.target.value })}
                      className="bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                {/* Output Format */}
                <div>
                  <label className="block text-slate-300 mb-2">Output Format</label>
                  <select
                    value={formData.format}
                    onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    {formats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Metrics Selection */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Select Metrics to Include</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'call_volume', label: 'Call Volume', desc: 'Total calls, completed, failed' },
                  { id: 'call_duration', label: 'Call Duration', desc: 'Average and total duration' },
                  { id: 'agent_performance', label: 'Agent Performance', desc: 'Per-agent metrics' },
                  { id: 'scheduling', label: 'Scheduling Stats', desc: 'Appointment success rate' },
                  { id: 'billing', label: 'Billing Summary', desc: 'Payments and collections' },
                  { id: 'conversations', label: 'Conversation Logs', desc: 'Full transcripts' }
                ].map((metric) => (
                  <label
                    key={metric.id}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      customBuilderMetrics.includes(metric.id)
                        ? 'bg-teal-500/20 border-teal-500/50'
                        : 'bg-slate-800/50 border-white/10 hover:border-teal-500/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 w-4 h-4 text-teal-600 bg-slate-700 border-white/20 rounded focus:ring-teal-500"
                      checked={customBuilderMetrics.includes(metric.id)}
                      onChange={() => toggleMetric(metric.id)}
                    />
                    <div>
                      <p className="text-white font-medium">{metric.label}</p>
                      <p className="text-slate-400 text-xs">{metric.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-6">
              <h3 className="text-lg font-bold text-white mb-4">Filters (Optional)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-300 mb-2">Agent</label>
                  <select 
                    value={customBuilderFilters.agent}
                    onChange={(e) => setCustomBuilderFilters(prev => ({ ...prev, agent: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">All Agents</option>
                    <option value="front_desk">Front Desk Assistant</option>
                    <option value="medical">Medical Assistant</option>
                    <option value="triage">Triage Nurse</option>
                    <option value="billing">Billing Specialist</option>
                    <option value="collections">Collections Specialist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Call Status</label>
                  <select 
                    value={customBuilderFilters.status}
                    onChange={(e) => setCustomBuilderFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="failed">Failed</option>
                    <option value="missed">Missed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-2">Direction</label>
                  <select 
                    value={customBuilderFilters.direction}
                    onChange={(e) => setCustomBuilderFilters(prev => ({ ...prev, direction: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">All</option>
                    <option value="inbound">Inbound</option>
                    <option value="outbound">Outbound</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selected Metrics Summary */}
            {customBuilderMetrics.length > 0 && (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 mb-6">
                <p className="text-teal-300 text-sm">
                  <strong>Selected Metrics:</strong> {customBuilderMetrics.join(', ').replace(/_/g, ' ')}
                </p>
              </div>
            )}

            {/* Generate Button */}
            <div className="flex justify-end gap-4">
              <button 
                onClick={handleSaveAsTemplate}
                disabled={createLoading || customBuilderMetrics.length === 0}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? 'Saving...' : 'Save as Template'}
              </button>
              <button 
                onClick={handleGenerateCustomReport}
                disabled={createLoading || customBuilderMetrics.length === 0}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? 'Generating...' : 'Generate Custom Report'}
              </button>
            </div>
          </div>
        )}

        {/* Scheduled Reports Tab */}
        {activeTab === 'scheduled' && (
          <div>
            <div className="mb-6 flex justify-between items-center">
              <div className="text-slate-300">
                Schedule reports to be automatically generated and emailed
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors font-semibold"
              >
                + Schedule Report
              </button>
            </div>

            {/* Scheduled Reports List */}
            {templates.filter(t => t.schedule).length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
                <div className="text-6xl mb-4">📅</div>
                <div className="text-slate-300 mb-2">No scheduled reports yet</div>
                <p className="text-slate-400 text-sm mb-4">
                  Set up automatic report generation on a daily, weekly, or monthly schedule.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Create Scheduled Report
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.filter(t => t.schedule).map((template) => (
                  <div
                    key={template.id}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{template.name}</h3>
                        <p className="text-slate-400 text-sm">
                          Schedule: {template.schedule === 'daily' ? 'Daily (6:00 AM)' : 
                                    template.schedule === 'weekly' ? 'Weekly (Mondays at 6:00 AM)' :
                                    template.schedule === 'monthly' ? 'Monthly (1st of each month)' :
                                    template.schedule}
                        </p>
                        <p className="text-slate-400 text-xs mt-1">
                          Format: {template.format.toUpperCase()} | Type: {template.type.replace(/_/g, ' ')}
                        </p>
                        {template.recipients && template.recipients.length > 0 && (
                          <p className="text-slate-400 text-xs mt-1">
                            📧 Recipients: {template.recipients.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <span className="px-3 py-1 text-xs rounded bg-green-500/20 text-green-300 border border-green-500">
                          Active
                        </span>
                        <button 
                          onClick={() => handleEditScheduledReport(template)}
                          className="px-3 py-1 text-xs rounded bg-slate-600 hover:bg-slate-500 text-white transition-colors"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDisableSchedule(template)}
                          className="px-3 py-1 text-xs rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
                        >
                          Disable
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Schedule Options Info */}
            <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h3 className="font-bold text-blue-300 mb-2">Scheduling Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">📆</span>
                  <div>
                    <p className="font-medium">Daily</p>
                    <p className="text-slate-400 text-xs">Reports generated every day at specified time</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">📅</span>
                  <div>
                    <p className="font-medium">Weekly</p>
                    <p className="text-slate-400 text-xs">Reports generated every week on specified day</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400">🗓️</span>
                  <div>
                    <p className="font-medium">Monthly</p>
                    <p className="text-slate-400 text-xs">Reports generated on 1st of each month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Generate Report Modal */}
        {showGenerateModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Generate Report: {selectedTemplate.name}</h2>
                <button
                  onClick={() => {
                    setShowGenerateModal(false)
                    setSelectedTemplate(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGenerateReport} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={generateFormData.start_date}
                      onChange={(e) => setGenerateFormData({ ...generateFormData, start_date: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-2">End Date</label>
                    <input
                      type="date"
                      value={generateFormData.end_date}
                      onChange={(e) => setGenerateFormData({ ...generateFormData, end_date: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    />
                  </div>
                </div>

                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">
                    <strong>Format:</strong> {selectedTemplate.format.toUpperCase()}<br />
                    <strong>Type:</strong> {selectedTemplate.type.replace(/_/g, ' ')}
                  </p>
                </div>

                {createError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowGenerateModal(false)
                      setSelectedTemplate(null)
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Generating...' : 'Generate Report'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Template Modal */}
        {showEditModal && selectedTemplate && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Edit Scheduled Report</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedTemplate(null)
                  }}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateTemplate} className="space-y-4">
                <div>
                  <label className="block text-slate-300 mb-2">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 mb-2">Report Type</label>
                    <select
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    >
                      {reportTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-2">Format</label>
                    <select
                      value={formData.format}
                      onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                      className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    >
                      {formats.map((format) => (
                        <option key={format.value} value={format.value}>
                          {format.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Schedule</label>
                  <select
                    value={formData.schedule}
                    onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  >
                    <option value="">No Schedule (Manual Only)</option>
                    <option value="daily">Daily (every day at 6:00 AM)</option>
                    <option value="weekly">Weekly (every Monday at 6:00 AM)</option>
                    <option value="monthly">Monthly (1st of each month)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Email Recipients (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.recipients.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      recipients: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                    })}
                    placeholder="email1@example.com, email2@example.com"
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                    rows={2}
                  />
                </div>

                {createError && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300 text-sm">
                    {createError}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setSelectedTemplate(null)
                    }}
                    className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

