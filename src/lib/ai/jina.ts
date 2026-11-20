// ==============================================================================
// GapLens AI — Jina AI Embeddings Client
// Target Endpoint: https://api.jina.ai/v1/embeddings
// Model: jina-embeddings-v5-text-nano (768 dimensions)
// Supports retrieval.passage and retrieval.query tasks
// ==============================================================================

export const DEFAULT_JINA_MODEL = "jina-embeddings-v5-text-nano";
export const DEFAULT_JINA_DIMENSIONS = 768;
export const DEFAULT_JINA_BASE_URL = "https://api.jina.ai/v1/embeddings";

export function getJinaApiKey(): string | null {
  const key = process.env.JINA_API_KEY;
  if (!key || key.trim() === "" || key.includes("your-jina-api-key")) {
    return null;
  }
  return key.trim();
}

export function isJinaLive(): boolean {
  return getJinaApiKey() !== null;
}

export function getJinaModel(): string {
  return process.env.JINA_EMBEDDING_MODEL || DEFAULT_JINA_MODEL;
}

export function getJinaDimensions(): number {
  const parsed = parseInt(process.env.JINA_EMBEDDING_DIMENSIONS || "768", 10);
  return isNaN(parsed) ? DEFAULT_JINA_DIMENSIONS : parsed;
}

export interface JinaEmbedResult {
  embedding: number[];
  dimensions: number;
  model: string;
  isMock: boolean;
}

/**
 * Deterministic unit-normalized 768d vector generator fallback.
 */
export function generateDeterministic768dVector(text: string): number[] {
  const targetDim = 768;
  const vec: number[] = new Array(targetDim).fill(0.01);
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
      const idx = Math.abs((h + j * 79) % targetDim);
      vec[idx] += 1.0;
    }
  }

  let baseHash = 0;
  for (let i = 0; i < text.length; i++) {
    baseHash = (baseHash << 5) - baseHash + text.charCodeAt(i);
    baseHash |= 0;
  }
  for (let i = 0; i < targetDim; i++) {
    vec[i] += Math.sin((baseHash + i * 1337) * 0.001) * 0.05;
  }

  let sumSq = 0;
  for (let i = 0; i < targetDim; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

/**
 * Normalizes vector to exact target dimensions and unit L2 norm.
 */
export function normalizeJinaVector(vector: number[], targetDim = 768): number[] {
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

/**
 * Generates embeddings via Jina AI API for an array of input strings.
 * Task can be 'retrieval.passage' (for document chunks) or 'retrieval.query' (for search queries).
 */
export async function embedBatchJina(
  inputs: string[],
  task: "retrieval.passage" | "retrieval.query" | "text-matching" = "retrieval.passage"
): Promise<JinaEmbedResult[]> {
  const apiKey = getJinaApiKey();
  const model = getJinaModel();
  const dimensions = getJinaDimensions();
  const baseUrl = process.env.JINA_BASE_URL || DEFAULT_JINA_BASE_URL;

  if (apiKey && inputs.length > 0) {
    try {
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          dimensions,
          task,
          input: inputs,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || `Jina API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (Array.isArray(data?.data)) {
        return data.data.map((item: any) => {
          const rawVec = item.embedding || [];
          const normalized = normalizeJinaVector(rawVec, dimensions);
          return {
            embedding: normalized,
            dimensions,
            model,
            isMock: false,
          };
        });
      }
    } catch (err: any) {
      console.warn(
        `[Jina AI Embed] Live API call failed (${err.message || err}). Falling back to deterministic vector.`
      );
    }
  }

  // Deterministic mock fallback
  return inputs.map((text) => ({
    embedding: generateDeterministic768dVector(text),
    dimensions,
    model,
    isMock: true,
  }));
}

/**
 * Generates an embedding for a single text input via Jina AI.
 */
export async function embedTextJina(
  text: string,
  task: "retrieval.passage" | "retrieval.query" | "text-matching" = "retrieval.passage"
): Promise<JinaEmbedResult> {
  const results = await embedBatchJina([text], task);
  return results[0];
}
