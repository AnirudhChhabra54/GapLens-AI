// ==============================================================================
// GapLens AI — Server-Side Quiz Session Cache & Stateless Encrypted Token
// Holds dynamically generated quiz questions and ground-truth answer keys
// strictly on the server (or in an AES-256-GCM sealed token) to prevent
// answer leakage, client tampering, and serverless cold-start cache misses.
// ==============================================================================

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import type { QuizQuestionRow } from "@/types/database";

interface CachedQuiz {
  quizId: string;
  createdAt: number;
  questions: QuizQuestionRow[];
}

// In-memory cache for demo/unmigrated quiz questions (TTL: 2 hours)
const quizCache = new Map<string, CachedQuiz>();
const TTL_MS = 2 * 60 * 60 * 1000;

function getSessionSecretKey(): Buffer {
  const raw =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.GROQ_API_KEY ||
    "gaplens-local-dev-quiz-session-key";
  return createHash("sha256").update(raw).digest();
}

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

/**
 * Encrypts quiz questions + answer keys into an opaque AES-256-GCM token
 * so serverless cold starts never lose unmigrated/demo quiz sessions.
 */
export function sealQuizSession(quizId: string, questions: QuizQuestionRow[]): string | null {
  try {
    const key = getSessionSecretKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const payload = JSON.stringify({
      quizId,
      createdAt: Date.now(),
      questions,
    });
    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
  } catch {
    return null;
  }
}

/**
 * Decrypts and verifies an opaque AES-256-GCM quiz session token.
 */
export function unsealQuizSession(quizId: string, token?: string | null): QuizQuestionRow[] | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, encB64] = parts;
    const key = getSessionSecretKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(decrypted) as CachedQuiz;
    if (parsed.quizId !== quizId) return null;
    if (Date.now() - parsed.createdAt > TTL_MS) return null;
    return Array.isArray(parsed.questions) ? parsed.questions : null;
  } catch {
    return null;
  }
}

export function clearDemoQuizCache() {
  quizCache.clear();
}
