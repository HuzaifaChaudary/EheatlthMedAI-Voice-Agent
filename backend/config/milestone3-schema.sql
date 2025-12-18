-- Milestone 3: High-Level System Architecture Schema

-- Presentation Layer: Portals
CREATE TABLE IF NOT EXISTS portals (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- admin, client, patient, provider
    url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    config JSONB, -- portal-specific configuration
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Presentation Layer: SDKs
CREATE TABLE IF NOT EXISTS sdks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    language VARCHAR(50) NOT NULL, -- javascript, python, java, etc.
    version VARCHAR(50) NOT NULL,
    download_url VARCHAR(500),
    documentation_url VARCHAR(500),
    api_key_prefix VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI & Telephony Layer: STT (Speech-to-Text) Configurations
CREATE TABLE IF NOT EXISTS stt_configurations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    provider VARCHAR(100) NOT NULL, -- google, aws, azure, deepgram, etc.
    model VARCHAR(100),
    language_code VARCHAR(10) DEFAULT 'en-US',
    sample_rate INTEGER DEFAULT 16000,
    encoding VARCHAR(50) DEFAULT 'LINEAR16',
    config JSONB, -- provider-specific settings
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI & Telephony Layer: NLU (Natural Language Understanding) Configurations
CREATE TABLE IF NOT EXISTS nlu_configurations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    provider VARCHAR(100) NOT NULL, -- openai, anthropic, google, etc.
    model VARCHAR(100) NOT NULL, -- gpt-4, claude-3, etc.
    temperature DECIMAL(3, 2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    system_prompt TEXT,
    functions JSONB, -- function calling definitions
    config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI & Telephony Layer: TTS (Text-to-Speech) Configurations
CREATE TABLE IF NOT EXISTS tts_configurations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    provider VARCHAR(100) NOT NULL, -- google, aws, azure, elevenlabs, etc.
    voice_id VARCHAR(100),
    voice_name VARCHAR(100),
    language_code VARCHAR(10) DEFAULT 'en-US',
    speaking_rate DECIMAL(4, 2) DEFAULT 1.0,
    pitch DECIMAL(5, 2) DEFAULT 0.0,
    volume_gain_db DECIMAL(5, 2) DEFAULT 0.0,
    config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI & Telephony Layer: Consent Management
CREATE TABLE IF NOT EXISTS consent_records (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number VARCHAR(20) NOT NULL,
    consent_type VARCHAR(50) NOT NULL, -- automated_calls, recording, data_sharing, marketing
    consent_method VARCHAR(50), -- verbal, written, digital, ivr
    consent_status VARCHAR(50) DEFAULT 'granted', -- granted, revoked, expired
    consent_text TEXT,
    recorded_at TIMESTAMP,
    expires_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voice AI & Telephony Layer: Call Recordings
CREATE TABLE IF NOT EXISTS call_recordings (
    id SERIAL PRIMARY KEY,
    call_log_id INTEGER REFERENCES call_logs(id),
    organization_id INTEGER REFERENCES organizations(id),
    recording_url VARCHAR(500) NOT NULL,
    storage_provider VARCHAR(50), -- s3, azure, gcs, local
    storage_path VARCHAR(500),
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    format VARCHAR(20) DEFAULT 'mp3', -- mp3, wav, ogg
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    retention_until TIMESTAMP,
    is_encrypted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Layer: HL7 Connectors
CREATE TABLE IF NOT EXISTS hl7_connectors (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    hl7_version VARCHAR(20) DEFAULT '2.8', -- 2.3, 2.5, 2.8
    message_types TEXT[], -- ADT, ORU, ORM, etc.
    endpoint_url VARCHAR(500),
    authentication_type VARCHAR(50), -- basic, oauth, api_key
    credentials JSONB, -- encrypted credentials
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Layer: FHIR Connectors
CREATE TABLE IF NOT EXISTS fhir_connectors (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    fhir_version VARCHAR(20) DEFAULT 'R4', -- STU3, R4, R5
    base_url VARCHAR(500) NOT NULL,
    resource_types TEXT[], -- Patient, Appointment, Encounter, etc.
    authentication_type VARCHAR(50), -- oauth2, basic, bearer
    credentials JSONB,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Layer: EHR Systems
CREATE TABLE IF NOT EXISTS ehr_systems (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255), -- epic, cerner, allscripts, etc.
    ehr_type VARCHAR(50), -- epic, cerner, allscripts, athena, etc.
    connection_type VARCHAR(50), -- hl7, fhir, api, custom
    connector_id INTEGER, -- references hl7_connectors or fhir_connectors
    connector_type VARCHAR(20), -- hl7, fhir
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT false,
    sync_frequency VARCHAR(50), -- real-time, hourly, daily
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integration Layer: Webhook Events
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id),
    organization_id INTEGER REFERENCES organizations(id),
    event_type VARCHAR(100) NOT NULL, -- call_started, call_ended, appointment_created, etc.
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, retrying
    response_code INTEGER,
    response_body TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Data & Security Layer: Encryption Key Rotation Log
CREATE TABLE IF NOT EXISTS key_rotation_log (
    id SERIAL PRIMARY KEY,
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    organization_id INTEGER REFERENCES organizations(id),
    old_key_encrypted TEXT,
    new_key_encrypted TEXT,
    rotated_by INTEGER REFERENCES users(id),
    rotation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data & Security Layer: Access Control Policies
CREATE TABLE IF NOT EXISTS access_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL, -- agents, calls, patients, appointments
    resource_id INTEGER,
    role VARCHAR(50),
    permissions TEXT[], -- read, write, delete, manage
    conditions JSONB, -- time-based, IP-based, etc.
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics & Reporting: Report Templates
CREATE TABLE IF NOT EXISTS report_templates (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- compliance, performance, financial, custom
    description TEXT,
    query_config JSONB, -- SQL or query configuration
    schedule VARCHAR(100), -- daily, weekly, monthly, custom cron
    recipients TEXT[], -- email addresses
    format VARCHAR(20) DEFAULT 'pdf', -- pdf, csv, json, html
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics & Reporting: Generated Reports
CREATE TABLE IF NOT EXISTS generated_reports (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES report_templates(id),
    organization_id INTEGER REFERENCES organizations(id),
    report_url VARCHAR(500),
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    format VARCHAR(20),
    generated_by INTEGER REFERENCES users(id),
    parameters JSONB, -- date range, filters, etc.
    status VARCHAR(50) DEFAULT 'generating', -- generating, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Multi-channel Voice AI: Channels
CREATE TABLE IF NOT EXISTS voice_channels (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    channel_type VARCHAR(50) NOT NULL, -- phone, sms, whatsapp, web_chat, mobile_app
    channel_config JSONB, -- channel-specific configuration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_portals_organization_id ON portals(organization_id);
CREATE INDEX IF NOT EXISTS idx_sdks_organization_id ON sdks(organization_id);
CREATE INDEX IF NOT EXISTS idx_stt_config_agent_id ON stt_configurations(agent_id);
CREATE INDEX IF NOT EXISTS idx_nlu_config_agent_id ON nlu_configurations(agent_id);
CREATE INDEX IF NOT EXISTS idx_tts_config_agent_id ON tts_configurations(agent_id);
CREATE INDEX IF NOT EXISTS idx_consent_phone ON consent_records(phone_number);
CREATE INDEX IF NOT EXISTS idx_consent_status ON consent_records(consent_status);
CREATE INDEX IF NOT EXISTS idx_call_recordings_call_log_id ON call_recordings(call_log_id);
CREATE INDEX IF NOT EXISTS idx_hl7_connectors_org ON hl7_connectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_fhir_connectors_org ON fhir_connectors(organization_id);
CREATE INDEX IF NOT EXISTS idx_ehr_systems_org ON ehr_systems(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_webhook_id ON webhook_events(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_access_policies_org ON access_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_templates_org ON report_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_generated_reports_template ON generated_reports(template_id);
CREATE INDEX IF NOT EXISTS idx_voice_channels_agent ON voice_channels(agent_id);

