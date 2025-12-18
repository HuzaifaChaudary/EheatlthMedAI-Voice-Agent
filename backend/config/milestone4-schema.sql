-- Milestone 4: Assumptions, Constraints & Conventions Schema

-- Operational Assumptions
CREATE TABLE IF NOT EXISTS operational_assumptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    assumption_id VARCHAR(50) UNIQUE NOT NULL, -- ASM-001, ASM-002, etc.
    category VARCHAR(100) NOT NULL, -- baa, ehr, telephony, infrastructure, compliance
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_level VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraints
CREATE TABLE IF NOT EXISTS constraints (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    constraint_id VARCHAR(50) UNIQUE NOT NULL, -- CON-HIPAA-001, CON-SEC-001, etc.
    category VARCHAR(100) NOT NULL, -- hipaa, security, encryption, rbac, consent, compliance
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    constraint_type VARCHAR(50) NOT NULL, -- technical, legal, operational, regulatory
    enforcement_level VARCHAR(20) DEFAULT 'mandatory', -- mandatory, recommended, optional
    validation_rule JSONB, -- rule for automated validation
    is_enforced BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requirements (RFC 2119 based)
CREATE TABLE IF NOT EXISTS requirements (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    requirement_id VARCHAR(50) UNIQUE NOT NULL, -- PLAT-SEC-001, AGT-FD-001, etc.
    category VARCHAR(100) NOT NULL, -- platform, agent, integration, security, compliance
    subcategory VARCHAR(100), -- front_desk, medical_assistant, triage, billing, collections
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirement_type VARCHAR(20) NOT NULL, -- MUST, SHOULD, MAY (RFC 2119)
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    status VARCHAR(50) DEFAULT 'draft', -- draft, approved, implemented, verified, deprecated
    related_constraints INTEGER[], -- array of constraint IDs
    related_assumptions INTEGER[], -- array of assumption IDs
    parent_requirement_id INTEGER REFERENCES requirements(id), -- for hierarchical requirements
    implementation_notes TEXT,
    verification_criteria TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by INTEGER REFERENCES users(id)
);

-- Requirement Dependencies
CREATE TABLE IF NOT EXISTS requirement_dependencies (
    id SERIAL PRIMARY KEY,
    requirement_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
    depends_on_requirement_id INTEGER REFERENCES requirements(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) DEFAULT 'requires', -- requires, conflicts_with, enhances
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requirement_id, depends_on_requirement_id)
);

-- Constraint Violations Log
CREATE TABLE IF NOT EXISTS constraint_violations (
    id SERIAL PRIMARY KEY,
    constraint_id INTEGER REFERENCES constraints(id),
    organization_id INTEGER REFERENCES organizations(id),
    violation_type VARCHAR(100) NOT NULL, -- encryption, rbac, consent, tls, etc.
    resource_type VARCHAR(100), -- agent, call, user, integration, etc.
    resource_id INTEGER,
    severity VARCHAR(20) DEFAULT 'warning', -- critical, high, medium, low, warning
    description TEXT NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id),
    resolution_notes TEXT
);

-- Requirement Verification Log
CREATE TABLE IF NOT EXISTS requirement_verifications (
    id SERIAL PRIMARY KEY,
    requirement_id INTEGER REFERENCES requirements(id),
    verified_by INTEGER REFERENCES users(id),
    verification_method VARCHAR(100), -- manual, automated, test, audit
    verification_result VARCHAR(50) DEFAULT 'passed', -- passed, failed, partial
    evidence_url VARCHAR(500),
    notes TEXT,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_assumptions_org ON operational_assumptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_category ON operational_assumptions(category);
CREATE INDEX IF NOT EXISTS idx_constraints_org ON constraints(organization_id);
CREATE INDEX IF NOT EXISTS idx_constraints_category ON constraints(category);
CREATE INDEX IF NOT EXISTS idx_requirements_org ON requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_requirements_category ON requirements(category);
CREATE INDEX IF NOT EXISTS idx_requirements_type ON requirements(requirement_type);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_org ON constraint_violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_constraint_violations_resolved ON constraint_violations(resolved_at);
CREATE INDEX IF NOT EXISTS idx_requirement_verifications_req ON requirement_verifications(requirement_id);

-- Insert default operational assumptions
INSERT INTO operational_assumptions (assumption_id, category, title, description, impact_level) VALUES
    ('ASM-BAA-001', 'baa', 'BAA Required for All Vendors', 'All third-party vendors handling PHI must have a signed Business Associate Agreement (BAA) in place before integration.', 'high'),
    ('ASM-EHR-001', 'ehr', 'Client-Provided EHR Credentials', 'Clients will provide valid EHR system credentials and maintain access permissions for integration.', 'high'),
    ('ASM-TEL-001', 'telephony', 'Compliant Telephony Carriers', 'All telephony carriers used must be HIPAA-compliant and support TLS 1.2+ for call transmission.', 'high'),
    ('ASM-INF-001', 'infrastructure', 'Secure Infrastructure', 'Infrastructure providers (cloud, hosting) must be HIPAA-compliant and provide BAA.', 'high'),
    ('ASM-COMP-001', 'compliance', 'Ongoing Compliance', 'Clients are responsible for maintaining their own HIPAA compliance and will notify of any compliance issues.', 'medium')
ON CONFLICT (assumption_id) DO NOTHING;

-- Insert default constraints
INSERT INTO constraints (constraint_id, category, title, description, constraint_type, enforcement_level) VALUES
    ('CON-HIPAA-001', 'hipaa', 'HIPAA Administrative Safeguards', 'Must implement administrative safeguards including security management, workforce security, and information access management.', 'regulatory', 'mandatory'),
    ('CON-HIPAA-002', 'hipaa', 'HIPAA Physical Safeguards', 'Must implement physical safeguards including facility access controls and workstation security.', 'regulatory', 'mandatory'),
    ('CON-HIPAA-003', 'hipaa', 'HIPAA Technical Safeguards', 'Must implement technical safeguards including access control, audit controls, integrity controls, and transmission security.', 'regulatory', 'mandatory'),
    ('CON-SEC-001', 'security', 'TLS 1.2/1.3 Required', 'All data in transit MUST use TLS 1.2 or higher. TLS 1.0 and 1.1 are prohibited.', 'technical', 'mandatory'),
    ('CON-SEC-002', 'encryption', 'AES-256 Encryption', 'All data at rest MUST be encrypted using AES-256 encryption standard.', 'technical', 'mandatory'),
    ('CON-SEC-003', 'rbac', 'RBAC Enforcement', 'Role-Based Access Control (RBAC) MUST be enforced for all system access. Users can only access resources permitted by their role.', 'technical', 'mandatory'),
    ('CON-CONSENT-001', 'consent', 'Consent-Based Recording', 'Call recording MUST only occur with explicit consent from all parties. Consent must be recorded and verifiable.', 'legal', 'mandatory'),
    ('CON-AUDIT-001', 'compliance', 'Audit Logging', 'All access to PHI MUST be logged in audit trails with immutable records.', 'regulatory', 'mandatory')
ON CONFLICT (constraint_id) DO NOTHING;

-- Insert default requirements (sample structure)
INSERT INTO requirements (requirement_id, category, subcategory, title, description, requirement_type, priority, status) VALUES
    ('PLAT-SEC-001', 'platform', 'security', 'TLS Encryption for All Connections', 'The platform MUST use TLS 1.2 or higher for all network connections transmitting PHI.', 'MUST', 'high', 'approved'),
    ('PLAT-SEC-002', 'platform', 'security', 'AES-256 Data Encryption', 'All PHI stored in the database MUST be encrypted using AES-256 encryption.', 'MUST', 'high', 'approved'),
    ('PLAT-SEC-003', 'platform', 'security', 'RBAC Implementation', 'The platform MUST implement Role-Based Access Control (RBAC) for all user access.', 'MUST', 'high', 'approved'),
    ('PLAT-AUDIT-001', 'platform', 'compliance', 'Comprehensive Audit Logging', 'The platform MUST log all access to PHI including user, timestamp, action, and resource accessed.', 'MUST', 'high', 'approved'),
    ('AGT-FD-001', 'agent', 'front_desk', 'Appointment Scheduling Capability', 'The Front Desk Assistant agent MUST be able to schedule, reschedule, and cancel appointments.', 'MUST', 'high', 'approved'),
    ('AGT-FD-002', 'agent', 'front_desk', 'Patient Check-in Support', 'The Front Desk Assistant agent SHOULD support patient check-in procedures.', 'SHOULD', 'medium', 'approved'),
    ('AGT-MA-001', 'agent', 'medical_assistant', 'Symptom Assessment', 'The Medical Assistant agent MUST be able to perform basic symptom assessment and triage.', 'MUST', 'high', 'approved'),
    ('AGT-TRIAGE-001', 'agent', 'triage', 'Urgency Assessment', 'The Triage Nurse agent MUST assess patient urgency and prioritize care accordingly.', 'MUST', 'high', 'approved'),
    ('INT-EHR-001', 'integration', 'ehr', 'HL7 Message Support', 'The platform SHOULD support HL7 v2.8 message formats for EHR integration.', 'SHOULD', 'medium', 'approved'),
    ('INT-EHR-002', 'integration', 'ehr', 'FHIR API Support', 'The platform SHOULD support FHIR R4 REST API for modern EHR integration.', 'SHOULD', 'medium', 'approved'),
    ('CONSENT-001', 'compliance', 'consent', 'Explicit Consent for Recording', 'The platform MUST obtain explicit consent before recording any calls containing PHI.', 'MUST', 'high', 'approved'),
    ('CONSENT-002', 'compliance', 'consent', 'Consent Documentation', 'All consent records MUST be stored with timestamp, method, and verifiable evidence.', 'MUST', 'high', 'approved')
ON CONFLICT (requirement_id) DO NOTHING;

