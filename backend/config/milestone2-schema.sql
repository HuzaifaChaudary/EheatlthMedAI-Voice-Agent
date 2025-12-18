-- Milestone 2: Stakeholders, Terminology & References Schema

-- Stakeholder types
CREATE TABLE IF NOT EXISTS stakeholder_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL, -- pm, engineering, security, qa, compliance, implementation, legal, client_it
    name VARCHAR(100) NOT NULL,
    description TEXT,
    reading_guidance TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Terminology/Glossary
CREATE TABLE IF NOT EXISTS terminology (
    id SERIAL PRIMARY KEY,
    term VARCHAR(255) UNIQUE NOT NULL,
    acronym VARCHAR(50),
    definition TEXT NOT NULL,
    category VARCHAR(100), -- hipaa, technical, medical, legal, telephony
    related_terms INTEGER[], -- array of terminology IDs
    reference_urls TEXT[], -- array of reference IDs or URLs
    stakeholder_relevance TEXT[], -- which stakeholder types should know this
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reference Standards
CREATE TABLE IF NOT EXISTS reference_standards (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL, -- HIPAA, HL7, FHIR, TCPA, etc.
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100), -- regulation, standard, protocol, template
    description TEXT,
    authority VARCHAR(255), -- HHS, HL7, IEEE, ISO, etc.
    version VARCHAR(50),
    document_url VARCHAR(500),
    applicable_sections TEXT[], -- array of section references
    stakeholder_relevance TEXT[], -- which stakeholder types need this
    compliance_requirements TEXT, -- what we need to do to comply
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reading Guidance by Stakeholder
CREATE TABLE IF NOT EXISTS reading_guidance (
    id SERIAL PRIMARY KEY,
    stakeholder_type_id INTEGER REFERENCES stakeholder_types(id),
    section VARCHAR(100) NOT NULL, -- overview, architecture, security, compliance, api, etc.
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
    estimated_time_minutes INTEGER,
    prerequisites TEXT[], -- other sections or documents
    related_references INTEGER[], -- array of reference_standards IDs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User stakeholder assignments
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stakeholder_types TEXT[]; -- array of stakeholder type codes

-- Insert stakeholder types
INSERT INTO stakeholder_types (code, name, description, reading_guidance) VALUES
    ('pm', 'Product Manager', 'Product managers responsible for feature planning and roadmap', 'Focus on overview, features, user stories, and integration capabilities'),
    ('engineering', 'Engineering', 'Software engineers and developers building the platform', 'Focus on architecture, API documentation, technical implementation, and code standards'),
    ('security', 'Security', 'Security professionals ensuring platform security and compliance', 'Focus on security architecture, encryption, access controls, audit logs, and vulnerability management'),
    ('qa', 'QA/Testing', 'Quality assurance and testing teams', 'Focus on test cases, test scenarios, acceptance criteria, and testing procedures'),
    ('compliance', 'Compliance', 'Compliance officers ensuring regulatory adherence', 'Focus on HIPAA compliance, BAA requirements, data retention, audit trails, and regulatory standards'),
    ('implementation', 'Implementation', 'Implementation consultants and customer success teams', 'Focus on setup guides, configuration, integration steps, and deployment procedures'),
    ('legal', 'Legal', 'Legal counsel reviewing contracts and compliance', 'Focus on BAA templates, terms of service, privacy policies, and regulatory requirements'),
    ('client_it', 'Client IT Teams', 'Client IT teams integrating the platform', 'Focus on API documentation, integration guides, webhooks, authentication, and technical requirements')
ON CONFLICT (code) DO NOTHING;

-- Insert terminology
INSERT INTO terminology (term, acronym, definition, category, stakeholder_relevance) VALUES
    ('Health Insurance Portability and Accountability Act', 'HIPAA', 'US federal law that sets standards for protecting sensitive patient health information. Requires covered entities and business associates to implement safeguards for PHI.', 'hipaa', ARRAY['compliance', 'legal', 'security', 'pm']),
    ('Business Associate Agreement', 'BAA', 'A written contract between a covered entity and a business associate that ensures the business associate will safeguard PHI. Required under HIPAA.', 'legal', ARRAY['compliance', 'legal', 'pm']),
    ('Health Level Seven', 'HL7', 'A set of international standards for transfer of clinical and administrative data between software applications used by healthcare providers.', 'medical', ARRAY['engineering', 'implementation', 'client_it']),
    ('Fast Healthcare Interoperability Resources', 'FHIR', 'A standard for exchanging healthcare information electronically. Built on HL7 and designed to be web-based.', 'medical', ARRAY['engineering', 'implementation', 'client_it']),
    ('Natural Language Understanding', 'NLU', 'A branch of AI that helps computers understand, interpret, and respond to human language in a valuable way. Used in voice AI agents.', 'technical', ARRAY['engineering', 'pm']),
    ('Text-to-Speech', 'TTS', 'Technology that converts written text into spoken words. Used in voice AI agents to respond to users.', 'technical', ARRAY['engineering', 'pm']),
    ('Transport Layer Security', 'TLS', 'A cryptographic protocol designed to provide secure communication over a computer network. Used to encrypt data in transit.', 'security', ARRAY['security', 'engineering', 'compliance']),
    ('Advanced Encryption Standard 256-bit', 'AES-256', 'A symmetric encryption algorithm using 256-bit keys. Used to encrypt data at rest. Considered highly secure.', 'security', ARRAY['security', 'engineering', 'compliance']),
    ('Role-Based Access Control', 'RBAC', 'A method of restricting system access to authorized users based on their roles within an organization. Users are assigned roles with specific permissions.', 'security', ARRAY['security', 'engineering', 'compliance', 'pm']),
    ('Telephone Consumer Protection Act', 'TCPA', 'US federal law that restricts telemarketing calls, auto-dialed calls, prerecorded calls, text messages, and faxes. Requires consent for automated calls.', 'legal', ARRAY['legal', 'compliance', 'pm'])
ON CONFLICT (term) DO NOTHING;

-- Insert reference standards
INSERT INTO reference_standards (code, name, type, description, authority, version, document_url, stakeholder_relevance, compliance_requirements) VALUES
    ('HIPAA', 'Health Insurance Portability and Accountability Act', 'regulation', 'Federal law protecting patient health information', 'HHS', '1996', 'https://www.hhs.gov/hipaa', ARRAY['compliance', 'legal', 'security'], 'Implement administrative, physical, and technical safeguards. Execute BAAs with all vendors. Maintain audit logs. Encrypt PHI in transit and at rest.'),
    ('HL7', 'Health Level Seven Standards', 'standard', 'Standards for exchanging health information', 'HL7 International', 'v2.8', 'https://www.hl7.org', ARRAY['engineering', 'implementation', 'client_it'], 'Support HL7 message formats for EHR integration. Implement proper message structure and validation.'),
    ('FHIR', 'Fast Healthcare Interoperability Resources', 'standard', 'Modern standard for healthcare data exchange', 'HL7 International', 'R4', 'https://www.hl7.org/fhir', ARRAY['engineering', 'implementation', 'client_it'], 'Implement FHIR REST API. Support FHIR resources for patient data, appointments, and clinical information.'),
    ('TCPA', 'Telephone Consumer Protection Act', 'regulation', 'Federal law regulating automated calls and texts', 'FCC', '1991', 'https://www.fcc.gov/general/telephone-consumer-protection-act-tcpa', ARRAY['legal', 'compliance', 'pm'], 'Obtain express written consent before automated calls. Provide opt-out mechanisms. Maintain consent records. Honor Do Not Call lists.'),
    ('BAA_TEMPLATE', 'Business Associate Agreement Template', 'template', 'Standard BAA template for HIPAA compliance', 'HHS', 'N/A', 'https://www.hhs.gov/hipaa/for-professionals/covered-entities/sample-business-associate-agreement-provisions', ARRAY['legal', 'compliance'], 'Use HHS-approved BAA template. Customize for specific vendor relationships. Ensure all required provisions are included.'),
    ('IEEE_830', 'IEEE 830 Software Requirements Specification', 'standard', 'Standard for software requirements documentation', 'IEEE', '1998', 'https://standards.ieee.org', ARRAY['engineering', 'pm', 'qa'], 'Follow IEEE 830 structure for requirements documentation. Include functional and non-functional requirements.'),
    ('ISO_27001', 'ISO/IEC 27001 Information Security Management', 'standard', 'International standard for information security management', 'ISO/IEC', '2022', 'https://www.iso.org/isoiec-27001-information-security.html', ARRAY['security', 'compliance'], 'Implement ISMS. Conduct risk assessments. Maintain security controls. Regular audits and reviews.')
ON CONFLICT (code) DO NOTHING;

-- Insert reading guidance
INSERT INTO reading_guidance (stakeholder_type_id, section, title, content, priority, estimated_time_minutes, prerequisites, related_references)
SELECT 
    st.id,
    'overview',
    'Platform Overview',
    'Start here to understand the EHealth Med AI platform: its purpose, core capabilities, and value proposition. This section provides a high-level understanding of the white-label SaaS AI Voice Agent platform for healthcare.',
    'high',
    15,
    '{}'::TEXT[],
    '{}'::INTEGER[]
FROM stakeholder_types st WHERE st.code = 'pm'
UNION ALL
SELECT 
    st.id,
    'architecture',
    'System Architecture',
    'Detailed technical architecture including database schema, API structure, authentication flow, and integration patterns. Essential for understanding how to build and extend the platform.',
    'high',
    60,
    ARRAY['overview'],
    '{}'::INTEGER[]
FROM stakeholder_types st WHERE st.code = 'engineering'
UNION ALL
SELECT 
    st.id,
    'security',
    'Security Architecture',
    'Comprehensive security documentation covering encryption (AES-256, TLS), access controls (RBAC), audit logging, vulnerability management, and security best practices.',
    'high',
    45,
    ARRAY['architecture'],
    '{}'::INTEGER[]
FROM stakeholder_types st WHERE st.code = 'security'
UNION ALL
SELECT 
    st.id,
    'compliance',
    'HIPAA Compliance Guide',
    'Complete guide to HIPAA compliance including BAA requirements, PHI protection, audit trails, data retention policies, and compliance checklists.',
    'high',
    90,
    ARRAY['overview'],
    '{}'::INTEGER[]
FROM stakeholder_types st WHERE st.code = 'compliance'
UNION ALL
SELECT 
    st.id,
    'api',
    'API Documentation',
    'Complete API reference including authentication, endpoints, request/response formats, error handling, rate limits, and integration examples.',
    'high',
    120,
    ARRAY['architecture'],
    '{}'::INTEGER[]
FROM stakeholder_types st WHERE st.code IN ('engineering', 'client_it', 'implementation');

