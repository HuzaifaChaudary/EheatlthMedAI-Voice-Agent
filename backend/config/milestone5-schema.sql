-- Milestone 5: SRS Organization, Change Control & Next Deliverables Schema

-- SRS Document Structure
CREATE TABLE IF NOT EXISTS srs_documents (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    document_id VARCHAR(50) UNIQUE NOT NULL, -- SRS-001, SRS-002, etc.
    title VARCHAR(255) NOT NULL,
    section VARCHAR(100) NOT NULL, -- overview, functional_requirements, external_interfaces, nfrs, data_models, use_cases, acceptance_criteria, deployment_ops, appendices
    subsection VARCHAR(100),
    content TEXT NOT NULL,
    version VARCHAR(20) DEFAULT '1.0',
    status VARCHAR(50) DEFAULT 'draft', -- draft, in_review, approved, published, deprecated
    author_id INTEGER REFERENCES users(id),
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SRS Version History
CREATE TABLE IF NOT EXISTS srs_versions (
    id SERIAL PRIMARY KEY,
    document_id INTEGER REFERENCES srs_documents(id),
    version VARCHAR(20) NOT NULL,
    change_summary TEXT,
    changed_by INTEGER REFERENCES users(id),
    change_type VARCHAR(50), -- major, minor, patch, correction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_id, version)
);

-- Change Control Log
CREATE TABLE IF NOT EXISTS change_control_log (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    change_id VARCHAR(50) UNIQUE NOT NULL, -- CHG-001, CHG-002, etc.
    change_type VARCHAR(50) NOT NULL, -- requirement_change, constraint_change, assumption_change, new_feature, bug_fix
    affected_documents INTEGER[], -- array of srs_documents IDs
    affected_requirements INTEGER[], -- array of requirements IDs
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reason TEXT,
    impact_assessment TEXT,
    proposed_by INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'proposed', -- proposed, under_review, approved, rejected, implemented
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMP,
    approved_by INTEGER REFERENCES users(id),
    approved_at TIMESTAMP,
    implemented_by INTEGER REFERENCES users(id),
    implemented_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Workflow
CREATE TABLE IF NOT EXISTS approval_workflows (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    workflow_name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(100) NOT NULL, -- srs_approval, requirement_approval, change_approval
    steps JSONB NOT NULL, -- array of approval steps with roles and order
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Approval Records
CREATE TABLE IF NOT EXISTS approval_records (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER REFERENCES approval_workflows(id),
    entity_type VARCHAR(100) NOT NULL, -- srs_document, requirement, change_control
    entity_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    approver_role VARCHAR(50),
    approver_id INTEGER REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, skipped
    comments TEXT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deliverables Tracking
CREATE TABLE IF NOT EXISTS deliverables (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    deliverable_id VARCHAR(50) UNIQUE NOT NULL, -- DEL-001, DEL-002, etc.
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL, -- functional_requirements, external_interfaces, nfrs, workflows, data_models, test_plans
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    status VARCHAR(50) DEFAULT 'planned', -- planned, in_progress, review, completed, blocked
    assigned_to INTEGER REFERENCES users(id),
    due_date DATE,
    completed_date DATE,
    dependencies INTEGER[], -- array of other deliverable IDs
    related_requirements INTEGER[], -- array of requirements IDs
    related_documents INTEGER[], -- array of srs_documents IDs
    acceptance_criteria TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deliverable Milestones
CREATE TABLE IF NOT EXISTS deliverable_milestones (
    id SERIAL PRIMARY KEY,
    deliverable_id INTEGER REFERENCES deliverables(id) ON DELETE CASCADE,
    milestone_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SRS Section Templates
CREATE TABLE IF NOT EXISTS srs_section_templates (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    template_content TEXT, -- template structure/content
    required_fields JSONB, -- array of required field names
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_srs_documents_org ON srs_documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_srs_documents_section ON srs_documents(section);
CREATE INDEX IF NOT EXISTS idx_srs_documents_status ON srs_documents(status);
CREATE INDEX IF NOT EXISTS idx_srs_versions_doc ON srs_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_change_control_org ON change_control_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_change_control_status ON change_control_log(status);
CREATE INDEX IF NOT EXISTS idx_approval_workflows_org ON approval_workflows(organization_id);
CREATE INDEX IF NOT EXISTS idx_approval_records_entity ON approval_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_org ON deliverables(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);
CREATE INDEX IF NOT EXISTS idx_deliverables_category ON deliverables(category);

-- Insert default SRS section templates
INSERT INTO srs_section_templates (section, title, description, template_content, required_fields) VALUES
    ('overview', 'Overview', 'High-level system overview and purpose', 'System Purpose\nSystem Scope\nSystem Context\nStakeholders', '["purpose", "scope", "context"]'::jsonb),
    ('functional_requirements', 'Functional Requirements', 'Detailed functional requirements', 'Feature Description\nUser Stories\nAcceptance Criteria\nDependencies', '["feature", "user_stories", "acceptance_criteria"]'::jsonb),
    ('external_interfaces', 'External Interfaces', 'API and integration specifications', 'Interface Name\nProtocol\nData Format\nAuthentication\nEndpoints', '["interface_name", "protocol", "endpoints"]'::jsonb),
    ('nfrs', 'Non-Functional Requirements', 'Performance, security, scalability requirements', 'Category\nRequirement\nMeasurement Criteria\nTarget Value', '["category", "requirement", "target_value"]'::jsonb),
    ('data_models', 'Data Models', 'Database schema and data structures', 'Entity Name\nAttributes\nRelationships\nConstraints', '["entity_name", "attributes"]'::jsonb),
    ('use_cases', 'Use Cases', 'Detailed use case scenarios', 'Use Case ID\nActor\nPreconditions\nMain Flow\nAlternate Flows\nPostconditions', '["use_case_id", "actor", "main_flow"]'::jsonb),
    ('acceptance_criteria', 'Acceptance Criteria', 'Testable acceptance criteria', 'Criterion ID\nDescription\nTest Method\nPass/Fail Criteria', '["criterion_id", "description", "test_method"]'::jsonb),
    ('deployment_ops', 'Deployment & Operations', 'Deployment and operational procedures', 'Deployment Steps\nInfrastructure Requirements\nMonitoring\nBackup & Recovery', '["deployment_steps", "infrastructure"]'::jsonb),
    ('appendices', 'Appendices', 'Additional reference materials', 'Appendix Title\nContent\nReferences', '["title", "content"]'::jsonb)
ON CONFLICT (section) DO NOTHING;

-- Insert default approval workflow
INSERT INTO approval_workflows (organization_id, workflow_name, workflow_type, steps, is_active)
SELECT 
    o.id,
    'Standard SRS Approval',
    'srs_approval',
    '[
      {"step": 1, "role": "author", "action": "submit"},
      {"step": 2, "role": "pm", "action": "review"},
      {"step": 3, "role": "compliance", "action": "approve"},
      {"step": 4, "role": "admin", "action": "publish"}
    ]'::jsonb,
    true
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM approval_workflows WHERE workflow_type = 'srs_approval');

-- Insert default deliverables
INSERT INTO deliverables (deliverable_id, organization_id, title, description, category, priority, status) VALUES
    ('DEL-FR-001', (SELECT id FROM organizations LIMIT 1), 'Detailed Functional Requirements', 'Complete functional requirements specification for all agent types and platform features', 'functional_requirements', 'high', 'planned'),
    ('DEL-EXT-001', (SELECT id FROM organizations LIMIT 1), 'External Interface Specifications', 'Complete API documentation, webhook specifications, and integration protocols', 'external_interfaces', 'high', 'planned'),
    ('DEL-NFR-001', (SELECT id FROM organizations LIMIT 1), 'Non-Functional Requirements', 'Performance, security, scalability, and reliability requirements with measurement criteria', 'nfrs', 'high', 'planned'),
    ('DEL-WF-001', (SELECT id FROM organizations LIMIT 1), 'Workflow Specifications', 'Detailed workflows for all agent types and system processes', 'workflows', 'medium', 'planned'),
    ('DEL-DM-001', (SELECT id FROM organizations LIMIT 1), 'Data Models', 'Complete database schema, entity relationships, and data flow diagrams', 'data_models', 'high', 'planned'),
    ('DEL-TP-001', (SELECT id FROM organizations LIMIT 1), 'Test Plans', 'Comprehensive test plans including unit, integration, system, and acceptance testing', 'test_plans', 'high', 'planned')
ON CONFLICT (deliverable_id) DO NOTHING;

