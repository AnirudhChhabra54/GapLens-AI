// ==============================================================================
// GapLens AI — Unified Multi-Provider AI Facade
// Seamlessly routes between:
// - Groq API (openai/gpt-oss-120b) for structured generation & reasoning
// - Jina AI API (jina-embeddings-v5-text-nano, 768d) for dense embeddings
// - Google Gemini API fallback
// - Deterministic offline mock mode when unconfigured
// ==============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import { isGroqLive, generateGroqStructured, getGroqModel } from "./groq";
import { isJinaLive, embedBatchJina, embedTextJina, getJinaModel } from "./jina";

export const TARGET_EMBEDDING_DIMENSIONS = 768;

/**
 * Returns the configured Gemini API key if present and not a placeholder.
 */
export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key || key.includes("YourGeminiApiKeyHere") || key.trim() === "") {
    return null;
  }
  return key.trim();
}

/**
 * Returns true if genuine Gemini API credentials are active in the environment.
 */
export function isGeminiLive(): boolean {
  return getGeminiApiKey() !== null;
}

/**
 * Returns true if any genuine LLM generation provider is active (Groq or Gemini).
 */
export function isLLMLive(): boolean {
  return isGroqLive() || isGeminiLive();
}

/**
 * Returns true if any genuine embedding provider is active (Jina or Gemini).
 */
export function isEmbeddingLive(): boolean {
  return isJinaLive() || isGeminiLive();
}

/**
 * Runtime-evaluated active embedding model name.
 */
export function getActiveEmbeddingModelName(): string {
  if (isJinaLive()) return getJinaModel();
  if (isGeminiLive()) return "gemini-embedding-001";
  return "deterministic-local-768d";
}

/**
 * Runtime-evaluated active reasoning model name.
 */
export function getActiveReasoningModelName(): string {
  if (isGroqLive()) return getGroqModel();
  if (isGeminiLive()) return "gemini-1.5-flash";
  return "offline-mock";
}

export const EMBEDDING_MODEL_NAME = getActiveEmbeddingModelName();
export const REASONING_MODEL_NAME = getActiveReasoningModelName();

/**
 * Generates a deterministic, unit-normalized 768-dimensional embedding vector
 * from text. Used as an offline/fallback vector when API keys are absent.
 */
export function generateDeterministic768dEmbedding(text: string): number[] {
  const vec: number[] = new Array(TARGET_EMBEDDING_DIMENSIONS).fill(0.01);
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  for (const word of words) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = (h << 5) - h + word.charCodeAt(i);
      h |= 0;
    }
    for (let j = 0; j < 8; j++) {
      const idx = Math.abs((h + j * 79) % TARGET_EMBEDDING_DIMENSIONS);
      vec[idx] += 1.0;
    }
  }

  let baseHash = 0;
  for (let i = 0; i < text.length; i++) {
    baseHash = (baseHash << 5) - baseHash + text.charCodeAt(i);
    baseHash |= 0;
  }
  for (let i = 0; i < TARGET_EMBEDDING_DIMENSIONS; i++) {
    vec[i] += Math.sin((baseHash + i * 1337) * 0.001) * 0.05;
  }

  let sumSq = 0;
  for (let i = 0; i < TARGET_EMBEDDING_DIMENSIONS; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Normalizes any number[] vector to exact target dimensions (768) and unit L2 norm.
 */
export function normalizeEmbedding(vector: number[], targetDim = TARGET_EMBEDDING_DIMENSIONS): number[] {
  let adjusted: number[];
  if (vector.length === targetDim) {
    adjusted = [...vector];
  } else if (vector.length > targetDim) {
    adjusted = vector.slice(0, targetDim);
  } else {
    adjusted = [...vector, ...new Array(targetDim - vector.length).fill(0)];
  }

  let sumSq = 0;
  for (let i = 0; i < targetDim; i++) {
    sumSq += adjusted[i] * adjusted[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  return adjusted.map((v) => Number((v / norm).toFixed(6)));
}

export interface EmbedResult {
  embedding: number[];
  dimensions: number;
  model: string;
  isMock: boolean;
}

/**
 * Generates an embedding for a single text input.
 * Priority: Jina AI -> Gemini API -> Deterministic Mock.
 */
export async function embedText(
  text: string,
  task: "retrieval.passage" | "retrieval.query" | "text-matching" = "retrieval.passage"
): Promise<EmbedResult> {
  if (isJinaLive()) {
    const result = await embedTextJina(text, task);
    return {
      embedding: result.embedding,
      dimensions: result.dimensions,
      model: result.model,
      isMock: result.isMock,
    };
  }

  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      if (result.embedding?.values && result.embedding.values.length > 0) {
        const normalized = normalizeEmbedding(result.embedding.values, TARGET_EMBEDDING_DIMENSIONS);
        return {
          embedding: normalized,
          dimensions: TARGET_EMBEDDING_DIMENSIONS,
          model: "gemini-embedding-001",
          isMock: false,
        };
      }
    } catch (error) {
      console.warn(
        `[Gemini Embed] Live call failed, falling back to deterministic vector:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  const mockVector = generateDeterministic768dEmbedding(text);
  return {
    embedding: mockVector,
    dimensions: TARGET_EMBEDDING_DIMENSIONS,
    model: "deterministic-local-768d",
    isMock: true,
  };
}

/**
 * Generates embeddings for a batch of text chunks.
 * Priority: Jina AI -> Gemini API -> Deterministic Mock.
 */
export async function embedBatch(
  texts: string[],
  task: "retrieval.passage" | "retrieval.query" | "text-matching" = "retrieval.passage"
): Promise<EmbedResult[]> {
  if (isJinaLive()) {
    const results = await embedBatchJina(texts, task);
    return results.map((r) => ({
      embedding: r.embedding,
      dimensions: r.dimensions,
      model: r.model,
      isMock: r.isMock,
    }));
  }

  return Promise.all(texts.map((t) => embedText(t, task)));
}

/**
 * Generates structured JSON output validated against a Zod schema.
 * Priority: Groq API (openai/gpt-oss-120b) -> Gemini API -> Mock Fallback.
 */
export async function generateStructured<T>(params: {
  prompt: string;
  schema: z.ZodType<T, any, any>;
  systemInstruction?: string;
  mockFallback?: () => T;
}): Promise<{ data: T; isMock: boolean; model?: string }> {
  if (isGroqLive()) {
    try {
      const groqRes = await generateGroqStructured(params);
      return {
        data: groqRes.data,
        isMock: groqRes.isMock,
        model: groqRes.model,
      };
    } catch (err) {
      console.warn(
        `[Groq Structured Gen] Call failed, attempting secondary provider fallback:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  const apiKey = getGeminiApiKey();
  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
        systemInstruction: params.systemInstruction,
      });

      const response = await model.generateContent(params.prompt);
      const jsonText = response.response.text();
      const parsed = JSON.parse(jsonText);
      const validated = params.schema.parse(parsed);

      return {
        data: validated,
        isMock: false,
        model: "gemini-1.5-flash",
      };
    } catch (error) {
      console.warn(
        `[Gemini Structured Gen] Live API generation failed, falling back to mock:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  if (params.mockFallback) {
    return {
      data: params.mockFallback(),
      isMock: true,
      model: "offline-mock",
    };
  }

  throw new Error("No live LLM provider available and no mockFallback provided for structured generation.");
}
