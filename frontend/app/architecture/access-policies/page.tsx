'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ChevronLeft, Shield, Users, Lock, Plus, Edit2, Trash2,
  Check, X, AlertTriangle, Eye, UserCheck, Settings, Save
} from 'lucide-react'
import { get, post, put, del } from '@/lib/api'
import { isAuthenticated } from '@/lib/auth'

interface AccessPolicy {
  id: number
  name: string
  resource_type: string
  resource_id: number | null
  role: string
  permissions: string[]
  conditions: any
  is_active: boolean
  created_at: string
}

interface Role {
  id: string
  name: string
  description: string
  permissions: string[]
  userCount: number
  isSystem: boolean
  policyId?: number
}

// Default system roles (used as templates)
const defaultSystemRoles: Role[] = [
  {
    id: 'admin',
    name: 'Administrator',
    description: 'Full system access with all permissions',
    permissions: ['*'],
    userCount: 1,
    isSystem: true
  },
  {
    id: 'doctor',
    name: 'Doctor',
    description: 'Access to patient records, appointments, and medical data',
    permissions: ['patients:read', 'patients:write', 'appointments:read', 'appointments:write', 'medical:read', 'medical:write'],
    userCount: 0,
    isSystem: true
  },
  {
    id: 'nurse',
    name: 'Nurse',
    description: 'Access to patient records and triage functions',
    permissions: ['patients:read', 'appointments:read', 'triage:read', 'triage:write'],
    userCount: 0,
    isSystem: true
  },
  {
    id: 'front_desk',
    name: 'Front Desk',
    description: 'Appointment scheduling and patient check-in',
    permissions: ['appointments:read', 'appointments:write', 'patients:read'],
    userCount: 0,
    isSystem: true
  },
  {
    id: 'billing',
    name: 'Billing Specialist',
    description: 'Access to billing, payments, and insurance',
    permissions: ['billing:read', 'billing:write', 'payments:read', 'payments:write'],
    userCount: 0,
    isSystem: true
  },
  {
    id: 'patient',
    name: 'Patient',
    description: 'Limited access to own records and appointments',
    permissions: ['self:read', 'appointments:read'],
    userCount: 0,
    isSystem: true
  }
]

const permissionCategories = [
  {
    category: 'Patients',
    permissions: [
      { id: 'patients:read', name: 'View Patients', description: 'View patient records and information' },
      { id: 'patients:write', name: 'Edit Patients', description: 'Create and modify patient records' },
      { id: 'patients:delete', name: 'Delete Patients', description: 'Remove patient records' }
    ]
  },
  {
    category: 'Appointments',
    permissions: [
      { id: 'appointments:read', name: 'View Appointments', description: 'View appointment schedules' },
      { id: 'appointments:write', name: 'Manage Appointments', description: 'Create, modify, cancel appointments' }
    ]
  },
  {
    category: 'Medical',
    permissions: [
      { id: 'medical:read', name: 'View Medical Records', description: 'Access medical history and notes' },
      { id: 'medical:write', name: 'Edit Medical Records', description: 'Add and modify medical information' }
    ]
  },
  {
    category: 'Triage',
    permissions: [
      { id: 'triage:read', name: 'View Triage', description: 'View triage assessments' },
      { id: 'triage:write', name: 'Perform Triage', description: 'Create and update triage assessments' }
    ]
  },
  {
    category: 'Billing',
    permissions: [
      { id: 'billing:read', name: 'View Billing', description: 'View invoices and statements' },
      { id: 'billing:write', name: 'Manage Billing', description: 'Create and modify billing records' },
      { id: 'payments:read', name: 'View Payments', description: 'View payment history' },
      { id: 'payments:write', name: 'Process Payments', description: 'Accept and process payments' }
    ]
  },
  {
    category: 'System',
    permissions: [
      { id: 'users:read', name: 'View Users', description: 'View user accounts' },
      { id: 'users:write', name: 'Manage Users', description: 'Create and modify user accounts' },
      { id: 'settings:read', name: 'View Settings', description: 'View system settings' },
      { id: 'settings:write', name: 'Manage Settings', description: 'Modify system settings' },
      { id: 'audit:read', name: 'View Audit Logs', description: 'Access audit trail' }
    ]
  }
]

export default function AccessPoliciesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<Role[]>([])
  const [policies, setPolicies] = useState<AccessPolicy[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state for new/edit role
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    role: '',
    permissions: [] as string[]
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    fetchPolicies()
  }, [router])

  const fetchPolicies = async () => {
    try {
      setLoading(true)
      const response = await get('/security/access-policies')
      
      if (response.data?.policies) {
        setPolicies(response.data.policies)
        
        // Convert policies to roles format
        const policyRoles: Role[] = response.data.policies
          .filter((p: AccessPolicy) => p.resource_type === 'role')
          .map((p: AccessPolicy) => ({
            id: p.role,
            name: p.name,
            description: p.conditions?.description || '',
            permissions: p.permissions || [],
            userCount: 0,
            isSystem: false,
            policyId: p.id
          }))

        // Merge with system roles (system roles that don't have policies yet)
        const existingRoleIds = policyRoles.map(r => r.id)
        const systemRolesNotInDB = defaultSystemRoles.filter(r => !existingRoleIds.includes(r.id))
        
        setRoles([...systemRolesNotInDB, ...policyRoles])
      } else {
        // If no policies, show default system roles
        setRoles(defaultSystemRoles)
      }
    } catch (error) {
      console.error('Error fetching policies:', error)
      setRoles(defaultSystemRoles)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateRole = () => {
    setEditingRole(null)
    setFormData({
      name: '',
      description: '',
      role: '',
      permissions: []
    })
    setShowRoleModal(true)
  }

  const handleEditRole = (role: Role) => {
    setEditingRole(role)
    setFormData({
      name: role.name,
      description: role.description,
      role: role.id,
      permissions: [...role.permissions]
    })
    setShowRoleModal(true)
  }

  const handleSaveRole = async () => {
    if (!formData.name || !formData.role) {
      showMessage('error', 'Role name and ID are required')
      return
    }

    if (formData.permissions.length === 0) {
      showMessage('error', 'At least one permission is required')
      return
    }

    try {
      setSaving(true)

      if (editingRole?.policyId) {
        // Update existing policy
        const response = await put(`/security/access-policies/${editingRole.policyId}`, {
          name: formData.name,
          permissions: formData.permissions,
          conditions: { description: formData.description }
        })

        if (response.error) {
          showMessage('error', response.error)
          return
        }

        showMessage('success', 'Role updated successfully!')
      } else {
        // Create new policy
        const response = await post('/security/access-policies', {
          name: formData.name,
          resource_type: 'role',
          role: formData.role.toLowerCase().replace(/\s+/g, '_'),
          permissions: formData.permissions,
          conditions: { description: formData.description }
        })

        if (response.error) {
          showMessage('error', response.error)
          return
        }

        showMessage('success', 'Role created successfully!')
      }

      setShowRoleModal(false)
      fetchPolicies()
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to save role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem && !role.policyId) {
      showMessage('error', 'Cannot delete system roles')
      return
    }

    if (!confirm(`Delete role "${role.name}"? This cannot be undone.`)) return

    try {
      if (role.policyId) {
        const response = await del(`/security/access-policies/${role.policyId}`)
        if (response.error) {
          showMessage('error', response.error)
          return
        }
      }

      showMessage('success', 'Role deleted successfully!')
      setSelectedRole(null)
      fetchPolicies()
    } catch (error: any) {
      showMessage('error', error.message || 'Failed to delete role')
    }
  }

  const togglePermission = (permId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }))
  }

  const selectAllInCategory = (category: typeof permissionCategories[0]) => {
    const categoryPermIds = category.permissions.map(p => p.id)
    const allSelected = categoryPermIds.every(id => formData.permissions.includes(id))
    
    if (allSelected) {
      // Deselect all in category
      setFormData(prev => ({
        ...prev,
        permissions: prev.permissions.filter(p => !categoryPermIds.includes(p))
      }))
    } else {
      // Select all in category
      setFormData(prev => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...categoryPermIds]))
      }))
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
          <Lock size={28} className="text-teal-400" />
          <span className="text-xl font-semibold">Access Policies</span>
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
          <h1 className="text-4xl font-bold mb-4">Role-Based Access Control (RBAC)</h1>
          <p className="text-slate-300 text-lg max-w-3xl">
            Define roles and permissions to control access to patient data, appointments, billing, 
            and system features. HIPAA requires strict access controls for PHI.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Users size={24} className="text-blue-400 mb-2" />
            <p className="text-2xl font-bold">{roles.length}</p>
            <p className="text-sm text-slate-400">Defined Roles</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Lock size={24} className="text-purple-400 mb-2" />
            <p className="text-2xl font-bold">{permissionCategories.reduce((acc, c) => acc + c.permissions.length, 0)}</p>
            <p className="text-sm text-slate-400">Permissions</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <Shield size={24} className="text-green-400 mb-2" />
            <p className="text-2xl font-bold">{permissionCategories.length}</p>
            <p className="text-sm text-slate-400">Categories</p>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <UserCheck size={24} className="text-teal-400 mb-2" />
            <p className="text-2xl font-bold">HIPAA</p>
            <p className="text-sm text-slate-400">Compliant</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-1">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold">Roles</h2>
                <button 
                  onClick={handleCreateRole}
                  className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-lg"
                  title="Create New Role"
                >
                  <Plus size={16} />
                </button>
              </div>

              <div className="space-y-2">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedRole?.id === role.id 
                        ? 'bg-teal-600/20 border border-teal-500/50' 
                        : 'bg-slate-950/50 border border-white/5 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          role.id === 'admin' ? 'bg-red-500/20' :
                          role.id === 'doctor' ? 'bg-blue-500/20' :
                          role.id === 'nurse' ? 'bg-green-500/20' :
                          role.id === 'billing' ? 'bg-yellow-500/20' :
                          role.id === 'front_desk' ? 'bg-purple-500/20' :
                          'bg-slate-500/20'
                        }`}>
                          <Users size={16} className={
                            role.id === 'admin' ? 'text-red-400' :
                            role.id === 'doctor' ? 'text-blue-400' :
                            role.id === 'nurse' ? 'text-green-400' :
                            role.id === 'billing' ? 'text-yellow-400' :
                            role.id === 'front_desk' ? 'text-purple-400' :
                            'text-slate-400'
                          } />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{role.name}</p>
                          <p className="text-xs text-slate-400">
                            {role.permissions.includes('*') ? 'All' : role.permissions.length} permissions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {role.isSystem && !role.policyId && (
                          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">System</span>
                        )}
                        {role.policyId && (
                          <span className="text-xs text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded">Custom</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Role Details */}
          <div className="lg:col-span-2">
            {selectedRole ? (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-bold">{selectedRole.name}</h2>
                    <p className="text-sm text-slate-400">{selectedRole.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditRole(selectedRole)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10"
                      title="Edit Role"
                    >
                      <Edit2 size={16} />
                    </button>
                    {(!selectedRole.isSystem || selectedRole.policyId) && (
                      <button 
                        onClick={() => handleDeleteRole(selectedRole)}
                        className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                        title="Delete Role"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Permissions by Category */}
                <div className="space-y-4">
                  {permissionCategories.map((category) => (
                    <div key={category.category} className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                      <h3 className="font-medium text-sm mb-3 text-slate-300">{category.category}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {category.permissions.map((perm) => {
                          const hasPermission = selectedRole.permissions.includes('*') || 
                                                selectedRole.permissions.includes(perm.id)
                          return (
                            <div 
                              key={perm.id}
                              className={`flex items-center gap-2 p-2 rounded ${
                                hasPermission ? 'bg-green-500/10' : 'bg-slate-800/50'
                              }`}
                            >
                              {hasPermission ? (
                                <Check size={14} className="text-green-400" />
                              ) : (
                                <X size={14} className="text-slate-500" />
                              )}
                              <div>
                                <p className={`text-xs font-medium ${hasPermission ? 'text-white' : 'text-slate-500'}`}>
                                  {perm.name}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl p-6 border border-white/10 flex items-center justify-center h-full min-h-[400px]">
                <div className="text-center text-slate-400">
                  <Lock size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Select a role to view permissions</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* HIPAA Note */}
        <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
          <h3 className="font-bold text-blue-300 mb-2">HIPAA Access Control Requirements</h3>
          <ul className="text-sm text-slate-300 space-y-1">
            <li>✓ <strong>Minimum Necessary:</strong> Users only access PHI needed for their role</li>
            <li>✓ <strong>Unique User IDs:</strong> Each user has a unique identifier for audit trails</li>
            <li>✓ <strong>Automatic Logoff:</strong> Sessions timeout after inactivity</li>
            <li>✓ <strong>Access Audit:</strong> All PHI access is logged and auditable</li>
          </ul>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link 
            href="/dashboard/settings?tab=users"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Users size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">User Management</p>
              <p className="text-xs text-slate-400">Assign roles to users</p>
            </div>
          </Link>
          <Link 
            href="/architecture/security"
            className="bg-white/5 rounded-xl p-4 border border-white/10 hover:border-teal-500/50 transition-colors flex items-center gap-3"
          >
            <Shield size={24} className="text-teal-400" />
            <div>
              <p className="font-medium">Security & Encryption</p>
              <p className="text-xs text-slate-400">Encryption keys and audit logs</p>
            </div>
          </Link>
        </div>
      </main>

      {/* Create/Edit Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-white/20 p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </h2>
              <button
                onClick={() => setShowRoleModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Role Name */}
              <div>
                <label className="block text-slate-300 mb-2">Role Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., Receptionist"
                />
              </div>

              {/* Role ID */}
              <div>
                <label className="block text-slate-300 mb-2">Role ID *</label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                  placeholder="e.g., receptionist"
                  disabled={!!editingRole}
                />
                <p className="text-xs text-slate-400 mt-1">Lowercase, no spaces. Used internally.</p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-700/50 border border-white/20 rounded-lg px-4 py-2 text-white"
                  rows={2}
                  placeholder="Describe what this role can do..."
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-slate-300 mb-4">Permissions *</label>
                <div className="space-y-4">
                  {permissionCategories.map((category) => {
                    const categoryPermIds = category.permissions.map(p => p.id)
                    const allSelected = categoryPermIds.every(id => formData.permissions.includes(id))
                    const someSelected = categoryPermIds.some(id => formData.permissions.includes(id))
                    
                    return (
                      <div key={category.category} className="bg-slate-950/50 rounded-lg p-4 border border-white/5">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-sm text-slate-300">{category.category}</h4>
                          <button
                            type="button"
                            onClick={() => selectAllInCategory(category)}
                            className={`text-xs px-2 py-1 rounded ${
                              allSelected 
                                ? 'bg-teal-500/20 text-teal-400' 
                                : 'bg-slate-700 text-slate-400 hover:text-white'
                            }`}
                          >
                            {allSelected ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {category.permissions.map((perm) => {
                            const isSelected = formData.permissions.includes(perm.id)
                            return (
                              <label
                                key={perm.id}
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                  isSelected ? 'bg-teal-500/20' : 'bg-slate-800/50 hover:bg-slate-700/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePermission(perm.id)}
                                  className="w-4 h-4 text-teal-600 bg-slate-700 border-white/20 rounded focus:ring-teal-500"
                                />
                                <div>
                                  <p className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                                    {perm.name}
                                  </p>
                                  <p className="text-xs text-slate-500">{perm.description}</p>
                                </div>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Selected Count */}
              <div className="text-sm text-slate-400">
                {formData.permissions.length} permissions selected
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRole}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>Saving...</>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingRole ? 'Update Role' : 'Create Role'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
