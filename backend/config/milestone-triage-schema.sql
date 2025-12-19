-- Triage Nurse Assistant Feature Schemas

-- Triage Interactions/Assessments
CREATE TABLE IF NOT EXISTS triage_assessments (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    chief_complaint TEXT,
    symptoms JSONB NOT NULL, -- Structured symptom data
    severity_score INTEGER, -- 1-10 scale
    urgency_level VARCHAR(50), -- critical, emergent, urgent, routine
    protocol_pathway VARCHAR(100), -- chest_pain, difficulty_breathing, mild_rash, etc.
    triage_decision TEXT, -- Recommended action
    red_flags JSONB, -- Array of red flags detected
    assessment_notes TEXT,
    status VARCHAR(50) DEFAULT 'active', -- active, escalated, completed, documented
    escalated_to VARCHAR(100), -- 911, provider, emergency_department
    provider_schedule_id INTEGER, -- If scheduled with provider
    emr_documentation_id VARCHAR(255), -- Reference to EMR note/encounter
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triage Protocols/Pathways
CREATE TABLE IF NOT EXISTS triage_protocols (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    protocol_name VARCHAR(255) NOT NULL, -- chest_pain, difficulty_breathing, etc.
    protocol_category VARCHAR(100), -- cardiac, respiratory, neurological, etc.
    symptom_keywords TEXT[], -- Keywords that trigger this protocol
    red_flags JSONB NOT NULL, -- Array of red flag criteria
    escalation_action VARCHAR(100) NOT NULL, -- 911, emergency_department, provider_call, schedule_visit
    severity_threshold INTEGER, -- Minimum severity to trigger escalation (1-10)
    decision_tree JSONB NOT NULL, -- Structured decision tree
    protocol_description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider Call Schedules
CREATE TABLE IF NOT EXISTS provider_call_schedules (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    provider_name VARCHAR(255) NOT NULL,
    provider_phone VARCHAR(20),
    provider_email VARCHAR(255),
    provider_type VARCHAR(100), -- primary_care, specialist, on_call, etc.
    schedule_data JSONB NOT NULL, -- Days, hours, timezone, availability
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Emergency Services Integration Log
CREATE TABLE IF NOT EXISTS emergency_service_calls (
    id SERIAL PRIMARY KEY,
    triage_assessment_id INTEGER REFERENCES triage_assessments(id),
    organization_id INTEGER REFERENCES organizations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_location VARCHAR(500), -- Address or location
    emergency_type VARCHAR(100), -- cardiac_arrest, stroke, severe_trauma, etc.
    severity_level VARCHAR(50), -- critical, emergent
    service_called VARCHAR(100), -- 911, local_emergency, ambulance_service
    call_reference VARCHAR(255), -- Reference number from emergency service
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'initiated', -- initiated, dispatched, arrived, completed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Triage Red Flags
CREATE TABLE IF NOT EXISTS triage_red_flags (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    red_flag_name VARCHAR(255) NOT NULL,
    red_flag_description TEXT,
    symptom_patterns TEXT[], -- Symptoms that indicate this red flag
    severity_level VARCHAR(50), -- critical, emergent, urgent
    escalation_action VARCHAR(100) NOT NULL, -- 911, emergency_department, provider_call
    protocol_id INTEGER REFERENCES triage_protocols(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_triage_assessments_conversation ON triage_assessments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_triage_assessments_status ON triage_assessments(status);
CREATE INDEX IF NOT EXISTS idx_triage_assessments_urgency ON triage_assessments(urgency_level);
CREATE INDEX IF NOT EXISTS idx_triage_protocols_org ON triage_protocols(organization_id);
CREATE INDEX IF NOT EXISTS idx_triage_protocols_category ON triage_protocols(protocol_category);
CREATE INDEX IF NOT EXISTS idx_provider_schedules_org ON provider_call_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_triage ON emergency_service_calls(triage_assessment_id);
CREATE INDEX IF NOT EXISTS idx_emergency_calls_status ON emergency_service_calls(status);
CREATE INDEX IF NOT EXISTS idx_red_flags_org ON triage_red_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_red_flags_protocol ON triage_red_flags(protocol_id);

