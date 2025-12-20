-- SMS Messages table
CREATE TABLE IF NOT EXISTS sms_messages (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    conversation_id INTEGER REFERENCES conversations(id),
    to_number VARCHAR(20) NOT NULL,
    from_number VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    provider_message_id VARCHAR(255),
    status VARCHAR(50) DEFAULT 'sent',
    direction VARCHAR(10) NOT NULL, -- inbound, outbound
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Voicemails table
CREATE TABLE IF NOT EXISTS voicemails (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    call_log_id INTEGER REFERENCES call_logs(id),
    caller_phone VARCHAR(20) NOT NULL,
    called_number VARCHAR(20) NOT NULL,
    recording_url VARCHAR(500) NOT NULL,
    recording_sid VARCHAR(255),
    duration_seconds INTEGER,
    transcription_text TEXT,
    status VARCHAR(50) DEFAULT 'received', -- received, read, deleted
    read_at TIMESTAMP,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Real-time call transcriptions table
CREATE TABLE IF NOT EXISTS call_transcriptions (
    id SERIAL PRIMARY KEY,
    call_log_id INTEGER REFERENCES call_logs(id),
    organization_id INTEGER REFERENCES organizations(id),
    transcription_text TEXT NOT NULL,
    confidence NUMERIC(5,2),
    speaker VARCHAR(50), -- user, assistant
    timestamp_seconds INTEGER, -- Time in call when this was transcribed
    is_final BOOLEAN DEFAULT false, -- true for final transcription, false for interim
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sms_messages_organization_id ON sms_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_conversation_id ON sms_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_number ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_voicemails_organization_id ON voicemails(organization_id);
CREATE INDEX IF NOT EXISTS idx_voicemails_call_log_id ON voicemails(call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_transcriptions_call_log_id ON call_transcriptions(call_log_id);
CREATE INDEX IF NOT EXISTS idx_call_transcriptions_organization_id ON call_transcriptions(organization_id);

