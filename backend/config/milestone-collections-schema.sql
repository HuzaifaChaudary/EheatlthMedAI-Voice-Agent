-- Collections Specialist Feature Schemas

-- Payment Plans
CREATE TABLE IF NOT EXISTS payment_plans (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    statement_id INTEGER REFERENCES patient_statements(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    total_amount NUMERIC(10,2) NOT NULL,
    remaining_balance NUMERIC(10,2) NOT NULL,
    monthly_payment_amount NUMERIC(10,2) NOT NULL,
    number_of_payments INTEGER NOT NULL,
    payment_frequency VARCHAR(50) DEFAULT 'monthly', -- monthly, biweekly, weekly
    start_date DATE NOT NULL,
    next_payment_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, cancelled, defaulted
    terms_agreed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Plan Payments (scheduled and completed)
CREATE TABLE IF NOT EXISTS payment_plan_payments (
    id SERIAL PRIMARY KEY,
    payment_plan_id INTEGER REFERENCES payment_plans(id),
    scheduled_payment_date DATE NOT NULL,
    payment_amount NUMERIC(10,2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, paid, missed, waived
    payment_id INTEGER REFERENCES payments(id), -- Link to actual payment if made
    paid_at TIMESTAMP,
    reminder_sent_at TIMESTAMP,
    reminder_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Overdue Balance Reminders
CREATE TABLE IF NOT EXISTS overdue_balance_reminders (
    id SERIAL PRIMARY KEY,
    statement_id INTEGER REFERENCES patient_statements(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    balance_amount NUMERIC(10,2) NOT NULL,
    days_overdue INTEGER NOT NULL,
    reminder_type VARCHAR(50) NOT NULL, -- sms, email, call, letter
    reminder_status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, cancelled
    scheduled_send_date TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    reminder_content TEXT,
    consent_verified BOOLEAN DEFAULT false,
    tcp_compliant BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TCPA/FCC Compliance - Do Not Call List
CREATE TABLE IF NOT EXISTS do_not_call_list (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number VARCHAR(20) NOT NULL,
    patient_name VARCHAR(255),
    patient_email VARCHAR(255),
    reason VARCHAR(255), -- customer_request, legal_requirement, etc.
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    added_by INTEGER REFERENCES users(id),
    verified BOOLEAN DEFAULT true,
    notes TEXT,
    UNIQUE(organization_id, phone_number)
);

-- TCPA/FCC Compliance - Consent Records
CREATE TABLE IF NOT EXISTS collections_consent_records (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    patient_identifier VARCHAR(255) NOT NULL, -- phone, email, or patient ID
    consent_type VARCHAR(50) NOT NULL, -- sms, call, email, automated_call, automated_text
    consent_status VARCHAR(50) NOT NULL, -- granted, revoked, expired
    consent_method VARCHAR(50), -- verbal, written, electronic, implied
    consent_date TIMESTAMP NOT NULL,
    expiration_date TIMESTAMP, -- For time-limited consent
    revocation_date TIMESTAMP,
    consent_text TEXT, -- Text of what was consented to
    recorded_by INTEGER REFERENCES users(id),
    ip_address VARCHAR(45),
    user_agent TEXT,
    verification_code VARCHAR(50), -- For double opt-in
    verified_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collections Activity Log
CREATE TABLE IF NOT EXISTS collections_activity_log (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    statement_id INTEGER REFERENCES patient_statements(id),
    payment_plan_id INTEGER REFERENCES payment_plans(id),
    activity_type VARCHAR(100) NOT NULL, -- reminder_sent, payment_received, payment_plan_created, consent_granted, consent_revoked, call_made
    activity_description TEXT,
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    performed_by INTEGER REFERENCES users(id), -- NULL if automated
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Additional activity data
);

-- Collections System Integration Config
CREATE TABLE IF NOT EXISTS collections_system_configs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    system_name VARCHAR(100) NOT NULL, -- experian, transunion, debtbuyer_name, etc.
    system_type VARCHAR(50) NOT NULL, -- credit_bureau, debt_collector, legal_service
    api_endpoint VARCHAR(500),
    api_key_encrypted TEXT,
    api_secret_encrypted TEXT,
    configuration JSONB,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collections Cases
CREATE TABLE IF NOT EXISTS collections_cases (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    statement_id INTEGER REFERENCES patient_statements(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    balance_amount NUMERIC(10,2) NOT NULL,
    days_overdue INTEGER NOT NULL,
    case_status VARCHAR(50) DEFAULT 'open', -- open, payment_plan_active, paid_in_full, written_off, sent_to_collections
    assigned_to INTEGER REFERENCES users(id),
    collections_system_id INTEGER REFERENCES collections_system_configs(id),
    external_case_id VARCHAR(255), -- ID from external collections system
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_plans_statement ON payment_plans(statement_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON payment_plans(status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_next_payment ON payment_plans(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_plan_payments_plan ON payment_plan_payments(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_payments_status ON payment_plan_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_plan_payments_scheduled ON payment_plan_payments(scheduled_payment_date);
CREATE INDEX IF NOT EXISTS idx_overdue_reminders_statement ON overdue_balance_reminders(statement_id);
CREATE INDEX IF NOT EXISTS idx_overdue_reminders_status ON overdue_balance_reminders(reminder_status);
CREATE INDEX IF NOT EXISTS idx_overdue_reminders_scheduled ON overdue_balance_reminders(scheduled_send_date);
CREATE INDEX IF NOT EXISTS idx_dnc_list_org_phone ON do_not_call_list(organization_id, phone_number);
CREATE INDEX IF NOT EXISTS idx_collections_consent_org ON collections_consent_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_consent_identifier ON collections_consent_records(patient_identifier);
CREATE INDEX IF NOT EXISTS idx_collections_consent_status ON collections_consent_records(consent_status);
CREATE INDEX IF NOT EXISTS idx_collections_activity_org ON collections_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_activity_type ON collections_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_collections_cases_org ON collections_cases(organization_id);
CREATE INDEX IF NOT EXISTS idx_collections_cases_status ON collections_cases(case_status);
CREATE INDEX IF NOT EXISTS idx_collections_cases_statement ON collections_cases(statement_id);

