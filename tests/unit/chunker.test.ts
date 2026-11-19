// ==============================================================================
// GapLens AI — Unit Tests: Token-Aware Chunker
// ==============================================================================

import { describe, it, expect } from "vitest";
import { chunkExtractedPages, estimateTokens, extractHeading } from "@/lib/rag/chunker";
import type { ExtractedPage } from "@/types/rag";

describe("Unit: Token-Aware Chunker", () => {
  const samplePages: ExtractedPage[] = [
    {
      pageNumber: 1,
      text: [
        "# Chapter 1: Operating System Architectures",
        "An operating system acts as an intermediary between the computer user and computer hardware.",
        "The purpose of an operating system is to provide an environment in which a user can execute programs conveniently and efficiently.",
        "Operating systems can be explored from two viewpoints: the user and the system.",
        "Dual-mode operation allows OS to protect itself and other system components. User mode and kernel mode are distinguished by a hardware mode bit.",
      ].join("\n\n"),
      charCount: 460,
    },
    {
      pageNumber: 2,
      text: [
        "# Chapter 2: Process Synchronization",
        "A cooperating process is one that can affect or be affected by other processes executing in the system.",
        "The critical section problem is to design a protocol that the processes can use to cooperate.",
        "Each process must ask permission to enter its critical section. The section of code implementing this request is the entry section.",
        "The critical section may be followed by an exit section, and the remaining code is the remainder section.",
        "A solution to the critical section problem must satisfy: Mutual Exclusion, Progress, and Bounded Waiting.",
      ].join("\n\n"),
      charCount: 580,
    },
    {
      pageNumber: 3,
      text: [
        "## Semaphores and Mutex Locks",
        "Hardware-based solutions to the critical-section problem are complicated and generally inaccessible to application programmers.",
        "Instead, operating-system designers build software tools to solve the critical-section problem.",
        "The simplest of these tools is the mutex lock. In addition, semaphores provide more sophisticated ways to synchronize activities.",
        "A semaphore S is an integer variable that, apart from initialization, is accessed only through two standard atomic operations: wait() and signal().",
      ].join("\n\n"),
      charCount: 560,
    },
  ];

  it("should estimate token counts conservatively based on character and word ratios", () => {
    const text = "Operating Systems Concept: Virtual Memory and Paging Mechanism";
    const tokens = estimateTokens(text);
    expect(tokens).toBeGreaterThan(10);
    expect(tokens).toBeLessThan(30);
  });

  it("should chunk pages into continuous 1-based chunk indices", () => {
    const chunks = chunkExtractedPages(samplePages, {
      minTokens: 80,
      maxTokens: 150,
      overlapTokens: 25,
    });

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx + 1);
    });
  });

  it("should preserve detected section headings in chunk metadata", () => {
    const chunks = chunkExtractedPages(samplePages, {
      minTokens: 80,
      maxTokens: 150,
      overlapTokens: 25,
    });

    const headings = chunks.map((c) => c.sectionHeading).filter(Boolean);
    expect(headings.length).toBeGreaterThan(0);
    expect(headings.some((h) => h?.includes("Operating System Architectures"))).toBe(true);
    expect(headings.some((h) => h?.includes("Process Synchronization") || h?.includes("Semaphores"))).toBe(true);
  });

  it("should track monotonic page spans (pageStart <= pageEnd)", () => {
    const chunks = chunkExtractedPages(samplePages, {
      minTokens: 80,
      maxTokens: 150,
      overlapTokens: 25,
    });

    for (const chunk of chunks) {
      expect(chunk.pageStart).toBeGreaterThanOrEqual(1);
      expect(chunk.pageEnd).toBeGreaterThanOrEqual(chunk.pageStart);
      expect(chunk.pageEnd).toBeLessThanOrEqual(3);
    }
  });

  it("should maintain overlap between adjacent chunks to prevent boundary context loss", () => {
    const chunks = chunkExtractedPages(samplePages, {
      minTokens: 50,
      maxTokens: 100,
      overlapTokens: 30,
    });

    if (chunks.length >= 2) {
      // Adjacent chunks should share semantic context or tokens
      const chunk1Words = chunks[0].content.toLowerCase().split(/\s+/);
      const chunk2Words = chunks[1].content.toLowerCase().split(/\s+/);
      const sharedWords = chunk1Words.filter((w) => w.length > 4 && chunk2Words.includes(w));
      expect(sharedWords.length).toBeGreaterThan(0);
    }
  });

  it("should return empty array when given empty page list", () => {
    const emptyResult = chunkExtractedPages([]);
    expect(emptyResult).toEqual([]);
  });

  // ============================================================================
  // Iteration 2: Adversarial Defect Fixes & Edge-Case Regression Tests
  // ============================================================================

  it("should accurately distinguish headings from body sentences and list items", () => {
    // Valid headings
    expect(extractHeading("# Chapter 1: Architectures")).toBe("Chapter 1: Architectures");
    expect(extractHeading("## Process Synchronization")).toBe("Process Synchronization");
    expect(extractHeading("### CPU Scheduling")).toBe("CPU Scheduling");
    expect(extractHeading("Chapter 1: Operating System Architectures")).toBe("Chapter 1: Operating System Architectures");
    expect(extractHeading("Section 2: Memory Management")).toBe("Section 2: Memory Management");
    expect(extractHeading("Module 3 - Concurrency")).toBe("Module 3 - Concurrency");
    expect(extractHeading("1.1 CPU Scheduling")).toBe("1.1 CPU Scheduling");
    expect(extractHeading("SYSTEM ARCHITECTURE")).toBe("SYSTEM ARCHITECTURE");

    // Body sentences / list items ending with terminal punctuation must NOT be headings
    expect(extractHeading("1. FCFS is the simplest scheduling algorithm.")).toBeNull();
    expect(extractHeading("2. SJF selects the process with the shortest burst.")).toBeNull();
    expect(extractHeading("Section 1: Operating systems manage computer hardware.")).toBeNull();
    expect(extractHeading("Chapter 1 discusses the fundamental components of modern computing systems.")).toBeNull();

    // Sentences exceeding 80 chars must NOT be headings
    expect(
      extractHeading("Section 1: An operating system acts as an intermediary between the user of a computer and the computer hardware.")
    ).toBeNull();
  });

  it("should preserve 100% of numbered lists without data loss (0 dropped items)", () => {
    const numberedListPages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: [
          "1. FCFS (First-Come, First-Served) is the simplest scheduling algorithm.",
          "2. SJF (Shortest Job First) selects the process with the shortest CPU burst.",
          "3. Round Robin allocates a fixed time quantum to each running process in circular order.",
          "4. Priority scheduling selects the process with the highest priority.",
          "5. Multilevel queue scheduling partitions the ready queue into several separate queues.",
        ].join("\n\n"),
        charCount: 400,
      },
    ];

    const chunks = chunkExtractedPages(numberedListPages, {
      minTokens: 50,
      maxTokens: 300,
      overlapTokens: 20,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const fullContent = chunks.map((c) => c.content).join("\n\n");
    expect(fullContent).toContain("FCFS (First-Come, First-Served)");
    expect(fullContent).toContain("SJF (Shortest Job First)");
    expect(fullContent).toContain("Round Robin allocates");
    expect(fullContent).toContain("Priority scheduling selects");
    expect(fullContent).toContain("Multilevel queue scheduling partitions");
  });

  it("should preserve section paragraphs without dropping any sections", () => {
    const sectionPages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: [
          "Section 1: Operating systems manage computer hardware.",
          "Section 2: The kernel is the core of the operating system.",
          "Section 3: System calls provide an interface between running programs and the OS.",
        ].join("\n\n"),
        charCount: 200,
      },
    ];

    const chunks = chunkExtractedPages(sectionPages, {
      minTokens: 30,
      maxTokens: 200,
      overlapTokens: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);

    const fullContent = chunks.map((c) => c.content).join("\n\n");
    expect(fullContent).toContain("Section 1: Operating systems manage computer hardware.");
    expect(fullContent).toContain("Section 2: The kernel is the core of the operating system.");
    expect(fullContent).toContain("Section 3: System calls provide an interface between running programs and the OS.");
  });

  it("should preserve standalone markdown headings in chunks without dropping outlines", () => {
    const outlinePages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: [
          "# Chapter 1: Operating Systems",
          "## Unit 2: Process Management",
          "### Section 2.1: CPU Scheduling",
        ].join("\n\n"),
        charCount: 100,
      },
    ];

    const chunks = chunkExtractedPages(outlinePages, {
      minTokens: 10,
      maxTokens: 100,
      overlapTokens: 10,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const fullContent = chunks.map((c) => c.content).join("\n\n");
    expect(fullContent).toContain("# Chapter 1: Operating Systems");
    expect(fullContent).toContain("## Unit 2: Process Management");
    expect(fullContent).toContain("### Section 2.1: CPU Scheduling");
    expect(chunks[0].sectionHeading).toBe("Chapter 1: Operating Systems");
  });

  it("should strictly observe maxTokens ceiling on unpunctuated text", () => {
    // Generate 4,000 unpunctuated words (approximately 5,200 tokens)
    const words: string[] = [];
    for (let i = 0; i < 4000; i++) {
      words.push(`concept${i}`);
    }
    const unpunctuatedText = words.join(" ");

    const pages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: unpunctuatedText,
        charCount: unpunctuatedText.length,
      },
    ];

    const MAX_TOKENS = 600;
    const chunks = chunkExtractedPages(pages, {
      minTokens: 300,
      maxTokens: MAX_TOKENS,
      overlapTokens: 80,
    });

    expect(chunks.length).toBeGreaterThan(1);

    // Verify EVERY chunk strictly respects the maxTokens ceiling
    for (const chunk of chunks) {
      const estimated = estimateTokens(chunk.content);
      expect(estimated).toBeLessThanOrEqual(MAX_TOKENS);
      expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_TOKENS);
      expect(chunk.chunkIndex).toBeGreaterThan(0);
    }

    // Verify sequential chunk numbering
    chunks.forEach((chunk, idx) => {
      expect(chunk.chunkIndex).toBe(idx + 1);
    });

    // Verify first and last words are accounted for (no truncation at edges)
    expect(chunks[0].content).toContain("concept0");
    expect(chunks[chunks.length - 1].content).toContain("concept3999");
  });

  it("should handle mixed outline, list items, and narrative content with correct headings", () => {
    const mixedPages: ExtractedPage[] = [
      {
        pageNumber: 1,
        text: [
          "# Chapter 3: Deadlocks",
          "A deadlock occurs when processes are unable to proceed because each is waiting for all the others to do something.",
          "## Deadlock Characterization",
          "Four conditions must hold simultaneously for a deadlock to arise:",
          "1. Mutual exclusion: at least one resource must be held in a non-shareable mode.",
          "2. Hold and wait: a process must be holding at least one resource and waiting to acquire additional resources.",
          "3. No preemption: resources cannot be preempted.",
          "4. Circular wait: a closed chain of processes exists such that each process holds at least one resource needed by the next.",
        ].join("\n\n"),
        charCount: 650,
      },
    ];

    const chunks = chunkExtractedPages(mixedPages, {
      minTokens: 50,
      maxTokens: 200,
      overlapTokens: 25,
    });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    const fullContent = chunks.map((c) => c.content).join("\n\n");
    expect(fullContent).toContain("Mutual exclusion");
    expect(fullContent).toContain("Hold and wait");
    expect(fullContent).toContain("No preemption");
    expect(fullContent).toContain("Circular wait");

    const headings = chunks.map((c) => c.sectionHeading).filter(Boolean);
    expect(headings.some((h) => h?.includes("Deadlocks") || h?.includes("Deadlock Characterization"))).toBe(true);
  });
});
