// ==============================================================================
// GapLens AI — Google Gemini AI SDK Wrapper
// Embedding generation (gemini-embedding-001, 768d unit vectors)
// Reasoning and Structured Output (gemini-3.8-flash / gemini-1.5-flash with Zod)
// Distinguishes genuine API calls from deterministic offline mock mode via `isMock: boolean`
// ==============================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

export const EMBEDDING_MODEL_NAME = "gemini-embedding-001";
export const REASONING_MODEL_NAME = "gemini-3.8-flash";
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
    // Distribute word features across 8 deterministic dimensions
    for (let j = 0; j < 8; j++) {
      const idx = Math.abs((h + j * 79) % TARGET_EMBEDDING_DIMENSIONS);
      vec[idx] += 1.0;
    }
  }

  // Base deterministic pseudorandom variation
  let baseHash = 0;
  for (let i = 0; i < text.length; i++) {
    baseHash = (baseHash << 5) - baseHash + text.charCodeAt(i);
    baseHash |= 0;
  }
  for (let i = 0; i < TARGET_EMBEDDING_DIMENSIONS; i++) {
    vec[i] += Math.sin((baseHash + i * 1337) * 0.001) * 0.05;
  }

  // L2 unit normalization
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
 * If live credentials exist, calls the Google Gemini API.
 * Otherwise, generates a deterministic 768d unit vector flagged with `isMock: true`.
 */
export async function embedText(text: string): Promise<EmbedResult> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      // Attempt embedding with text-embedding-004 or gemini-embedding-001
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      if (result.embedding?.values && result.embedding.values.length > 0) {
        const normalized = normalizeEmbedding(result.embedding.values, TARGET_EMBEDDING_DIMENSIONS);
        return {
          embedding: normalized,
          dimensions: TARGET_EMBEDDING_DIMENSIONS,
          model: EMBEDDING_MODEL_NAME,
          isMock: false,
        };
      }
    } catch (error) {
      console.warn(
        `[Gemini Embed] Live API call failed, falling back to deterministic mock vector:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  // Deterministic mock fallback
  const mockVector = generateDeterministic768dEmbedding(text);
  return {
    embedding: mockVector,
    dimensions: TARGET_EMBEDDING_DIMENSIONS,
    model: EMBEDDING_MODEL_NAME,
    isMock: true,
  };
}

/**
 * Generates embeddings for a batch of text chunks.
 */
export async function embedBatch(texts: string[]): Promise<EmbedResult[]> {
  return Promise.all(texts.map((t) => embedText(t)));
}

/**
 * Generates structured JSON output validated against a Zod schema.
 */
export async function generateStructured<T>(params: {
  prompt: string;
  schema: z.ZodType<T>;
  systemInstruction?: string;
  mockFallback?: () => T;
}): Promise<{ data: T; isMock: boolean }> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash", // stable flash model
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
      };
    } catch (error) {
      console.warn(
        `[Gemini Structured Gen] Live API generation failed, falling back to mock generator:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  if (params.mockFallback) {
    return {
      data: params.mockFallback(),
      isMock: true,
    };
  }

  throw new Error("No live Gemini API key provided and no mockFallback provided for structured generation.");
}
