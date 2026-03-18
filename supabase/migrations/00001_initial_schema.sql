-- NEXUS Database Migration
-- Run this in Supabase SQL Editor

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Custom ENUM Types
CREATE TYPE user_role AS ENUM ('admin', 'member');
CREATE TYPE conversation_type AS ENUM ('direct', 'group');
CREATE TYPE message_type AS ENUM ('text', 'image', 'file', 'system', 'voice');
CREATE TYPE job_status AS ENUM ('new', 'claimed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE job_platform AS ENUM ('fiverr', 'upwork', 'manual', 'other');
CREATE TYPE notification_type AS ENUM ('new_message', 'new_job', 'job_claimed', 'job_completed', 'user_joined', 'user_left', 'admin_announcement', 'mention');

-- Table: profiles
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    role user_role DEFAULT 'member',
    custom_status TEXT DEFAULT ''::TEXT,
    permissions JSONB DEFAULT '{"can_view_jobs":true,"can_claim_jobs":true,"can_create_groups":true,"can_send_files":true,"can_send_messages":true}'::JSONB,
    is_active BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);
CREATE INDEX idx_profiles_is_online ON profiles(is_online);

-- Table: conversations
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type conversation_type NOT NULL,
    name TEXT,
    description TEXT,
    avatar_url TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    is_archived BOOLEAN DEFAULT false,
    pinned_message_id UUID,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_preview TEXT,
    last_message_sender TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_created_by ON conversations(created_by);

-- Table: conversation_members
CREATE TABLE conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role user_role DEFAULT 'member',
    notifications_muted BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX idx_conversation_members_user_conversation ON conversation_members(user_id, conversation_id);

-- Table: messages
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT,
    type message_type DEFAULT 'text',
    file_url TEXT,
    file_name TEXT,
    file_size BIGINT,
    file_type TEXT,
    reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
    is_deleted BOOLEAN DEFAULT false,
    is_edited BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_fulltext ON messages USING gin(to_tsvector('english', COALESCE(content, '')));

-- Table: message_reads
CREATE TABLE message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_reads_user_id ON message_reads(user_id);

-- Table: message_reactions
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

CREATE INDEX idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user_id ON message_reactions(user_id);

-- Table: typing_indicators
CREATE TABLE typing_indicators (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    is_typing BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- Table: jobs
CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform job_platform NOT NULL,
    external_id TEXT,
    external_url TEXT,
    title TEXT NOT NULL,
    description TEXT,
    requirements TEXT[],
    budget_amount DECIMAL(10,2),
    budget_currency TEXT DEFAULT 'USD',
    deadline TIMESTAMPTZ,
    client_name TEXT,
    client_info JSONB DEFAULT '{}'::JSONB,
    status job_status DEFAULT 'new',
    claimed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    claimed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    attachments JSONB DEFAULT '[]'::JSONB,
    raw_data JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_platform ON jobs(platform);
CREATE INDEX idx_jobs_claimed_by ON jobs(claimed_by);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);

-- Table: job_comments
CREATE TABLE job_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_job_comments_job_id ON job_comments(job_id);
CREATE INDEX idx_job_comments_user_id ON job_comments(user_id);

-- Table: notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::JSONB,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Table: activity_logs
CREATE TABLE activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}'::JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- Table: ai_summaries
CREATE TABLE ai_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    message_count INT NOT NULL,
    from_date TIMESTAMPTZ NOT NULL,
    to_date TIMESTAMPTZ NOT NULL,
    model TEXT DEFAULT 'gpt-4o-mini',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_summaries_conversation_id ON ai_summaries(conversation_id);
CREATE INDEX idx_ai_summaries_created_at ON ai_summaries(created_at DESC);

-- Table: ai_agent_tasks
CREATE TABLE ai_agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    task_type TEXT NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB,
    status TEXT DEFAULT 'pending',
    error TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_agent_tasks_job_id ON ai_agent_tasks(job_id);
CREATE INDEX idx_ai_agent_tasks_status ON ai_agent_tasks(status);
CREATE INDEX idx_ai_agent_tasks_created_at ON ai_agent_tasks(created_at DESC);

-- Table: hf_sync_log
CREATE TABLE hf_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_type TEXT NOT NULL,
    records_synced INT DEFAULT 0,
    last_synced_id UUID,
    status TEXT DEFAULT 'completed',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hf_sync_log_sync_type ON hf_sync_log(sync_type);
CREATE INDEX idx_hf_sync_log_created_at ON hf_sync_log(created_at DESC);

-- Database Functions

-- Function: update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: update_updated_at on profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger: update_updated_at on conversations
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger: update_updated_at on messages
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Trigger: update_updated_at on jobs
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Function: update_conversation_last_message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT p.display_name INTO sender_name
        FROM profiles p
        WHERE p.id = NEW.sender_id;
        
        UPDATE conversations
        SET last_message_at = NEW.created_at,
            last_message_preview = LEFT(COALESCE(NEW.content, ''), 100),
            last_message_sender = sender_name
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: update_conversation_last_message
DROP TRIGGER IF EXISTS trigger_update_conversation_last_message ON messages;
CREATE TRIGGER trigger_update_conversation_last_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_last_message();

-- Function: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    metadata JSONB;
BEGIN
    metadata := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB);
    
    INSERT INTO profiles (
        id,
        username,
        display_name,
        role,
        permissions
    ) VALUES (
        NEW.id,
        COALESCE(metadata->>'username', 'user_' || LEFT(NEW.id::TEXT, 8)),
        COALESCE(metadata->>'display_name', 'User'),
        COALESCE(metadata->>'role', 'member')::user_role,
        '{"can_view_jobs":true,"can_claim_jobs":true,"can_create_groups":true,"can_send_files":true,"can_send_messages":true}'::JSONB
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: handle_new_user
DROP TRIGGER IF EXISTS trigger_handle_new_user ON auth.users;
CREATE TRIGGER trigger_handle_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Function: get_unread_count
CREATE OR REPLACE FUNCTION get_unread_count(p_conversation_id UUID, p_user_id UUID)
RETURNS INT AS $$
DECLARE
    unread_count INT;
    last_read TIMESTAMPTZ;
BEGIN
    SELECT last_read_at INTO last_read
    FROM conversation_members
    WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
    
    IF last_read IS NULL THEN
        RETURN 0;
    END IF;
    
    SELECT COUNT(*) INTO unread_count
    FROM messages
    WHERE conversation_id = p_conversation_id
      AND sender_id != p_user_id
      AND created_at > last_read
      AND is_deleted = false;
    
    RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Function: search_messages
CREATE OR REPLACE FUNCTION search_messages(p_query TEXT, p_user_id UUID, p_limit INT DEFAULT 50)
RETURNS TABLE(
    message_id UUID,
    conversation_id UUID,
    conversation_name TEXT,
    sender_name TEXT,
    content TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS message_id,
        m.conversation_id,
        COALESCE(c.name, 'Direct Chat')::TEXT AS conversation_name,
        p.display_name AS sender_name,
        m.content,
        m.created_at
    FROM messages m
    JOIN conversations c ON m.conversation_id = c.id
    JOIN conversation_members cm ON c.id = cm.conversation_id
    JOIN profiles p ON m.sender_id = p.id
    WHERE cm.user_id = p_user_id
      AND m.is_deleted = false
      AND m.content ILIKE '%' || p_query || '%'
    ORDER BY m.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE hf_sync_log ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "profiles_select" ON profiles
    FOR SELECT USING (is_active = true);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_admin_full" ON profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Conversations RLS Policies
CREATE POLICY "conversations_select" ON conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = id AND user_id = auth.uid()
        )
    );

CREATE POLICY "conversations_insert" ON conversations
    FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "conversations_update" ON conversations
    FOR UPDATE USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = id AND user_id = auth.uid() AND role = 'admin'
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Conversation Members RLS Policies
CREATE POLICY "conversation_members_select" ON conversation_members
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "conversation_members_insert" ON conversation_members
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "conversation_members_update" ON conversation_members
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "conversation_members_delete" ON conversation_members
    FOR DELETE USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Messages RLS Policies
CREATE POLICY "messages_select" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "messages_update_own" ON messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_delete_own" ON messages
    FOR DELETE USING (
        sender_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Message Reads RLS Policies
CREATE POLICY "message_reads_select" ON message_reads
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "message_reads_insert" ON message_reads
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Message Reactions RLS Policies
CREATE POLICY "message_reactions_select" ON message_reactions
    FOR SELECT USING (true);

CREATE POLICY "message_reactions_insert" ON message_reactions
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "message_reactions_delete" ON message_reactions
    FOR DELETE USING (user_id = auth.uid());

-- Typing Indicators RLS Policies
CREATE POLICY "typing_indicators_all" ON typing_indicators
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM conversation_members
            WHERE conversation_id = typing_indicators.conversation_id AND user_id = auth.uid()
        )
    );

-- Jobs RLS Policies
CREATE POLICY "jobs_select" ON jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (permissions->>'can_view_jobs')::boolean = true)
    );

CREATE POLICY "jobs_insert" ON jobs
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "jobs_update" ON jobs
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Job Comments RLS Policies
CREATE POLICY "job_comments_select" ON job_comments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') OR
        EXISTS (
            SELECT 1 FROM jobs j
            WHERE j.id = job_comments.job_id
              AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (permissions->>'can_view_jobs')::boolean = true)
        )
    );

CREATE POLICY "job_comments_insert" ON job_comments
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Notifications RLS Policies
CREATE POLICY "notifications_select" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Activity Logs RLS Policies
CREATE POLICY "activity_logs_admin" ON activity_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- AI Summaries RLS Policies
CREATE POLICY "ai_summaries_admin" ON ai_summaries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- AI Agent Tasks RLS Policies
CREATE POLICY "ai_agent_tasks_admin" ON ai_agent_tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- HF Sync Log RLS Policies
CREATE POLICY "hf_sync_log_admin" ON hf_sync_log
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Storage Bucket: nexus-files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'nexus-files',
    'nexus-files',
    false,
    52428800,
    ARRAY[
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/zip',
        'application/x-rar-compressed',
        'application/gzip',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'text/plain',
        'text/csv'
    ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "nexus_files_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'nexus-files' AND auth.role() = 'authenticated');

CREATE POLICY "nexus_files_insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'nexus-files' AND auth.role() = 'authenticated');

CREATE POLICY "nexus_files_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'nexus-files' AND 
        auth.role() = 'authenticated' AND
        (storage.foldername(name))[1] = auth.uid()::text
    );
