// ==============================================================================
// GapLens AI — Topic Hierarchy & Past-Paper Mapping Engine
// Extracts structured syllabus topic hierarchies with prerequisite relationships,
// maps historical past-paper questions to syllabus topics with confidence scoring,
// and computes authentic exam weights from mapped exam questions.
// ==============================================================================

import type {
  TopicRow,
  TopicPrerequisiteRow,
  PaperQuestionRow,
  DocumentChunkRow,
  HybridSearchResult,
} from "@/types/database";
import { generateStructured } from "@/lib/ai/gemini";
import { TopicExtractionResultSchema } from "@/lib/ai/schemas";

export interface ExtractedTopicItem {
  id?: string;
  title: string;
  unitModule: string | null;
  orderIndex: number;
  learningObjectives: string[];
  prerequisites: string[]; // Topic titles or IDs of prerequisites
  inferredPrerequisites?: Array<{
    prerequisiteTitle: string;
    confidence: number;
    rationale: string;
  }>;
  sourceChunkId?: string | null;
  extractionConfidence: number;
}

export interface TopicTreeNode extends TopicRow {
  children?: TopicTreeNode[];
  prerequisites?: Array<{
    prerequisiteTopicId: string;
    prerequisiteTitle: string;
    isInferred: boolean;
    confidence: number;
  }>;
}

export interface PaperQuestionInput {
  paperYear?: number | null;
  paperName?: string | null;
  questionNumber: string;
  questionText: string;
  marks: number;
  documentId: string;
  workspaceId: string;
}

export interface MappedPaperQuestionResult {
  paperYear: number | null;
  paperName: string | null;
  questionNumber: string;
  questionText: string;
  marks: number;
  documentId: string;
  workspaceId: string;
  mappedTopicId: string | null;
  mappingConfidence: number;
  needsReview: boolean;
  supportingChunkId: string | null;
  mappingRationale: string;
}

/**
 * Heuristic fallback parser to extract topics from syllabus text when offline.
 */
export function extractTopicsHeuristic(
  syllabusText: string,
  chunks?: Array<DocumentChunkRow | HybridSearchResult>
): { topics: ExtractedTopicItem[]; prerequisites: Array<{ topicTitle: string; prereqTitle: string; isInferred: boolean; confidence: number; rationale: string }> } {
  const lines = syllabusText.split("\n").map((l) => l.trim()).filter(Boolean);
  const topics: ExtractedTopicItem[] = [];
  const prerequisites: Array<{ topicTitle: string; prereqTitle: string; isInferred: boolean; confidence: number; rationale: string }> = [];

  let currentUnit: string | null = null;
  let order = 1;

  for (const line of lines) {
    // Detect Unit / Module headers
    const unitMatch = line.match(/^(?:Unit|Module|Chapter|Part)\s*([0-9IVX]+)[:\.\s-]*(.*)/i);
    if (unitMatch) {
      currentUnit = line;
      continue;
    }

    // Detect bullet points or numbered topics
    const topicMatch = line.match(/^(?:[0-9]+[\.\)]|\*|-|\u2022)\s*(.*)/);
    const candidateTitle = topicMatch ? topicMatch[1].trim() : line;

    if (candidateTitle.length > 5 && candidateTitle.length < 120 && !candidateTitle.toLowerCase().startsWith("learning objectives")) {
      // Find matching source chunk if available
      let matchedChunkId: string | null = null;
      if (chunks && chunks.length > 0) {
        const lowerTitle = candidateTitle.toLowerCase();
        const found = chunks.find((c) => c.content.toLowerCase().includes(lowerTitle));
        if (found) matchedChunkId = found.id;
      }

      topics.push({
        title: candidateTitle,
        unitModule: currentUnit,
        orderIndex: order++,
        learningObjectives: [`Understand principles and application of ${candidateTitle}`],
        prerequisites: [],
        sourceChunkId: matchedChunkId,
        extractionConfidence: 0.90,
      });
    }
  }

  // Link basic sequential prerequisites between topics within same unit
  for (let i = 1; i < topics.length; i++) {
    if (topics[i].unitModule && topics[i].unitModule === topics[i - 1].unitModule) {
      prerequisites.push({
        topicTitle: topics[i].title,
        prereqTitle: topics[i - 1].title,
        isInferred: true,
        confidence: 0.75,
        rationale: `Sequential topic dependency within ${topics[i].unitModule}`,
      });
    }
  }

  return { topics, prerequisites };
}

/**
 * Extracts syllabus topic hierarchy and prerequisite links.
 * Uses Gemini structured output when available, falling back to deterministic heuristic parsing.
 */
export async function extractTopicHierarchy(params: {
  syllabusText: string;
  chunks?: Array<DocumentChunkRow | HybridSearchResult>;
}): Promise<{
  topics: ExtractedTopicItem[];
  prerequisites: Array<{
    topicTitle: string;
    prereqTitle: string;
    isInferred: boolean;
    confidence: number;
    rationale: string;
  }>;
}> {
  const { syllabusText, chunks } = params;

  try {
    const response = await generateStructured({
      prompt: `Analyze the following syllabus text and extract a structured hierarchy of units, topics, subtopics, and prerequisite dependencies.
Do not invent topics not supported by the syllabus text.

Syllabus Content:
"""
${syllabusText.slice(0, 15000)}
"""`,
      schema: TopicExtractionResultSchema,
      systemInstruction: "You are an expert curriculum engineering specialist. Extract only genuinely stated or strongly inferred syllabus topics.",
      mockFallback: () => {
        const res = extractTopicsHeuristic(syllabusText, chunks);
        return {
          topics: res.topics.map((t) => ({
            title: t.title,
            unitModule: t.unitModule,
            orderIndex: t.orderIndex,
            learningObjectives: t.learningObjectives,
            examFrequency: 0,
            examTotalMarks: 0,
            examWeight: 10,
            prerequisites: [],
            sourceChunkId: t.sourceChunkId,
          })),
        };
      },
    });

    const parsedTopics: ExtractedTopicItem[] = response.data.topics.map((t, idx) => ({
      title: t.title,
      unitModule: t.unitModule || null,
      orderIndex: t.orderIndex ?? idx + 1,
      learningObjectives: t.learningObjectives || [],
      prerequisites: t.prerequisites || [],
      sourceChunkId: t.sourceChunkId || null,
      extractionConfidence: 0.92,
    }));

    const prerequisites: Array<{
      topicTitle: string;
      prereqTitle: string;
      isInferred: boolean;
      confidence: number;
      rationale: string;
    }> = [];

    for (const t of parsedTopics) {
      for (const p of t.prerequisites) {
        prerequisites.push({
          topicTitle: t.title,
          prereqTitle: p,
          isInferred: false,
          confidence: 0.95,
          rationale: "Explicitly defined in syllabus",
        });
      }
    }

    if (parsedTopics.length === 0) {
      return extractTopicsHeuristic(syllabusText, chunks);
    }

    return { topics: parsedTopics, prerequisites };
  } catch (err) {
    return extractTopicsHeuristic(syllabusText, chunks);
  }
}

/**
 * Maps a single past-paper question to the best matching syllabus topic.
 * Uses term overlap and contextual similarity.
 * Flags mapping with `needsReview = true` if confidence is below 0.60.
 */
export function mapSingleQuestionToTopic(params: {
  question: PaperQuestionInput;
  topics: TopicRow[];
  chunks?: Array<DocumentChunkRow | HybridSearchResult>;
}): MappedPaperQuestionResult {
  const { question, topics, chunks } = params;
  const qTextLower = question.questionText.toLowerCase();

  let bestTopicId: string | null = null;
  let highestScore = 0;
  let bestRationale = "No close topic match found in syllabus.";
  let supportingChunkId: string | null = null;

  for (const topic of topics) {
    const topicTitleLower = topic.title.toLowerCase();
    const topicTokens = topicTitleLower
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    let matchCount = 0;
    for (const token of topicTokens) {
      if (qTextLower.includes(token) || (token.endsWith("ing") && qTextLower.includes(token.slice(0, -3)))) {
        matchCount++;
      }
    }

    let score = topicTokens.length > 0 ? (matchCount / topicTokens.length) * 0.6 : 0;
    if (qTextLower.includes(topicTitleLower)) {
      score += 0.4;
    }

    // Key domain acronym and stem bonuses
    const domainKeys = ["tlb", "mmu", "fifo", "lru", "mlfq", "pcb", "dram", "emat", "peterson", "deadlock", "inode"];
    for (const key of domainKeys) {
      if (
        qTextLower.includes(key) &&
        (topicTitleLower.includes(key) ||
          topic.learning_objectives?.some((lo) => lo.toLowerCase().includes(key)))
      ) {
        score += 0.35;
      }
    }

    // Learning objectives token overlap bonus
    if (topic.learning_objectives && topic.learning_objectives.length > 0) {
      for (const obj of topic.learning_objectives) {
        const objTokens = obj
          .toLowerCase()
          .replace(/[^\w\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3);
        let objMatches = 0;
        for (const ot of objTokens) {
          if (qTextLower.includes(ot)) {
            objMatches++;
          }
        }
        if (objMatches >= 2) {
          score += 0.35;
          break;
        } else if (objMatches === 1) {
          score += 0.15;
        }
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestTopicId = topic.id;
      bestRationale = `Matched syllabus topic "${topic.title}" based on shared domain keywords.`;
    }
  }

  // Find supporting chunk
  if (bestTopicId && chunks && chunks.length > 0) {
    const bestTopic = topics.find((t) => t.id === bestTopicId);
    if (bestTopic) {
      const chunkMatch = chunks.find(
        (c) =>
          c.content.toLowerCase().includes(bestTopic.title.toLowerCase()) ||
          qTextLower.split(/\s+/).some((w) => w.length > 5 && c.content.toLowerCase().includes(w))
      );
      if (chunkMatch) {
        supportingChunkId = chunkMatch.id;
      }
    }
  }

  // Bound confidence between 0.0 and 1.0
  const mappingConfidence = Math.min(1.0, Number(highestScore.toFixed(2)));
  const needsReview = mappingConfidence < 0.60;

  return {
    paperYear: question.paperYear ?? null,
    paperName: question.paperName ?? null,
    questionNumber: question.questionNumber,
    questionText: question.questionText,
    marks: question.marks,
    documentId: question.documentId,
    workspaceId: question.workspaceId,
    mappedTopicId: bestTopicId,
    mappingConfidence,
    needsReview,
    supportingChunkId,
    mappingRationale: needsReview
      ? `Confidence (${(mappingConfidence * 100).toFixed(0)}%) is below 60% threshold. Needs human review.`
      : bestRationale,
  };
}

/**
 * Maps a batch of past paper questions to syllabus topics.
 */
export function mapPastPaperQuestions(params: {
  questions: PaperQuestionInput[];
  topics: TopicRow[];
  chunks?: Array<DocumentChunkRow | HybridSearchResult>;
}): MappedPaperQuestionResult[] {
  return params.questions.map((q) =>
    mapSingleQuestionToTopic({
      question: q,
      topics: params.topics,
      chunks: params.chunks,
    })
  );
}

export interface TopicExamWeightUpdate {
  topicId: string;
  examFrequency: number;
  examTotalMarks: number;
  examWeight: number; // Normalized weight: 0.0 to 1.0 (or 0% to 100%)
}

/**
 * Computes authentic exam weights from actual uploaded past papers.
 * If no past papers exist or total marks is 0, returns 0 for exam weights.
 * Normalizes exam weights across topics summing to 1.0.
 */
export function computeTopicExamWeights(
  topics: TopicRow[],
  paperQuestions: PaperQuestionRow[]
): Map<string, TopicExamWeightUpdate> {
  const result = new Map<string, TopicExamWeightUpdate>();

  const validQuestions = paperQuestions.filter(
    (q) => q.mapped_topic_id && !q.needs_review
  );

  let totalMarksAll = 0;
  const topicStats = new Map<string, { freq: number; marks: number }>();

  for (const topic of topics) {
    topicStats.set(topic.id, { freq: 0, marks: 0 });
  }

  for (const q of validQuestions) {
    if (!q.mapped_topic_id) continue;
    const stats = topicStats.get(q.mapped_topic_id) || { freq: 0, marks: 0 };
    stats.freq += 1;
    stats.marks += q.marks || 0;
    topicStats.set(q.mapped_topic_id, stats);
    totalMarksAll += q.marks || 0;
  }

  const totalQuestionsAll = validQuestions.length;
  for (const topic of topics) {
    const stats = topicStats.get(topic.id) || { freq: 0, marks: 0 };
    const normalizedWeight =
      totalMarksAll > 0
        ? stats.marks / totalMarksAll
        : totalQuestionsAll > 0
        ? stats.freq / totalQuestionsAll
        : 0.0;

    result.set(topic.id, {
      topicId: topic.id,
      examFrequency: stats.freq,
      examTotalMarks: stats.marks,
      examWeight: Number(normalizedWeight.toFixed(4)),
    });
  }

  return result;
}

/**
 * Heuristic extractor for questions from past-paper documents.
 * Recognizes question markers (e.g. "Q1", "Question 1", "1.", marks "[10 marks]", etc.).
 */
export function extractPastPaperQuestionsFromText(
  text: string,
  documentId: string,
  workspaceId: string
): PaperQuestionInput[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const questions: PaperQuestionInput[] = [];

  let currentQNumber: string | null = null;
  let currentQText: string[] = [];
  let currentMarks: number | null = null;
  let qIndex = 1;

  const flushCurrent = () => {
    if (currentQNumber && currentQText.length > 0) {
      const fullText = currentQText.join(" ").trim();
      if (fullText.length >= 10) {
        questions.push({
          paperYear: null,
          paperName: null,
          questionNumber: currentQNumber,
          questionText: fullText,
          marks: currentMarks ?? 0,
          documentId,
          workspaceId,
        });
      }
    }
    currentQNumber = null;
    currentQText = [];
    currentMarks = null;
  };

  const questionHeaderRegex = /^(?:Question\s*([0-9IVX]+)|Q([0-9IVX]+)|([0-9]{1,2})\.)[:\.\s-]*(.*)/i;
  const marksRegex = /(?:\[|\()([0-9]{1,2})\s*(?:marks?|pts?|points?)(?:\]|\))/i;

  for (const line of lines) {
    const match = line.match(questionHeaderRegex);
    if (match) {
      flushCurrent();
      currentQNumber = match[1] || match[2] || match[3] || `Q${qIndex}`;
      if (!currentQNumber.toUpperCase().startsWith("Q")) {
        currentQNumber = `Q${currentQNumber}`;
      }
      qIndex++;

      const marksMatch = line.match(marksRegex);
      if (marksMatch) {
        currentMarks = parseInt(marksMatch[1], 10) || null;
      }
    } else {
      currentQText.push(line);
      const marksMatch = line.match(marksRegex);
      if (marksMatch && currentMarks === null) {
        currentMarks = parseInt(marksMatch[1], 10) || null;
      }
    }
  }

  flushCurrent();

  // If strict question markers were not found, chunk by substantial paragraphs
  if (questions.length === 0) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 30 && p.length < 800 && (p.includes("?") || p.toLowerCase().includes("explain") || p.toLowerCase().includes("describe") || p.toLowerCase().includes("calculate") || p.toLowerCase().includes("discuss")));

    paragraphs.slice(0, 10).forEach((p, idx) => {
      questions.push({
        paperYear: null,
        paperName: null,
        questionNumber: `Q${idx + 1}`,
        questionText: p,
        marks: 10,
        documentId,
        workspaceId,
      });
    });
  }

  return questions;
}

/**
 * Builds a hierarchical topic tree structure from flat topic rows and prerequisites.
 */
export function buildTopicTree(
  topics: TopicRow[],
  prerequisites: TopicPrerequisiteRow[] = []
): TopicTreeNode[] {
  const topicMap = new Map<string, TopicTreeNode>();

  for (const topic of topics) {
    topicMap.set(topic.id, {
      ...topic,
      children: [],
      prerequisites: [],
    });
  }

  // Populate prerequisite relationships
  for (const prereq of prerequisites) {
    const node = topicMap.get(prereq.topic_id);
    const prereqNode = topicMap.get(prereq.prerequisite_topic_id);
    if (node && prereqNode) {
      node.prerequisites = node.prerequisites || [];
      node.prerequisites.push({
        prerequisiteTopicId: prereq.prerequisite_topic_id,
        prerequisiteTitle: prereqNode.title,
        isInferred: prereq.is_inferred,
        confidence: prereq.confidence,
      });
    }
  }

  const roots: TopicTreeNode[] = [];

  for (const topic of topics) {
    const node = topicMap.get(topic.id)!;
    if (topic.parent_id && topicMap.has(topic.parent_id)) {
      const parent = topicMap.get(topic.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots.sort((a, b) => a.order_index - b.order_index);
}
