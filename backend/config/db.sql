-- EHealth Med AI Complete Database Schema
-- This schema includes all tables from the production database

-- Organizations table (must be first due to foreign keys)
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE,
    domain VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    max_agents INTEGER DEFAULT 5,
    max_users INTEGER DEFAULT 10,
    max_calls_per_month INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    google_id VARCHAR(255),
    google_email VARCHAR(255),
    avatar_url VARCHAR(500),
    organization_id INTEGER REFERENCES organizations(id),
    stakeholder_types TEXT[]
);

-- Phone Numbers table
CREATE TABLE IF NOT EXISTS phone_numbers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number VARCHAR(20) NOT NULL,
    provider VARCHAR(50),
    provider_sid VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    capabilities JSONB,
    monthly_cost NUMERIC(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Voice Agents table
CREATE TABLE IF NOT EXISTS ai_agents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    configuration JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER REFERENCES organizations(id),
    voice_model VARCHAR(100),
    voice_settings JSONB,
    system_prompt TEXT,
    temperature NUMERIC(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,
    phone_number_id INTEGER REFERENCES phone_numbers(id),
    greeting_message TEXT,
    fallback_message TEXT,
    business_hours JSONB,
    escalation_rules JSONB
);

-- Conversations/Interactions table
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    patient_name VARCHAR(255),
    patient_phone VARCHAR(20),
    status VARCHAR(50) DEFAULT 'active',
    transcript JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(id),
    patient_name VARCHAR(255) NOT NULL,
    patient_phone VARCHAR(20),
    patient_email VARCHAR(255),
    appointment_date TIMESTAMP NOT NULL,
    appointment_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for HIPAA compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Integrations table
CREATE TABLE IF NOT EXISTS integrations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    provider VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    credentials JSONB,
    config JSONB,
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL
);

-- Role Permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role VARCHAR(50) NOT NULL,
    permission_id INTEGER REFERENCES permissions(id),
    UNIQUE(role, permission_id)
);

-- Access Policies table
CREATE TABLE IF NOT EXISTS access_policies (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id INTEGER,
    role VARCHAR(50),
    permissions TEXT[],
    conditions JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions TEXT[],
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call Logs table
CREATE TABLE IF NOT EXISTS call_logs (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    phone_number_id INTEGER REFERENCES phone_numbers(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    conversation_id INTEGER REFERENCES conversations(id),
    caller_phone VARCHAR(20),
    caller_name VARCHAR(255),
    direction VARCHAR(10),
    status VARCHAR(50),
    duration_seconds INTEGER,
    recording_url VARCHAR(500),
    transcription_text TEXT,
    cost NUMERIC(10,4),
    provider_call_id VARCHAR(255),
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Encryption Keys table
CREATE TABLE IF NOT EXISTS encryption_keys (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    key_name VARCHAR(255) NOT NULL,
    key_type VARCHAR(50),
    algorithm VARCHAR(50) DEFAULT 'AES-256',
    key_encrypted TEXT NOT NULL,
    rotation_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Call Recordings table
CREATE TABLE IF NOT EXISTS call_recordings (
    id SERIAL PRIMARY KEY,
    call_log_id INTEGER REFERENCES call_logs(id),
    organization_id INTEGER REFERENCES organizations(id),
    recording_url VARCHAR(500) NOT NULL,
    storage_provider VARCHAR(50),
    storage_path VARCHAR(500),
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    format VARCHAR(20) DEFAULT 'mp3',
    encryption_key_id INTEGER REFERENCES encryption_keys(id),
    retention_until TIMESTAMP,
    is_encrypted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Call Metrics table
CREATE TABLE IF NOT EXISTS call_metrics (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    agent_id INTEGER REFERENCES ai_agents(id),
    date DATE NOT NULL,
    total_calls INTEGER DEFAULT 0,
    completed_calls INTEGER DEFAULT 0,
    failed_calls INTEGER DEFAULT 0,
    total_duration_seconds INTEGER DEFAULT 0,
    avg_duration_seconds NUMERIC(10,2),
    total_cost NUMERIC(10,2) DEFAULT 0,
    satisfaction_score NUMERIC(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, agent_id, date)
);

-- Agent Performance table
CREATE TABLE IF NOT EXISTS agent_performance (
    id SERIAL PRIMARY KEY,
    agent_id INTEGER REFERENCES ai_agents(id),
    organization_id INTEGER REFERENCES organizations(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_interactions INTEGER DEFAULT 0,
    successful_interactions INTEGER DEFAULT 0,
    avg_response_time_seconds NUMERIC(10,2),
    avg_satisfaction_score NUMERIC(3,2),
    escalation_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stakeholder Types table
CREATE TABLE IF NOT EXISTS stakeholder_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    reading_guidance TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Terminology table
CREATE TABLE IF NOT EXISTS terminology (
    id SERIAL PRIMARY KEY,
    term VARCHAR(255) UNIQUE NOT NULL,
    acronym VARCHAR(50),
    definition TEXT NOT NULL,
    category VARCHAR(100),
    related_terms INTEGER[],
    reference_urls TEXT[],
    stakeholder_relevance TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reference Standards table
CREATE TABLE IF NOT EXISTS reference_standards (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    description TEXT,
    authority VARCHAR(255),
    version VARCHAR(50),
    document_url VARCHAR(500),
    applicable_sections TEXT[],
    stakeholder_relevance TEXT[],
    compliance_requirements TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requirements table
CREATE TABLE IF NOT EXISTS requirements (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    requirement_id VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirement_type VARCHAR(20) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'draft',
    related_constraints INTEGER[],
    related_assumptions INTEGER[],
    parent_requirement_id INTEGER REFERENCES requirements(id),
    implementation_notes TEXT,
    verification_criteria TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP,
    verified_by INTEGER REFERENCES users(id)
);

-- Operational Assumptions table
CREATE TABLE IF NOT EXISTS operational_assumptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    assumption_id VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    impact_level VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Constraints table
CREATE TABLE IF NOT EXISTS constraints (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    constraint_id VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    constraint_type VARCHAR(50) NOT NULL,
    enforcement_level VARCHAR(20) DEFAULT 'mandatory',
    validation_rule JSONB,
    is_enforced BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deliverables table
CREATE TABLE IF NOT EXISTS deliverables (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id),
    deliverable_id VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(50) DEFAULT 'planned',
    assigned_to INTEGER REFERENCES users(id),
    due_date DATE,
    completed_date DATE,
    dependencies INTEGER[],
    related_requirements INTEGER[],
    related_documents INTEGER[],
    acceptance_criteria TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_agents_type ON ai_agents(type);
CREATE INDEX IF NOT EXISTS idx_ai_agents_organization_id ON ai_agents(organization_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);

CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_organization_id ON phone_numbers(organization_id);

CREATE INDEX IF NOT EXISTS idx_integrations_organization_id ON integrations(organization_id);

CREATE INDEX IF NOT EXISTS idx_access_policies_org ON access_policies(organization_id);

CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);

CREATE INDEX IF NOT EXISTS idx_call_logs_organization_id ON call_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_agent_id ON call_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at ON call_logs(started_at);

CREATE INDEX IF NOT EXISTS idx_call_recordings_call_log_id ON call_recordings(call_log_id);

CREATE INDEX IF NOT EXISTS idx_call_metrics_organization_id ON call_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_metrics_date ON call_metrics(date);

CREATE INDEX IF NOT EXISTS idx_requirements_org ON requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_requirements_category ON requirements(category);
CREATE INDEX IF NOT EXISTS idx_requirements_status ON requirements(status);
CREATE INDEX IF NOT EXISTS idx_requirements_type ON requirements(requirement_type);

CREATE INDEX IF NOT EXISTS idx_assumptions_org ON operational_assumptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_assumptions_category ON operational_assumptions(category);

CREATE INDEX IF NOT EXISTS idx_constraints_org ON constraints(organization_id);
CREATE INDEX IF NOT EXISTS idx_constraints_category ON constraints(category);

CREATE INDEX IF NOT EXISTS idx_deliverables_org ON deliverables(organization_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_category ON deliverables(category);
CREATE INDEX IF NOT EXISTS idx_deliverables_status ON deliverables(status);

-- Insert default AI agents (only if they don't exist)
INSERT INTO ai_agents (name, type, description, is_active)
SELECT 'Front Desk Assistant', 'Front Desk Assistant', 'Handles appointment scheduling, patient check-ins, and general inquiries', true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE name = 'Front Desk Assistant' AND type = 'Front Desk Assistant');

INSERT INTO ai_agents (name, type, description, is_active)
SELECT 'Medical Assistant', 'Medical Assistant', 'Assists with medical information, symptom assessment, and care coordination', true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE name = 'Medical Assistant' AND type = 'Medical Assistant');

INSERT INTO ai_agents (name, type, description, is_active)
SELECT 'Triage Nurse', 'Triage Nurse', 'Performs initial patient assessment and prioritizes care based on urgency', true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE name = 'Triage Nurse' AND type = 'Triage Nurse');

INSERT INTO ai_agents (name, type, description, is_active)
SELECT 'Billing Specialist', 'Billing Specialist', 'Manages billing inquiries, payment processing, and insurance questions', true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE name = 'Billing Specialist' AND type = 'Billing Specialist');

INSERT INTO ai_agents (name, type, description, is_active)
SELECT 'Collections Specialist', 'Collections Specialist', 'Handles payment collections and payment plan arrangements', true
WHERE NOT EXISTS (SELECT 1 FROM ai_agents WHERE name = 'Collections Specialist' AND type = 'Collections Specialist');


--
-- PostgreSQL database dump
--

-- \restrict command removed (psql meta-command, not valid SQL)

-- Dumped from database version 18.0
-- Dumped by pg_dump version 18.0

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout removed (PostgreSQL 14+ only)
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: access_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.access_policies (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    resource_type character varying(100) NOT NULL,
    resource_id integer,
    role character varying(50),
    permissions text[],
    conditions jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: access_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.access_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: access_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.access_policies_id_seq OWNED BY public.access_policies.id;


--
-- Name: agent_performance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.agent_performance (
    id integer NOT NULL,
    agent_id integer,
    organization_id integer,
    period_start date NOT NULL,
    period_end date NOT NULL,
    total_interactions integer DEFAULT 0,
    successful_interactions integer DEFAULT 0,
    avg_response_time_seconds numeric(10,2),
    avg_satisfaction_score numeric(3,2),
    escalation_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: agent_performance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.agent_performance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: agent_performance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.agent_performance_id_seq OWNED BY public.agent_performance.id;


--
-- Name: ai_agents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_agents (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    type character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    configuration jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id integer,
    voice_model character varying(100),
    voice_settings jsonb,
    system_prompt text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 1000,
    phone_number_id integer,
    greeting_message text,
    fallback_message text,
    business_hours jsonb,
    escalation_rules jsonb
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: ai_agents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ai_agents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: ai_agents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ai_agents_id_seq OWNED BY public.ai_agents.id;


--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_keys (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    key_hash character varying(255) NOT NULL,
    key_prefix character varying(20) NOT NULL,
    permissions text[],
    expires_at timestamp without time zone,
    last_used_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: api_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.api_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: api_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.api_keys_id_seq OWNED BY public.api_keys.id;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    conversation_id integer,
    patient_name character varying(255) NOT NULL,
    patient_phone character varying(20),
    patient_email character varying(255),
    appointment_date timestamp without time zone NOT NULL,
    appointment_type character varying(100),
    status character varying(50) DEFAULT 'scheduled'::character varying,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: approval_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_records (
    id integer NOT NULL,
    workflow_id integer,
    entity_type character varying(100) NOT NULL,
    entity_id integer NOT NULL,
    step_number integer NOT NULL,
    approver_role character varying(50),
    approver_id integer,
    status character varying(50) DEFAULT 'pending'::character varying,
    comments text,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: approval_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.approval_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: approval_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.approval_records_id_seq OWNED BY public.approval_records.id;


--
-- Name: approval_workflows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approval_workflows (
    id integer NOT NULL,
    organization_id integer,
    workflow_name character varying(255) NOT NULL,
    workflow_type character varying(100) NOT NULL,
    steps jsonb NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: approval_workflows_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.approval_workflows_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: approval_workflows_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.approval_workflows_id_seq OWNED BY public.approval_workflows.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id integer,
    ip_address character varying(45),
    user_agent text,
    details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: baa_agreements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.baa_agreements (
    id integer NOT NULL,
    organization_id integer,
    vendor_name character varying(255) NOT NULL,
    vendor_type character varying(100),
    status character varying(50) DEFAULT 'pending'::character varying,
    signed_date date,
    expiration_date date,
    document_url character varying(500),
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: baa_agreements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.baa_agreements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: baa_agreements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.baa_agreements_id_seq OWNED BY public.baa_agreements.id;


--
-- Name: branding_configs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branding_configs (
    id integer NOT NULL,
    organization_id integer,
    logo_url character varying(500),
    primary_color character varying(7),
    secondary_color character varying(7),
    company_name character varying(255),
    support_email character varying(255),
    support_phone character varying(20),
    custom_css text,
    favicon_url character varying(500),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: branding_configs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branding_configs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: branding_configs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branding_configs_id_seq OWNED BY public.branding_configs.id;


--
-- Name: call_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_logs (
    id integer NOT NULL,
    organization_id integer,
    phone_number_id integer,
    agent_id integer,
    conversation_id integer,
    caller_phone character varying(20),
    caller_name character varying(255),
    direction character varying(10),
    status character varying(50),
    duration_seconds integer,
    recording_url character varying(500),
    transcription_text text,
    cost numeric(10,4),
    provider_call_id character varying(255),
    started_at timestamp without time zone,
    ended_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.call_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.call_logs_id_seq OWNED BY public.call_logs.id;


--
-- Name: call_metrics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_metrics (
    id integer NOT NULL,
    organization_id integer,
    agent_id integer,
    date date NOT NULL,
    total_calls integer DEFAULT 0,
    completed_calls integer DEFAULT 0,
    failed_calls integer DEFAULT 0,
    total_duration_seconds integer DEFAULT 0,
    avg_duration_seconds numeric(10,2),
    total_cost numeric(10,2) DEFAULT 0,
    satisfaction_score numeric(3,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_metrics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.call_metrics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_metrics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.call_metrics_id_seq OWNED BY public.call_metrics.id;


--
-- Name: call_recordings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.call_recordings (
    id integer NOT NULL,
    call_log_id integer,
    organization_id integer,
    recording_url character varying(500) NOT NULL,
    storage_provider character varying(50),
    storage_path character varying(500),
    duration_seconds integer,
    file_size_bytes bigint,
    format character varying(20) DEFAULT 'mp3'::character varying,
    encryption_key_id integer,
    retention_until timestamp without time zone,
    is_encrypted boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_recordings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.call_recordings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: call_recordings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.call_recordings_id_seq OWNED BY public.call_recordings.id;


--
-- Name: change_control_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.change_control_log (
    id integer NOT NULL,
    organization_id integer,
    change_id character varying(50) NOT NULL,
    change_type character varying(50) NOT NULL,
    affected_documents integer[],
    affected_requirements integer[],
    title character varying(255) NOT NULL,
    description text NOT NULL,
    reason text,
    impact_assessment text,
    proposed_by integer,
    status character varying(50) DEFAULT 'proposed'::character varying,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    approved_by integer,
    approved_at timestamp without time zone,
    implemented_by integer,
    implemented_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: change_control_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.change_control_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: change_control_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.change_control_log_id_seq OWNED BY public.change_control_log.id;


--
-- Name: consent_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.consent_records (
    id integer NOT NULL,
    organization_id integer,
    phone_number character varying(20) NOT NULL,
    consent_type character varying(50) NOT NULL,
    consent_method character varying(50),
    consent_status character varying(50) DEFAULT 'granted'::character varying,
    consent_text text,
    recorded_at timestamp without time zone,
    expires_at timestamp without time zone,
    ip_address character varying(45),
    user_agent text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: consent_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.consent_records_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: consent_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.consent_records_id_seq OWNED BY public.consent_records.id;


--
-- Name: constraint_violations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.constraint_violations (
    id integer NOT NULL,
    constraint_id integer,
    organization_id integer,
    violation_type character varying(100) NOT NULL,
    resource_type character varying(100),
    resource_id integer,
    severity character varying(20) DEFAULT 'warning'::character varying,
    description text NOT NULL,
    detected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    resolved_at timestamp without time zone,
    resolved_by integer,
    resolution_notes text
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: constraint_violations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.constraint_violations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: constraint_violations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.constraint_violations_id_seq OWNED BY public.constraint_violations.id;


--
-- Name: constraints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.constraints (
    id integer NOT NULL,
    organization_id integer,
    constraint_id character varying(50) NOT NULL,
    category character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    constraint_type character varying(50) NOT NULL,
    enforcement_level character varying(20) DEFAULT 'mandatory'::character varying,
    validation_rule jsonb,
    is_enforced boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: constraints_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.constraints_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: constraints_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.constraints_id_seq OWNED BY public.constraints.id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.conversations (
    id integer NOT NULL,
    user_id integer,
    agent_id integer,
    patient_name character varying(255),
    patient_phone character varying(20),
    status character varying(50) DEFAULT 'active'::character varying,
    transcript jsonb,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: conversations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.conversations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: conversations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.conversations_id_seq OWNED BY public.conversations.id;


--
-- Name: deliverable_milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliverable_milestones (
    id integer NOT NULL,
    deliverable_id integer,
    milestone_name character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'pending'::character varying,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: deliverable_milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deliverable_milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: deliverable_milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deliverable_milestones_id_seq OWNED BY public.deliverable_milestones.id;


--
-- Name: deliverables; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliverables (
    id integer NOT NULL,
    organization_id integer,
    deliverable_id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100) NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'planned'::character varying,
    assigned_to integer,
    due_date date,
    completed_date date,
    dependencies integer[],
    related_requirements integer[],
    related_documents integer[],
    acceptance_criteria text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: deliverables_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deliverables_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: deliverables_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deliverables_id_seq OWNED BY public.deliverables.id;


--
-- Name: ehr_systems; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ehr_systems (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    vendor character varying(255),
    ehr_type character varying(50),
    connection_type character varying(50),
    connector_id integer,
    connector_type character varying(20),
    is_active boolean DEFAULT true,
    sync_enabled boolean DEFAULT false,
    sync_frequency character varying(50),
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: ehr_systems_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.ehr_systems_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: ehr_systems_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.ehr_systems_id_seq OWNED BY public.ehr_systems.id;


--
-- Name: encryption_keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.encryption_keys (
    id integer NOT NULL,
    organization_id integer,
    key_name character varying(255) NOT NULL,
    key_type character varying(50),
    algorithm character varying(50) DEFAULT 'AES-256'::character varying,
    key_encrypted text NOT NULL,
    rotation_date date,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp without time zone
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: encryption_keys_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.encryption_keys_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: encryption_keys_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.encryption_keys_id_seq OWNED BY public.encryption_keys.id;


--
-- Name: fhir_connectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fhir_connectors (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    fhir_version character varying(20) DEFAULT 'R4'::character varying,
    base_url character varying(500) NOT NULL,
    resource_types text[],
    authentication_type character varying(50),
    credentials jsonb,
    is_active boolean DEFAULT true,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: fhir_connectors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.fhir_connectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: fhir_connectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.fhir_connectors_id_seq OWNED BY public.fhir_connectors.id;


--
-- Name: generated_reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.generated_reports (
    id integer NOT NULL,
    template_id integer,
    organization_id integer,
    report_url character varying(500),
    file_path character varying(500),
    file_size_bytes bigint,
    format character varying(20),
    generated_by integer,
    parameters jsonb,
    status character varying(50) DEFAULT 'generating'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: generated_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.generated_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: generated_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.generated_reports_id_seq OWNED BY public.generated_reports.id;


--
-- Name: hl7_connectors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.hl7_connectors (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    hl7_version character varying(20) DEFAULT '2.8'::character varying,
    message_types text[],
    endpoint_url character varying(500),
    authentication_type character varying(50),
    credentials jsonb,
    is_active boolean DEFAULT true,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: hl7_connectors_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.hl7_connectors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: hl7_connectors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.hl7_connectors_id_seq OWNED BY public.hl7_connectors.id;


--
-- Name: integrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integrations (
    id integer NOT NULL,
    organization_id integer,
    name character varying(100) NOT NULL,
    type character varying(50) NOT NULL,
    provider character varying(100),
    is_active boolean DEFAULT true,
    credentials jsonb,
    config jsonb,
    last_sync_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: integrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.integrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: integrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.integrations_id_seq OWNED BY public.integrations.id;


--
-- Name: key_rotation_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.key_rotation_log (
    id integer NOT NULL,
    encryption_key_id integer,
    organization_id integer,
    old_key_encrypted text,
    new_key_encrypted text,
    rotated_by integer,
    rotation_reason text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: key_rotation_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.key_rotation_log_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: key_rotation_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.key_rotation_log_id_seq OWNED BY public.key_rotation_log.id;


--
-- Name: nlu_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.nlu_configurations (
    id integer NOT NULL,
    organization_id integer,
    agent_id integer,
    provider character varying(100) NOT NULL,
    model character varying(100) NOT NULL,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 1000,
    system_prompt text,
    functions jsonb,
    config jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: nlu_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.nlu_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: nlu_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.nlu_configurations_id_seq OWNED BY public.nlu_configurations.id;


--
-- Name: operational_assumptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.operational_assumptions (
    id integer NOT NULL,
    organization_id integer,
    assumption_id character varying(50) NOT NULL,
    category character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    impact_level character varying(20) DEFAULT 'medium'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: operational_assumptions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.operational_assumptions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: operational_assumptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.operational_assumptions_id_seq OWNED BY public.operational_assumptions.id;


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.organizations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    subdomain character varying(100),
    domain character varying(255),
    is_active boolean DEFAULT true,
    subscription_tier character varying(50) DEFAULT 'starter'::character varying,
    max_agents integer DEFAULT 5,
    max_users integer DEFAULT 10,
    max_calls_per_month integer DEFAULT 1000,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: organizations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.organizations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: organizations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.organizations_id_seq OWNED BY public.organizations.id;


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    resource character varying(100) NOT NULL,
    action character varying(50) NOT NULL
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.permissions_id_seq OWNED BY public.permissions.id;


--
-- Name: phone_numbers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.phone_numbers (
    id integer NOT NULL,
    organization_id integer,
    phone_number character varying(20) NOT NULL,
    provider character varying(50),
    provider_sid character varying(255),
    is_active boolean DEFAULT true,
    capabilities jsonb,
    monthly_cost numeric(10,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: phone_numbers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.phone_numbers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: phone_numbers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.phone_numbers_id_seq OWNED BY public.phone_numbers.id;


--
-- Name: portals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.portals (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    url character varying(500),
    is_active boolean DEFAULT true,
    config jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: portals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.portals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: portals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.portals_id_seq OWNED BY public.portals.id;


--
-- Name: reading_guidance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reading_guidance (
    id integer NOT NULL,
    stakeholder_type_id integer,
    section character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    estimated_time_minutes integer,
    prerequisites text[],
    related_references integer[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: reading_guidance_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reading_guidance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: reading_guidance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reading_guidance_id_seq OWNED BY public.reading_guidance.id;


--
-- Name: reference_standards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reference_standards (
    id integer NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(100),
    description text,
    authority character varying(255),
    version character varying(50),
    document_url character varying(500),
    applicable_sections text[],
    stakeholder_relevance text[],
    compliance_requirements text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: reference_standards_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reference_standards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: reference_standards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reference_standards_id_seq OWNED BY public.reference_standards.id;


--
-- Name: report_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.report_templates (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    type character varying(50) NOT NULL,
    description text,
    query_config jsonb,
    schedule character varying(100),
    recipients text[],
    format character varying(20) DEFAULT 'pdf'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: report_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.report_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: report_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.report_templates_id_seq OWNED BY public.report_templates.id;


--
-- Name: requirement_dependencies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_dependencies (
    id integer NOT NULL,
    requirement_id integer,
    depends_on_requirement_id integer,
    dependency_type character varying(50) DEFAULT 'requires'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirement_dependencies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.requirement_dependencies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirement_dependencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requirement_dependencies_id_seq OWNED BY public.requirement_dependencies.id;


--
-- Name: requirement_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirement_verifications (
    id integer NOT NULL,
    requirement_id integer,
    verified_by integer,
    verification_method character varying(100),
    verification_result character varying(50) DEFAULT 'passed'::character varying,
    evidence_url character varying(500),
    notes text,
    verified_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirement_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.requirement_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirement_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requirement_verifications_id_seq OWNED BY public.requirement_verifications.id;


--
-- Name: requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.requirements (
    id integer NOT NULL,
    organization_id integer,
    requirement_id character varying(50) NOT NULL,
    category character varying(100) NOT NULL,
    subcategory character varying(100),
    title character varying(255) NOT NULL,
    description text NOT NULL,
    requirement_type character varying(20) NOT NULL,
    priority character varying(20) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    related_constraints integer[],
    related_assumptions integer[],
    parent_requirement_id integer,
    implementation_notes text,
    verification_criteria text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verified_at timestamp without time zone,
    verified_by integer
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.requirements_id_seq OWNED BY public.requirements.id;


--
-- Name: retention_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.retention_policies (
    id integer NOT NULL,
    organization_id integer,
    data_type character varying(100) NOT NULL,
    retention_days integer NOT NULL,
    auto_delete boolean DEFAULT false,
    last_cleanup_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: retention_policies_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.retention_policies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: retention_policies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.retention_policies_id_seq OWNED BY public.retention_policies.id;


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id integer NOT NULL,
    role character varying(50) NOT NULL,
    permission_id integer
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: role_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.role_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: role_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.role_permissions_id_seq OWNED BY public.role_permissions.id;


--
-- Name: sdks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sdks (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    language character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    download_url character varying(500),
    documentation_url character varying(500),
    api_key_prefix character varying(50),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: sdks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.sdks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: sdks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.sdks_id_seq OWNED BY public.sdks.id;


--
-- Name: srs_documents; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.srs_documents (
    id integer NOT NULL,
    organization_id integer,
    document_id character varying(50) NOT NULL,
    title character varying(255) NOT NULL,
    section character varying(100) NOT NULL,
    subsection character varying(100),
    content text NOT NULL,
    version character varying(20) DEFAULT '1.0'::character varying,
    status character varying(50) DEFAULT 'draft'::character varying,
    author_id integer,
    approved_by integer,
    approved_at timestamp without time zone,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.srs_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.srs_documents_id_seq OWNED BY public.srs_documents.id;


--
-- Name: srs_section_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.srs_section_templates (
    id integer NOT NULL,
    section character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    template_content text,
    required_fields jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_section_templates_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.srs_section_templates_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_section_templates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.srs_section_templates_id_seq OWNED BY public.srs_section_templates.id;


--
-- Name: srs_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.srs_versions (
    id integer NOT NULL,
    document_id integer,
    version character varying(20) NOT NULL,
    change_summary text,
    changed_by integer,
    change_type character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_versions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.srs_versions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: srs_versions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.srs_versions_id_seq OWNED BY public.srs_versions.id;


--
-- Name: stakeholder_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stakeholder_types (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    reading_guidance text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: stakeholder_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stakeholder_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: stakeholder_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stakeholder_types_id_seq OWNED BY public.stakeholder_types.id;


--
-- Name: stt_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stt_configurations (
    id integer NOT NULL,
    organization_id integer,
    agent_id integer,
    provider character varying(100) NOT NULL,
    model character varying(100),
    language_code character varying(10) DEFAULT 'en-US'::character varying,
    sample_rate integer DEFAULT 16000,
    encoding character varying(50) DEFAULT 'LINEAR16'::character varying,
    config jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: stt_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.stt_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: stt_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.stt_configurations_id_seq OWNED BY public.stt_configurations.id;


--
-- Name: terminology; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.terminology (
    id integer NOT NULL,
    term character varying(255) NOT NULL,
    acronym character varying(50),
    definition text NOT NULL,
    category character varying(100),
    related_terms integer[],
    reference_urls text[],
    stakeholder_relevance text[],
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: terminology_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.terminology_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: terminology_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.terminology_id_seq OWNED BY public.terminology.id;


--
-- Name: tts_configurations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tts_configurations (
    id integer NOT NULL,
    organization_id integer,
    agent_id integer,
    provider character varying(100) NOT NULL,
    voice_id character varying(100),
    voice_name character varying(100),
    language_code character varying(10) DEFAULT 'en-US'::character varying,
    speaking_rate numeric(4,2) DEFAULT 1.0,
    pitch numeric(5,2) DEFAULT 0.0,
    volume_gain_db numeric(5,2) DEFAULT 0.0,
    config jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: tts_configurations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tts_configurations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: tts_configurations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tts_configurations_id_seq OWNED BY public.tts_configurations.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    role character varying(50) DEFAULT 'user'::character varying,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    reset_token character varying(255),
    reset_token_expires timestamp without time zone,
    google_id character varying(255),
    google_email character varying(255),
    avatar_url character varying(500),
    organization_id integer,
    stakeholder_types text[]
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: voice_channels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.voice_channels (
    id integer NOT NULL,
    organization_id integer,
    agent_id integer,
    channel_type character varying(50) NOT NULL,
    channel_config jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: voice_channels_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.voice_channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: voice_channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.voice_channels_id_seq OWNED BY public.voice_channels.id;


--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id integer NOT NULL,
    webhook_id integer,
    organization_id integer,
    event_type character varying(100) NOT NULL,
    payload jsonb NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying,
    response_code integer,
    response_body text,
    retry_count integer DEFAULT 0,
    next_retry_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: webhook_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webhook_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: webhook_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webhook_events_id_seq OWNED BY public.webhook_events.id;


--
-- Name: webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhooks (
    id integer NOT NULL,
    organization_id integer,
    name character varying(255) NOT NULL,
    url character varying(500) NOT NULL,
    events text[],
    secret_key character varying(255),
    is_active boolean DEFAULT true,
    last_triggered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- OWNER TO postgres removed (not needed, requires superuser)
--
-- Name: webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.webhooks_id_seq OWNED BY public.webhooks.id;


--
-- Name: access_policies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_policies ALTER COLUMN id SET DEFAULT nextval('public.access_policies_id_seq'::regclass);


--
-- Name: agent_performance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_performance ALTER COLUMN id SET DEFAULT nextval('public.agent_performance_id_seq'::regclass);


--
-- Name: ai_agents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents ALTER COLUMN id SET DEFAULT nextval('public.ai_agents_id_seq'::regclass);


--
-- Name: api_keys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys ALTER COLUMN id SET DEFAULT nextval('public.api_keys_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: approval_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_records ALTER COLUMN id SET DEFAULT nextval('public.approval_records_id_seq'::regclass);


--
-- Name: approval_workflows id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_workflows ALTER COLUMN id SET DEFAULT nextval('public.approval_workflows_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: baa_agreements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baa_agreements ALTER COLUMN id SET DEFAULT nextval('public.baa_agreements_id_seq'::regclass);


--
-- Name: branding_configs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branding_configs ALTER COLUMN id SET DEFAULT nextval('public.branding_configs_id_seq'::regclass);


--
-- Name: call_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs ALTER COLUMN id SET DEFAULT nextval('public.call_logs_id_seq'::regclass);


--
-- Name: call_metrics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_metrics ALTER COLUMN id SET DEFAULT nextval('public.call_metrics_id_seq'::regclass);


--
-- Name: call_recordings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_recordings ALTER COLUMN id SET DEFAULT nextval('public.call_recordings_id_seq'::regclass);


--
-- Name: change_control_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log ALTER COLUMN id SET DEFAULT nextval('public.change_control_log_id_seq'::regclass);


--
-- Name: consent_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_records ALTER COLUMN id SET DEFAULT nextval('public.consent_records_id_seq'::regclass);


--
-- Name: constraint_violations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraint_violations ALTER COLUMN id SET DEFAULT nextval('public.constraint_violations_id_seq'::regclass);


--
-- Name: constraints id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraints ALTER COLUMN id SET DEFAULT nextval('public.constraints_id_seq'::regclass);


--
-- Name: conversations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations ALTER COLUMN id SET DEFAULT nextval('public.conversations_id_seq'::regclass);


--
-- Name: deliverable_milestones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverable_milestones ALTER COLUMN id SET DEFAULT nextval('public.deliverable_milestones_id_seq'::regclass);


--
-- Name: deliverables id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverables ALTER COLUMN id SET DEFAULT nextval('public.deliverables_id_seq'::regclass);


--
-- Name: ehr_systems id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ehr_systems ALTER COLUMN id SET DEFAULT nextval('public.ehr_systems_id_seq'::regclass);


--
-- Name: encryption_keys id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encryption_keys ALTER COLUMN id SET DEFAULT nextval('public.encryption_keys_id_seq'::regclass);


--
-- Name: fhir_connectors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_connectors ALTER COLUMN id SET DEFAULT nextval('public.fhir_connectors_id_seq'::regclass);


--
-- Name: generated_reports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports ALTER COLUMN id SET DEFAULT nextval('public.generated_reports_id_seq'::regclass);


--
-- Name: hl7_connectors id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hl7_connectors ALTER COLUMN id SET DEFAULT nextval('public.hl7_connectors_id_seq'::regclass);


--
-- Name: integrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations ALTER COLUMN id SET DEFAULT nextval('public.integrations_id_seq'::regclass);


--
-- Name: key_rotation_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.key_rotation_log ALTER COLUMN id SET DEFAULT nextval('public.key_rotation_log_id_seq'::regclass);


--
-- Name: nlu_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nlu_configurations ALTER COLUMN id SET DEFAULT nextval('public.nlu_configurations_id_seq'::regclass);


--
-- Name: operational_assumptions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operational_assumptions ALTER COLUMN id SET DEFAULT nextval('public.operational_assumptions_id_seq'::regclass);


--
-- Name: organizations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations ALTER COLUMN id SET DEFAULT nextval('public.organizations_id_seq'::regclass);


--
-- Name: permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions ALTER COLUMN id SET DEFAULT nextval('public.permissions_id_seq'::regclass);


--
-- Name: phone_numbers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phone_numbers ALTER COLUMN id SET DEFAULT nextval('public.phone_numbers_id_seq'::regclass);


--
-- Name: portals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portals ALTER COLUMN id SET DEFAULT nextval('public.portals_id_seq'::regclass);


--
-- Name: reading_guidance id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reading_guidance ALTER COLUMN id SET DEFAULT nextval('public.reading_guidance_id_seq'::regclass);


--
-- Name: reference_standards id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reference_standards ALTER COLUMN id SET DEFAULT nextval('public.reference_standards_id_seq'::regclass);


--
-- Name: report_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_templates ALTER COLUMN id SET DEFAULT nextval('public.report_templates_id_seq'::regclass);


--
-- Name: requirement_dependencies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_dependencies ALTER COLUMN id SET DEFAULT nextval('public.requirement_dependencies_id_seq'::regclass);


--
-- Name: requirement_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_verifications ALTER COLUMN id SET DEFAULT nextval('public.requirement_verifications_id_seq'::regclass);


--
-- Name: requirements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirements ALTER COLUMN id SET DEFAULT nextval('public.requirements_id_seq'::regclass);


--
-- Name: retention_policies id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies ALTER COLUMN id SET DEFAULT nextval('public.retention_policies_id_seq'::regclass);


--
-- Name: role_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions ALTER COLUMN id SET DEFAULT nextval('public.role_permissions_id_seq'::regclass);


--
-- Name: sdks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sdks ALTER COLUMN id SET DEFAULT nextval('public.sdks_id_seq'::regclass);


--
-- Name: srs_documents id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_documents ALTER COLUMN id SET DEFAULT nextval('public.srs_documents_id_seq'::regclass);


--
-- Name: srs_section_templates id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_section_templates ALTER COLUMN id SET DEFAULT nextval('public.srs_section_templates_id_seq'::regclass);


--
-- Name: srs_versions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_versions ALTER COLUMN id SET DEFAULT nextval('public.srs_versions_id_seq'::regclass);


--
-- Name: stakeholder_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_types ALTER COLUMN id SET DEFAULT nextval('public.stakeholder_types_id_seq'::regclass);


--
-- Name: stt_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stt_configurations ALTER COLUMN id SET DEFAULT nextval('public.stt_configurations_id_seq'::regclass);


--
-- Name: terminology id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.terminology ALTER COLUMN id SET DEFAULT nextval('public.terminology_id_seq'::regclass);


--
-- Name: tts_configurations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tts_configurations ALTER COLUMN id SET DEFAULT nextval('public.tts_configurations_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: voice_channels id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_channels ALTER COLUMN id SET DEFAULT nextval('public.voice_channels_id_seq'::regclass);


--
-- Name: webhook_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events ALTER COLUMN id SET DEFAULT nextval('public.webhook_events_id_seq'::regclass);


--
-- Name: webhooks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhooks ALTER COLUMN id SET DEFAULT nextval('public.webhooks_id_seq'::regclass);


--
-- Name: access_policies access_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: agent_performance agent_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: ai_agents ai_agents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: approval_records approval_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: approval_workflows approval_workflows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: baa_agreements baa_agreements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: branding_configs branding_configs_organization_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branding_configs
    ADD CONSTRAINT branding_configs_organization_id_key UNIQUE (organization_id);


--
-- Name: branding_configs branding_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: call_logs call_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: call_metrics call_metrics_organization_id_agent_id_date_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_metrics
    ADD CONSTRAINT call_metrics_organization_id_agent_id_date_key UNIQUE (organization_id, agent_id, date);


--
-- Name: call_metrics call_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: call_recordings call_recordings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: change_control_log change_control_log_change_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_change_id_key UNIQUE (change_id);


--
-- Name: change_control_log change_control_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: consent_records consent_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: constraint_violations constraint_violations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: constraints constraints_constraint_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraints
    ADD CONSTRAINT constraints_constraint_id_key UNIQUE (constraint_id);


--
-- Name: constraints constraints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: deliverable_milestones deliverable_milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: deliverables deliverables_deliverable_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_deliverable_id_key UNIQUE (deliverable_id);


--
-- Name: deliverables deliverables_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: ehr_systems ehr_systems_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: encryption_keys encryption_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: fhir_connectors fhir_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: generated_reports generated_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: hl7_connectors hl7_connectors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: integrations integrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: key_rotation_log key_rotation_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: nlu_configurations nlu_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: operational_assumptions operational_assumptions_assumption_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operational_assumptions
    ADD CONSTRAINT operational_assumptions_assumption_id_key UNIQUE (assumption_id);


--
-- Name: operational_assumptions operational_assumptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: organizations organizations_subdomain_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_subdomain_key UNIQUE (subdomain);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: phone_numbers phone_numbers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: portals portals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: reading_guidance reading_guidance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: reference_standards reference_standards_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reference_standards
    ADD CONSTRAINT reference_standards_code_key UNIQUE (code);


--
-- Name: reference_standards reference_standards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: report_templates report_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: requirement_dependencies requirement_dependencies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: requirement_dependencies requirement_dependencies_requirement_id_depends_on_requirem_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_dependencies
    ADD CONSTRAINT requirement_dependencies_requirement_id_depends_on_requirem_key UNIQUE (requirement_id, depends_on_requirement_id);


--
-- Name: requirement_verifications requirement_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: requirements requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: requirements requirements_requirement_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_requirement_id_key UNIQUE (requirement_id);


--
-- Name: retention_policies retention_policies_organization_id_data_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_organization_id_data_type_key UNIQUE (organization_id, data_type);


--
-- Name: retention_policies retention_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: role_permissions role_permissions_role_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_permission_id_key UNIQUE (role, permission_id);


--
-- Name: sdks sdks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: srs_documents srs_documents_document_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_documents
    ADD CONSTRAINT srs_documents_document_id_key UNIQUE (document_id);


--
-- Name: srs_documents srs_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: srs_section_templates srs_section_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: srs_section_templates srs_section_templates_section_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_section_templates
    ADD CONSTRAINT srs_section_templates_section_key UNIQUE (section);


--
-- Name: srs_versions srs_versions_document_id_version_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_versions
    ADD CONSTRAINT srs_versions_document_id_version_key UNIQUE (document_id, version);


--
-- Name: srs_versions srs_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: stakeholder_types stakeholder_types_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stakeholder_types
    ADD CONSTRAINT stakeholder_types_code_key UNIQUE (code);


--
-- Name: stakeholder_types stakeholder_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: stt_configurations stt_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: terminology terminology_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: terminology terminology_term_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.terminology
    ADD CONSTRAINT terminology_term_key UNIQUE (term);


--
-- Name: tts_configurations tts_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: voice_channels voice_channels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: webhooks webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

-- Duplicate PRIMARY KEY constraint removed (already defined in CREATE TABLE)
--
-- Name: idx_access_policies_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_access_policies_org ON public.access_policies USING btree (organization_id);


--
-- Name: idx_ai_agents_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_agents_organization_id ON public.ai_agents USING btree (organization_id);


--
-- Name: idx_ai_agents_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ai_agents_type ON public.ai_agents USING btree (type);


--
-- Name: idx_api_keys_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_api_keys_organization_id ON public.api_keys USING btree (organization_id);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (appointment_date);


--
-- Name: idx_approval_records_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_records_entity ON public.approval_records USING btree (entity_type, entity_id);


--
-- Name: idx_approval_workflows_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_approval_workflows_org ON public.approval_workflows USING btree (organization_id);


--
-- Name: idx_assumptions_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assumptions_category ON public.operational_assumptions USING btree (category);


--
-- Name: idx_assumptions_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_assumptions_org ON public.operational_assumptions USING btree (organization_id);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at);


--
-- Name: idx_audit_logs_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: idx_baa_agreements_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_baa_agreements_organization_id ON public.baa_agreements USING btree (organization_id);


--
-- Name: idx_call_logs_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_agent_id ON public.call_logs USING btree (agent_id);


--
-- Name: idx_call_logs_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_organization_id ON public.call_logs USING btree (organization_id);


--
-- Name: idx_call_logs_started_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_logs_started_at ON public.call_logs USING btree (started_at);


--
-- Name: idx_call_metrics_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_metrics_date ON public.call_metrics USING btree (date);


--
-- Name: idx_call_metrics_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_metrics_organization_id ON public.call_metrics USING btree (organization_id);


--
-- Name: idx_call_recordings_call_log_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_call_recordings_call_log_id ON public.call_recordings USING btree (call_log_id);


--
-- Name: idx_change_control_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_control_org ON public.change_control_log USING btree (organization_id);


--
-- Name: idx_change_control_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_change_control_status ON public.change_control_log USING btree (status);


--
-- Name: idx_consent_phone; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_phone ON public.consent_records USING btree (phone_number);


--
-- Name: idx_consent_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_consent_status ON public.consent_records USING btree (consent_status);


--
-- Name: idx_constraint_violations_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_constraint_violations_org ON public.constraint_violations USING btree (organization_id);


--
-- Name: idx_constraint_violations_resolved; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_constraint_violations_resolved ON public.constraint_violations USING btree (resolved_at);


--
-- Name: idx_constraints_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_constraints_category ON public.constraints USING btree (category);


--
-- Name: idx_constraints_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_constraints_org ON public.constraints USING btree (organization_id);


--
-- Name: idx_conversations_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_agent_id ON public.conversations USING btree (agent_id);


--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id);


--
-- Name: idx_deliverables_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliverables_category ON public.deliverables USING btree (category);


--
-- Name: idx_deliverables_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliverables_org ON public.deliverables USING btree (organization_id);


--
-- Name: idx_deliverables_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliverables_status ON public.deliverables USING btree (status);


--
-- Name: idx_ehr_systems_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ehr_systems_org ON public.ehr_systems USING btree (organization_id);


--
-- Name: idx_fhir_connectors_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fhir_connectors_org ON public.fhir_connectors USING btree (organization_id);


--
-- Name: idx_generated_reports_template; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_generated_reports_template ON public.generated_reports USING btree (template_id);


--
-- Name: idx_hl7_connectors_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_hl7_connectors_org ON public.hl7_connectors USING btree (organization_id);


--
-- Name: idx_integrations_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrations_organization_id ON public.integrations USING btree (organization_id);


--
-- Name: idx_nlu_config_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_nlu_config_agent_id ON public.nlu_configurations USING btree (agent_id);


--
-- Name: idx_phone_numbers_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_phone_numbers_organization_id ON public.phone_numbers USING btree (organization_id);


--
-- Name: idx_portals_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_portals_organization_id ON public.portals USING btree (organization_id);


--
-- Name: idx_report_templates_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_report_templates_org ON public.report_templates USING btree (organization_id);


--
-- Name: idx_requirement_verifications_req; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirement_verifications_req ON public.requirement_verifications USING btree (requirement_id);


--
-- Name: idx_requirements_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirements_category ON public.requirements USING btree (category);


--
-- Name: idx_requirements_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirements_org ON public.requirements USING btree (organization_id);


--
-- Name: idx_requirements_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirements_status ON public.requirements USING btree (status);


--
-- Name: idx_requirements_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_requirements_type ON public.requirements USING btree (requirement_type);


--
-- Name: idx_sdks_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sdks_organization_id ON public.sdks USING btree (organization_id);


--
-- Name: idx_srs_documents_org; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_srs_documents_org ON public.srs_documents USING btree (organization_id);


--
-- Name: idx_srs_documents_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_srs_documents_section ON public.srs_documents USING btree (section);


--
-- Name: idx_srs_documents_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_srs_documents_status ON public.srs_documents USING btree (status);


--
-- Name: idx_srs_versions_doc; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_srs_versions_doc ON public.srs_versions USING btree (document_id);


--
-- Name: idx_stt_config_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stt_config_agent_id ON public.stt_configurations USING btree (agent_id);


--
-- Name: idx_tts_config_agent_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_tts_config_agent_id ON public.tts_configurations USING btree (agent_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_google_id ON public.users USING btree (google_id);


--
-- Name: idx_users_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_organization_id ON public.users USING btree (organization_id);


--
-- Name: idx_users_reset_token; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_reset_token ON public.users USING btree (reset_token);


--
-- Name: idx_voice_channels_agent; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_voice_channels_agent ON public.voice_channels USING btree (agent_id);


--
-- Name: idx_webhook_events_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_events_status ON public.webhook_events USING btree (status);


--
-- Name: idx_webhook_events_webhook_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhook_events_webhook_id ON public.webhook_events USING btree (webhook_id);


--
-- Name: idx_webhooks_organization_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_webhooks_organization_id ON public.webhooks USING btree (organization_id);


--
-- Name: access_policies access_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.access_policies
    ADD CONSTRAINT access_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: agent_performance agent_performance_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_performance
    ADD CONSTRAINT agent_performance_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: agent_performance agent_performance_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.agent_performance
    ADD CONSTRAINT agent_performance_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ai_agents ai_agents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ai_agents ai_agents_phone_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_agents
    ADD CONSTRAINT ai_agents_phone_number_id_fkey FOREIGN KEY (phone_number_id) REFERENCES public.phone_numbers(id);


--
-- Name: api_keys api_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: appointments appointments_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: approval_records approval_records_approver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_records
    ADD CONSTRAINT approval_records_approver_id_fkey FOREIGN KEY (approver_id) REFERENCES public.users(id);


--
-- Name: approval_records approval_records_workflow_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_records
    ADD CONSTRAINT approval_records_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES public.approval_workflows(id);


--
-- Name: approval_workflows approval_workflows_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approval_workflows
    ADD CONSTRAINT approval_workflows_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: baa_agreements baa_agreements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.baa_agreements
    ADD CONSTRAINT baa_agreements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: branding_configs branding_configs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branding_configs
    ADD CONSTRAINT branding_configs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: call_logs call_logs_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: call_logs call_logs_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);


--
-- Name: call_logs call_logs_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: call_logs call_logs_phone_number_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_logs
    ADD CONSTRAINT call_logs_phone_number_id_fkey FOREIGN KEY (phone_number_id) REFERENCES public.phone_numbers(id);


--
-- Name: call_metrics call_metrics_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_metrics
    ADD CONSTRAINT call_metrics_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: call_metrics call_metrics_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_metrics
    ADD CONSTRAINT call_metrics_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: call_recordings call_recordings_call_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_recordings
    ADD CONSTRAINT call_recordings_call_log_id_fkey FOREIGN KEY (call_log_id) REFERENCES public.call_logs(id);


--
-- Name: call_recordings call_recordings_encryption_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_recordings
    ADD CONSTRAINT call_recordings_encryption_key_id_fkey FOREIGN KEY (encryption_key_id) REFERENCES public.encryption_keys(id);


--
-- Name: call_recordings call_recordings_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.call_recordings
    ADD CONSTRAINT call_recordings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: change_control_log change_control_log_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: change_control_log change_control_log_implemented_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_implemented_by_fkey FOREIGN KEY (implemented_by) REFERENCES public.users(id);


--
-- Name: change_control_log change_control_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: change_control_log change_control_log_proposed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.users(id);


--
-- Name: change_control_log change_control_log_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.change_control_log
    ADD CONSTRAINT change_control_log_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.users(id);


--
-- Name: consent_records consent_records_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.consent_records
    ADD CONSTRAINT consent_records_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: constraint_violations constraint_violations_constraint_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraint_violations
    ADD CONSTRAINT constraint_violations_constraint_id_fkey FOREIGN KEY (constraint_id) REFERENCES public.constraints(id);


--
-- Name: constraint_violations constraint_violations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraint_violations
    ADD CONSTRAINT constraint_violations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: constraint_violations constraint_violations_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraint_violations
    ADD CONSTRAINT constraint_violations_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: constraints constraints_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.constraints
    ADD CONSTRAINT constraints_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: conversations conversations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: deliverable_milestones deliverable_milestones_deliverable_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverable_milestones
    ADD CONSTRAINT deliverable_milestones_deliverable_id_fkey FOREIGN KEY (deliverable_id) REFERENCES public.deliverables(id) ON DELETE CASCADE;


--
-- Name: deliverables deliverables_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.users(id);


--
-- Name: deliverables deliverables_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliverables
    ADD CONSTRAINT deliverables_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: ehr_systems ehr_systems_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ehr_systems
    ADD CONSTRAINT ehr_systems_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: encryption_keys encryption_keys_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.encryption_keys
    ADD CONSTRAINT encryption_keys_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: fhir_connectors fhir_connectors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fhir_connectors
    ADD CONSTRAINT fhir_connectors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: generated_reports generated_reports_generated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_generated_by_fkey FOREIGN KEY (generated_by) REFERENCES public.users(id);


--
-- Name: generated_reports generated_reports_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: generated_reports generated_reports_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.generated_reports
    ADD CONSTRAINT generated_reports_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.report_templates(id);


--
-- Name: hl7_connectors hl7_connectors_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.hl7_connectors
    ADD CONSTRAINT hl7_connectors_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: integrations integrations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrations
    ADD CONSTRAINT integrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: key_rotation_log key_rotation_log_encryption_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.key_rotation_log
    ADD CONSTRAINT key_rotation_log_encryption_key_id_fkey FOREIGN KEY (encryption_key_id) REFERENCES public.encryption_keys(id);


--
-- Name: key_rotation_log key_rotation_log_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.key_rotation_log
    ADD CONSTRAINT key_rotation_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: key_rotation_log key_rotation_log_rotated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.key_rotation_log
    ADD CONSTRAINT key_rotation_log_rotated_by_fkey FOREIGN KEY (rotated_by) REFERENCES public.users(id);


--
-- Name: nlu_configurations nlu_configurations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nlu_configurations
    ADD CONSTRAINT nlu_configurations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: nlu_configurations nlu_configurations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.nlu_configurations
    ADD CONSTRAINT nlu_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: operational_assumptions operational_assumptions_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.operational_assumptions
    ADD CONSTRAINT operational_assumptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: phone_numbers phone_numbers_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.phone_numbers
    ADD CONSTRAINT phone_numbers_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: portals portals_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.portals
    ADD CONSTRAINT portals_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: reading_guidance reading_guidance_stakeholder_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reading_guidance
    ADD CONSTRAINT reading_guidance_stakeholder_type_id_fkey FOREIGN KEY (stakeholder_type_id) REFERENCES public.stakeholder_types(id);


--
-- Name: report_templates report_templates_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_templates
    ADD CONSTRAINT report_templates_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: requirement_dependencies requirement_dependencies_depends_on_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_dependencies
    ADD CONSTRAINT requirement_dependencies_depends_on_requirement_id_fkey FOREIGN KEY (depends_on_requirement_id) REFERENCES public.requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_dependencies requirement_dependencies_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_dependencies
    ADD CONSTRAINT requirement_dependencies_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id) ON DELETE CASCADE;


--
-- Name: requirement_verifications requirement_verifications_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_verifications
    ADD CONSTRAINT requirement_verifications_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.requirements(id);


--
-- Name: requirement_verifications requirement_verifications_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirement_verifications
    ADD CONSTRAINT requirement_verifications_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: requirements requirements_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: requirements requirements_parent_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_parent_requirement_id_fkey FOREIGN KEY (parent_requirement_id) REFERENCES public.requirements(id);


--
-- Name: requirements requirements_verified_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.requirements
    ADD CONSTRAINT requirements_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.users(id);


--
-- Name: retention_policies retention_policies_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.retention_policies
    ADD CONSTRAINT retention_policies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id);


--
-- Name: sdks sdks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sdks
    ADD CONSTRAINT sdks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: srs_documents srs_documents_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_documents
    ADD CONSTRAINT srs_documents_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: srs_documents srs_documents_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_documents
    ADD CONSTRAINT srs_documents_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id);


--
-- Name: srs_documents srs_documents_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_documents
    ADD CONSTRAINT srs_documents_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: srs_versions srs_versions_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_versions
    ADD CONSTRAINT srs_versions_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.users(id);


--
-- Name: srs_versions srs_versions_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.srs_versions
    ADD CONSTRAINT srs_versions_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.srs_documents(id);


--
-- Name: stt_configurations stt_configurations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stt_configurations
    ADD CONSTRAINT stt_configurations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: stt_configurations stt_configurations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stt_configurations
    ADD CONSTRAINT stt_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: tts_configurations tts_configurations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tts_configurations
    ADD CONSTRAINT tts_configurations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: tts_configurations tts_configurations_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tts_configurations
    ADD CONSTRAINT tts_configurations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: users users_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: voice_channels voice_channels_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_channels
    ADD CONSTRAINT voice_channels_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.ai_agents(id);


--
-- Name: voice_channels voice_channels_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.voice_channels
    ADD CONSTRAINT voice_channels_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: webhook_events webhook_events_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: webhook_events webhook_events_webhook_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.webhooks(id);


--
-- Name: webhooks webhooks_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhooks
    ADD CONSTRAINT webhooks_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- PostgreSQL database dump complete
--

-- \unrestrict Gq0LJ3NVYvhbKKFc8eOP2WXvbbf5c5uTyHPBulRZ5JuSNlDb5VxtvciG04pnv3p
