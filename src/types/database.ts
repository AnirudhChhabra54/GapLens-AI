// ==============================================================================
// GapLens AI — Database Schema Types
// Compatible with Supabase Client and standard Postgres models
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ------------------------------------------------------------------------------
// Domain Enums
// ------------------------------------------------------------------------------

export type DocumentType = "syllabus" | "material" | "past_paper";

export type DocumentStatus =
  | "uploaded"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexed"
  | "needs_ocr"
  | "failed"
  | "cancelled";

export type QuestionType = "mcq" | "short_answer";

export type ConfidenceLevel = "low" | "medium" | "high";

export type MasteryClassification = "unassessed" | "weak" | "medium" | "strong";

export type EvidenceStrength = "early_signal" | "developing_evidence" | "strong_evidence";

export type TaskType =
  | "read_source"
  | "copilot_lesson"
  | "practice_drill"
  | "retest"
  | "spaced_review";

export type TaskStatus = "pending" | "completed" | "skipped";

// ------------------------------------------------------------------------------
// Table Row Types
// ------------------------------------------------------------------------------

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkspaceRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  exam_date: string | null;
  daily_study_minutes: number;
  created_at: string;
  updated_at: string;
}

export type DocumentRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  declared_size_bytes: number;
  doc_type: DocumentType;
  status: DocumentStatus;
  page_count: number;
  extracted_char_count: number;
  chunk_count: number;
  current_checkpoint: Json;
  error_message: string | null;
  parser_version: string;
  index_version: number;
  created_at: string;
  updated_at: string;
}

export type DocumentChunkRow = {
  id: string;
  document_id: string;
  workspace_id: string;
  user_id: string;
  chunk_index: number;
  index_version: number;
  page_start: number;
  page_end: number;
  section_heading: string | null;
  content: string;
  embedding: number[];
  embedding_model: string;
  embedding_dimensions: number;
  fts?: string;
  created_at: string;
}

export type TopicRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  unit_module: string | null;
  order_index: number;
  learning_objectives: string[] | null;
  source_chunk_id: string | null;
  extraction_confidence: number;
  exam_frequency: number;
  exam_total_marks: number;
  exam_weight: number;
  current_mastery: number;
  classification: MasteryClassification;
  evidence_level: EvidenceStrength;
  total_attempts: number;
  correct_attempts: number;
  blind_spot_count: number;
  created_at: string;
  updated_at: string;
}

export type TopicPrerequisiteRow = {
  id: string;
  workspace_id: string;
  topic_id: string;
  prerequisite_topic_id: string;
  is_inferred: boolean;
  confidence: number;
  source_rationale: string | null;
  created_at: string;
}

export type PaperQuestionRow = {
  id: string;
  workspace_id: string;
  document_id: string;
  paper_year: number | null;
  paper_name: string | null;
  question_number: string;
  question_text: string;
  marks: number;
  mapped_topic_id: string | null;
  mapping_confidence: number;
  needs_review: boolean;
  supporting_chunk_id: string | null;
  mapping_rationale: string | null;
  created_at: string;
}

export type QuizRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  title: string;
  quiz_mode: string; // 'diagnostic' | 'drill' | 'retest'
  target_topic_ids: string[];
  is_completed: boolean;
  started_at: string;
  completed_at: string | null;
  total_score: number | null;
  max_possible_score: number | null;
}

export interface MCQOption {
  id: string;
  text: string;
}

export interface RubricKeypoint {
  keypoint: string;
  weight: number;
  description: string;
}

export type QuizQuestionRow = {
  id: string;
  quiz_id: string;
  topic_id: string;
  question_type: QuestionType;
  difficulty: number;
  question_text: string;
  options: MCQOption[] | null;
  answer_key: string;
  explanation: string;
  rubric: RubricKeypoint[] | null;
  source_chunk_id: string;
  citation_document_name: string;
  citation_page_start: number;
  citation_page_end: number;
  citation_section: string | null;
  citation_quote: string | null;
  is_quote_verified: boolean;
  created_at: string;
}

export interface RubricEvaluationItem {
  keypoint: string;
  status: "met" | "partially_met" | "not_met";
  rationale: string;
  marks_awarded: number;
  marksAwarded?: number;
}

export type AnswerRow = {
  id: string;
  quiz_id: string;
  quiz_question_id: string;
  topic_id: string;
  user_id: string;
  student_response: string;
  confidence: ConfidenceLevel;
  is_correct: boolean | null;
  score: number;
  rubric_evaluation: RubricEvaluationItem[] | null;
  feedback: string;
  is_blind_spot: boolean;
  answered_at: string;
}

export type MasterySnapshotRow = {
  id: string;
  workspace_id: string;
  topic_id: string;
  user_id: string;
  quiz_id: string | null;
  mastery_score: number;
  classification: MasteryClassification;
  evidence_level: EvidenceStrength;
  effective_attempts: number;
  recorded_at: string;
}

export type RevisionPlanRow = {
  id: string;
  workspace_id: string;
  user_id: string;
  version: number;
  exam_date: string | null;
  daily_minutes: number;
  total_days: number;
  total_allocated_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type RevisionTaskRow = {
  id: string;
  plan_id: string;
  workspace_id: string;
  topic_id: string;
  day_number: number;
  task_order: number;
  task_type: TaskType;
  title: string;
  description: string | null;
  allocated_minutes: number;
  allocatedMinutes?: number;
  priority_score: number;
  priorityScore?: number;
  status: TaskStatus;
  source_chunk_id: string | null;
  citation_reference: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------------------
// Canonical Shorter Type Aliases
// ------------------------------------------------------------------------------

export type Profile = ProfileRow;
export type Workspace = WorkspaceRow;
export type Document = DocumentRow;
export type DocumentChunk = DocumentChunkRow;
export type Topic = TopicRow;
export type TopicPrerequisite = TopicPrerequisiteRow;
export type PaperQuestion = PaperQuestionRow;
export type Quiz = QuizRow;
export type QuizQuestion = QuizQuestionRow;
export type Answer = AnswerRow;
export type MasterySnapshot = MasterySnapshotRow;
export type RevisionPlan = RevisionPlanRow;
export type RevisionTask = RevisionTaskRow;

// ------------------------------------------------------------------------------
// Hybrid Search RPC Return Shape
// ------------------------------------------------------------------------------

export interface HybridSearchResult {
  id: string;
  document_id: string;
  chunk_index: number;
  page_start: number;
  page_end: number;
  section_heading: string | null;
  content: string;
  document_name: string;
  doc_type: DocumentType;
  similarity: number;
  rrf_score: number;
}

// ------------------------------------------------------------------------------
// Supabase Database Mapping
// ------------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "id" | "email">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      workspaces: {
        Row: WorkspaceRow;
        Insert: Partial<WorkspaceRow> & Pick<WorkspaceRow, "user_id" | "title">;
        Update: Partial<WorkspaceRow>;
        Relationships: [];
      };
      documents: {
        Row: DocumentRow;
        Insert: Partial<DocumentRow> &
          Pick<
            DocumentRow,
            | "workspace_id"
            | "user_id"
            | "filename"
            | "storage_path"
            | "file_type"
            | "declared_size_bytes"
            | "doc_type"
          >;
        Update: Partial<DocumentRow>;
        Relationships: [];
      };
      document_chunks: {
        Row: DocumentChunkRow;
        Insert: Partial<DocumentChunkRow> &
          Pick<
            DocumentChunkRow,
            | "document_id"
            | "workspace_id"
            | "user_id"
            | "chunk_index"
            | "page_start"
            | "page_end"
            | "content"
            | "embedding"
          >;
        Update: Partial<DocumentChunkRow>;
        Relationships: [];
      };
      topics: {
        Row: TopicRow;
        Insert: Partial<TopicRow> & Pick<TopicRow, "workspace_id" | "user_id" | "title">;
        Update: Partial<TopicRow>;
        Relationships: [];
      };
      topic_prerequisites: {
        Row: TopicPrerequisiteRow;
        Insert: Partial<TopicPrerequisiteRow> &
          Pick<TopicPrerequisiteRow, "workspace_id" | "topic_id" | "prerequisite_topic_id">;
        Update: Partial<TopicPrerequisiteRow>;
        Relationships: [];
      };
      paper_questions: {
        Row: PaperQuestionRow;
        Insert: Partial<PaperQuestionRow> &
          Pick<
            PaperQuestionRow,
            | "workspace_id"
            | "document_id"
            | "question_number"
            | "question_text"
          >;
        Update: Partial<PaperQuestionRow>;
        Relationships: [];
      };
      quizzes: {
        Row: QuizRow;
        Insert: Partial<QuizRow> & Pick<QuizRow, "workspace_id" | "user_id" | "title">;
        Update: Partial<QuizRow>;
        Relationships: [];
      };
      quiz_questions: {
        Row: QuizQuestionRow;
        Insert: Partial<QuizQuestionRow> &
          Pick<
            QuizQuestionRow,
            | "quiz_id"
            | "topic_id"
            | "question_type"
            | "question_text"
            | "answer_key"
            | "explanation"
            | "source_chunk_id"
            | "citation_document_name"
            | "citation_page_start"
            | "citation_page_end"
          >;
        Update: Partial<QuizQuestionRow>;
        Relationships: [];
      };
      answers: {
        Row: AnswerRow;
        Insert: Partial<AnswerRow> &
          Pick<
            AnswerRow,
            | "quiz_id"
            | "quiz_question_id"
            | "topic_id"
            | "user_id"
            | "student_response"
            | "confidence"
            | "score"
            | "feedback"
          >;
        Update: Partial<AnswerRow>;
        Relationships: [];
      };
      mastery_snapshots: {
        Row: MasterySnapshotRow;
        Insert: Partial<MasterySnapshotRow> &
          Pick<
            MasterySnapshotRow,
            | "workspace_id"
            | "topic_id"
            | "user_id"
            | "mastery_score"
            | "classification"
            | "evidence_level"
            | "effective_attempts"
          >;
        Update: Partial<MasterySnapshotRow>;
        Relationships: [];
      };
      revision_plans: {
        Row: RevisionPlanRow;
        Insert: Partial<RevisionPlanRow> &
          Pick<
            RevisionPlanRow,
            "workspace_id" | "user_id" | "daily_minutes" | "total_days" | "total_allocated_minutes"
          >;
        Update: Partial<RevisionPlanRow>;
        Relationships: [];
      };
      revision_tasks: {
        Row: RevisionTaskRow;
        Insert: Partial<RevisionTaskRow> &
          Pick<
            RevisionTaskRow,
            | "plan_id"
            | "workspace_id"
            | "topic_id"
            | "day_number"
            | "task_order"
            | "task_type"
            | "title"
            | "allocated_minutes"
            | "priority_score"
          >;
        Update: Partial<RevisionTaskRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_documents_hybrid: {
        Args: {
          p_workspace_id: string;
          p_query_text: string;
          p_query_embedding: number[];
          p_match_count?: number;
          p_allowed_doc_types?: DocumentType[];
          p_rrf_k?: number;
        };
        Returns: HybridSearchResult[];
      };
      hybrid_search_chunks: {
        Args: {
          p_workspace_id: string;
          p_query_text: string;
          p_query_embedding: number[];
          p_match_count?: number;
          p_allowed_doc_types?: DocumentType[];
          p_rrf_k?: number;
        };
        Returns: HybridSearchResult[];
      };
    };
    Enums: {
      document_type: DocumentType;
      document_status: DocumentStatus;
      question_type: QuestionType;
      confidence_level: ConfidenceLevel;
      mastery_classification: MasteryClassification;
      evidence_strength: EvidenceStrength;
      task_type: TaskType;
      task_status: TaskStatus;
    };
  };
}
