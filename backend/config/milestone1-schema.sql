-- Milestone 1: HIPAA-Compliant White-Label SaaS AI Voice Agent Platform Schema

-- Organizations/Tenants (for white-label multi-tenancy)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'starter', -- starter, professional, enterprise
    max_agents INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    max_calls_per_month INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add organization_id to users
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

-- RBAC: Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL, -- agents, users, calls, analytics, settings
    action VARCHAR(50) NOT NULL -- create, read, update, delete, manage
);

-- RBAC: Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_id INTEGER REFERENCES permissions(id),
    UNIQUE(role, permission_id)
);

-- White-label branding configuration
CREATE TABLE IF NOT EXISTS branding_configs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    logo_url VARCHAR(500),
    primary_color VARCHAR(7), -- hex color
    secondary_color VARCHAR(7),
    company_name VARCHAR(255),
    support_email VARCHAR(255),
    support_phone VARCHAR(20),
    custom_css TEXT,
    favicon_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id)
);

-- Telephony: Phone numbers
CREATE TABLE IF NOT EXISTS phone_numbers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number VARCHAR(20) NOT NULL,
    provider VARCHAR(50), -- twilio, vonage, etc.
    provider_sid VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB, -- voice, sms, fax
    monthly_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Telephony: Call logs
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number_id INTEGER REFERENCES phone_numbers(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    conversation_id INTEGER REFERENCES conversations(id),
    caller_phone VARCHAR(20),
    caller_name VARCHAR(255),
    direction VARCHAR(10), -- inbound, outbound
    status VARCHAR(50), -- completed, failed, busy, no-answer, voicemail
    duration_seconds INTEGER,
    recording_url VARCHAR(500),
    transcription_text TEXT,
    cost DECIMAL(10, 4),
    provider_call_id VARCHAR(255),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI: Enhanced agent configurations
ALTER TABLE ai_agents 
ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id),
ADD COLUMN IF NOT EXISTS voice_model VARCHAR(100), -- openai, anthropic, custom
ADD COLUMN IF NOT EXISTS voice_settings JSONB, -- voice speed, pitch, language
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS temperature DECIMAL(3, 2) DEFAULT 0.7,
ADD COLUMN IF NOT EXISTS max_tokens INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS phone_number_id INTEGER REFERENCES phone_numbers(id),
ADD COLUMN IF NOT EXISTS greeting_message TEXT,
ADD COLUMN IF NOT EXISTS fallback_message TEXT,
ADD COLUMN IF NOT EXISTS business_hours JSONB, -- timezone, hours
ADD COLUMN IF NOT EXISTS escalation_rules JSONB; -- when to transfer to human

-- Integrations: Third-party services
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- ehr, crm, calendar, payment, sms
    provider VARCHAR(100), -- epic, salesforce, stripe, etc.
    is_active BOOLEAN DEFAULT true,
    credentials JSONB, -- encrypted API keys, tokens
    config JSONB, -- sync settings, mappings
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integrations: Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    events TEXT[], -- call_started, call_ended, appointment_created, etc.
    secret_key VARCHAR(255), -- for signature verification
    is_active BOOLEAN DEFAULT true,
    last_triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integrations: API keys
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL, -- hashed API key
    key_prefix VARCHAR(20) NOT NULL, -- first 8 chars for display
    permissions TEXT[], -- scopes/permissions
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HIPAA Compliance: Business Associate Agreements (BAA)
CREATE TABLE IF NOT EXISTS baa_agreements (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(100), -- telephony, storage, ai_provider
    status VARCHAR(50) DEFAULT 'pending', -- pending, signed, expired
    signed_date DATE,
    expiration_date DATE,
    document_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HIPAA Compliance: Encryption keys
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    key_name VARCHAR(255) NOT NULL,
    key_type VARCHAR(50), -- data_at_rest, data_in_transit
    algorithm VARCHAR(50) DEFAULT 'AES-256',
    key_encrypted TEXT NOT NULL, -- encrypted key itself
    rotation_date DATE,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- HIPAA Compliance: Data retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    data_type VARCHAR(100) NOT NULL, -- call_logs, transcripts, recordings, audit_logs
    retention_days INTEGER NOT NULL,
    auto_delete BOOLEAN DEFAULT false,
    last_cleanup_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, data_type)
);

-- Analytics: Call metrics (materialized for performance)
CREATE TABLE IF NOT EXISTS call_metrics (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    avg_duration_seconds DECIMAL(10, 2),
    total_cost DECIMAL(10, 2) DEFAULT 0,
    satisfaction_score DECIMAL(3, 2), -- 0-5
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, agent_id, date)
);

-- Analytics: Agent performance
CREATE TABLE IF NOT EXISTS agent_performance (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES ai_agents(id),
    organization_id INTEGER REFERENCES organizations(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_interactions INTEGER DEFAULT 0,
    successful_interactions INTEGER DEFAULT 0,
    avg_response_time_seconds DECIMAL(10, 2),
    avg_satisfaction_score DECIMAL(3, 2),
    escalation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_organization_id ON ai_agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_organization_id ON phone_numbers(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_organization_id ON call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_integrations_organization_id ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_baa_agreements_organization_id ON baa_agreements(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_metrics_organization_id ON call_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_metrics_date ON call_metrics(date);

-- Insert default permissions
INSERT INTO permissions (name, description, resource, action) VALUES
    ('agents.create', 'Create AI agents', 'agents', 'create'),
    ('agents.read', 'View AI agents', 'agents', 'read'),
    ('agents.update', 'Update AI agents', 'agents', 'update'),
    ('agents.delete', 'Delete AI agents', 'agents', 'delete'),
    ('agents.manage', 'Full agent management', 'agents', 'manage'),
    ('users.create', 'Create users', 'users', 'create'),
    ('users.read', 'View users', 'users', 'read'),
    ('users.update', 'Update users', 'users', 'update'),
    ('users.delete', 'Delete users', 'users', 'delete'),
    ('users.manage', 'Full user management', 'users', 'manage'),
    ('calls.read', 'View call logs', 'calls', 'read'),
    ('calls.manage', 'Manage call settings', 'calls', 'manage'),
    ('analytics.read', 'View analytics', 'analytics', 'read'),
    ('settings.read', 'View settings', 'settings', 'read'),
    ('settings.update', 'Update settings', 'settings', 'update'),
    ('settings.manage', 'Full settings management', 'settings', 'manage'),
    ('integrations.manage', 'Manage integrations', 'integrations', 'manage'),
    ('billing.read', 'View billing', 'billing', 'read'),
    ('billing.manage', 'Manage billing', 'billing', 'manage')
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'user', id FROM permissions WHERE name IN (
    'agents.read', 'calls.read', 'analytics.read', 'settings.read'
)
ON CONFLICT DO NOTHING;

-- Create default organization for existing users
INSERT INTO organizations (name, subdomain, subscription_tier)
SELECT 'Default Organization', 'default', 'enterprise'
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE subdomain = 'default');

-- Update existing users to belong to default organization
UPDATE users SET organization_id = (SELECT id FROM organizations WHERE subdomain = 'default' LIMIT 1)
WHERE organization_id IS NULL;

