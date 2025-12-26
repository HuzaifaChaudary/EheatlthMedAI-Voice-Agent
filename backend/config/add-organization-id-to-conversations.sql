-- Add organization_id column to conversations table
-- This migration adds the organization_id column for multi-tenancy support

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'organization_id'
    ) THEN
        -- Add organization_id column
        ALTER TABLE conversations 
        ADD COLUMN organization_id INTEGER REFERENCES organizations(id);
        
        -- Create index for better query performance
        CREATE INDEX IF NOT EXISTS idx_conversations_organization_id 
        ON conversations(organization_id);
        
        -- Update existing conversations to have organization_id based on user's organization
        UPDATE conversations c
        SET organization_id = u.organization_id
        FROM users u
        WHERE c.user_id = u.id 
        AND c.organization_id IS NULL;
        
        RAISE NOTICE 'Added organization_id column to conversations table';
    ELSE
        RAISE NOTICE 'organization_id column already exists in conversations table';
    END IF;
END $$;

