-- FAQ Knowledge Base Table for Front Desk Agent
-- This table stores common questions and answers for hours, directions, services, etc.

CREATE TABLE IF NOT EXISTS faq_knowledge_base (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'hours', 'directions', 'services', 'general'
    priority INTEGER DEFAULT 0, -- Higher priority = shown first
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_faq_organization_id ON faq_knowledge_base(organization_id);
CREATE INDEX IF NOT EXISTS idx_faq_category ON faq_knowledge_base(category);
CREATE INDEX IF NOT EXISTS idx_faq_active ON faq_knowledge_base(is_active);
CREATE INDEX IF NOT EXISTS idx_faq_search ON faq_knowledge_base USING gin(to_tsvector('english', question || ' ' || answer));

