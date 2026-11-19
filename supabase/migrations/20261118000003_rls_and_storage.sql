-- ==============================================================================
-- GapLens AI Migration 3: Row Level Security (RLS) and Storage Policies
-- ==============================================================================

-- 1. Enable Row Level Security on all 13 tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_prerequisites ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE mastery_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE revision_tasks ENABLE ROW LEVEL SECURITY;

-- 2. Table-Specific RLS Policies

-- 2.1 profiles: Users can manage their own profile record
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 2.2 workspaces: Strict student isolation
CREATE POLICY "Users can manage own workspaces" ON workspaces
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.3 documents: Strict user isolation
CREATE POLICY "Users can manage own documents" ON documents
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.4 document_chunks: Strict user isolation
CREATE POLICY "Users can access own document chunks" ON document_chunks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.5 topics: Strict user isolation
CREATE POLICY "Users can manage own topics" ON topics
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.6 topic_prerequisites: Governed by workspace ownership
CREATE POLICY "Users can view and manage topic prerequisites" ON topic_prerequisites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = topic_prerequisites.workspace_id AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = topic_prerequisites.workspace_id AND w.user_id = auth.uid()
        )
    );

-- 2.7 paper_questions: Governed by workspace ownership
CREATE POLICY "Users can view and manage paper questions" ON paper_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = paper_questions.workspace_id AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = paper_questions.workspace_id AND w.user_id = auth.uid()
        )
    );

-- 2.8 quizzes: Strict user isolation
CREATE POLICY "Users can manage own quizzes" ON quizzes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.9 quiz_questions: Governed by quiz creator ownership
CREATE POLICY "Users can view and manage quiz questions" ON quiz_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM quizzes q
            WHERE q.id = quiz_questions.quiz_id AND q.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM quizzes q
            WHERE q.id = quiz_questions.quiz_id AND q.user_id = auth.uid()
        )
    );

-- 2.10 answers: Strict user isolation
CREATE POLICY "Users can manage own quiz answers" ON answers
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.11 mastery_snapshots: Strict user isolation (Read + Insert, immutable log)
CREATE POLICY "Users can view own mastery snapshots" ON mastery_snapshots
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can record own mastery snapshots" ON mastery_snapshots
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2.12 revision_plans: Strict user isolation
CREATE POLICY "Users can manage own revision plans" ON revision_plans
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2.13 revision_tasks: Governed by workspace ownership
CREATE POLICY "Users can manage own revision tasks" ON revision_tasks
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = revision_tasks.workspace_id AND w.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = revision_tasks.workspace_id AND w.user_id = auth.uid()
        )
    );

-- 3. Supabase Storage Configuration (Private 'documents' Bucket)
-- Setup the private documents bucket if storage schema exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'documents',
            'documents',
            false,
            52428800, -- 50 MB limit
            ARRAY['application/pdf', 'text/plain', 'text/markdown']
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 52428800,
            allowed_mime_types = ARRAY['application/pdf', 'text/plain', 'text/markdown'];
    END IF;
END $$;

-- Storage object policies for user-isolated path prefix: `<user_id>/<workspace_id>/<file>`
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Allow users to upload files to their own prefix
        DROP POLICY IF EXISTS "Users can upload course documents" ON storage.objects;
        CREATE POLICY "Users can upload course documents" ON storage.objects
            FOR INSERT
            WITH CHECK (
                bucket_id = 'documents' 
                AND (storage.foldername(name))[1] = auth.uid()::text
            );

        -- Allow users to read their own files
        DROP POLICY IF EXISTS "Users can read own course documents" ON storage.objects;
        CREATE POLICY "Users can read own course documents" ON storage.objects
            FOR SELECT
            USING (
                bucket_id = 'documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );

        -- Allow users to update their own files (for upsert support)
        DROP POLICY IF EXISTS "Users can update own course documents" ON storage.objects;
        CREATE POLICY "Users can update own course documents" ON storage.objects
            FOR UPDATE
            USING (
                bucket_id = 'documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            )
            WITH CHECK (
                bucket_id = 'documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );

        -- Allow users to delete their own files
        DROP POLICY IF EXISTS "Users can delete own course documents" ON storage.objects;
        CREATE POLICY "Users can delete own course documents" ON storage.objects
            FOR DELETE
            USING (
                bucket_id = 'documents'
                AND (storage.foldername(name))[1] = auth.uid()::text
            );
    END IF;
END $$;
