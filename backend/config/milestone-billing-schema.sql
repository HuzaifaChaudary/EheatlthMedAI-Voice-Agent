-- Billing Specialist Feature Schemas

-- Patient Statements/Bills
CREATE TABLE IF NOT EXISTS patient_statements (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    statement_number VARCHAR(100) UNIQUE NOT NULL,
    statement_date DATE NOT NULL,
    due_date DATE,
    total_amount NUMERIC(10,2) NOT NULL,
    balance_due NUMERIC(10,2) NOT NULL,
    statement_items JSONB NOT NULL, -- Array of line items
    insurance_info JSONB, -- Insurance details
    payment_history JSONB, -- Payment history
    status VARCHAR(50) DEFAULT 'pending', -- pending, paid, partial, overdue, disputed
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    statement_id INTEGER REFERENCES patient_statements(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    payment_amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL, -- credit_card, debit_card, bank_transfer, check, cash
    payment_gateway VARCHAR(50), -- stripe, paypal, square, etc.
    gateway_transaction_id VARCHAR(255), -- Transaction ID from payment gateway
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, refunded
    receipt_generated BOOLEAN DEFAULT false,
    receipt_url VARCHAR(500),
    receipt_sent_via_email BOOLEAN DEFAULT false,
    receipt_sent_via_sms BOOLEAN DEFAULT false,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    failure_reason TEXT,
    metadata JSONB, -- Additional payment metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Receipts
CREATE TABLE IF NOT EXISTS payment_receipts (
    id SERIAL PRIMARY KEY,
    payment_id INTEGER REFERENCES payments(id),
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    receipt_date DATE NOT NULL,
    patient_name VARCHAR(255) NOT NULL,
    patient_email VARCHAR(255),
    patient_phone VARCHAR(20),
    payment_amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    receipt_pdf_url VARCHAR(500),
    receipt_html TEXT, -- HTML version of receipt
    sent_via_email BOOLEAN DEFAULT false,
    sent_via_sms BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP,
    sms_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insurance Information
CREATE TABLE IF NOT EXISTS insurance_information (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    patient_identifier VARCHAR(255) NOT NULL, -- email, phone, or patient ID
    insurance_provider VARCHAR(255) NOT NULL,
    policy_number VARCHAR(100),
    group_number VARCHAR(100),
    member_id VARCHAR(100),
    coverage_type VARCHAR(100), -- primary, secondary, tertiary
    effective_date DATE,
    expiration_date DATE,
    copay_amount NUMERIC(10,2),
    deductible_amount NUMERIC(10,2),
    coinsurance_percentage NUMERIC(5,2),
    out_of_pocket_maximum NUMERIC(10,2),
    coverage_details JSONB, -- Detailed coverage information
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insurance Questions Knowledge Base
CREATE TABLE IF NOT EXISTS insurance_qa_knowledge_base (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    question_category VARCHAR(100), -- coverage, claims, copay, deductible, etc.
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    related_keywords TEXT[], -- Keywords that match this Q&A
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment Gateway Configurations
CREATE TABLE IF NOT EXISTS payment_gateway_configs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    gateway_name VARCHAR(50) NOT NULL, -- stripe, paypal, square, etc.
    gateway_type VARCHAR(50) NOT NULL, -- credit_card, bank_transfer, etc.
    api_key_encrypted TEXT, -- Encrypted API key
    api_secret_encrypted TEXT, -- Encrypted API secret
    webhook_secret_encrypted TEXT, -- Encrypted webhook secret
    merchant_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_test_mode BOOLEAN DEFAULT true,
    configuration JSONB, -- Additional gateway-specific configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Statement Line Items (normalized from JSONB for better querying)
CREATE TABLE IF NOT EXISTS statement_line_items (
    id SERIAL PRIMARY KEY,
    statement_id INTEGER REFERENCES patient_statements(id),
    item_description TEXT NOT NULL,
    service_date DATE,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(10,2),
    total_price NUMERIC(10,2) NOT NULL,
    insurance_paid NUMERIC(10,2) DEFAULT 0,
    patient_responsible NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_statements_conversation ON patient_statements(conversation_id);
CREATE INDEX IF NOT EXISTS idx_statements_patient ON patient_statements(patient_email, patient_phone);
CREATE INDEX IF NOT EXISTS idx_statements_status ON patient_statements(status);
CREATE INDEX IF NOT EXISTS idx_payments_conversation ON payments(conversation_id);
CREATE INDEX IF NOT EXISTS idx_payments_statement ON payments(statement_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_txn ON payments(gateway_transaction_id);
CREATE INDEX IF NOT EXISTS idx_receipts_payment ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_insurance_patient ON insurance_information(patient_identifier);
CREATE INDEX IF NOT EXISTS idx_insurance_qa_org ON insurance_qa_knowledge_base(organization_id);
CREATE INDEX IF NOT EXISTS idx_insurance_qa_category ON insurance_qa_knowledge_base(question_category);
CREATE INDEX IF NOT EXISTS idx_payment_gateway_org ON payment_gateway_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_line_items_statement ON statement_line_items(statement_id);

