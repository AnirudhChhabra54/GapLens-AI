// ==============================================================================
// GapLens AI — Zod Schemas for Structured LLM Outputs (Groq & Gemini)
// Enforces schema adherence for question generation, evaluation, and topic extraction
// Includes resilient preprocessors for model outputs
// ==============================================================================

import { z } from "zod";

export const MCQOptionSchema = z.object({
  id: z.string().describe("Option key, e.g. 'A', 'B', 'C', 'D'"),
  text: z.string().describe("The text content of the option"),
});

export const RubricKeypointSchema = z.object({
  keypoint: z.string().describe("Short label or phrase for the required concept"),
  weight: z.number().min(0).max(1).describe("Fractional weight of total score, sums to 1.0"),
  description: z.string().describe("Detailed criteria for awarding points on this concept"),
});

const CoercedQuestionType = z.preprocess((val) => {
  if (typeof val === "string") {
    const s = val.toLowerCase();
    if (s.includes("mcq") || s.includes("choice") || s.includes("multiple")) return "mcq";
    if (s.includes("short") || s.includes("answer") || s.includes("concept")) return "short_answer";
  }
  return val;
}, z.enum(["mcq", "short_answer"]).default("mcq"));

const CoercedDifficulty = z.preprocess((val) => {
  if (typeof val === "number") return Math.min(3, Math.max(1, Math.round(val)));
  if (typeof val === "string") {
    const num = parseInt(val, 10);
    if (!isNaN(num)) return Math.min(3, Math.max(1, num));
    const s = val.toLowerCase();
    if (s.includes("easy") || s.includes("foundation") || s.includes("basic")) return 1;
    if (s.includes("hard") || s.includes("advanced") || s.includes("difficult")) return 3;
    return 2;
  }
  return 2;
}, z.number().min(1).max(3).default(2));

export const DiagnosticQuestionSchema = z.object({
  topicId: z.string().describe("The ID of the target topic").optional().default(""),
  questionType: CoercedQuestionType,
  difficulty: CoercedDifficulty,
  questionText: z.string().min(10).describe("The diagnostic question text"),
  options: z.array(MCQOptionSchema).nullable().optional().describe("MCQ options if mcq"),
  answerKey: z.string().describe("Correct option letter or model answer summary"),
  explanation: z.string().describe("Detailed explanation citing why this is correct"),
  rubric: z.array(RubricKeypointSchema).nullable().optional().describe("Grading rubric for short answer"),
  sourceChunkId: z.string().describe("UUID of the source chunk used to ground the question").optional().default(""),
  citationDocumentName: z.string().describe("Document title where evidence was retrieved").optional().default("Course Material"),
  citationPageStart: z.number().int().min(1).describe("1-based start page").optional().default(1),
  citationPageEnd: z.number().int().min(1).describe("1-based end page").optional().default(1),
  citationSection: z.string().nullable().optional().describe("Section heading"),
  citationQuote: z.string().nullable().optional().describe("Verbatim quote from the chunk"),
});

export const RubricEvaluationItemSchema = z.object({
  keypoint: z.string(),
  status: z.enum(["met", "partially_met", "not_met"]),
  rationale: z.string(),
  marks_awarded: z.number().min(0),
});

export const ShortAnswerEvaluationSchema = z.object({
  score: z.number().min(0).max(1),
  rubric_evaluation: z.array(RubricEvaluationItemSchema).default([]),
  feedback: z.string(),
  is_blind_spot: z.boolean().default(false),
});

export const TopicExtractionItemSchema = z.object({
  title: z.string().min(2),
  unitModule: z.string().nullable().optional(),
  orderIndex: z.number().int().min(1).default(1),
  learningObjectives: z.array(z.string()).default([]),
  examFrequency: z.number().min(0).default(0),
  examTotalMarks: z.number().min(0).default(0),
  examWeight: z.number().min(0).max(100).default(10),
  prerequisites: z.array(z.string()).default([]),
  sourceChunkId: z.string().nullable().optional(),
});

export const TopicExtractionResultSchema = z.object({
  topics: z.array(TopicExtractionItemSchema),
});
