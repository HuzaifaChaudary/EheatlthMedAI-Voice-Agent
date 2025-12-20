-- Security Incidents Schema
-- For intrusion detection, security monitoring, and incident response

-- Security incidents table for tracking security events
CREATE TABLE IF NOT EXISTS security_incidents (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    incident_type VARCHAR(100) NOT NULL,  -- brute_force, unauthorized_access, data_breach, suspicious_activity, rate_limit_exceeded
    severity VARCHAR(20) NOT NULL,        -- low, medium, high, critical
    status VARCHAR(50) DEFAULT 'open',    -- open, investigating, resolved, closed
    source_ip VARCHAR(45),
    user_id INTEGER REFERENCES users(id),
    resource_type VARCHAR(100),
    resource_id INTEGER,
    description TEXT,
    details JSONB,                        -- Additional context (user agent, endpoint, etc.)
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Incident responses table for tracking actions taken
CREATE TABLE IF NOT EXISTS incident_responses (
    id SERIAL PRIMARY KEY,
    incident_id INTEGER REFERENCES security_incidents(id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,    -- notify, block_ip, disable_user, escalate, investigate, resolve
    action_status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, failed
    performed_by INTEGER REFERENCES users(id),
    notes TEXT,
    metadata JSONB,                       -- Action-specific data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Blocked IPs table for intrusion prevention
CREATE TABLE IF NOT EXISTS blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    organization_id INTEGER REFERENCES organizations(id),
    reason VARCHAR(255),
    blocked_by INTEGER REFERENCES users(id),
    incident_id INTEGER REFERENCES security_incidents(id),
    blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,                 -- NULL for permanent blocks
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ip_address, organization_id)
);

-- Failed login attempts tracking for intrusion detection
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(255),
    user_agent TEXT,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organizations(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_incidents_org ON security_incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_incidents_type ON security_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_security_incidents_status ON security_incidents(status);
CREATE INDEX IF NOT EXISTS idx_security_incidents_severity ON security_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_security_incidents_detected_at ON security_incidents(detected_at);
CREATE INDEX IF NOT EXISTS idx_incident_responses_incident ON incident_responses(incident_id);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active);
CREATE INDEX IF NOT EXISTS idx_failed_logins_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_logins_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_logins_time ON failed_login_attempts(attempted_at);
