-- GoHighLevel Integrations Table
CREATE TABLE IF NOT EXISTS grm_integrations (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('google', 'ghl')),
  credentials JSONB DEFAULT '{}', -- Stores access_token, refresh_token, etc.
  config JSONB DEFAULT '{}', -- Stores calendar_id, sync settings
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_grm_integrations_org ON grm_integrations(organization_id);

-- HL7 Configuration Table (Optional, can be part of organizations config but cleaner separate)
CREATE TABLE IF NOT EXISTS hl7_config (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
  port INTEGER DEFAULT 7777,
  allowed_ips TEXT[], -- Array of IP addresses allowed to send MLLP
  mapping_config JSONB DEFAULT '{}', -- Custom segment mapping
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hl7_config_org ON hl7_config(organization_id);
