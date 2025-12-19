-- Medical Assistant Feature Schemas

-- Medication Refill Requests
CREATE TABLE IF NOT EXISTS medication_refill_requests (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    medication_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100),
    frequency VARCHAR(100),
    last_filled_date DATE,
    days_supply INTEGER,
    refill_request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, denied, requires_provider_review
    protocol_decision VARCHAR(100), -- auto_approve, auto_deny, requires_review
    protocol_reason TEXT,
    provider_notes TEXT,
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lab Results
CREATE TABLE IF NOT EXISTS lab_results (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    test_name VARCHAR(255) NOT NULL,
    test_type VARCHAR(100), -- blood, urine, imaging, etc.
    result_value VARCHAR(255),
    unit VARCHAR(50),
    normal_range_min NUMERIC,
    normal_range_max NUMERIC,
    normal_range_text VARCHAR(255), -- e.g., "70-100 mg/dL"
    status VARCHAR(50), -- normal, abnormal, critical, pending
    interpretation TEXT,
    test_date DATE,
    provider_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pre-Visit Intake Forms
CREATE TABLE IF NOT EXISTS pre_visit_intake_forms (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    appointment_id INTEGER REFERENCES appointments(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    intake_data JSONB NOT NULL, -- Flexible JSON structure for different intake forms
    form_type VARCHAR(100), -- general, surgery_prep, lab_prep, imaging_prep
    status VARCHAR(50) DEFAULT 'in_progress', -- in_progress, completed, submitted
    submitted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prep Instructions Templates
CREATE TABLE IF NOT EXISTS prep_instruction_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    instruction_type VARCHAR(100) NOT NULL, -- fasting_blood_test, imaging_mri, imaging_ct, surgery_prep, etc.
    title VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    timing_hours_before INTEGER, -- e.g., 12 hours before for fasting
    send_via_sms BOOLEAN DEFAULT true,
    send_via_email BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prep Instructions Sent
CREATE TABLE IF NOT EXISTS prep_instructions_sent (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    appointment_id INTEGER REFERENCES appointments(id),
    template_id INTEGER REFERENCES prep_instruction_templates(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    instruction_type VARCHAR(100) NOT NULL,
    instructions_text TEXT NOT NULL,
    sent_via_sms BOOLEAN DEFAULT false,
    sent_via_email BOOLEAN DEFAULT false,
    sms_message_id VARCHAR(255),
    email_message_id VARCHAR(255),
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medication Protocols (Decision Trees)
CREATE TABLE IF NOT EXISTS medication_protocols (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    medication_name_pattern VARCHAR(255), -- e.g., "insulin*", "blood pressure*"
    medication_category VARCHAR(100), -- controlled_substance, maintenance, acute, etc.
    protocol_rules JSONB NOT NULL, -- Decision tree structure
    auto_approve_conditions JSONB, -- Conditions for auto-approval
    auto_deny_conditions JSONB, -- Conditions for auto-denial
    requires_review_conditions JSONB, -- Conditions requiring provider review
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lab Test Normal Ranges
CREATE TABLE IF NOT EXISTS lab_test_ranges (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(100), -- LOINC code or internal code
    normal_range_min NUMERIC,
    normal_range_max NUMERIC,
    normal_range_text VARCHAR(255),
    unit VARCHAR(50),
    age_min INTEGER, -- Age range for this normal range
    age_max INTEGER,
    gender VARCHAR(20), -- male, female, all
    interpretation_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_med_refill_conversation ON medication_refill_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_med_refill_status ON medication_refill_requests(status);
CREATE INDEX IF NOT EXISTS idx_lab_results_conversation ON lab_results(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_test_name ON lab_results(test_name);
CREATE INDEX IF NOT EXISTS idx_intake_conversation ON pre_visit_intake_forms(conversation_id);
CREATE INDEX IF NOT EXISTS idx_intake_appointment ON pre_visit_intake_forms(appointment_id);
CREATE INDEX IF NOT EXISTS idx_prep_sent_conversation ON prep_instructions_sent(conversation_id);
CREATE INDEX IF NOT EXISTS idx_prep_sent_appointment ON prep_instructions_sent(appointment_id);
CREATE INDEX IF NOT EXISTS idx_med_protocols_org ON medication_protocols(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_ranges_org ON lab_test_ranges(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_ranges_test_name ON lab_test_ranges(test_name);

