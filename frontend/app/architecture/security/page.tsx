'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Shield, Key, Lock, RefreshCw, Plus, Trash2,
  Check, AlertTriangle, Eye, EyeOff, Clock, FileText
} from 'lucide-react'
import { get, post, del } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface EncryptionKey {
  id: number
  key_name: string
  key_type: string
  algorithm: string
  is_active: boolean
  created_at: string
  expires_at: string | null
  rotation_date: string | null
}

interface AuditLog {
  id: number
  user_id: number
  action: string
  resource_type: string
  details: string
  created_at: string
  user_email?: string
}

export default function SecurityPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const [encryptionKeys, setEncryptionKeys] = useState<EncryptionKey[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [showCreateKey, setShowCreateKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyType, setNewKeyType] = useState('data_at_rest')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchData()
  }, [router])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [keysRes, logsRes] = await Promise.all([
        get('/security/encryption-keys'),
        get('/admin/audit-logs?limit=20')
      ])
      if (keysRes.data?.keys) setEncryptionKeys(keysRes.data.keys)
      if (logsRes.data?.logs) setAuditLogs(logsRes.data.logs)
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      showMessage('error', 'Key name is required')
      return
    }
    try {
      setCreating(true)
      const response = await post('/security/encryption-keys', {
        key_name: newKeyName,
        key_type: newKeyType,
        algorithm: 'AES-256'
      })
      if (response.data?.key) {
        setEncryptionKeys([response.data.key, ...encryptionKeys])
        setShowCreateKey(false)
        setNewKeyName('')
        showMessage('success', 'Encryption key created successfully!')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  const handleRotateKey = async (keyId: number) => {
    if (!confirm('Rotate this key? A new key will be created and the old one deactivated.')) return
    try {
      await post(`/security/encryption-keys/${keyId}/rotate`)
      fetchData()
      showMessage('success', 'Key rotated successfully!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to rotate key')
    }
  }

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm('Delete this key? This action cannot be undone.')) return
    try {
      await del(`/security/encryption-keys/${keyId}`)
      setEncryptionKeys(encryptionKeys.filter(k => k.id !== keyId))
      showMessage('success', 'Key deleted successfully!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to delete key')
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center space-x-3">
          <Shield size={28} className="text-teal-400" />
          <span className="text-xl font-semibold">Data & Security</span>
        </div>
        <Link href="/architecture" className="text-white hover:text-slate-300 text-sm flex items-center gap-1">
          <ChevronLeft size={16} /> Architecture
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
            {message.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
            {message.text}
          </div>
        )}

        {/* Hero */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Security & Encryption</h1>
          <p className="text-slate-300 text-lg max-w-3xl">
            HIPAA-compliant encryption keys, access controls, and audit logging. 
            All PHI is encrypted at rest (AES-256) and in transit (TLS 1.2/1.3).
          </p>
        </div>

        {/* Security Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Key size={24} className="text-yellow-400 mb-2" />
            <p className="text-2xl font-bold">{encryptionKeys.filter(k => k.is_active).length}</p>
            <p className="text-sm text-slate-400">Active Keys</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Lock size={24} className="text-green-400 mb-2" />
            <p className="text-2xl font-bold">AES-256</p>
            <p className="text-sm text-slate-400">Encryption</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield size={24} className="text-blue-400 mb-2" />
            <p className="text-2xl font-bold">TLS 1.3</p>
            <p className="text-sm text-slate-400">In Transit</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <FileText size={24} className="text-purple-400 mb-2" />
            <p className="text-2xl font-bold">{auditLogs.length}+</p>
            <p className="text-sm text-slate-400">Audit Logs</p>
          </div>
        </div>

        {/* Encryption Keys */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Key size={24} className="text-yellow-400" />
              <h2 className="text-xl font-bold">Encryption Keys</h2>
            </div>
            <button
              onClick={() => setShowCreateKey(!showCreateKey)}
              className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Plus size={16} />
              Create Key
            </button>
          </div>

          {/* Create Key Form */}
          {showCreateKey && (
            <div className="bg-slate-950 rounded-lg p-4 mb-6 border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key Name (e.g., PHI Data Key)"
                  className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                />
                <select
                  value={newKeyType}
                  onChange={(e) => setNewKeyType(e.target.value)}
                  className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                >
                  <option value="data_at_rest">Data at Rest</option>
                  <option value="data_in_transit">Data in Transit</option>
                  <option value="backup">Backup Encryption</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateKey}
                    disabled={creating}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                  <button
                    onClick={() => setShowCreateKey(false)}
                    className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Keys List */}
          {encryptionKeys.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Key size={48} className="mx-auto mb-2 opacity-50" />
              <p>No encryption keys configured</p>
              <p className="text-sm mt-1">Create a key for HIPAA-compliant data encryption</p>
            </div>
          ) : (
            <div className="space-y-3">
              {encryptionKeys.map((key) => (
                <div 
                  key={key.id} 
                  className="bg-slate-950/50 rounded-lg p-4 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${key.is_active ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                      <Key size={20} className={key.is_active ? 'text-green-400' : 'text-slate-400'} />
                    </div>
                    <div>
                      <p className="font-medium">{key.key_name}</p>
                      <p className="text-xs text-slate-400">
                        {key.algorithm} • {key.key_type.replace('_', ' ')} • 
                        Created {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      key.is_active ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {key.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => handleRotateKey(key.id)}
                      className="p-2 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                      title="Rotate Key"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteKey(key.id)}
                      className="p-2 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                      title="Delete Key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Logs */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <div className="flex items-center gap-3 mb-6">
            <FileText size={24} className="text-purple-400" />
            <h2 className="text-xl font-bold">Recent Audit Logs</h2>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No audit logs available</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div 
                  key={log.id} 
                  className="bg-slate-950/50 rounded-lg p-3 border border-white/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      log.action.includes('CREATE') ? 'bg-green-500/20' :
                      log.action.includes('DELETE') ? 'bg-red-500/20' :
                      log.action.includes('LOGIN') ? 'bg-blue-500/20' :
                      'bg-slate-500/20'
                    }`}>
                      {log.action.includes('CREATE') ? <Plus size={16} className="text-green-400" /> :
                       log.action.includes('DELETE') ? <Trash2 size={16} className="text-red-400" /> :
                       log.action.includes('LOGIN') ? <Lock size={16} className="text-blue-400" /> :
                       <FileText size={16} className="text-slate-400" />}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{log.action}</p>
                      <p className="text-xs text-slate-400">
                        {log.resource_type || 'System'} • User ID: {log.user_id}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* HIPAA Compliance Note */}
        <div className="mt-8 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
          <h3 className="font-bold text-green-300 mb-2">HIPAA Compliance</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>✓ All PHI encrypted at rest using AES-256</li>
            <li>✓ All data in transit encrypted with TLS 1.2/1.3</li>
            <li>✓ Complete audit trail of all data access</li>
            <li>✓ Role-based access control (RBAC) enforced</li>
            <li>✓ Automatic key rotation support</li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/architecture/access-policies"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Lock size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Access Policies</p>
              <p className="text-xs text-slate-400">RBAC and permissions</p>
            </div>
          </Link>
          <Link 
            href="/dashboard/settings?tab=security"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Shield size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Security Settings</p>
              <p className="text-xs text-slate-400">Organization security config</p>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}

