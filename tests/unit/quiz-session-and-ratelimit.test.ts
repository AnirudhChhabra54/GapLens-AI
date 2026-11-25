// ==============================================================================
// Unit Test: Stateless Encrypted Quiz Session Tokens & AI Rate Limiter
// ==============================================================================

import { describe, it, expect } from "vitest";
import { sealQuizSession, unsealQuizSession } from "@/lib/demo/demo-quiz-cache";
import { checkRateLimit } from "@/lib/rate-limit";
import type { QuizQuestionRow } from "@/types/database";

describe("Unit: Stateless Encrypted Quiz Session Tokens", () => {
  const sampleQuestions: QuizQuestionRow[] = [
    {
      id: "q-1",
      quiz_id: "quiz-123",
      topic_id: "topic-1",
      question_type: "mcq",
      difficulty: 2,
      question_text: "What is a TLB miss?",
      options: [
        { id: "A", text: "Cache lookup miss for page table entry" },
        { id: "B", text: "Disk seek failure" },
      ],
      answer_key: "A",
      explanation: "TLB caches page table translations.",
      rubric: null,
      source_chunk_id: "chunk-1",
      citation_document_name: "OS Notes.pdf",
      citation_page_start: 1,
      citation_page_end: 2,
      citation_section: "Virtual Memory",
      citation_quote: "A TLB miss occurs when the virtual page number is not in the TLB.",
      is_quote_verified: true,
      created_at: new Date().toISOString(),
    },
  ];

  it("seals and unseals quiz questions with answer keys intact", () => {
    const token = sealQuizSession("quiz-123", sampleQuestions);
    expect(token).toBeTruthy();
    expect(token).not.toContain("TLB caches page table translations");

    const restored = unsealQuizSession("quiz-123", token);
    expect(restored).toHaveLength(1);
    expect(restored![0].answer_key).toBe("A");
  });

  it("rejects tampered tokens or mismatched quiz IDs", () => {
    const token = sealQuizSession("quiz-123", sampleQuestions)!;
    expect(unsealQuizSession("quiz-999", token)).toBeNull();
    expect(unsealQuizSession("quiz-123", `${token}tampered`)).toBeNull();
    expect(unsealQuizSession("quiz-123", null)).toBeNull();
  });

  it("allows rate-limit bypass under Vitest environment", () => {
    const res = checkRateLimit("test-user", 1, 60_000);
    expect(res.allowed).toBe(true);
  });
});
