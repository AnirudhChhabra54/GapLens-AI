// ==============================================================================
// GapLens AI — Groq Cloud LLM Client (OpenAI-Compatible)
// Target Endpoint: https://api.groq.com/openai/v1
// Model: openai/gpt-oss-120b
// Features: Strict Zod validation, JSON mode, timeout handling, and 429 backoff
// ==============================================================================

import { z } from "zod";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
export const DEFAULT_GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function getGroqApiKey(): string | null {
  const key = process.env.GROQ_API_KEY;
  if (!key || key.trim() === "" || key.includes("your-groq-api-key")) {
    return null;
  }
  return key.trim();
}

export function isGroqLive(): boolean {
  return getGroqApiKey() !== null;
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormatJson?: boolean;
  timeoutMs?: number;
}

/**
 * Executes a chat completion call against Groq with exponential backoff on 429.
 */
export async function groqChatCompletion(
  messages: GroqMessage[],
  options: GroqChatOptions = {}
): Promise<{ text: string; model: string; isMock: boolean }> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  const model = getGroqModel();
  const baseUrl = process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL;
  const timeoutMs = options.timeoutMs ?? 25000;

  const payload: Record<string, any> = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
  };

  if (options.maxTokens) {
    payload.max_tokens = options.maxTokens;
  }

  if (options.responseFormatJson) {
    payload.response_format = { type: "json_object" };
  }

  const maxAttempts = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after");
        const delayMs = retryAfter ? Math.min(parseInt(retryAfter, 10) * 1000, 5000) : attempt * 1500;
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`Groq rate limit exceeded (429) after ${attempt} attempts.`);
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `Groq API returned HTTP ${res.status}`);
      }

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error("Groq API returned an empty response choice.");
      }

      return {
        text: choice.message.content.trim(),
        model,
        isMock: false,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      lastError = err;
      if (err.name === "AbortError") {
        throw new Error(`Groq API request timed out after ${timeoutMs}ms.`);
      }
      if (attempt < maxAttempts && !err.message?.includes("429")) {
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  }

  throw lastError || new Error("Groq API request failed after retries.");
}

/**
 * Builds schema guidance from a Zod schema to ensure Groq outputs matching properties.
 */
function buildSchemaGuidance(schema: z.ZodType<any>): string {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    const keys = Object.keys(shape);
    const hints: string[] = [`Output must be a JSON object with keys: ${keys.join(", ")}`];

    if (keys.includes("options")) {
      hints.push('Format for "options": [{"id": "A", "text": "..."}, {"id": "B", "text": "..."}, {"id": "C", "text": "..."}, {"id": "D", "text": "..."}]');
    }
    if (keys.includes("rubric")) {
      hints.push('Format for "rubric": [{"keypoint": "...", "weight": 0.5, "description": "..."}] (weights must sum to 1.0)');
    }
    if (keys.includes("topics")) {
      hints.push('Format for "topics": [{"title": "...", "unitModule": "...", "orderIndex": 1, ...}]');
    }
    if (keys.includes("rubric_evaluation")) {
      hints.push('Format for "rubric_evaluation": [{"keypoint": "...", "status": "met"|"partially_met"|"not_met", "rationale": "...", "marks_awarded": 1}]');
    }

    return hints.join("\n");
  }
  return "";
}

/**
 * Generates structured output validated against a Zod schema using Groq.
 */
export async function generateGroqStructured<T>(params: {
  prompt: string;
  schema: z.ZodType<T>;
  systemInstruction?: string;
  mockFallback?: () => T;
}): Promise<{ data: T; isMock: boolean; model: string }> {
  if (!isGroqLive()) {
    if (params.mockFallback) {
      return {
        data: params.mockFallback(),
        isMock: true,
        model: "offline-mock",
      };
    }
    throw new Error("GROQ_API_KEY is missing and no mockFallback was provided.");
  }

  const schemaGuidance = buildSchemaGuidance(params.schema);

  const system = [
    params.systemInstruction || "You are an expert AI learning intelligence assistant.",
    schemaGuidance,
    "CRITICAL: Output ONLY a single valid JSON object strictly matching these field names and formats. Do NOT wrap in markdown fences or add explanatory text outside the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: GroqMessage[] = [
    { role: "system", content: system },
    { role: "user", content: params.prompt },
  ];

  try {
    const result = await groqChatCompletion(messages, {
      responseFormatJson: true,
      temperature: 0.1,
    });

    let rawText = result.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
    }

    const parsedJson = JSON.parse(rawText);
    const validated = params.schema.parse(parsedJson);

    return {
      data: validated,
      isMock: false,
      model: result.model,
    };
  } catch (err) {
    if (params.mockFallback) {
      console.warn(
        `[Groq Structured Gen] Live call failed (${err instanceof Error ? err.message : String(err)}). Reverting to deterministic mock.`
      );
      return {
        data: params.mockFallback(),
        isMock: true,
        model: "offline-mock",
      };
    }
    throw err;
  }
}
