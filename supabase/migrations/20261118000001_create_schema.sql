-- ==============================================================================
-- GapLens AI Migration 1: Extensions, Enums, and 13 Core Tables
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Domain Enums
CREATE TYPE document_type AS ENUM ('syllabus', 'material', 'past_paper');
CREATE TYPE document_status AS ENUM (
    'uploaded',
    'extracting',
    'chunking',
    'embedding',
    'indexed',
    'needs_ocr',
    'failed',
    'cancelled'
);
CREATE TYPE question_type AS ENUM ('mcq', 'short_answer');
CREATE TYPE confidence_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE mastery_classification AS ENUM ('unassessed', 'weak', 'medium', 'strong');
CREATE TYPE evidence_strength AS ENUM ('early_signal', 'developing_evidence', 'strong_evidence');
CREATE TYPE task_type AS ENUM ('read_source', 'copilot_lesson', 'practice_drill', 'retest', 'spaced_review');
CREATE TYPE task_status AS ENUM ('pending', 'completed', 'skipped');

-- 3. Core Tables

-- 3.1 profiles (User metadata linked to Supabase Auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- references auth.users(id) on Supabase
    email TEXT NOT NULL,
    full_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 workspaces (Subject/course container per student)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    exam_date DATE,
    daily_study_minutes INTEGER NOT NULL DEFAULT 60,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_workspaces_user ON workspaces(user_id);

-- 3.3 documents (Uploaded course files and ingestion state machine)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    declared_size_bytes BIGINT NOT NULL,
    doc_type document_type NOT NULL,
    status document_status NOT NULL DEFAULT 'uploaded',
    page_count INTEGER DEFAULT 0,
    extracted_char_count INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    current_checkpoint JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    parser_version TEXT DEFAULT '1.0',
    index_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);

-- 3.4 document_chunks (768d vector embeddings and full-text search)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    index_version INTEGER NOT NULL DEFAULT 1,
    page_start INTEGER NOT NULL,
    page_end INTEGER NOT NULL,
    section_heading TEXT,
    content TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    embedding_model TEXT NOT NULL DEFAULT 'gemini-embedding-001',
    embedding_dimensions INTEGER NOT NULL DEFAULT 768,
    fts TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index, index_version)
);
CREATE INDEX idx_chunks_workspace ON document_chunks(workspace_id);
CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_fts ON document_chunks USING GIN(fts);
CREATE INDEX idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- 3.5 topics (Syllabus topic hierarchy, exam signals, and cached mastery)
CREATE TABLE topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    unit_module TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    learning_objectives TEXT[],
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    extraction_confidence NUMERIC(4,3) DEFAULT 1.0,
    exam_frequency INTEGER DEFAULT 0,
    exam_total_marks INTEGER DEFAULT 0,
    exam_weight NUMERIC(5,4) DEFAULT 0.0,
    current_mastery NUMERIC(5,2) DEFAULT 0.0,
    classification mastery_classification NOT NULL DEFAULT 'unassessed',
    evidence_level evidence_strength NOT NULL DEFAULT 'early_signal',
    total_attempts INTEGER DEFAULT 0,
    correct_attempts INTEGER DEFAULT 0,
    blind_spot_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_topics_workspace ON topics(workspace_id);
CREATE INDEX idx_topics_parent ON topics(parent_id);

-- 3.6 topic_prerequisites (Directed prerequisite edges)
CREATE TABLE topic_prerequisites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    prerequisite_topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    is_inferred BOOLEAN NOT NULL DEFAULT false,
    confidence NUMERIC(4,3) DEFAULT 1.0,
    source_rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_prerequisite UNIQUE (topic_id, prerequisite_topic_id)
);
CREATE INDEX idx_prereq_workspace ON topic_prerequisites(workspace_id);
CREATE INDEX idx_prereq_topic ON topic_prerequisites(topic_id);
CREATE INDEX idx_prereq_target ON topic_prerequisites(prerequisite_topic_id);

-- 3.7 paper_questions (Past exam questions mapped to syllabus topics)
CREATE TABLE paper_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    paper_year INTEGER,
    paper_name TEXT,
    question_number TEXT NOT NULL,
    question_text TEXT NOT NULL,
    marks INTEGER NOT NULL DEFAULT 1,
    mapped_topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
    mapping_confidence NUMERIC(4,3) NOT NULL DEFAULT 0.0,
    needs_review BOOLEAN NOT NULL DEFAULT false,
    supporting_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    mapping_rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_paper_questions_workspace ON paper_questions(workspace_id);
CREATE INDEX idx_paper_questions_topic ON paper_questions(mapped_topic_id);

-- 3.8 quizzes (Diagnostic and drill assessment sessions)
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    quiz_mode TEXT NOT NULL DEFAULT 'diagnostic',
    target_topic_ids UUID[] NOT NULL DEFAULT '{}',
    is_completed BOOLEAN NOT NULL DEFAULT false,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    total_score NUMERIC(5,2),
    max_possible_score NUMERIC(5,2)
);
CREATE INDEX idx_quizzes_workspace ON quizzes(workspace_id);
CREATE INDEX idx_quizzes_user ON quizzes(user_id);

-- 3.9 quiz_questions (Grounded generated questions with pinned source citations)
CREATE TABLE quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    question_type question_type NOT NULL,
    difficulty NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    question_text TEXT NOT NULL,
    options JSONB,
    answer_key TEXT NOT NULL,
    explanation TEXT NOT NULL,
    rubric JSONB,
    source_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    citation_document_name TEXT NOT NULL,
    citation_page_start INTEGER NOT NULL,
    citation_page_end INTEGER NOT NULL,
    citation_section TEXT,
    citation_quote TEXT,
    is_quote_verified BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX idx_quiz_questions_topic ON quiz_questions(topic_id);

-- 3.10 answers (Student submissions, confidence, rubric evaluation, blind spot flag)
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    quiz_question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_response TEXT NOT NULL,
    confidence confidence_level NOT NULL,
    is_correct BOOLEAN,
    score NUMERIC(4,3) NOT NULL,
    rubric_evaluation JSONB,
    feedback TEXT NOT NULL,
    is_blind_spot BOOLEAN NOT NULL DEFAULT false,
    answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_quiz_question_answer UNIQUE (quiz_id, quiz_question_id)
);
CREATE INDEX idx_answers_quiz ON answers(quiz_id);
CREATE INDEX idx_answers_topic ON answers(topic_id);
CREATE INDEX idx_answers_user ON answers(user_id);

-- 3.11 mastery_snapshots (Immutable historical mastery logs)
CREATE TABLE mastery_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
    mastery_score NUMERIC(5,2) NOT NULL,
    classification mastery_classification NOT NULL,
    evidence_level evidence_strength NOT NULL,
    effective_attempts INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_snapshots_workspace_topic ON mastery_snapshots(workspace_id, topic_id);
CREATE INDEX idx_snapshots_recorded ON mastery_snapshots(recorded_at);

-- 3.12 revision_plans (Revision plan metadata and parameters)
CREATE TABLE revision_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    exam_date DATE,
    daily_minutes INTEGER NOT NULL,
    total_days INTEGER NOT NULL,
    total_allocated_minutes INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_revision_plans_workspace ON revision_plans(workspace_id);

-- 3.13 revision_tasks (Discrete, time-budgeted study tasks)
CREATE TABLE revision_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID NOT NULL REFERENCES revision_plans(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL,
    task_order INTEGER NOT NULL,
    task_type task_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    allocated_minutes INTEGER NOT NULL,
    priority_score NUMERIC(5,2) NOT NULL,
    status task_status NOT NULL DEFAULT 'pending',
    source_chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,
    citation_reference TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_revision_tasks_plan ON revision_tasks(plan_id);
CREATE INDEX idx_revision_tasks_topic ON revision_tasks(topic_id);
CREATE INDEX idx_revision_tasks_day ON revision_tasks(plan_id, day_number);
CREATE INDEX idx_revision_tasks_workspace ON revision_tasks(workspace_id);
