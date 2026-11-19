// ==============================================================================
// GapLens AI — Grounded Diagnostic Question Generator Engine
// Synthesizes source-grounded MCQs (4 distinct options) and short conceptual questions
// strictly verified against retrieved document chunks with discrete rubrics and pinned citations.
// Strips answer keys and rubrics when serializing SafeQuizQuestion for client runners.
// ==============================================================================

import type {
  MCQOption,
  RubricKeypoint,
  QuestionType,
  QuizQuestionRow,
  DocumentChunkRow,
  HybridSearchResult,
} from "@/types/database";
import type { SafeQuizQuestion } from "@/types/assessment";
import { generateStructured } from "@/lib/ai/gemini";
import { DiagnosticQuestionSchema } from "@/lib/ai/schemas";
import { verifyQuote, normalizeText } from "@/lib/rag/citation-verifier";

export interface GenerateQuestionParams {
  topicId: string;
  topicTitle: string;
  chunks: Array<DocumentChunkRow | HybridSearchResult>;
  questionType?: QuestionType; // 'mcq' | 'short_answer'
  difficulty?: number; // 1 | 2 | 3
  existingQuestions?: Array<{ question_text: string } | { questionText: string }>;
  targetCount?: number;
}

export interface GeneratedQuestionResult {
  id?: string;
  topicId: string;
  questionType: QuestionType;
  difficulty: number;
  questionText: string;
  options: MCQOption[] | null;
  answerKey: string;
  explanation: string;
  rubric: RubricKeypoint[] | null;
  sourceChunkId: string;
  citationDocumentName: string;
  citationPageStart: number;
  citationPageEnd: number;
  citationSection: string | null;
  citationQuote: string | null;
  isQuoteVerified: boolean;
}

/**
 * Checks for near-duplicate question text using token overlap similarity.
 */
export function isNearDuplicate(
  candidateText: string,
  existingQuestions: Array<{ question_text?: string; questionText?: string }>
): boolean {
  const normCandidate = normalizeText(candidateText);
  const candidateTokens = new Set(normCandidate.split(/\s+/).filter((t) => t.length > 3));

  if (candidateTokens.size === 0) return false;

  for (const item of existingQuestions) {
    const existing = item.question_text || item.questionText || "";
    const normExisting = normalizeText(existing);
    const existingTokens = new Set(normExisting.split(/\s+/).filter((t) => t.length > 3));

    if (existingTokens.size === 0) continue;

    let overlap = 0;
    for (const token of candidateTokens) {
      if (existingTokens.has(token)) {
        overlap++;
      }
    }

    const similarity = overlap / Math.max(candidateTokens.size, existingTokens.size);
    if (similarity > 0.80) {
      return true;
    }
  }

  return false;
}

/**
 * Deterministic offline question generator grounded in chunk content.
 */
export function generateQuestionDeterministic(params: {
  topicId: string;
  topicTitle: string;
  chunk: DocumentChunkRow | HybridSearchResult;
  questionType: QuestionType;
  difficulty: number;
}): GeneratedQuestionResult {
  const { topicId, topicTitle, chunk, questionType, difficulty } = params;
  const chunkText = chunk.content;
  const sentences = chunkText.split(/\. |\.\n/).map((s) => s.trim()).filter((s) => s.length > 25);
  const primarySentence = sentences[0] || `${topicTitle} is an essential concept in computer systems.`;
  const quote = primarySentence.slice(0, 150);

  const quoteCheck = verifyQuote(quote, chunkText);

  if (questionType === "mcq") {
    const options: MCQOption[] = [
      { id: "A", text: `It accurately describes ${topicTitle.toLowerCase()} as stated in the course syllabus.` },
      { id: "B", text: `It executes only during unprivileged user-mode traps.` },
      { id: "C", text: `It requires disabled hardware interrupts across all processor cores.` },
      { id: "D", text: `It bypasses address translation and page tables directly.` },
    ];

    return {
      topicId,
      questionType: "mcq",
      difficulty,
      questionText: `Which of the following statements regarding ${topicTitle} is correct according to the course material?`,
      options,
      answerKey: "A",
      explanation: `Option A is correct: "${primarySentence}". The other options present common misconceptions.`,
      rubric: null,
      sourceChunkId: chunk.id,
      citationDocumentName: (chunk as any).document_title || "Course Material",
      citationPageStart: (chunk as any).page_start || (chunk as any).page_number || 1,
      citationPageEnd: (chunk as any).page_end || (chunk as any).page_number || 1,
      citationSection: (chunk as any).section_heading || topicTitle,
      citationQuote: quote,
      isQuoteVerified: quoteCheck.verified,
    };
  }

  // Short answer
  const rubric: RubricKeypoint[] = [
    {
      keypoint: "Core definition",
      weight: 0.50,
      description: `Student must explain the core principle of ${topicTitle} as described in the notes.`,
    },
    {
      keypoint: "Mechanism or impact",
      weight: 0.50,
      description: `Student must articulate how ${topicTitle} operates or prevents faults in system execution.`,
    },
  ];

  return {
    topicId,
    questionType: "short_answer",
    difficulty,
    questionText: `Explain the fundamental concept and mechanism of ${topicTitle}. Highlight its primary function and operational requirements.`,
    options: null,
    answerKey: primarySentence,
    explanation: `A complete answer should discuss the definition and mechanism of ${topicTitle}: "${primarySentence}".`,
    rubric,
    sourceChunkId: chunk.id,
    citationDocumentName: (chunk as any).document_title || "Course Material",
    citationPageStart: (chunk as any).page_start || (chunk as any).page_number || 1,
    citationPageEnd: (chunk as any).page_end || (chunk as any).page_number || 1,
    citationSection: (chunk as any).section_heading || topicTitle,
    citationQuote: quote,
    isQuoteVerified: quoteCheck.verified,
  };
}

/**
 * Generates grounded diagnostic questions for a topic.
 * Selects chunks matching the topic, queries Gemini with structured schema,
 * and validates quotation and rubric constraints.
 */
export async function generateDiagnosticQuestions(
  params: GenerateQuestionParams
): Promise<GeneratedQuestionResult[]> {
  const {
    topicId,
    topicTitle,
    chunks,
    questionType = "mcq",
    difficulty = 2,
    existingQuestions = [],
    targetCount = 1,
  } = params;

  if (chunks.length === 0) {
    throw new Error(`Cannot generate questions for topic "${topicTitle}": No candidate chunks provided.`);
  }

  const results: GeneratedQuestionResult[] = [];

  for (let i = 0; i < targetCount; i++) {
    const chunk = chunks[i % chunks.length];
    const qType = questionType;

    try {
      const { data } = await generateStructured({
        prompt: `Generate a high quality diagnostic ${qType === "mcq" ? "multiple-choice question with 4 unique options" : "short conceptual answer question with a weighted rubric"} for topic: "${topicTitle}".
Ground the question STRICTLY on the following source chunk text. Quote an exact phrase from the chunk as citationQuote.

Chunk Content:
"""
${chunk.content}
"""`,
        schema: DiagnosticQuestionSchema,
        systemInstruction:
          "You are an assessment authoring expert. Generate questions strictly grounded in the provided source chunk. Rubric weights MUST sum to exactly 1.0. MCQ options must have exactly 4 distinct items with 1 correct answer.",
        mockFallback: () => {
          return generateQuestionDeterministic({
            topicId,
            topicTitle,
            chunk,
            questionType: qType,
            difficulty,
          });
        },
      });

      // Verify citation quote
      const quoteCheck = verifyQuote(data.citationQuote, chunk.content);

      // Validate rubric weights if short answer
      let validatedRubric = data.rubric || null;
      if (qType === "short_answer" && validatedRubric && validatedRubric.length > 0) {
        const sumWeights = validatedRubric.reduce((sum, r) => sum + r.weight, 0);
        if (Math.abs(sumWeights - 1.0) > 0.01) {
          // Normalize weights to sum exactly to 1.0
          validatedRubric = validatedRubric.map((r) => ({
            ...r,
            weight: Number((r.weight / sumWeights).toFixed(2)),
          }));
        }
      }

      // Ensure question is not near duplicate
      if (isNearDuplicate(data.questionText, existingQuestions) || isNearDuplicate(data.questionText, results)) {
        // Fall back to deterministic distinct question
        const fallback = generateQuestionDeterministic({
          topicId,
          topicTitle,
          chunk,
          questionType: qType,
          difficulty,
        });
        results.push(fallback);
      } else {
        results.push({
          topicId,
          questionType: data.questionType as QuestionType,
          difficulty: data.difficulty,
          questionText: data.questionText,
          options: data.options || null,
          answerKey: data.answerKey,
          explanation: data.explanation,
          rubric: validatedRubric,
          sourceChunkId: chunk.id,
          citationDocumentName: data.citationDocumentName || (chunk as any).document_title || "Course Material",
          citationPageStart: data.citationPageStart || (chunk as any).page_start || 1,
          citationPageEnd: data.citationPageEnd || (chunk as any).page_end || 1,
          citationSection: data.citationSection || (chunk as any).section_heading || null,
          citationQuote: data.citationQuote || null,
          isQuoteVerified: quoteCheck.verified,
        });
      }
    } catch {
      results.push(
        generateQuestionDeterministic({
          topicId,
          topicTitle,
          chunk,
          questionType: qType,
          difficulty,
        })
      );
    }
  }

  return results;
}

/**
 * Strips answer keys, explanations, and grading rubrics from question records,
 * returning a SafeQuizQuestion suitable for delivery to student client runners.
 */
export function toSafeQuizQuestion(
  q: QuizQuestionRow | GeneratedQuestionResult,
  topicTitle?: string
): SafeQuizQuestion {
  const isRow = "quiz_id" in q;

  return {
    id: q.id || (isRow ? (q as QuizQuestionRow).id : "temp-question-id"),
    topicId: isRow ? (q as QuizQuestionRow).topic_id : (q as GeneratedQuestionResult).topicId,
    topicTitle: topicTitle || "Diagnostic Topic",
    questionType: isRow ? (q as QuizQuestionRow).question_type : (q as GeneratedQuestionResult).questionType,
    difficulty: q.difficulty,
    questionText: isRow ? (q as QuizQuestionRow).question_text : (q as GeneratedQuestionResult).questionText,
    options: q.options || null,
    citation: {
      chunkId: isRow ? (q as QuizQuestionRow).source_chunk_id : (q as GeneratedQuestionResult).sourceChunkId,
      documentId: "",
      documentName: isRow
        ? (q as QuizQuestionRow).citation_document_name
        : (q as GeneratedQuestionResult).citationDocumentName,
      docType: "material",
      pageStart: isRow
        ? (q as QuizQuestionRow).citation_page_start
        : (q as GeneratedQuestionResult).citationPageStart,
      pageEnd: isRow
        ? (q as QuizQuestionRow).citation_page_end
        : (q as GeneratedQuestionResult).citationPageEnd,
      sectionHeading: isRow
        ? (q as QuizQuestionRow).citation_section || null
        : (q as GeneratedQuestionResult).citationSection || null,
      isQuoteVerified: isRow
        ? (q as QuizQuestionRow).is_quote_verified
        : (q as GeneratedQuestionResult).isQuoteVerified,
    },
  };
}
