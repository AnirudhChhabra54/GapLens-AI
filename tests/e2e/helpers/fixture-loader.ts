// ==============================================================================
// GapLens AI — E2E Fixture Loader
// Comprehensive OS CS-301 fixture providing 10 topics, prerequisites,
// 20 realistic chunks with 768d embeddings, 15 diagnostic questions,
// historical attempts, weak topics (Virtual Memory), and blind spots (Synchronization).
// ==============================================================================

import type {
  ProfileRow,
  WorkspaceRow,
  DocumentRow,
  DocumentChunkRow,
  TopicRow,
  TopicPrerequisiteRow,
  PaperQuestionRow,
  QuizRow,
  QuizQuestionRow,
  AnswerRow,
  MasterySnapshotRow,
  RevisionPlanRow,
  RevisionTaskRow,
} from "@/types/database";
import type { GapReportData, TopicMastery } from "@/types/assessment";
import type { RevisionPlanOverview } from "@/types/planner";
import { DEMO_REVISION_SCHEDULE } from "@/lib/demo/os-cs301-fixture";

// Deterministic 768d unit-normalized mock embedding generator with semantic token projection
export function generateDeterministic768dEmbedding(text: string): number[] {
  const vec: number[] = new Array(768).fill(0.01);
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
      const idx = Math.abs((h + j * 79) % 768);
      vec[idx] += 1.0;
    }
  }

  // Base deterministic pseudorandom variation
  let baseHash = 0;
  for (let i = 0; i < text.length; i++) {
    baseHash = (baseHash << 5) - baseHash + text.charCodeAt(i);
    baseHash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    vec[i] += Math.sin((baseHash + i * 1337) * 0.001) * 0.05;
  }

  // Normalize to L2 unit length
  let sumSq = 0;
  for (let i = 0; i < 768; i++) {
    sumSq += vec[i] * vec[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  return vec.map((v) => Number((v / norm).toFixed(6)));
}

export const E2E_PROFILE: ProfileRow = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "demo@gapfinder.ai",
  full_name: "Alex Chen (Demo Student)",
  created_at: "2026-11-04T12:00:00.000Z",
  updated_at: "2026-11-18T12:00:00.000Z",
};

export const E2E_WORKSPACE: WorkspaceRow = {
  id: "10000000-0000-0000-0000-000000000001",
  user_id: E2E_PROFILE.id,
  title: "Operating Systems (CS-301)",
  description: "Core Systems Curriculum: Virtual Memory, Synchronization, Scheduling, Storage",
  exam_date: "2026-12-02",
  daily_study_minutes: 60,
  created_at: "2026-11-04T12:00:00.000Z",
  updated_at: "2026-11-18T12:00:00.000Z",
};

export const E2E_DOCUMENTS: DocumentRow[] = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    filename: "CS301_Operating_Systems_Syllabus.pdf",
    storage_path: `${E2E_PROFILE.id}/${E2E_WORKSPACE.id}/CS301_Operating_Systems_Syllabus.pdf`,
    file_type: "application/pdf",
    declared_size_bytes: 420000,
    doc_type: "syllabus",
    status: "indexed",
    page_count: 5,
    extracted_char_count: 14200,
    chunk_count: 4,
    current_checkpoint: { step: "complete" },
    error_message: null,
    parser_version: "unpdf-v2.2",
    index_version: 1,
    created_at: "2026-11-04T12:00:00.000Z",
    updated_at: "2026-11-04T12:05:00.000Z",
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    filename: "Operating_System_Concepts_Silberschatz_Selected_Chapters.pdf",
    storage_path: `${E2E_PROFILE.id}/${E2E_WORKSPACE.id}/Silberschatz_OS.pdf`,
    file_type: "application/pdf",
    declared_size_bytes: 3840000,
    doc_type: "material",
    status: "indexed",
    page_count: 45,
    extracted_char_count: 125000,
    chunk_count: 16,
    current_checkpoint: { step: "complete" },
    error_message: null,
    parser_version: "unpdf-v2.2",
    index_version: 1,
    created_at: "2026-11-04T12:06:00.000Z",
    updated_at: "2026-11-04T12:12:00.000Z",
  },
];

// 10 OS Topics with hierarchical structure
export const E2E_TOPICS: TopicRow[] = [
  {
    id: "40000000-0000-0000-0000-000000000001",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Operating System Architecture & Dual-Mode Operation",
    unit_module: "Unit 1: Kernel & Hardware Protection",
    order_index: 1,
    learning_objectives: ["User vs Kernel Mode", "System Calls", "Interrupt Vector Table"],
    source_chunk_id: "30000000-0000-0000-0000-000000000001",
    extraction_confidence: 0.96,
    exam_frequency: 3,
    exam_total_marks: 15,
    exam_weight: 0.08,
    current_mastery: 85.0,
    classification: "strong",
    evidence_level: "strong_evidence",
    total_attempts: 4,
    correct_attempts: 4,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000002",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Process Management & Context Switching",
    unit_module: "Unit 2: Processes & Threads",
    order_index: 2,
    learning_objectives: ["PCB Lifecycle", "Context Switch Overhead", "fork() and exec()"],
    source_chunk_id: "30000000-0000-0000-0000-000000000002",
    extraction_confidence: 0.95,
    exam_frequency: 4,
    exam_total_marks: 20,
    exam_weight: 0.10,
    current_mastery: 78.0,
    classification: "medium",
    evidence_level: "strong_evidence",
    total_attempts: 4,
    correct_attempts: 3,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000003",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Threads & Multithreaded Models",
    unit_module: "Unit 2: Processes & Threads",
    order_index: 3,
    learning_objectives: ["User vs Kernel Threads", "Many-to-One vs One-to-One", "Thread Safety"],
    source_chunk_id: "30000000-0000-0000-0000-000000000003",
    extraction_confidence: 0.93,
    exam_frequency: 2,
    exam_total_marks: 10,
    exam_weight: 0.06,
    current_mastery: 75.0,
    classification: "medium",
    evidence_level: "developing_evidence",
    total_attempts: 3,
    correct_attempts: 2,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000004",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "CPU Scheduling Algorithms (FCFS, SJF, RR, MLFQ)",
    unit_module: "Unit 3: Scheduling",
    order_index: 4,
    learning_objectives: ["Gantt Charts", "Turnaround & Waiting Time", "Convoy Effect", "Starvation"],
    source_chunk_id: "30000000-0000-0000-0000-000000000004",
    extraction_confidence: 0.98,
    exam_frequency: 5,
    exam_total_marks: 25,
    exam_weight: 0.12,
    current_mastery: 84.0,
    classification: "strong",
    evidence_level: "strong_evidence",
    total_attempts: 5,
    correct_attempts: 4,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    // BLIND SPOT TOPIC: Process Synchronization
    id: "40000000-0000-0000-0000-000000000005",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Process Synchronization & Critical Section Problem",
    unit_module: "Unit 4: Concurrency & Synchronization",
    order_index: 5,
    learning_objectives: ["Mutual Exclusion", "Peterson Algorithm", "Semaphores & Mutexes", "Monitors"],
    source_chunk_id: "30000000-0000-0000-0000-000000000005",
    extraction_confidence: 0.97,
    exam_frequency: 5,
    exam_total_marks: 28,
    exam_weight: 0.16,
    current_mastery: 35.0,
    classification: "weak",
    evidence_level: "strong_evidence",
    total_attempts: 4,
    correct_attempts: 1,
    blind_spot_count: 1, // HIGH-CONFIDENCE BLIND SPOT
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000006",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Deadlocks & Banker's Algorithm",
    unit_module: "Unit 4: Concurrency & Synchronization",
    order_index: 6,
    learning_objectives: ["Coffman Conditions", "Resource Allocation Graph", "Banker's Safety Algorithm"],
    source_chunk_id: "30000000-0000-0000-0000-000000000006",
    extraction_confidence: 0.96,
    exam_frequency: 4,
    exam_total_marks: 20,
    exam_weight: 0.10,
    current_mastery: 90.0,
    classification: "strong",
    evidence_level: "strong_evidence",
    total_attempts: 4,
    correct_attempts: 4,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000007",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Main Memory & Basic Paging",
    unit_module: "Unit 5: Memory Management",
    order_index: 7,
    learning_objectives: ["Contiguous Allocation", "Logical vs Physical Address", "Page Tables"],
    source_chunk_id: "30000000-0000-0000-0000-000000000007",
    extraction_confidence: 0.94,
    exam_frequency: 3,
    exam_total_marks: 15,
    exam_weight: 0.08,
    current_mastery: 65.0,
    classification: "medium",
    evidence_level: "developing_evidence",
    total_attempts: 3,
    correct_attempts: 2,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    // WEAK TOPIC: Virtual Memory
    id: "40000000-0000-0000-0000-000000000008",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Virtual Memory, Page Faults & TLB",
    unit_module: "Unit 5: Memory Management",
    order_index: 8,
    learning_objectives: ["Demand Paging", "Page Fault Handling", "TLB Miss & EAT Calculation", "Thrashing"],
    source_chunk_id: "30000000-0000-0000-0000-000000000008",
    extraction_confidence: 0.99,
    exam_frequency: 6,
    exam_total_marks: 32,
    exam_weight: 0.18,
    current_mastery: 38.0,
    classification: "weak",
    evidence_level: "strong_evidence",
    total_attempts: 5,
    correct_attempts: 1,
    blind_spot_count: 1,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000009",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "File System Structure & Inodes",
    unit_module: "Unit 6: Storage & I/O",
    order_index: 9,
    learning_objectives: ["Directory Organization", "Inode Structure", "File Allocation Tables", "Journaling"],
    source_chunk_id: "30000000-0000-0000-0000-000000000009",
    extraction_confidence: 0.92,
    exam_frequency: 3,
    exam_total_marks: 14,
    exam_weight: 0.07,
    current_mastery: 72.0,
    classification: "medium",
    evidence_level: "developing_evidence",
    total_attempts: 3,
    correct_attempts: 2,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
  {
    id: "40000000-0000-0000-0000-000000000010",
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    parent_id: null,
    title: "Mass-Storage Structure, Disk Scheduling & RAID",
    unit_module: "Unit 6: Storage & I/O",
    order_index: 10,
    learning_objectives: ["HDD vs SSD", "SCAN and C-SCAN Scheduling", "RAID Levels 0, 1, 5, 6"],
    source_chunk_id: "30000000-0000-0000-0000-000000000010",
    extraction_confidence: 0.91,
    exam_frequency: 2,
    exam_total_marks: 10,
    exam_weight: 0.05,
    current_mastery: 80.0,
    classification: "strong",
    evidence_level: "early_signal",
    total_attempts: 2,
    correct_attempts: 2,
    blind_spot_count: 0,
    created_at: "2026-11-04T12:15:00.000Z",
    updated_at: "2026-11-18T12:00:00.000Z",
  },
];

// Prerequisites
export const E2E_PREREQUISITES: TopicPrerequisiteRow[] = [
  {
    id: "50000000-0000-0000-0000-000000000001",
    workspace_id: E2E_WORKSPACE.id,
    topic_id: "40000000-0000-0000-0000-000000000002", // Process Management
    prerequisite_topic_id: "40000000-0000-0000-0000-000000000001", // Kernel Intro
    is_inferred: false,
    confidence: 0.95,
    source_rationale: "Understanding kernel mode is required to understand system call dispatch in PCB",
    created_at: "2026-11-04T12:20:00.000Z",
  },
  {
    id: "50000000-0000-0000-0000-000000000002",
    workspace_id: E2E_WORKSPACE.id,
    topic_id: "40000000-0000-0000-0000-000000000003", // Threads
    prerequisite_topic_id: "40000000-0000-0000-0000-000000000002", // Processes
    is_inferred: false,
    confidence: 0.98,
    source_rationale: "Thread control blocks exist within address space of process",
    created_at: "2026-11-04T12:20:00.000Z",
  },
  {
    id: "50000000-0000-0000-0000-000000000003",
    workspace_id: E2E_WORKSPACE.id,
    topic_id: "40000000-0000-0000-0000-000000000005", // Synchronization
    prerequisite_topic_id: "40000000-0000-0000-0000-000000000003", // Threads
    is_inferred: false,
    confidence: 0.99,
    source_rationale: "Critical section race conditions arise from concurrent threads accessing shared memory",
    created_at: "2026-11-04T12:20:00.000Z",
  },
  {
    id: "50000000-0000-0000-0000-000000000004",
    workspace_id: E2E_WORKSPACE.id,
    topic_id: "40000000-0000-0000-0000-000000000006", // Deadlocks
    prerequisite_topic_id: "40000000-0000-0000-0000-000000000005", // Synchronization
    is_inferred: false,
    confidence: 0.97,
    source_rationale: "Deadlocks occur from hold-and-wait circular wait on mutual exclusion locks",
    created_at: "2026-11-04T12:20:00.000Z",
  },
  {
    id: "50000000-0000-0000-0000-000000000005",
    workspace_id: E2E_WORKSPACE.id,
    topic_id: "40000000-0000-0000-0000-000000000008", // Virtual Memory
    prerequisite_topic_id: "40000000-0000-0000-0000-000000000007", // Main Memory Paging
    is_inferred: false,
    confidence: 0.99,
    source_rationale: "Demand paging extends basic hardware paging with swap and page fault interrupts",
    created_at: "2026-11-04T12:20:00.000Z",
  },
];

// 20 realistic chunks with exact page numbers, section headings, and 768d embeddings
export const E2E_CHUNKS: DocumentChunkRow[] = Array.from({ length: 20 }, (_, idx) => {
  const chunkIndex = idx + 1;
  const pageStart = Math.floor(idx * 2.2) + 1;
  const pageEnd = pageStart + 1;
  const topicIdx = Math.floor(idx / 2);
  const topic = E2E_TOPICS[topicIdx] || E2E_TOPICS[0];

  const contentMap: Record<number, string> = {
    1: "Operating System Architecture: Dual-mode operation provides basic hardware protection. The CPU mode bit is set to 0 for kernel mode and 1 for user mode. Privileged instructions can only execute in kernel mode.",
    2: "System Calls and Hardware Interrupts: System calls trigger software interrupts (traps). The CPU saves registers, elevates privilege to supervisor mode, and jumps to the interrupt service routine in the kernel.",
    3: "Process Control Block (PCB): The PCB contains process state (new, ready, running, waiting, terminated), program counter, CPU registers, CPU scheduling info, memory-management info, and accounting info.",
    4: "Context Switching: A context switch saves the state of the currently executing process in its PCB and restores the state of the newly scheduled process. Switching involves pure computational overhead.",
    5: "Threads and Concurrency: A thread comprises a thread ID, program counter, register set, and stack. It shares code, data, and open files with other threads in the same process.",
    6: "Multithreading Models: Many-to-One model maps many user threads to one kernel thread. One-to-One maps each user thread to a kernel thread, enabling true parallelism on multicore processors.",
    7: "CPU Scheduling: CPU-I/O burst cycle alternates CPU execution and I/O wait. Preemptive scheduling can interrupt running processes. Non-preemptive scheduling allows a process to run until termination or yield.",
    8: "Scheduling Algorithms: Round Robin (RR) allocates a time quantum (10-100ms). Shortest Job First (SJF) is provably optimal for minimizing average waiting time but requires predicting future CPU burst durations.",
    9: "Process Synchronization: A race condition occurs when multiple processes access and manipulate the same data concurrently. The Critical Section must guarantee Mutual Exclusion, Progress, and Bounded Waiting.",
    10: "Peterson's Algorithm and Modern Hardware: Peterson's algorithm solves critical sections for two processes. However, modern out-of-order processors can reorder independent memory loads and stores, breaking correctness without explicit memory barriers.",
    11: "Semaphores and Mutexes: A mutex lock provides boolean mutual exclusion (acquire/release). A counting semaphore S is an integer variable accessed only via wait() (P) and signal() (V) atomic operations.",
    12: "Deadlock Coffman Conditions: Deadlock requires four simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Banker's Algorithm ensures the system remains in a safe state.",
    13: "Main Memory and Contiguous Allocation: Base and limit registers protect process memory spaces. Dynamic storage-allocation strategies include First-Fit, Best-Fit, and Worst-Fit.",
    14: "Paging Hardware: Paging divides logical memory into fixed pages and physical memory into frames. The Memory Management Unit (MMU) translates logical addresses (page number p, offset d) into physical frames.",
    15: "Virtual Memory and Demand Paging: Virtual memory separates user logical memory from physical memory. With demand paging, pages are brought into memory only when referenced. Invalid bit access triggers page fault (trap).",
    16: "Translation Lookaside Buffer (TLB): The TLB is an associative high-speed hardware cache. If the page is in TLB (hit), physical address is produced in 1 clock cycle. On TLB miss, page table walk takes multiple DRAM access cycles.",
    17: "Effective Memory Access Time (EMAT): EMAT = hit_rate * (tlb_lookup + mem_access) + (1 - hit_rate) * (tlb_lookup + 2 * mem_access). Page replacement occurs when no free frame exists.",
    18: "Page Replacement Algorithms: FIFO suffers from Belady's Anomaly where allocating more frames increases page faults. Least Recently Used (LRU) algorithm replaces the page that has not been used for the longest time.",
    19: "File Systems and Inodes: An inode stores metadata (file size, permissions, owner, timestamps) and direct, indirect, double-indirect pointers to disk data blocks. Directory maps filenames to inode numbers.",
    20: "Disk Scheduling: Disk bandwidth is measured by bytes transferred per second. SCAN (elevator algorithm) moves arm across cylinders servicing requests. RAID 5 stripes data and parity across disks to tolerate single disk failures.",
  };

  const content = contentMap[chunkIndex] || `Operating Systems Principles Chunk ${chunkIndex} covering topics in systems architecture and systems software.`;
  const embedding = generateDeterministic768dEmbedding(content);

  return {
    id: `30000000-0000-0000-0000-${String(chunkIndex).padStart(12, "0")}`,
    document_id: E2E_DOCUMENTS[1].id,
    workspace_id: E2E_WORKSPACE.id,
    user_id: E2E_PROFILE.id,
    chunk_index: chunkIndex,
    index_version: 1,
    page_start: pageStart,
    page_end: pageEnd,
    section_heading: topic.title,
    content,
    embedding,
    embedding_model: "gemini-embedding-001",
    embedding_dimensions: 768,
    fts: content.toLowerCase(),
    created_at: "2026-11-04T12:10:00.000Z",
  };
});

// 15 Diagnostic Questions (10 MCQs + 5 Rubric Short-Answers)
export const E2E_QUESTIONS: QuizQuestionRow[] = [
  // 1. Architecture MCQ
  {
    id: "60000000-0000-0000-0000-000000000001",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000001",
    question_type: "mcq",
    difficulty: 1,
    question_text: "What hardware mechanism ensures that user-level processes cannot execute privileged I/O instructions?",
    options: [
      { id: "A", text: "Dual-mode CPU operation (user mode vs kernel mode bit)" },
      { id: "B", text: "Compiler syntax verification" },
      { id: "C", text: "Virtual memory TLB flush" },
      { id: "D", text: "Round Robin scheduler time quantum" },
    ],
    answer_key: "A",
    explanation: "Dual-mode operation sets CPU mode bit to 0 for kernel and 1 for user; privileged instructions trap if executed in user mode.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[0].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 1,
    citation_page_end: 2,
    citation_section: "Dual-Mode Operation",
    citation_quote: "The CPU mode bit is set to 0 for kernel mode and 1 for user mode. Privileged instructions can only execute in kernel mode.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 2. Process Lifecycle MCQ
  {
    id: "60000000-0000-0000-0000-000000000002",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000002",
    question_type: "mcq",
    difficulty: 2,
    question_text: "Which process state transition occurs when a process in the Running state executes an I/O read system call?",
    options: [
      { id: "A", text: "Running -> Ready" },
      { id: "B", text: "Running -> Waiting (Blocked)" },
      { id: "C", text: "Running -> Terminated" },
      { id: "D", text: "Waiting -> Running" },
    ],
    answer_key: "B",
    explanation: "When a process initiates an I/O request, it yields the CPU and moves from Running to Waiting until the I/O event completes.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[2].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 3,
    citation_page_end: 4,
    citation_section: "Process Management",
    citation_quote: "The PCB contains process state (new, ready, running, waiting, terminated)",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 3. Threads MCQ
  {
    id: "60000000-0000-0000-0000-000000000003",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000003",
    question_type: "mcq",
    difficulty: 2,
    question_text: "Which of the following resources is NOT shared between peer threads of the same multithreaded process?",
    options: [
      { id: "A", text: "Open file descriptors" },
      { id: "B", text: "Global heap variables" },
      { id: "C", text: "Register set and stack" },
      { id: "D", text: "Code segment" },
    ],
    answer_key: "C",
    explanation: "Each thread possesses its own private program counter, register state, and runtime stack to track local function invocations.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[4].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 5,
    citation_page_end: 6,
    citation_section: "Threads and Concurrency",
    citation_quote: "A thread comprises a thread ID, program counter, register set, and stack. It shares code, data, and open files",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 4. Scheduling MCQ
  {
    id: "60000000-0000-0000-0000-000000000004",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000004",
    question_type: "mcq",
    difficulty: 2,
    question_text: "What anomaly occurs in FCFS CPU scheduling when long CPU-bound processes cause short I/O-bound processes to wait indefinitely?",
    options: [
      { id: "A", text: "Belady's Anomaly" },
      { id: "B", text: "Convoy Effect" },
      { id: "C", text: "Priority Inversion" },
      { id: "D", text: "Thrashing" },
    ],
    answer_key: "B",
    explanation: "The convoy effect results in lower CPU and device utilization as processes wait for a large CPU-heavy process to release the processor.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[6].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 7,
    citation_page_end: 8,
    citation_section: "CPU Scheduling",
    citation_quote: "Convoy Effect occurs when all other processes wait for the one big process to get off the CPU.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 5. Synchronization MCQ (Blind Spot Target)
  {
    id: "60000000-0000-0000-0000-000000000005",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000005",
    question_type: "mcq",
    difficulty: 3,
    question_text: "Why can Peterson's algorithm fail to provide mutual exclusion on modern multicore x86/ARM processors without memory fences?",
    options: [
      { id: "A", text: "Modern CPUs support more than two concurrent processes" },
      { id: "B", text: "Out-of-order processors and memory subsystems may reorder stores and loads to flag and turn variables" },
      { id: "C", text: "Peterson's algorithm relies on kernel supervisor calls" },
      { id: "D", text: "TLB page faults corrupt the turn integer" },
    ],
    answer_key: "B",
    explanation: "Hardware memory reordering can allow entry protocols to read flags before earlier writes become visible across processor caches.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[9].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 11,
    citation_page_end: 12,
    citation_section: "Peterson's Algorithm",
    citation_quote: "modern out-of-order processors can reorder independent memory loads and stores, breaking correctness without explicit memory barriers.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 6. Deadlocks MCQ
  {
    id: "60000000-0000-0000-0000-000000000006",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000006",
    question_type: "mcq",
    difficulty: 2,
    question_text: "In Banker's Algorithm, what property defines a state as 'safe'?",
    options: [
      { id: "A", text: "All processes have completed execution" },
      { id: "B", text: "No process is currently requesting any resource" },
      { id: "C", text: "There exists an execution sequence <P1, P2, ... Pn> such that each process can satisfy its maximum claims using currently available resources plus resources held by previous processes" },
      { id: "D", text: "Available resources exceed total allocated resources" },
    ],
    answer_key: "C",
    explanation: "A safe sequence guarantees that no deadlock will occur regardless of how remaining resource claims are exercised.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[11].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 13,
    citation_page_end: 14,
    citation_section: "Deadlock Avoidance",
    citation_quote: "Banker's Algorithm ensures the system remains in a safe state.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 7. Memory Paging MCQ
  {
    id: "60000000-0000-0000-0000-000000000007",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000007",
    question_type: "mcq",
    difficulty: 2,
    question_text: "Given a 32-bit logical address space and 4 KB (2^12 bytes) page size, how many entries are in a single-level page table?",
    options: [
      { id: "A", text: "1,048,576 (2^20 entries)" },
      { id: "B", text: "4,096 (2^12 entries)" },
      { id: "C", text: "65,536 (2^16 entries)" },
      { id: "D", text: "256 entries" },
    ],
    answer_key: "A",
    explanation: "32 bits total minus 12 bits page offset leaves 20 bits for page number: 2^20 = 1,048,576 page entries.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[13].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 15,
    citation_page_end: 16,
    citation_section: "Paging Hardware",
    citation_quote: "The Memory Management Unit (MMU) translates logical addresses (page number p, offset d) into physical frames.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 8. Virtual Memory Page Fault MCQ (Weak Topic Target)
  {
    id: "60000000-0000-0000-0000-000000000008",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000008",
    question_type: "mcq",
    difficulty: 3,
    question_text: "What exact hardware sequence is initiated when an instruction references a virtual page marked invalid in the page table?",
    options: [
      { id: "A", text: "CPU halts execution immediately" },
      { id: "B", text: "MMU raises a page-fault trap, saving CPU registers and jumping to kernel Interrupt 14 service routine" },
      { id: "C", text: "TLB automatically retrieves the missing page from disk" },
      { id: "D", text: "OS kills the process with SIGKILL" },
    ],
    answer_key: "B",
    explanation: "Hardware raises a page fault trap to OS kernel; the kernel validates the address, finds a free frame, reads from swap disk, and restarts the instruction.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[14].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 17,
    citation_page_end: 18,
    citation_section: "Virtual Memory & Demand Paging",
    citation_quote: "With demand paging, pages are brought into memory only when referenced. Invalid bit access triggers page fault (trap).",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 9. File Systems MCQ
  {
    id: "60000000-0000-0000-0000-000000000009",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000009",
    question_type: "mcq",
    difficulty: 2,
    question_text: "In a Unix-style inode, where is the filename of a file stored?",
    options: [
      { id: "A", text: "Inside the inode metadata structure itself" },
      { id: "B", text: "In the directory entry that points to the inode number" },
      { id: "C", text: "In the master boot record" },
      { id: "D", text: "At offset 0 of the first data block" },
    ],
    answer_key: "B",
    explanation: "An inode contains only metadata and block pointers; file names are stored exclusively in directory data blocks mapping names to inode numbers.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[18].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 23,
    citation_page_end: 24,
    citation_section: "File Systems and Inodes",
    citation_quote: "Directory maps filenames to inode numbers.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 10. Storage & RAID MCQ
  {
    id: "60000000-0000-0000-0000-000000000010",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000010",
    question_type: "mcq",
    difficulty: 2,
    question_text: "Which RAID configuration uses block-level striping with distributed parity across at least 3 disks to tolerate single-disk failure?",
    options: [
      { id: "A", text: "RAID 0" },
      { id: "B", text: "RAID 1" },
      { id: "C", text: "RAID 5" },
      { id: "D", text: "RAID 10" },
    ],
    answer_key: "C",
    explanation: "RAID 5 distributes parity across all member disks, avoiding a single parity bottleneck while tolerating any 1 drive failure.",
    rubric: null,
    source_chunk_id: E2E_CHUNKS[19].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 25,
    citation_page_end: 26,
    citation_section: "Disk Scheduling & RAID",
    citation_quote: "RAID 5 stripes data and parity across disks to tolerate single disk failures.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 11. Short Answer 1: Virtual Memory Address Translation (Rubric)
  {
    id: "60000000-0000-0000-0000-000000000011",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000008",
    question_type: "short_answer",
    difficulty: 3,
    question_text: "Explain how a Translation Lookaside Buffer (TLB) miss is handled and calculate the Effective Memory Access Time (EMAT) formula.",
    options: null,
    answer_key: "On a TLB miss, the hardware MMU walks the page table in DRAM, loads the translation into TLB, and accesses the target frame. EMAT = HitRate * (TLB + Mem) + (1 - HitRate) * (TLB + 2*Mem).",
    explanation: "A TLB miss forces a memory lookup to locate the physical page frame before completing the operation.",
    rubric: [
      { keypoint: "TLB miss detection and page table walk in memory", weight: 0.4, description: "Explains that a miss triggers a page table lookup in physical RAM" },
      { keypoint: "Updating TLB cache with newly translated frame", weight: 0.3, description: "Mentions reloading the entry into TLB for subsequent hits" },
      { keypoint: "Mathematical EMAT formula with hit and miss penalty", weight: 0.3, description: "States EMAT equation factoring in memory access cycles" },
    ],
    source_chunk_id: E2E_CHUNKS[16].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 19,
    citation_page_end: 20,
    citation_section: "TLB & EMAT",
    citation_quote: "EMAT = hit_rate * (tlb_lookup + mem_access) + (1 - hit_rate) * (tlb_lookup + 2 * mem_access).",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 12. Short Answer 2: Synchronization Semaphores (Rubric)
  {
    id: "60000000-0000-0000-0000-000000000012",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000005",
    question_type: "short_answer",
    difficulty: 3,
    question_text: "Define counting semaphores and explain the difference between wait() and signal() operations.",
    options: null,
    answer_key: "A semaphore S is an integer variable accessed only via wait() and signal(). wait(S) decrements S and blocks if S <= 0. signal(S) increments S and unblocks waiting threads.",
    explanation: "Semaphores provide synchronization without busy-waiting by placing blocked processes on waiting queues.",
    rubric: [
      { keypoint: "Atomic integer definition with wait() decrement and block", weight: 0.5, description: "Explains wait() checks value, decrements, and suspends process if unavailable" },
      { keypoint: "signal() increment and wake-up semantics", weight: 0.5, description: "Explains signal() increments value and unblocks queued process" },
    ],
    source_chunk_id: E2E_CHUNKS[10].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 12,
    citation_page_end: 13,
    citation_section: "Semaphores and Mutexes",
    citation_quote: "A counting semaphore S is an integer variable accessed only via wait() (P) and signal() (V) atomic operations.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 13. Short Answer 3: Belady's Anomaly (Rubric)
  {
    id: "60000000-0000-0000-0000-000000000013",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000008",
    question_type: "short_answer",
    difficulty: 2,
    question_text: "What is Belady's Anomaly and which page replacement algorithm famously exhibits it?",
    options: null,
    answer_key: "Belady's Anomaly is the counterintuitive phenomenon where increasing the number of physical frames increases the total page faults. It occurs in FIFO page replacement.",
    explanation: "FIFO does not satisfy the stack inclusion property, allowing more frames to cause worse performance.",
    rubric: [
      { keypoint: "Definition of Belady's Anomaly (more frames -> more faults)", weight: 0.6, description: "Explains that increasing allocated physical frames results in increased page faults" },
      { keypoint: "Identification of FIFO algorithm as susceptible", weight: 0.4, description: "Correctly specifies First-In-First-Out (FIFO) algorithm" },
    ],
    source_chunk_id: E2E_CHUNKS[17].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 21,
    citation_page_end: 22,
    citation_section: "Page Replacement Algorithms",
    citation_quote: "FIFO suffers from Belady's Anomaly where allocating more frames increases page faults.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 14. Short Answer 4: Coffman Conditions (Rubric)
  {
    id: "60000000-0000-0000-0000-000000000014",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000006",
    question_type: "short_answer",
    difficulty: 2,
    question_text: "List the four Coffman conditions necessary for a system deadlock to occur.",
    options: null,
    answer_key: "The four Coffman conditions are Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
    explanation: "All four conditions must hold simultaneously for a deadlock to exist in a system.",
    rubric: [
      { keypoint: "Mutual exclusion and Hold & Wait", weight: 0.5, description: "Lists mutual exclusion and hold-and-wait" },
      { keypoint: "No Preemption and Circular Wait", weight: 0.5, description: "Lists no preemption and circular wait" },
    ],
    source_chunk_id: E2E_CHUNKS[11].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 13,
    citation_page_end: 14,
    citation_section: "Deadlock Coffman Conditions",
    citation_quote: "Deadlock requires four simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
  // 15. Short Answer 5: Context Switch Overhead (Rubric)
  {
    id: "60000000-0000-0000-0000-000000000015",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000002",
    question_type: "short_answer",
    difficulty: 2,
    question_text: "Explain why context switching represents pure system overhead and what hardware resources are saved and restored.",
    options: null,
    answer_key: "Context switching does no useful application work while switching processes; CPU registers, program counter, and memory mappings must be saved to the outgoing PCB and restored from incoming PCB.",
    explanation: "During a context switch, the CPU spends time swapping execution context rather than advancing user calculations.",
    rubric: [
      { keypoint: "Explanation of pure computational overhead (no work done)", weight: 0.5, description: "States that context switching does no useful user execution" },
      { keypoint: "Specification of registers, PC, and PCB state saved/restored", weight: 0.5, description: "Identifies registers and PCB state swapped in memory" },
    ],
    source_chunk_id: E2E_CHUNKS[3].id,
    citation_document_name: "Silberschatz OS Concepts",
    citation_page_start: 4,
    citation_page_end: 5,
    citation_section: "Context Switching",
    citation_quote: "A context switch saves the state of the currently executing process in its PCB and restores the state of the newly scheduled process. Switching involves pure computational overhead.",
    is_quote_verified: true,
    created_at: "2026-11-04T12:30:00.000Z",
  },
];

// Pre-seeded attempts reflecting:
// 1. High confidence blind spot on Synchronization (Question 5)
// 2. Low score on Virtual Memory (Question 8)
export const E2E_ANSWERS: AnswerRow[] = [
  // Question 1: Architecture MCQ - Correct, high confidence
  {
    id: "80000000-0000-0000-0000-000000000001",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    quiz_question_id: "60000000-0000-0000-0000-000000000001",
    topic_id: "40000000-0000-0000-0000-000000000001",
    user_id: E2E_PROFILE.id,
    student_response: "A",
    confidence: "high",
    is_correct: true,
    score: 1.0,
    rubric_evaluation: null,
    feedback: "Correct! Dual-mode CPU operation provides hardware protection.",
    is_blind_spot: false,
    answered_at: "2026-11-17T10:00:00.000Z",
  },
  // Question 5: Synchronization MCQ - HIGH CONFIDENCE BLIND SPOT!
  {
    id: "80000000-0000-0000-0000-000000000005",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    quiz_question_id: "60000000-0000-0000-0000-000000000005",
    topic_id: "40000000-0000-0000-0000-000000000005",
    user_id: E2E_PROFILE.id,
    student_response: "A", // INCORRECT (Correct is B)
    confidence: "high", // HIGH CONFIDENCE WRONG ANSWER
    is_correct: false,
    score: 0.0,
    rubric_evaluation: null,
    feedback: "Incorrect. Modern multicore CPUs reorder memory operations; Peterson's algorithm requires explicit memory barriers.",
    is_blind_spot: true, // BLIND SPOT MARKER
    answered_at: "2026-11-17T10:05:00.000Z",
  },
  // Question 8: Virtual Memory MCQ - WEAK TOPIC (Incorrect)
  {
    id: "80000000-0000-0000-0000-000000000008",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    quiz_question_id: "60000000-0000-0000-0000-000000000008",
    topic_id: "40000000-0000-0000-0000-000000000008",
    user_id: E2E_PROFILE.id,
    student_response: "C", // INCORRECT (Correct is B)
    confidence: "medium",
    is_correct: false,
    score: 0.0,
    rubric_evaluation: null,
    feedback: "Incorrect. The TLB cannot access disk directly; an invalid entry raises an interrupt trap to the kernel.",
    is_blind_spot: false,
    answered_at: "2026-11-17T10:10:00.000Z",
  },
  // Question 11: Short Answer on TLB - Partially met
  {
    id: "80000000-0000-0000-0000-000000000011",
    quiz_id: "70000000-0000-0000-0000-000000000001",
    quiz_question_id: "60000000-0000-0000-0000-000000000011",
    topic_id: "40000000-0000-0000-0000-000000000008",
    user_id: E2E_PROFILE.id,
    student_response: "When a TLB miss happens, it reads the page table from memory and reloads the TLB.",
    confidence: "medium",
    is_correct: false,
    score: 0.4,
    rubric_evaluation: [
      { keypoint: "TLB miss detection and page table walk in memory", status: "met", rationale: "Mentioned page table read from memory", marks_awarded: 0.4 },
      { keypoint: "Updating TLB cache with newly translated frame", status: "partially_met", rationale: "Briefly noted reloading TLB", marks_awarded: 0.0 },
      { keypoint: "Mathematical EMAT formula with hit and miss penalty", status: "not_met", rationale: "Omitted EMAT mathematical equation entirely", marks_awarded: 0.0 },
    ],
    feedback: "Good intuition on the page table walk, but you omitted the mathematical EMAT formula.",
    is_blind_spot: false,
    answered_at: "2026-11-17T10:15:00.000Z",
  },
];

// Helper functions for easy access
export function getDemoProfile(): ProfileRow {
  return JSON.parse(JSON.stringify(E2E_PROFILE));
}

export function getDemoWorkspace(): WorkspaceRow {
  return JSON.parse(JSON.stringify(E2E_WORKSPACE));
}

export function getDemoDocuments(): DocumentRow[] {
  return JSON.parse(JSON.stringify(E2E_DOCUMENTS));
}

export function getDemoTopics(): TopicRow[] {
  return JSON.parse(JSON.stringify(E2E_TOPICS));
}

export function getDemoPrerequisites(): TopicPrerequisiteRow[] {
  return JSON.parse(JSON.stringify(E2E_PREREQUISITES));
}

export function getDemoChunks(): DocumentChunkRow[] {
  return JSON.parse(JSON.stringify(E2E_CHUNKS));
}

export function getDemoQuestions(): QuizQuestionRow[] {
  return JSON.parse(JSON.stringify(E2E_QUESTIONS));
}

export function getDemoAnswers(): AnswerRow[] {
  return JSON.parse(JSON.stringify(E2E_ANSWERS));
}

export function getWeakTopic(): TopicRow {
  const weak = E2E_TOPICS.find((t) => t.id === "40000000-0000-0000-0000-000000000008");
  if (!weak) throw new Error("Weak topic not found");
  return weak;
}

export function getBlindSpotTopic(): TopicRow {
  const blindSpot = E2E_TOPICS.find((t) => t.id === "40000000-0000-0000-0000-000000000005");
  if (!blindSpot) throw new Error("Blind spot topic not found");
  return blindSpot;
}

export function getDemoRevisionSchedule(): RevisionPlanOverview {
  return JSON.parse(JSON.stringify(DEMO_REVISION_SCHEDULE));
}

export function getDemoGapReport(): GapReportData & {
  topicBreakdown: TopicMastery[];
  urgentActions: Array<{
    topicId: string;
    topicTitle: string;
    actionType: string;
    description: string;
    priority: "urgent" | "high" | "medium" | "low";
  }>;
} {
  const topics: TopicMastery[] = E2E_TOPICS.map((t) => ({
    topicId: t.id,
    topicTitle: t.title,
    unitModule: t.unit_module,
    masteryScore: t.current_mastery,
    classification: t.classification,
    evidenceLevel: t.evidence_level,
    totalAttempts: t.total_attempts,
    correctAttempts: t.correct_attempts,
    blindSpotCount: t.blind_spot_count,
    examWeight: t.exam_weight,
    examFrequency: t.exam_frequency,
    lastAttemptAt: t.updated_at,
  }));

  return {
    workspaceId: E2E_WORKSPACE.id,
    workspaceTitle: E2E_WORKSPACE.title,
    examDate: E2E_WORKSPACE.exam_date,
    daysRemaining: 14,
    generatedAt: "2026-11-18T12:00:00.000Z",
    readiness: {
      readinessScore: 68.4,
      assessedTopicsCount: 8,
      totalTopicsCount: 10,
      coveragePercentage: 80.0,
      averageMastery: 69.9,
      isDataSufficient: true,
    },
    topics,
    topicBreakdown: topics,
    blindSpots: {
      totalBlindSpots: 1,
      highRiskTopics: [
        {
          topicId: "40000000-0000-0000-0000-000000000005",
          topicTitle: "Process Synchronization & Critical Section Problem",
          blindSpotCount: 1,
        },
      ],
      items: [
        {
          topicId: "40000000-0000-0000-0000-000000000005",
          topicTitle: "Process Synchronization & Critical Section Problem",
          questionId: "60000000-0000-0000-0000-000000000005",
          questionText: "Why can Peterson's algorithm fail to provide mutual exclusion on modern multicore x86/ARM processors without memory fences?",
          studentResponse: "Modern CPUs support more than two concurrent processes",
          correctAnswer: "Out-of-order processors and memory subsystems may reorder stores and loads to flag and turn variables",
          confidence: "high",
          evidenceQuote: "modern out-of-order processors can reorder independent memory loads and stores, breaking correctness without explicit memory barriers.",
          citation: {
            chunkId: E2E_CHUNKS[9].id,
            documentId: E2E_DOCUMENTS[1].id,
            documentName: "Silberschatz OS Concepts",
            docType: "material",
            pageStart: 11,
            pageEnd: 12,
            sectionHeading: "Peterson's Algorithm",
            isQuoteVerified: true,
          },
          remedyAction: "Study memory consistency models and hardware memory barriers (mfence/dmb).",
        },
      ],
    },
    urgentActions: [
      {
        topicId: "40000000-0000-0000-0000-000000000005",
        topicTitle: "Process Synchronization & Critical Section Problem",
        actionType: "remedy_blind_spot",
        description: "Review Silberschatz Chapter 6 p. 11-12 on memory reordering barriers in Peterson's algorithm.",
        priority: "urgent",
      },
      {
        topicId: "40000000-0000-0000-0000-000000000008",
        topicTitle: "Virtual Memory, Page Faults & TLB",
        actionType: "practice_weak_topic",
        description: "Complete 3 EMAT and page fault calculation drills.",
        priority: "high",
      },
    ],
  };
}
