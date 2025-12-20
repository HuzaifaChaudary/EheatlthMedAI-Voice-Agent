'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Save, Plus, Trash2, Edit2, Shield, Users, Building2, 
  CreditCard, Key, RefreshCw, Check, X, Eye, EyeOff, AlertTriangle,
  Mail, Phone, Globe, MapPin
} from 'lucide-react'
import { get, post, put, del } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface Organization {
  id: number
  name: string
  subdomain: string
  domain: string
  subscription_tier: string
  max_agents: number
  max_users: number
  max_calls_per_month: number
  is_active: boolean
  contact_email?: string
  contact_phone?: string
  address?: string
  website?: string
}

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  created_at: string
}

interface EncryptionKey {
  id: number
  key_name: string
  key_type: string
  algorithm: string
  is_active: boolean
  created_at: string
  expires_at: string | null
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

export default function SettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [orgForm, setOrgForm] = useState({
    name: '',
    subdomain: '',
    domain: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    website: ''
  })

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user'
  })
  const [showPassword, setShowPassword] = useState(false)

  // Security state
  const [encryptionKeys, setEncryptionKeys] = useState<EncryptionKey[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [securityLoading, setSecurityLoading] = useState(false)
  const [showAddKey, setShowAddKey] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')

  // Billing state
  const [billingStats, setBillingStats] = useState({
    agentsUsed: 0,
    totalAgents: 5,
    callsThisMonth: 0,
    maxCalls: 1000
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchOrganization()
  }, [router])

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'security') {
      fetchSecurityData()
    } else if (activeTab === 'billing') {
      fetchBillingData()
    }
  }, [activeTab])

  const fetchOrganization = async () => {
    try {
      setLoading(true)
      const response = await get('/organizations/me')
      if (response.data?.organization) {
        const org = response.data.organization
        setOrganization(org)
        setOrgForm({
          name: org.name || '',
          subdomain: org.subdomain || '',
          domain: org.domain || '',
          contact_email: org.contact_email || '',
          contact_phone: org.contact_phone || '',
          address: org.address || '',
          website: org.website || ''
        })
      } else {
        // No organization - set defaults
        setOrganization(null)
        setOrgForm({
          name: 'My Organization',
          subdomain: '',
          domain: '',
          contact_email: '',
          contact_phone: '',
          address: '',
          website: ''
        })
      }
    } catch (err) {
      console.error('Error fetching organization:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const response = await post('/organizations/me', {
        name: orgForm.name || 'My Organization',
        subdomain: orgForm.subdomain,
        subscription_tier: 'professional',
        max_agents: 10,
        max_users: 20,
        max_calls_per_month: 5000
      })
      if (response.error) {
        showMessage('error', response.error)
      } else if (response.data?.organization) {
        setOrganization(response.data.organization)
        showMessage('success', 'Organization created successfully!')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to create organization')
    } finally {
      setSaving(false)
    }
  }

  const fetchUsers = async () => {
    try {
      setUsersLoading(true)
      const response = await get('/admin/users?limit=50')
      if (response.data?.users) {
        setUsers(response.data.users)
      }
    } catch (err) {
      console.error('Error fetching users:', err)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchSecurityData = async () => {
    try {
      setSecurityLoading(true)
      const [keysRes, logsRes] = await Promise.all([
        get('/security/encryption-keys'),
        get('/admin/audit-logs?limit=20')
      ])
      if (keysRes.data?.keys) setEncryptionKeys(keysRes.data.keys)
      if (logsRes.data?.logs) setAuditLogs(logsRes.data.logs)
    } catch (err) {
      console.error('Error fetching security data:', err)
    } finally {
      setSecurityLoading(false)
    }
  }

  const fetchBillingData = async () => {
    try {
      // Fetch agents count
      const agentsRes = await get('/agents')
      const agentsCount = agentsRes.data?.agents?.length || 0

      // Fetch call stats for this month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
      
      const analyticsRes = await get(`/analytics/dashboard?start_date=${startOfMonth}&end_date=${endOfMonth}`)
      const callsThisMonth = analyticsRes.data?.callStats?.total_calls || 0

      setBillingStats({
        agentsUsed: agentsCount,
        totalAgents: organization?.max_agents || 5,
        callsThisMonth: callsThisMonth,
        maxCalls: organization?.max_calls_per_month || 1000
      })
    } catch (err) {
      console.error('Error fetching billing data:', err)
    }
  }

  const handleSaveOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const response = await put('/organizations/me', orgForm)
      if (response.error) {
        showMessage('error', response.error)
      } else if (response.data?.organization) {
        setOrganization(response.data.organization)
        showMessage('success', 'Organization settings updated successfully!')
      } else {
        // If we got a 200 response without error, consider it success
        showMessage('success', 'Organization settings updated successfully!')
        // Refresh the data
        fetchOrganization()
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const response = await post('/admin/users', newUser)
      if (response.data?.user) {
        setUsers([response.data.user, ...users])
        setShowAddUser(false)
        setNewUser({ email: '', password: '', firstName: '', lastName: '', role: 'user' })
        showMessage('success', 'User created successfully!')
      } else if (response.error) {
        showMessage('error', response.error)
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await put(`/admin/users/${userId}`, { is_active: !currentStatus })
      if (response.data) {
        setUsers(users.map(u => u.id === userId ? { ...u, is_active: !currentStatus } : u))
        showMessage('success', `User ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return
    try {
      await del(`/admin/users/${userId}`)
      setUsers(users.filter(u => u.id !== userId))
      showMessage('success', 'User deleted successfully!')
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to delete user')
    }
  }

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      showMessage('error', 'Key name is required')
      return
    }
    try {
      setSaving(true)
      const response = await post('/security/encryption-keys', {
        key_name: newKeyName,
        key_type: 'data_at_rest',
        algorithm: 'AES-256'
      })
      if (response.data?.key) {
        setEncryptionKeys([response.data.key, ...encryptionKeys])
        setShowAddKey(false)
        setNewKeyName('')
        showMessage('success', 'Encryption key created successfully!')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to create encryption key')
    } finally {
      setSaving(false)
    }
  }

  const handleRotateKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to rotate this key? This will create a new key and mark the old one as inactive.')) return
    try {
      const response = await post(`/security/encryption-keys/${keyId}/rotate`)
      if (response.data) {
        fetchSecurityData()
        showMessage('success', 'Key rotated successfully!')
      }
    } catch (err: any) {
      showMessage('error', err.message || 'Failed to rotate key')
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const tabs = [
    { id: 'profile', label: 'Organization Profile', icon: Building2 },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'security', label: 'Security & Access', icon: Shield },
    { id: 'billing', label: 'Billing & Subscription', icon: CreditCard }
  ]

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
          <span className="text-xl font-semibold">Settings</span>
        </div>
        <Link href="/dashboard" className="text-white hover:text-slate-300 text-sm flex items-center gap-1 transition-colors">
          <ChevronLeft size={16} /> Dashboard
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

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Organization Settings</h1>
          <p className="text-slate-400">Manage your organization profile, team members, and security preferences.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors flex items-center gap-3 ${
                    activeTab === tab.id
                      ? 'bg-teal-600/20 text-teal-300 border-l-2 border-teal-500'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white border-l-2 border-transparent'
                  }`}
                >
                  <tab.icon size={18} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Organization Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                  <Building2 size={24} className="text-teal-400" />
                  Profile Information
                </h2>

                {/* Show create organization prompt if no organization exists */}
                {!organization && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
                    <p className="text-yellow-400 font-medium mb-2">No Organization Set Up</p>
                    <p className="text-sm text-slate-300 mb-4">
                      Create an organization to manage your AI agents, team members, and billing.
                    </p>
                  </div>
                )}

                <form onSubmit={organization ? handleSaveOrganization : handleCreateOrganization} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm mb-2">Organization Name</label>
                      <input
                        value={orgForm.name}
                        onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                        placeholder="Your Organization Name"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm mb-2">Subdomain</label>
                      <div className="flex">
                        <input
                          value={orgForm.subdomain}
                          onChange={(e) => setOrgForm({ ...orgForm, subdomain: e.target.value })}
                          className="flex-1 bg-slate-950/50 border border-white/10 rounded-l-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                          placeholder="yourcompany"
                        />
                        <span className="bg-slate-800 border border-white/10 border-l-0 rounded-r-lg px-3 py-2.5 text-slate-400 text-sm">
                          .ehealthmedai.com
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 text-sm mb-2 flex items-center gap-2">
                        <Mail size={14} /> Contact Email
                      </label>
                      <input
                        type="email"
                        value={orgForm.contact_email}
                        onChange={(e) => setOrgForm({ ...orgForm, contact_email: e.target.value })}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                        placeholder="contact@yourcompany.com"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 text-sm mb-2 flex items-center gap-2">
                        <Phone size={14} /> Phone Number
                      </label>
                      <input
                        type="tel"
                        value={orgForm.contact_phone}
                        onChange={(e) => setOrgForm({ ...orgForm, contact_phone: e.target.value })}
                        className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm mb-2 flex items-center gap-2">
                      <Globe size={14} /> Website
                    </label>
                    <input
                      type="url"
                      value={orgForm.website}
                      onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                      placeholder="https://yourcompany.com"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm mb-2 flex items-center gap-2">
                      <MapPin size={14} /> Address
                    </label>
                    <input
                      value={orgForm.address}
                      onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                      className="w-full bg-slate-950/50 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-teal-500"
                      placeholder="123 Main St, City, State 12345"
                    />
                  </div>

                  {/* Subscription Info (Read-only) */}
                  {organization && (
                    <div className="pt-4 border-t border-white/10">
                      <h3 className="text-sm font-medium text-slate-300 mb-3">Subscription Details</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-slate-950/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400">Plan</p>
                          <p className="font-medium capitalize">{organization.subscription_tier || 'Free'}</p>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400">Max Agents</p>
                          <p className="font-medium">{organization.max_agents || 5}</p>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400">Max Users</p>
                          <p className="font-medium">{organization.max_users || 10}</p>
                        </div>
                        <div className="bg-slate-950/50 rounded-lg p-3">
                          <p className="text-xs text-slate-400">Calls/Month</p>
                          <p className="font-medium">{organization.max_calls_per_month || 1000}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : organization ? (
                        <><Save size={18} /> Save Changes</>
                      ) : (
                        <><Plus size={18} /> Create Organization</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Users size={24} className="text-blue-400" />
                      Team Members
                    </h2>
                    <button
                      onClick={() => setShowAddUser(!showAddUser)}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus size={18} /> Add User
                    </button>
                  </div>

                  {/* Add User Form */}
                  {showAddUser && (
                    <form onSubmit={handleAddUser} className="bg-slate-950/50 rounded-lg p-4 mb-6 border border-white/10">
                      <h3 className="font-medium mb-4">Add New User</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <input
                          value={newUser.firstName}
                          onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                          placeholder="First Name"
                          required
                          className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <input
                          value={newUser.lastName}
                          onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                          placeholder="Last Name"
                          required
                          className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <input
                          type="email"
                          value={newUser.email}
                          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                          placeholder="Email"
                          required
                          className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                        />
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={newUser.password}
                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                            placeholder="Password"
                            required
                            minLength={6}
                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <select
                          value={newUser.role}
                          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                          className="bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="doctor">Doctor</option>
                          <option value="patient">Patient</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={saving}
                          className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2"
                        >
                          <Check size={16} /> Create User
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddUser(false)}
                          className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Users List */}
                  {usersLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                    </div>
                  ) : users.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No users found</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">User</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Role</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Status</th>
                            <th className="text-left py-3 px-4 text-slate-400 font-medium">Joined</th>
                            <th className="text-right py-3 px-4 text-slate-400 font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user) => (
                            <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                              <td className="py-3 px-4">
                                <div>
                                  <p className="font-medium">{user.first_name} {user.last_name}</p>
                                  <p className="text-xs text-slate-400">{user.email}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  user.role === 'admin' ? 'bg-purple-500/20 text-purple-400' :
                                  user.role === 'doctor' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-slate-500/20 text-slate-400'
                                }`}>
                                  {user.role}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  user.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                  {user.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-slate-400">
                                {new Date(user.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                    className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                                    title={user.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {user.is_active ? <X size={16} /> : <Check size={16} />}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400"
                                    title="Delete"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Security & Access Tab */}
            {activeTab === 'security' && (
              <div className="space-y-6">
                {/* Encryption Keys */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Key size={24} className="text-yellow-400" />
                      Encryption Keys
                    </h2>
                    <button
                      onClick={() => setShowAddKey(!showAddKey)}
                      className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus size={18} /> Create Key
                    </button>
                  </div>

                  {showAddKey && (
                    <div className="bg-slate-950/50 rounded-lg p-4 mb-6 border border-white/10 flex gap-4">
                      <input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Key Name (e.g., PHI Data Key)"
                        className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white"
                      />
                      <button
                        onClick={handleCreateKey}
                        disabled={saving}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                      >
                        <Check size={16} /> Create
                      </button>
                      <button
                        onClick={() => { setShowAddKey(false); setNewKeyName(''); }}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {securityLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
                    </div>
                  ) : encryptionKeys.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <Key size={48} className="mx-auto mb-2 opacity-50" />
                      <p>No encryption keys configured</p>
                      <p className="text-sm mt-1">Create a key for HIPAA-compliant data encryption</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {encryptionKeys.map((key) => (
                        <div key={key.id} className="bg-slate-950/50 rounded-lg p-4 border border-white/5 flex items-center justify-between">
                          <div>
                            <p className="font-medium">{key.key_name}</p>
                            <p className="text-xs text-slate-400">
                              {key.algorithm} • {key.key_type} • Created {new Date(key.created_at).toLocaleDateString()}
                            </p>
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
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Audit Logs */}
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                  <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                    <Shield size={24} className="text-green-400" />
                    Recent Audit Logs
                  </h2>

                  {auditLogs.length === 0 ? (
                    <p className="text-center text-slate-400 py-8">No audit logs available</p>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log.id} className="bg-slate-950/50 rounded-lg p-3 border border-white/5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-teal-400">{log.action}</span>
                            <span className="text-xs text-slate-400">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-slate-400 text-xs mt-1">
                            {log.resource_type} • User ID: {log.user_id}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 text-center">
                    <Link href="/architecture" className="text-teal-400 hover:text-teal-300 text-sm">
                      View System Architecture →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <h2 className="text-xl font-semibold flex items-center gap-2 mb-6">
                  <CreditCard size={24} className="text-green-400" />
                  Billing & Subscription
                </h2>

                <div className="space-y-6">
                  {/* Current Plan */}
                  <div className="bg-gradient-to-r from-teal-600/20 to-blue-600/20 rounded-xl p-6 border border-teal-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-300">Current Plan</p>
                        <p className="text-2xl font-bold capitalize">{organization?.subscription_tier || 'Free'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {organization?.is_active ? '✓ Active' : '✗ Inactive'}
                        </p>
                      </div>
                      <button className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg font-medium">
                        Upgrade Plan
                      </button>
                    </div>
                  </div>

                  {/* Usage Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                      <p className="text-xs text-slate-400 mb-1">Agents Used</p>
                      <p className="text-2xl font-bold">
                        {billingStats.agentsUsed} 
                        <span className="text-sm text-slate-400">/ {billingStats.totalAgents}</span>
                      </p>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-teal-500 rounded-full transition-all" 
                          style={{ width: `${Math.min((billingStats.agentsUsed / billingStats.totalAgents) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                      <p className="text-xs text-slate-400 mb-1">Team Members</p>
                      <p className="text-2xl font-bold">
                        {users.length} 
                        <span className="text-sm text-slate-400">/ {organization?.max_users || 10}</span>
                      </p>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 rounded-full transition-all" 
                          style={{ width: `${Math.min((users.length / (organization?.max_users || 10)) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                      <p className="text-xs text-slate-400 mb-1">Calls This Month</p>
                      <p className="text-2xl font-bold">
                        {billingStats.callsThisMonth} 
                        <span className="text-sm text-slate-400">/ {billingStats.maxCalls}</span>
                      </p>
                      <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 rounded-full transition-all" 
                          style={{ width: `${Math.min((billingStats.callsThisMonth / billingStats.maxCalls) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Plan Features */}
                  <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                    <h3 className="font-medium mb-3">Plan Features</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>Up to {billingStats.totalAgents} AI Agents</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>Up to {organization?.max_users || 10} Team Members</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>{billingStats.maxCalls.toLocaleString()} Calls/Month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>HIPAA Compliance</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>24/7 Support</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={16} className="text-green-400" />
                        <span>Custom Integrations</span>
                      </div>
                    </div>
                  </div>

                  {/* Billing Info */}
                  <div className="border-t border-white/10 pt-6">
                    <h3 className="font-medium mb-4">Payment Information</h3>
                    <div className="bg-slate-950/50 rounded-lg p-4 border border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded flex items-center justify-center text-xs font-bold">
                          VISA
                        </div>
                        <div>
                          <p className="font-medium">•••• •••• •••• 4242</p>
                          <p className="text-xs text-slate-400">Expires 12/25</p>
                        </div>
                      </div>
                      <button className="text-teal-400 hover:text-teal-300 text-sm">
                        Update
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      * Payment processing is simulated for demo purposes
                    </p>
                  </div>

                  {/* Billing History Link */}
                  <div className="text-center pt-4">
                    <Link href="/billing" className="text-teal-400 hover:text-teal-300 text-sm">
                      View Billing Dashboard & Payment History →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
