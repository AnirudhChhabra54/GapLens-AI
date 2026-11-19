-- ==============================================================================
-- GapLens AI Seed: Operating Systems (CS-301) Realistic Demo Dataset
-- ==============================================================================
-- Run scripts/provision-demo-auth.mjs first so the Supabase Auth user exists.
-- This file is intended for psql, which supports the :'demo_user_id' variable.

SELECT id AS demo_user_id FROM auth.users WHERE email = 'demo@gapfinder.ai' \gset

-- 1. Demo User Profile
INSERT INTO profiles (id, email, full_name, created_at, updated_at)
VALUES (
    :'demo_user_id',
    'demo@gapfinder.ai',
    'Alex Chen (Demo Student)',
    NOW() - INTERVAL '14 days',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

-- 2. Operating Systems Workspace (Target exam 14 days out, 60 mins/day study budget)
INSERT INTO workspaces (id, user_id, title, description, exam_date, daily_study_minutes, created_at, updated_at)
VALUES (
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'Operating Systems (CS-301)',
    'Comprehensive core undergraduate systems curriculum covering Concurrency, Virtual Memory, Scheduling, and Storage.',
    (CURRENT_DATE + INTERVAL '14 days')::date,
    60,
    NOW() - INTERVAL '14 days',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    exam_date = EXCLUDED.exam_date,
    daily_study_minutes = EXCLUDED.daily_study_minutes;

-- 3. Documents
INSERT INTO documents (
    id, workspace_id, user_id, filename, storage_path, file_type, declared_size_bytes, doc_type, status, page_count, extracted_char_count, chunk_count, created_at
)
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'CS301_Operating_Systems_Syllabus.pdf',
    :'demo_user_id' || '/10000000-0000-0000-0000-000000000001/CS301_Operating_Systems_Syllabus.pdf',
    'application/pdf',
    184200,
    'syllabus',
    'indexed',
    4,
    6200,
    3,
    NOW() - INTERVAL '14 days'
),
(
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'Silberschatz_OS_Concepts_Core_Notes.pdf',
    :'demo_user_id' || '/10000000-0000-0000-0000-000000000001/Silberschatz_OS_Concepts_Core_Notes.pdf',
    'application/pdf',
    1450200,
    'material',
    'indexed',
    48,
    78400,
    24,
    NOW() - INTERVAL '14 days'
),
(
    '20000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'CS301_Final_Exam_2023.pdf',
    :'demo_user_id' || '/10000000-0000-0000-0000-000000000001/CS301_Final_Exam_2023.pdf',
    'application/pdf',
    412000,
    'past_paper',
    'indexed',
    8,
    14200,
    6,
    NOW() - INTERVAL '14 days'
),
(
    '20000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'CS301_Final_Exam_2024.pdf',
    :'demo_user_id' || '/10000000-0000-0000-0000-000000000001/CS301_Final_Exam_2024.pdf',
    'application/pdf',
    438000,
    'past_paper',
    'indexed',
    8,
    15100,
    6,
    NOW() - INTERVAL '14 days'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Document Chunks (with 768-dim mock vector representation)
INSERT INTO document_chunks (
    id, document_id, workspace_id, user_id, chunk_index, index_version, page_start, page_end, section_heading, content, embedding, embedding_model, embedding_dimensions, created_at
)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    1,
    1,
    14,
    15,
    'Virtual Memory & Address Translation',
    'Virtual Memory and Paging: In modern operating systems, virtual address spaces are divided into fixed-size pages. Address translation uses a Translation Lookaside Buffer (TLB). When a TLB hit occurs, physical address translation completes in hardware within 1 clock cycle. On a TLB miss, the memory management unit (MMU) or OS page-table walker accesses multi-level page tables in DRAM, incurring significant latency. In x86-64, a 4-level page table structure is traversed. If the page table entry indicates the page is not in physical memory (valid bit is 0), the hardware generates a page fault trap (Interrupt 14), transferring control to the OS page fault handler to read the frame from secondary storage.',
    ARRAY_FILL(0.036::float, ARRAY[768])::vector(768),
    'gemini-embedding-001',
    768,
    NOW() - INTERVAL '14 days'
),
(
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    2,
    1,
    22,
    23,
    'Process Synchronization: Critical Section & Peterson''s Algorithm',
    'Critical Section Problem & Peterson''s Algorithm: Peterson''s algorithm solves mutual exclusion for two processes using shared variables boolean flag[2] and int turn. Process i sets flag[i] = true and turn = j, then enters a spin-wait loop: while (flag[j] && turn == j);. This ensures mutual exclusion, progress, and bounded waiting. However, on modern out-of-order superscalar architectures, compilers and CPU hardware reorder loads and stores. Without explicit memory barriers (memory fences) or atomic memory instructions (e.g., test-and-set, compare-and-swap), Peterson''s algorithm is NOT guaranteed to work on modern multicore hardware due to CPU store buffer reordering.',
    ARRAY_FILL(0.036::float, ARRAY[768])::vector(768),
    'gemini-embedding-001',
    768,
    NOW() - INTERVAL '14 days'
),
(
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    3,
    1,
    29,
    30,
    'Deadlock Prevention & Banker''s Algorithm',
    'Deadlocks: A deadlock requires four simultaneous conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. The Banker''s Algorithm by Edsger Dijkstra is a deadlock avoidance algorithm for multiple resource instances. It determines if allocating resources maintains a safe state. A state is safe if there exists a safe sequence of processes <P1, P2, ..., Pn> where each process''s remaining needs can be satisfied by current available resources plus resources released by preceding processes. If a request would cause an unsafe state, the request is denied and the process must wait.',
    ARRAY_FILL(0.036::float, ARRAY[768])::vector(768),
    'gemini-embedding-001',
    768,
    NOW() - INTERVAL '14 days'
),
(
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    4,
    1,
    35,
    36,
    'CPU Scheduling: Multi-Level Feedback Queue',
    'CPU Scheduling Algorithms: Round Robin (RR) allocates a fixed time quantum q. If a process does not yield before q expires, the timer interrupt fires, triggering preemption and moving the process to the ready queue tail. Multi-Level Feedback Queue (MLFQ) dynamically adjusts process priority based on observed behavior: I/O-bound interactive processes stay at high priority with short time slices, while CPU-intensive compute jobs sink to lower priority queues with longer time slices. Starvation is prevented using periodic priority boosting (aging).',
    ARRAY_FILL(0.036::float, ARRAY[768])::vector(768),
    'gemini-embedding-001',
    768,
    NOW() - INTERVAL '14 days'
),
(
    '30000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    5,
    1,
    42,
    43,
    'File Systems: Inodes & Journaling',
    'File Systems and Inodes: Unix-style file systems represent files using index nodes (inodes) containing metadata (permissions, owner, size, timestamps) and direct/indirect block pointers. Modern file systems (ext4, XFS) replace simple block pointers with extents (contiguous block ranges) to reduce metadata overhead and fragmentation. To recover from power failure and crashes without exhaustive fsck scans, journaling logs metadata changes to a circular journal buffer before committing modifications to the main file system structures.',
    ARRAY_FILL(0.036::float, ARRAY[768])::vector(768),
    'gemini-embedding-001',
    768,
    NOW() - INTERVAL '14 days'
)
ON CONFLICT (id) DO NOTHING;

-- 5. Syllabus Topics
-- Parent Modules
INSERT INTO topics (id, workspace_id, user_id, parent_id, title, unit_module, order_index, exam_frequency, exam_total_marks, exam_weight, current_mastery, classification, evidence_level, total_attempts, correct_attempts, blind_spot_count)
VALUES
(
    '40000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    NULL,
    'Memory Management & Virtual Memory',
    'Module 1',
    1,
    5,
    35,
    0.35,
    48.50,
    'weak',
    'strong_evidence',
    4,
    1,
    1
),
(
    '40000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    NULL,
    'Concurrency & Synchronization',
    'Module 2',
    2,
    4,
    30,
    0.30,
    52.20,
    'weak',
    'strong_evidence',
    5,
    2,
    1
),
(
    '40000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    NULL,
    'Processor Scheduling & Threads',
    'Module 3',
    3,
    3,
    18,
    0.18,
    82.50,
    'strong',
    'strong_evidence',
    4,
    4,
    0
),
(
    '40000000-0000-0000-0000-000000000009',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    NULL,
    'Storage & File Systems',
    'Module 4',
    4,
    2,
    17,
    0.17,
    72.00,
    'medium',
    'developing_evidence',
    3,
    2,
    0
)
ON CONFLICT (id) DO NOTHING;

-- Subtopics (Actionable Granular Topics)
INSERT INTO topics (id, workspace_id, user_id, parent_id, title, unit_module, order_index, source_chunk_id, exam_frequency, exam_total_marks, exam_weight, current_mastery, classification, evidence_level, total_attempts, correct_attempts, blind_spot_count)
VALUES
(
    '40000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000001',
    'Multi-Level Paging & TLB Translation Misses',
    'Module 1.1',
    1,
    '30000000-0000-0000-0000-000000000001',
    3,
    22,
    0.22,
    42.00,
    'weak',
    'strong_evidence',
    3,
    1,
    1
),
(
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000001',
    'Page Replacement Algorithms (LRU, Clock)',
    'Module 1.2',
    2,
    '30000000-0000-0000-0000-000000000001',
    2,
    13,
    0.13,
    65.00,
    'medium',
    'developing_evidence',
    2,
    1,
    0
),
(
    '40000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000004',
    'Peterson''s Algorithm & Modern Multicore Reordering',
    'Module 2.1',
    1,
    '30000000-0000-0000-0000-000000000002',
    2,
    16,
    0.16,
    35.00,
    'weak',
    'strong_evidence',
    3,
    1,
    1
),
(
    '40000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000004',
    'Deadlock Avoidance & Banker''s Algorithm',
    'Module 2.2',
    2,
    '30000000-0000-0000-0000-000000000003',
    2,
    14,
    0.14,
    88.00,
    'strong',
    'strong_evidence',
    2,
    2,
    0
),
(
    '40000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000007',
    'Multi-Level Feedback Queue (MLFQ) Scheduling',
    'Module 3.1',
    1,
    '30000000-0000-0000-0000-000000000004',
    3,
    18,
    0.18,
    82.50,
    'strong',
    'strong_evidence',
    4,
    4,
    0
),
(
    '40000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    '40000000-0000-0000-0000-000000000009',
    'Inodes, Extents & Journaling Crash Recovery',
    'Module 4.1',
    1,
    '30000000-0000-0000-0000-000000000005',
    2,
    17,
    0.17,
    72.00,
    'medium',
    'developing_evidence',
    3,
    2,
    0
)
ON CONFLICT (id) DO NOTHING;

-- 6. Topic Prerequisites
INSERT INTO topic_prerequisites (id, workspace_id, topic_id, prerequisite_topic_id, is_inferred, confidence, source_rationale)
VALUES
(
    '50000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000003', -- Page Replacement
    '40000000-0000-0000-0000-000000000002', -- Multi-Level Paging
    false,
    1.0,
    'Understanding virtual-to-physical address translation is essential before analyzing page fault replacement policies.'
),
(
    '50000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000006', -- Deadlocks
    '40000000-0000-0000-0000-000000000005', -- Synchronization
    false,
    1.0,
    'Critical section mutual exclusion primitives are required knowledge prior to reasoning about circular wait deadlocks.'
),
(
    '50000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000010', -- File System Journaling
    '40000000-0000-0000-0000-000000000005', -- Synchronization
    true,
    0.85,
    'Atomic write transitions and write barriers in journaling depend on memory and store order guarantees.'
)
ON CONFLICT (id) DO NOTHING;

-- 7. Past Paper Questions (Mapped from 2023 & 2024 Exams)
INSERT INTO paper_questions (
    id, workspace_id, document_id, paper_year, paper_name, question_number, question_text, marks, mapped_topic_id, mapping_confidence, supporting_chunk_id, mapping_rationale
)
VALUES
(
    '60000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    2023,
    'CS301 Final Exam 2023',
    'Q2a',
    'Explain the role of the TLB in address translation. Calculate the Effective Memory Access Time (EMAT) given a TLB hit ratio of 95%, TLB lookup of 1ns, and main memory access time of 100ns in a 4-level page table architecture.',
    10,
    '40000000-0000-0000-0000-000000000002',
    0.98,
    '30000000-0000-0000-0000-000000000001',
    'Directly tests multi-level page table traversal and TLB miss overhead calculation.'
),
(
    '60000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000003',
    2023,
    'CS301 Final Exam 2023',
    'Q3b',
    'Prove why Peterson''s Algorithm guarantees mutual exclusion for two threads on an idealized sequentially consistent architecture. Why does this proof break on an Intel x86 or ARM multicore processor?',
    10,
    '40000000-0000-0000-0000-000000000005',
    0.99,
    '30000000-0000-0000-0000-000000000002',
    'Explicitly tests Peterson algorithm invariants and modern CPU store buffer reordering.'
),
(
    '60000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000004',
    2024,
    'CS301 Final Exam 2024',
    'Q1c',
    'Given an allocation matrix and max demand matrix with 5 processes and 3 resource types, apply Dijkstra''s Banker''s Algorithm to find if a safe sequence exists. Show step-by-step vector arithmetic.',
    8,
    '40000000-0000-0000-0000-000000000006',
    0.95,
    '30000000-0000-0000-0000-000000000003',
    'Banker''s algorithm safe state determination problem.'
)
ON CONFLICT (id) DO NOTHING;

-- 8. Diagnostic Quiz Session
INSERT INTO quizzes (id, workspace_id, user_id, title, quiz_mode, target_topic_ids, is_completed, started_at, completed_at, total_score, max_possible_score)
VALUES (
    '70000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    'OS CS-301 Comprehensive Diagnostic Assessment',
    'diagnostic',
    ARRAY[
        '40000000-0000-0000-0000-000000000002',
        '40000000-0000-0000-0000-000000000005',
        '40000000-0000-0000-0000-000000000006'
    ]::uuid[],
    true,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days' + INTERVAL '32 minutes',
    1.33,
    3.00
)
ON CONFLICT (id) DO NOTHING;

-- 9. Quiz Questions with Pinned Citations
INSERT INTO quiz_questions (
    id, quiz_id, topic_id, question_type, difficulty, question_text, options, answer_key, explanation, rubric, source_chunk_id, citation_document_name, citation_page_start, citation_page_end, citation_section, citation_quote, is_quote_verified
)
VALUES
(
    '80000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005', -- Peterson's Algorithm
    'mcq',
    1.0,
    'Why is Peterson''s algorithm NOT guaranteed to ensure mutual exclusion on modern multicore processors when compiled directly without synchronization intrinsics?',
    '[
        {"id": "A", "text": "It relies on busy waiting, which always leads to immediate priority inversion and OS kernel deadlock."},
        {"id": "B", "text": "It can only support up to two threads and fails to compile on 64-bit operating systems."},
        {"id": "C", "text": "Modern out-of-order processors and optimizing compilers can reorder loads and stores past each other in store buffers unless explicit memory fences are inserted."},
        {"id": "D", "text": "The turn variable cannot be stored in cache memory and causes hardware bus faults."}
    ]'::jsonb,
    'C',
    'Modern CPUs use out-of-order execution and store buffers, allowing store-load reordering where a thread''s write to flag[i] is delayed in the local store buffer while its read of flag[j] executes early, allowing both threads into the critical section simultaneously.',
    NULL,
    '30000000-0000-0000-0000-000000000002',
    'Silberschatz_OS_Concepts_Core_Notes.pdf',
    22,
    23,
    'Critical Section Problem & Peterson''s Algorithm',
    'Without explicit memory barriers (memory fences) or atomic memory instructions (e.g., test-and-set, compare-and-swap), Peterson''s algorithm is NOT guaranteed to work on modern multicore hardware due to CPU store buffer reordering.',
    true
),
(
    '80000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002', -- Multi-Level Paging
    'short_answer',
    1.1,
    'Distinguish between a TLB Miss and a Page Fault. In your explanation, specify what entity handles each event (hardware vs OS kernel) and the location from which the missing data is fetched.',
    NULL,
    'A TLB miss occurs when the virtual page number is absent from the TLB cache; it is resolved in hardware (or fast trap handler) by walking page tables in DRAM. A page fault occurs when the valid bit in the page table entry is 0 (the page is not present in RAM); it is handled by the OS kernel (Interrupt 14) and requires I/O to fetch the page frame from secondary storage (disk/SSD).',
    'A TLB miss is handled by the MMU hardware walker traversing page tables in DRAM; a page fault is a software interrupt handled by the OS kernel fetching frames from disk.',
    '[
        {"keypoint": "TLB Miss resolution mechanism (Hardware MMU walks page tables in DRAM)", "weight": 0.4, "description": "States that TLB miss checks page tables in main memory (DRAM), typically handled by MMU hardware."},
        {"keypoint": "Page Fault mechanism (OS software trap Interupt 14 fetching from disk)", "weight": 0.4, "description": "States that page fault is handled by the OS page fault trap handler, reading data from disk storage."},
        {"keypoint": "Performance latency distinction (DRAM vs Disk I/O)", "weight": 0.2, "description": "Highlights the massive latency difference between DRAM page walk (nanoseconds) and disk I/O (milliseconds/microseconds)."}
    ]'::jsonb,
    '30000000-0000-0000-0000-000000000001',
    'Silberschatz_OS_Concepts_Core_Notes.pdf',
    14,
    15,
    'Virtual Memory & Address Translation',
    'If the page table entry indicates the page is not in physical memory (valid bit is 0), the hardware generates a page fault trap (Interrupt 14), transferring control to the OS page fault handler to read the frame from secondary storage.',
    true
),
(
    '80000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000006', -- Banker's Algorithm
    'mcq',
    0.9,
    'In Dijkstra''s Banker''s Algorithm, what defines a "safe state"?',
    '[
        {"id": "A", "text": "A state where no process currently holds any locks or shared semaphores."},
        {"id": "B", "text": "A state where there exists at least one sequence of all processes such that each can satisfy its maximum remaining needs with current available resources plus resources freed by completed predecessors."},
        {"id": "C", "text": "A state where total available physical memory exceeds 50% of swap space."},
        {"id": "D", "text": "A state where all processes have identical priority and cannot preempt one another."}
    ]'::jsonb,
    'B',
    'A safe state guarantees that deadlock can be avoided because there exists a feasible execution ordering (safe sequence) ensuring every process eventually terminates.',
    NULL,
    '30000000-0000-0000-0000-000000000003',
    'Silberschatz_OS_Concepts_Core_Notes.pdf',
    29,
    30,
    'Deadlock Prevention & Banker''s Algorithm',
    'A state is safe if there exists a safe sequence of processes <P1, P2, ..., Pn> where each process''s remaining needs can be satisfied by current available resources plus resources released by preceding processes.',
    true
)
ON CONFLICT (id) DO NOTHING;

-- 10. Student Answers (Demonstrating High-Confidence Blind Spots)
INSERT INTO answers (
    id, quiz_id, quiz_question_id, topic_id, user_id, student_response, confidence, is_correct, score, rubric_evaluation, feedback, is_blind_spot, answered_at
)
VALUES
(
    '90000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000001', -- Peterson's Algorithm
    '40000000-0000-0000-0000-000000000005',
    :'demo_user_id',
    'A', -- Student erroneously answered A with HIGH confidence!
    'high',
    false,
    0.0,
    NULL,
    'HIGH CONFIDENCE BLIND SPOT: You indicated high confidence that Peterson''s algorithm always works on multicore systems. In reality, modern superscalar CPUs reorder memory operations in hardware store buffers. Without memory fences (e.g. MFENCE, atomic primitives), both threads can read flag=false simultaneously before writes become visible.',
    true, -- High Confidence Blind Spot!
    NOW() - INTERVAL '2 days' + INTERVAL '10 minutes'
),
(
    '90000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000002', -- Multi-Level Paging (Short Answer)
    '40000000-0000-0000-0000-000000000002',
    :'demo_user_id',
    'A TLB miss triggers interrupt 14 and immediately loads the page from the hard drive or SSD into RAM memory.',
    'high', -- High Confidence Blind Spot on short answer!
    false,
    0.33,
    '[
        {"keypoint": "TLB Miss resolution mechanism (Hardware MMU walks page tables in DRAM)", "status": "not_met", "rationale": "Incorrectly claimed TLB miss fetches directly from disk instead of walking page tables in DRAM.", "marks_awarded": 0.0},
        {"keypoint": "Page Fault mechanism (OS software trap Interupt 14 fetching from disk)", "status": "partially_met", "rationale": "Correctly identified Interrupt 14 and disk fetching, but conflated it with TLB miss.", "marks_awarded": 0.20},
        {"keypoint": "Performance latency distinction (DRAM vs Disk I/O)", "status": "partially_met", "rationale": "Implied disk latency for all misses.", "marks_awarded": 0.13}
    ]'::jsonb,
    'HIGH CONFIDENCE BLIND SPOT: A TLB miss is NOT a page fault. A TLB miss is resolved in DRAM by the MMU walking the multi-level page table. Only if the valid bit in the page table entry is 0 is a Page Fault trap (Interrupt 14) generated to perform disk I/O.',
    true, -- High Confidence Blind Spot!
    NOW() - INTERVAL '2 days' + INTERVAL '24 minutes'
),
(
    '90000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000001',
    '80000000-0000-0000-0000-000000000003', -- Banker's Algorithm
    '40000000-0000-0000-0000-000000000006',
    :'demo_user_id',
    'B',
    'high',
    true,
    1.0,
    NULL,
    'Correct! Excellent understanding of Banker''s algorithm safe sequence definition.',
    false,
    NOW() - INTERVAL '2 days' + INTERVAL '30 minutes'
)
ON CONFLICT (id) DO NOTHING;

-- 11. Mastery Snapshots (Historical Mastery Tracking)
INSERT INTO mastery_snapshots (id, workspace_id, topic_id, user_id, quiz_id, mastery_score, classification, evidence_level, effective_attempts, recorded_at)
VALUES
(
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005', -- Peterson's Algorithm
    :'demo_user_id',
    '70000000-0000-0000-0000-000000000001',
    35.00,
    'weak',
    'strong_evidence',
    3,
    NOW() - INTERVAL '2 days'
),
(
    'a0000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002', -- Multi-Level Paging
    :'demo_user_id',
    '70000000-0000-0000-0000-000000000001',
    42.00,
    'weak',
    'strong_evidence',
    3,
    NOW() - INTERVAL '2 days'
),
(
    'a0000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000006', -- Banker's Algorithm
    :'demo_user_id',
    '70000000-0000-0000-0000-000000000001',
    88.00,
    'strong',
    'strong_evidence',
    2,
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING;

-- 12. Active 14-Day Revision Plan (60 mins/day = 840 mins total)
INSERT INTO revision_plans (
    id, workspace_id, user_id, version, exam_date, daily_minutes, total_days, total_allocated_minutes, is_active, created_at, updated_at
)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    :'demo_user_id',
    1,
    (CURRENT_DATE + INTERVAL '14 days')::date,
    60,
    14,
    780, -- 780 of 840 minutes allocated
    true,
    NOW() - INTERVAL '1 day',
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 13. Revision Tasks (Priority packed into 60-minute daily budgets)
INSERT INTO revision_tasks (
    id, plan_id, workspace_id, topic_id, day_number, task_order, task_type, title, description, allocated_minutes, priority_score, status, source_chunk_id, citation_reference, created_at
)
VALUES
-- Day 1: Remediate High-Confidence Blind Spot on Peterson's Algorithm
(
    'c0000000-0000-0000-0000-000000000001',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005',
    1,
    1,
    'read_source',
    'Source Reading: Memory Reordering & Store Buffers',
    'Read pages 22-23 of Core Notes regarding CPU store buffer reordering and why software mutual exclusion algorithms fail without memory fences.',
    20,
    94.50,
    'completed',
    '30000000-0000-0000-0000-000000000002',
    'Silberschatz Core Notes p. 22-23',
    NOW() - INTERVAL '1 day'
),
(
    'c0000000-0000-0000-0000-000000000002',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005',
    1,
    2,
    'copilot_lesson',
    'Study Copilot Micro-Lesson: Hardware Memory Barriers',
    'Ask Copilot to explain how memory fences (MFENCE) prevent simultaneous critical section entry on x86-64.',
    15,
    94.50,
    'completed',
    '30000000-0000-0000-0000-000000000002',
    'Silberschatz Core Notes p. 22-23',
    NOW() - INTERVAL '1 day'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000005',
    1,
    3,
    'practice_drill',
    'Practice Drill: Past Exam 2023 Q3b Proof',
    'Solve 2023 Q3b analyzing sequential consistency violation on ARM/x86.',
    25,
    94.50,
    'completed',
    '30000000-0000-0000-0000-000000000002',
    'CS301 Final Exam 2023 Q3b',
    NOW() - INTERVAL '1 day'
),

-- Day 2: Remediate TLB Miss vs Page Fault Blind Spot
(
    'c0000000-0000-0000-0000-000000000004',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    2,
    1,
    'read_source',
    'Source Reading: Hardware Address Translation & Page Walking',
    'Review Core Notes p. 14-15 on 4-level page table traversal and Interrupt 14 page fault dispatch.',
    20,
    91.20,
    'pending',
    '30000000-0000-0000-0000-000000000001',
    'Silberschatz Core Notes p. 14-15',
    NOW()
),
(
    'c0000000-0000-0000-0000-000000000005',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    2,
    2,
    'practice_drill',
    'Effective Access Time Calculation Drill',
    'Practice calculating EMAT with TLB hit rates and multi-level DRAM lookups (2023 Exam Q2a).',
    20,
    91.20,
    'pending',
    '30000000-0000-0000-0000-000000000001',
    'CS301 Final Exam 2023 Q2a',
    NOW()
),
(
    'c0000000-0000-0000-0000-000000000006',
    'b0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    2,
    3,
    'retest',
    'Weak-Topic Targeted Retest: Address Translation',
    'Take a 3-question adaptive retest on Multi-Level Paging to demonstrate mastery improvement.',
    20,
    91.20,
    'pending',
    '30000000-0000-0000-0000-000000000001',
    'Silberschatz Core Notes p. 14-15',
    NOW()
)
ON CONFLICT (id) DO NOTHING;
