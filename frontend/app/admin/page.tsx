'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { clearAuth, isAuthenticated } from '@/lib/auth'
import { post, get, put } from '@/lib/api'
import { sanitizeInput, isValidEmail, validatePassword } from '@/lib/security'
import Logo from '@/components/Logo'

interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  created_at: string
}

interface Stats {
  users: number
  agents: number
  conversations: number
  appointments: number
}

interface Organization {
  id: number
  name: string
  subdomain: string
  domain: string
  subscription_tier: string
  is_active: boolean
  user_count: number
  agent_count: number
  phone_number_count: number
  created_at: string
}

interface OrganizationDetails {
  organization: Organization
  resources: {
    users: any[]
    agents: any[]
    phone_numbers: any[]
    stats: {
      total_calls: number
      unique_callers: number
      total_duration: number
    }
  }
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'organizations'>('users')
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<OrganizationDetails | null>(null)
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false)
  const [createOrgLoading, setCreateOrgLoading] = useState(false)
  const [createOrgError, setCreateOrgError] = useState('')
  const [orgFormData, setOrgFormData] = useState({
    name: '',
    subdomain: '',
    domain: '',
    subscription_tier: 'professional',
    max_agents: 10,
    max_users: 20,
    max_calls_per_month: 5000,
    user_email: ''
  })
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'user'
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }

    fetchUser()
    fetchStats()
    fetchUsers()
    fetchOrganizations()
  }, [router])

  useEffect(() => {
    if (activeTab === 'organizations') {
      fetchOrganizations()
    }
  }, [activeTab])

  const fetchUser = async () => {
    try {
      const response = await get('/users/me')
      if (response.data?.user) {
        setUser(response.data.user)
        if (response.data.user.role !== 'admin') {
          router.push('/dashboard')
        }
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      router.push('/login')
    }
  }

  const fetchStats = async () => {
    try {
      const response = await get('/admin/stats')
      if (response.data?.stats) {
        setStats(response.data.stats)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const url = `/admin/users${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`
      const response = await get(url)
      if (response.data?.users) {
        setUsers(response.data.users)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true)
      const response = await get('/organizations/all')
      if (response.data?.organizations) {
        setOrganizations(response.data.organizations)
      }
    } catch (error) {
      console.error('Error fetching organizations:', error)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const fetchOrganizationDetails = async (orgId: number) => {
    try {
      setLoadingOrgs(true)
      const response = await get(`/organizations/${orgId}/details`)
      if (response.data) {
        setSelectedOrg(response.data)
      }
    } catch (error) {
      console.error('Error fetching organization details:', error)
    } finally {
      setLoadingOrgs(false)
    }
  }

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateOrgError('')
    
    if (!orgFormData.name) {
      setCreateOrgError('Organization name is required')
      return
    }

    setCreateOrgLoading(true)
    try {
      const response = await post('/organizations', {
        name: orgFormData.name,
        subdomain: orgFormData.subdomain || null,
        domain: orgFormData.domain || null,
        subscription_tier: orgFormData.subscription_tier,
        max_agents: parseInt(orgFormData.max_agents.toString()),
        max_users: parseInt(orgFormData.max_users.toString()),
        max_calls_per_month: parseInt(orgFormData.max_calls_per_month.toString()),
        user_email: orgFormData.user_email || null
      })

      if (response.error) {
        setCreateOrgError(response.error)
      } else {
        setShowCreateOrgModal(false)
        setOrgFormData({
          name: '',
          subdomain: '',
          domain: '',
          subscription_tier: 'professional',
          max_agents: 10,
          max_users: 20,
          max_calls_per_month: 5000,
          user_email: ''
        })
        fetchOrganizations()
      }
    } catch (error: any) {
      setCreateOrgError(error.message || 'Failed to create organization')
    } finally {
      setCreateOrgLoading(false)
    }
  }

  const handleToggleUserStatus = async (userId: number, currentStatus: boolean) => {
    try {
      const response = await put(`/admin/users/${userId}`, { is_active: !currentStatus })
      if (response.data) {
        fetchUsers()
      }
    } catch (error) {
      console.error('Error updating user:', error)
    }
  }

  const handleLogout = () => {
    clearAuth()
    router.push('/')
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')

    // Validate email
    if (!isValidEmail(formData.email)) {
      setCreateError('Please enter a valid email address')
      return
    }

    // Validate password
    const passwordValidation = validatePassword(formData.password)
    if (!passwordValidation.valid) {
      setCreateError(passwordValidation.errors[0] || 'Password does not meet requirements')
      return
    }

    setCreateLoading(true)

    // Sanitize input
    const sanitizedData = {
      firstName: sanitizeInput(formData.firstName),
      lastName: sanitizeInput(formData.lastName),
      email: sanitizeInput(formData.email),
      password: formData.password, // Don't sanitize password
      role: formData.role
    }

    try {
      const response = await post('/admin/users', sanitizedData)
      
      if (response.data?.user) {
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          role: 'user'
        })
        setShowCreateModal(false)
        // Refresh users list
        fetchUsers()
        // Refresh stats
        fetchStats()
      } else {
        setCreateError(response.error || response.message || 'Failed to create user')
      }
    } catch (error: any) {
      console.error('Error creating user:', error)
      setCreateError(error.message || 'Failed to create user. Please try again.')
    } finally {
      setCreateLoading(false)
    }
  }

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchTerm !== undefined) {
        fetchUsers()
      }
    }, 500)

    return () => clearTimeout(debounceTimer)
  }, [searchTerm])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="container mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Logo size="md" showText={true} />
          <span className="text-white text-xl font-semibold">
            Admin Dashboard
          </span>
        </div>
        <div className="flex items-center space-x-6">
          <Link
            href="/dashboard"
            className="text-white hover:text-slate-300 text-sm font-medium"
          >
            User Dashboard
          </Link>
          {user && (
            <span className="text-white text-sm">
              {user.first_name} {user.last_name}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-8">Admin Dashboard</h1>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'users'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'organizations'
                ? 'text-teal-400 border-b-2 border-teal-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sub-Accounts (Organizations)
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm font-medium mb-2">Total Users</div>
              <div className="text-3xl font-bold text-white">{stats.users}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm font-medium mb-2">AI Agents</div>
              <div className="text-3xl font-bold text-white">{stats.agents}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm font-medium mb-2">Conversations</div>
              <div className="text-3xl font-bold text-white">{stats.conversations}</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="text-slate-300 text-sm font-medium mb-2">Appointments</div>
              <div className="text-3xl font-bold text-white">{stats.appointments}</div>
            </div>
          </div>
        )}

        {/* Organizations Management */}
        {activeTab === 'organizations' && (
          <div className="space-y-6">
            {selectedOrg ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <button
                      onClick={() => setSelectedOrg(null)}
                      className="text-teal-400 hover:text-teal-300 mb-2 flex items-center gap-2"
                    >
                      ← Back to Organizations
                    </button>
                    <h2 className="text-2xl font-bold text-white">{selectedOrg.organization.name}</h2>
                    <p className="text-slate-400 text-sm mt-1">
                      {selectedOrg.organization.domain || selectedOrg.organization.subdomain || 'No domain'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded text-sm font-semibold ${
                      selectedOrg.organization.is_active
                        ? 'bg-green-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}
                  >
                    {selectedOrg.organization.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Resources Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Users</div>
                    <div className="text-2xl font-bold text-white">{selectedOrg.resources.users.length}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Agents</div>
                    <div className="text-2xl font-bold text-white">{selectedOrg.resources.agents.length}</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="text-slate-400 text-sm mb-1">Phone Numbers</div>
                    <div className="text-2xl font-bold text-white">{selectedOrg.resources.phone_numbers.length}</div>
                  </div>
                </div>

                {/* Agents List */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Agents</h3>
                  <div className="space-y-2">
                    {selectedOrg.resources.agents.length > 0 ? (
                      selectedOrg.resources.agents.map((agent: any) => (
                        <div
                          key={agent.id}
                          className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center"
                        >
                          <div>
                            <div className="text-white font-medium">{agent.name}</div>
                            <div className="text-slate-400 text-sm">{agent.type}</div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              agent.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}
                          >
                            {agent.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm">No agents configured</div>
                    )}
                  </div>
                </div>

                {/* Phone Numbers List */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Phone Numbers</h3>
                  <div className="space-y-2">
                    {selectedOrg.resources.phone_numbers.length > 0 ? (
                      selectedOrg.resources.phone_numbers.map((pn: any) => (
                        <div
                          key={pn.id}
                          className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center"
                        >
                          <div>
                            <div className="text-white font-medium">{pn.phone_number}</div>
                            <div className="text-slate-400 text-sm">{pn.provider || 'N/A'}</div>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              pn.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                            }`}
                          >
                            {pn.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm">No phone numbers configured</div>
                    )}
                  </div>
                </div>

                {/* Users List */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">Users</h3>
                  <div className="space-y-2">
                    {selectedOrg.resources.users.length > 0 ? (
                      selectedOrg.resources.users.map((u: any) => (
                        <div
                          key={u.id}
                          className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center"
                        >
                          <div>
                            <div className="text-white font-medium">
                              {u.first_name} {u.last_name}
                            </div>
                            <div className="text-slate-400 text-sm">{u.email}</div>
                          </div>
                          <div className="flex gap-2">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                u.role === 'admin' ? 'bg-purple-500' : 'bg-teal-500'
                              } text-white`}
                            >
                              {u.role}
                            </span>
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                u.is_active ? 'bg-green-500' : 'bg-red-500'
                              } text-white`}
                            >
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-sm">No users in this organization</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-white">All Sub-Accounts (Organizations)</h2>
                  <button
                    onClick={() => setShowCreateOrgModal(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
                  >
                    + Create New Organization
                  </button>
                </div>
                {loadingOrgs ? (
                  <div className="text-white">Loading organizations...</div>
                ) : (
                  <div className="space-y-4">
                    {organizations.length > 0 ? (
                      organizations.map((org) => (
                        <div
                          key={org.id}
                          className="bg-slate-800/50 rounded-lg p-4 hover:bg-slate-800/70 transition-colors cursor-pointer"
                          onClick={() => fetchOrganizationDetails(org.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-white mb-1">{org.name}</h3>
                              <p className="text-slate-400 text-sm mb-3">
                                {org.domain || org.subdomain || 'No domain configured'}
                              </p>
                              <div className="flex gap-4 text-sm">
                                <span className="text-slate-300">
                                  <span className="text-slate-400">Users:</span> {org.user_count}
                                </span>
                                <span className="text-slate-300">
                                  <span className="text-slate-400">Agents:</span> {org.agent_count}
                                </span>
                                <span className="text-slate-300">
                                  <span className="text-slate-400">Phone Numbers:</span> {org.phone_number_count}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`px-3 py-1 rounded text-xs font-semibold ${
                                  org.is_active ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                }`}
                              >
                                {org.is_active ? 'Active' : 'Inactive'}
                              </span>
                              <span className="text-slate-400 text-xs">
                                {org.subscription_tier}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-400 text-center py-8">No organizations found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Users Management */}
        {activeTab === 'users' && (
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">User Management</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
              >
                Create User
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Created</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/10">
                    <td className="py-3 px-4">
                      {user.first_name} {user.last_name}
                    </td>
                    <td className="py-3 px-4">{user.email}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          user.role === 'admin'
                            ? 'bg-purple-500 text-white'
                            : 'bg-teal-600 text-white'
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          user.is_active
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                        className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                          user.is_active
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-green-500 hover:bg-green-600 text-white'
                        }`}
                      >
                        {user.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </main>

      {/* Create User Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" 
          onClick={() => {
            setShowCreateModal(false)
            setCreateError('')
            setFormData({
              firstName: '',
              lastName: '',
              email: '',
              password: '',
              role: 'user'
            })
          }}
        >
          <div 
            className="bg-slate-900 rounded-xl p-8 max-w-md w-full border border-white/20" 
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Create New User</h2>
            
            {createError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">Password</label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Minimum 6 characters"
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="user" className="bg-slate-800">User</option>
                  <option value="admin" className="bg-slate-800">Admin</option>
                  <option value="patient" className="bg-slate-800">Patient</option>
                  <option value="doctor" className="bg-slate-800">Doctor</option>
                  <option value="client" className="bg-slate-800">Client</option>
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setFormData({
                      firstName: '',
                      lastName: '',
                      email: '',
                      password: '',
                      role: 'user'
                    })
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  disabled={createLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" 
          onClick={() => {
            setShowCreateOrgModal(false)
            setCreateOrgError('')
          }}
        >
          <div 
            className="bg-slate-900 rounded-xl p-8 max-w-2xl w-full border border-white/20 max-h-[90vh] overflow-y-auto" 
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Create New Organization (Sub-Account)</h2>
            
            {createOrgError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
                {createOrgError}
              </div>
            )}

            <form onSubmit={handleCreateOrganization} className="space-y-4">
              <div>
                <label className="block text-white mb-2 text-sm font-medium">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={orgFormData.name}
                  onChange={(e) => setOrgFormData({ ...orgFormData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Acme Medical Group"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Subdomain</label>
                  <input
                    type="text"
                    value={orgFormData.subdomain}
                    onChange={(e) => setOrgFormData({ ...orgFormData, subdomain: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="acme"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Domain</label>
                  <input
                    type="text"
                    value={orgFormData.domain}
                    onChange={(e) => setOrgFormData({ ...orgFormData, domain: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="acme.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">Assign User (Optional)</label>
                <input
                  type="email"
                  value={orgFormData.user_email}
                  onChange={(e) => setOrgFormData({ ...orgFormData, user_email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="user@example.com (existing user email)"
                />
                <p className="text-slate-400 text-xs mt-1">If provided, this user will be assigned to the new organization</p>
              </div>

              <div>
                <label className="block text-white mb-2 text-sm font-medium">Subscription Tier</label>
                <select
                  value={orgFormData.subscription_tier}
                  onChange={(e) => setOrgFormData({ ...orgFormData, subscription_tier: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="starter" className="bg-slate-800">Starter</option>
                  <option value="professional" className="bg-slate-800">Professional</option>
                  <option value="enterprise" className="bg-slate-800">Enterprise</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Max Agents</label>
                  <input
                    type="number"
                    value={orgFormData.max_agents}
                    onChange={(e) => setOrgFormData({ ...orgFormData, max_agents: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Max Users</label>
                  <input
                    type="number"
                    value={orgFormData.max_users}
                    onChange={(e) => setOrgFormData({ ...orgFormData, max_users: parseInt(e.target.value) || 20 })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-white mb-2 text-sm font-medium">Max Calls/Month</label>
                  <input
                    type="number"
                    value={orgFormData.max_calls_per_month}
                    onChange={(e) => setOrgFormData({ ...orgFormData, max_calls_per_month: parseInt(e.target.value) || 5000 })}
                    className="w-full px-4 py-2 rounded-lg bg-white/10 border border-white/30 text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateOrgModal(false)
                    setCreateOrgError('')
                  }}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  disabled={createOrgLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={createOrgLoading}
                >
                  {createOrgLoading ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

