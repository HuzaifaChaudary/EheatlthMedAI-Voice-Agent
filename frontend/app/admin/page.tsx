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
  }, [router])

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

        {/* Users Management */}
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
    </div>
  )
}

