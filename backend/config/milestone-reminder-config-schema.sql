-- Reminder Configuration Schema
-- Stores SMS (Twilio) and Email (SMTP) configuration per organization

CREATE TABLE IF NOT EXISTS reminder_configurations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- SMS/Twilio Configuration
    twilio_account_sid VARCHAR(255),
    twilio_auth_token_encrypted TEXT, -- Store encrypted, decrypt when needed
    twilio_phone_number VARCHAR(20),
    twilio_enabled BOOLEAN DEFAULT false,
    
    -- Email/SMTP Configuration
    smtp_host VARCHAR(255) DEFAULT 'smtp.gmail.com',
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(255),
    smtp_password_encrypted TEXT, -- Store encrypted, decrypt when needed
    smtp_from_name VARCHAR(255),
    smtp_from_email VARCHAR(255),
    smtp_enabled BOOLEAN DEFAULT false,
    
    -- Test Results (for testing configuration)
    last_sms_test_at TIMESTAMP,
    last_sms_test_status VARCHAR(50),
    last_sms_test_message TEXT,
    
    last_email_test_at TIMESTAMP,
    last_email_test_status VARCHAR(50),
    last_email_test_message TEXT,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(organization_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reminder_config_organization_id ON reminder_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_reminder_config_active ON reminder_configurations(is_active);

