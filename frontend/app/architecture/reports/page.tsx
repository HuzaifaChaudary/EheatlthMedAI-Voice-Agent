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
  const [activeTab, setActiveTab] = useState<'templates' | 'generated'>('templates')
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            href="/architecture" 
            className="text-slate-400 hover:text-white mb-4 inline-block transition-colors"
          >
            ← Back to Architecture
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">Report Management</h1>
          <p className="text-slate-300">
            Create report templates and generate downloadable reports in Excel, PDF, CSV, or HTML formats
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex space-x-4 border-b border-white/20">
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'templates'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Report Templates ({templates.length})
          </button>
          <button
            onClick={() => setActiveTab('generated')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'generated'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Generated Reports ({generatedReports.length})
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
                          <span className={`px-2 py-1 text-xs rounded ${
                            report.status === 'completed'
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
                    <strong>Format:</strong> {selectedTemplate.format.toUpperCase()}<br/>
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
      </div>
    </div>
  )
}

