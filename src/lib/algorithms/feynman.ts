// ==============================================================================
// GapLens AI — Feynman "Teach-Back" Evidence-Diff Grader
// Audits a student's free-form explanation clause-by-clause against retrieved
// course passages: Verified Claims (Green), Omitted Mechanisms (Amber),
// and Silent Hallucinations / Contradictions (Red).
// ==============================================================================

import { z } from "zod";
import { generateStructured } from "@/lib/ai/provider";
import type { PinnedCitation } from "@/types/rag";

export const FeynmanAuditSchema = z.object({
  rigorScore: z.number().min(0).max(100),
  summaryFeedback: z.string(),
  verifiedClaims: z.array(
    z.object({
      claim: z.string(),
      sourceQuote: z.string(),
      documentName: z.string(),
      pageRange: z.string(),
    })
  ),
  omittedMechanisms: z.array(
    z.object({
      mechanism: z.string(),
      whyItMatters: z.string(),
    })
  ),
  contradictions: z.array(
    z.object({
      flawedStatement: z.string(),
      correction: z.string(),
      sourceQuote: z.string(),
    })
  ),
});

export type FeynmanAuditResult = z.infer<typeof FeynmanAuditSchema> & {
  topicTitle: string;
  citations: PinnedCitation[];
  isMock: boolean;
};

export async function evaluateFeynmanTeachBack(params: {
  topicTitle: string;
  studentExplanation: string;
  chunks: Array<{
    id?: string;
    document_id?: string;
    document_name?: string;
    page_start?: number;
    page_end?: number;
    section_heading?: string | null;
    content: string;
  }>;
}): Promise<FeynmanAuditResult> {
  const { topicTitle, studentExplanation, chunks } = params;
  const topChunks = chunks.slice(0, 4);

  const contextBlock = topChunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.document_name || "Course Material"} p.${c.page_start || 1}-${c.page_end || 1}]\n${c.content}`
    )
    .join("\n\n---\n\n");

  const systemInstruction = `You are a strict, evidence-grounded university Teaching Assistant performing a Feynman Teach-Back Evidence-Diff Audit.
Compare the student's explanation of "${topicTitle}" STRICTLY against the provided course excerpts.
Categorize into:
1. verifiedClaims: Accurate statements the student made, paired with a verbatim supporting quote from the excerpts.
2. omittedMechanisms: Key mechanisms, boundary conditions, or steps in the excerpts that the student forgot to mention.
3. contradictions: Any inaccurate or hallucinated claims in the student's explanation, with the exact correction and source quote.
Compute rigorScore (0-100) reflecting technical completeness and accuracy.`;

  const prompt = `Topic: ${topicTitle}

Student's Teach-Back Explanation:
"""
${studentExplanation}
"""

Authoritative Course Material Excerpts:
${contextBlock}`;

  const mockFallback = () => {
    const explanationLower = studentExplanation.toLowerCase();
    const sentences = studentExplanation
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    const refChunk = topChunks[0];
    const refContent = refChunk?.content || `Core mechanisms and definitions of ${topicTitle}.`;
    const refWords = refContent
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 5);
    const uniqueRefWords = Array.from(new Set(refWords)).slice(0, 8);

    const matchedKeywords = uniqueRefWords.filter((w) => explanationLower.includes(w));
    const missingKeywords = uniqueRefWords.filter((w) => !explanationLower.includes(w));

    const verifiedClaims = sentences.slice(0, 2).map((s) => ({
      claim: s,
      sourceQuote: refContent.slice(0, 140),
      documentName: refChunk?.document_name || "Course Material",
      pageRange: `p.${refChunk?.page_start || 1}-${refChunk?.page_end || 1}`,
    }));

    const omittedMechanisms = missingKeywords.slice(0, 3).map((kw) => ({
      mechanism: `Role of "${kw}" in ${topicTitle}`,
      whyItMatters: `Explicitly covered in ${refChunk?.section_heading || topicTitle} source material.`,
    }));

    const ratio = uniqueRefWords.length > 0 ? matchedKeywords.length / uniqueRefWords.length : 0.5;
    const rigorScore = Math.min(95, Math.max(25, Math.round(35 + ratio * 60)));

    return {
      rigorScore,
      summaryFeedback:
        omittedMechanisms.length > 0
          ? `Solid intuition on ${topicTitle}, but ${omittedMechanisms.length} core mechanism(s) from your course notes were omitted.`
          : `Strong, complete explanation aligned with your verified course excerpts.`,
      verifiedClaims,
      omittedMechanisms,
      contradictions: [],
    };
  };

  const result = await generateStructured({
    prompt,
    schema: FeynmanAuditSchema,
    systemInstruction,
    mockFallback,
  });

  const citations: PinnedCitation[] = topChunks.map((c) => ({
    chunkId: c.id || "chunk",
    documentId: c.document_id || "",
    documentName: c.document_name || "Course Material",
    docType: "material",
    pageStart: c.page_start || 1,
    pageEnd: c.page_end || 1,
    sectionHeading: c.section_heading || topicTitle,
    quote: c.content.slice(0, 220),
    isQuoteVerified: true,
  }));

  return {
    ...result.data,
    topicTitle,
    citations,
    isMock: result.isMock,
  };
}
