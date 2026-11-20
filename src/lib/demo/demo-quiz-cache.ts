// ==============================================================================
// GapLens AI — Server-Side Demo Quiz In-Memory Cache
// Holds dynamically generated demo quiz questions and their ground-truth answer keys
// strictly on the server to prevent answer leakage and client score tampering.
// ==============================================================================

import type { QuizQuestionRow } from "@/types/database";

interface CachedQuiz {
  quizId: string;
  createdAt: number;
  questions: QuizQuestionRow[];
}

// In-memory cache for demo quiz questions (TTL: 2 hours)
const quizCache = new Map<string, CachedQuiz>();
const TTL_MS = 2 * 60 * 60 * 1000;

export function storeDemoQuiz(quizId: string, questions: QuizQuestionRow[]) {
  const now = Date.now();
  // Evict expired entries
  for (const [id, entry] of quizCache.entries()) {
    if (now - entry.createdAt > TTL_MS) {
      quizCache.delete(id);
    }
  }

  quizCache.set(quizId, {
    quizId,
    createdAt: now,
    questions,
  });
}

export function getDemoQuizQuestions(quizId: string): QuizQuestionRow[] | null {
  const entry = quizCache.get(quizId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TTL_MS) {
    quizCache.delete(quizId);
    return null;
  }
  return entry.questions;
}

export function clearDemoQuizCache() {
  quizCache.clear();
}
