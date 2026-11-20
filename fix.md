# GapLens AI — Code Audit & Fix Plan

Audit date: 2026-11-21
Scope: `src/app`, `src/components`, `src/lib`, `src/types`, `supabase`, `scripts`, docs
Verification baseline: `tsc --noEmit` passes, `next lint` passes, `vitest run` passes (39 files / 474 tests). All issues below are integration, state-persistence, or logic defects that the existing unit tests do not exercise.

Legend: **P0** = security/correctness blocker, **P1** = broken user-facing flow, **P2** = logic/data bug, **P3** = incomplete feature / docs drift.

---

## P0 — Critical

### 1. No auth routing or session refresh (no middleware)
- Where: repo root (missing `middleware.ts`), `src/components/app-shell.tsx:34-44`, `src/app/layout.tsx:20-22`
- Problem: `AppShell` only splits public vs. private chrome; it never reads `isLoggedIn`. `isLoggedIn` defaults to `true` (`workspace-context.tsx:209`), and `logout()` does not redirect. Every protected URL is reachable without a session. Separately, `@supabase/ssr` cookies are never refreshed because no middleware calls `getUser()`.
- Fix: add `middleware.ts` using `@supabase/ssr` `createServerClient` + cookie `updateSession`, redirect unauthenticated users away from `/dashboard`, `/materials`, `/diagnostic`, `/gap-report`, `/planner`; in `AppShell` consume `isLoggedIn` and `router.replace("/login")` when false, and redirect after logout.

### 2. Custom login offline creates a permanently unauthorized workspace
- Where: `src/components/workspace-context.tsx:387-518`, `src/app/login/page.tsx:35-80`, `src/lib/supabase/auth.ts:50-55`
- Problem: when Supabase is not configured (or `getUser()` fails), `loginCustom` invents `crypto.randomUUID()` for both user and workspace, sets `isDemo: false`, and proceeds. Every API route then calls `authorizeWorkspace` with that random workspace and receives `401 Authentication is required`.
- Fix: if no configured Supabase/session exists, reject custom sign-in with a clear message, or explicitly enter a client-only mode. Never synthesize a workspace ID that the server cannot authorize. Optionally create the workspace via a server action after a verified session.

### 3. Demo-generated quizzes are always scored correct
- Where: `src/app/diagnostic/page.tsx:242-254`, `src/app/api/quiz/evaluate/route.ts:204-233`
- Problem: `/api/quiz/generate` returns a random `quizId` and random question IDs in demo mode. On submit, the client omits `answerKey`/`rubric`. The evaluator's dynamic-preview branch then builds the question with `answer_key: a.answerKey || a.response`, so the "correct answer" becomes the student's response and every answer scores 1.0.
- Fix: keep generated demo questions server-side in a TTL cache keyed by `quizId` (or return a signed opaque token), look them up during evaluation, and reject unknown `quizId`/`questionId`. Never fall back to the student's response as the answer key. Simplest alternative: in offline mode restrict generation to the fixture quiz and its known IDs.

### 4. Document delete and reindex are stubs
- Where: `src/app/materials/page.tsx:383-391` (handlers), `:683`, `:692` (buttons)
- Problem: `handleDeleteDoc` only filters React state; `handleReindexDoc` only rewrites `status` locally. The `documents` row, storage object, `document_chunks`, and `paper_questions` remain untouched, and refresh restores the document.
- Fix: add `DELETE /api/documents/[id]` (verify `authorizeWorkspace`, delete storage object, delete DB row with cascades, remove dependent chunks/paper-question references) and `POST /api/documents/[id]/reindex` (reset status/index version, clear chunks, re-run `parse → chunk → embed` from stored file). Update local state from the API response.

### 5. Task completion and daily budget are never persisted
- Where: `src/components/workspace-context.tsx:519-536` (`toggleTaskCompletion`), `:589-604` (`regenerateSchedule`), `src/app/planner/page.tsx:79-92`
- Problem: completed task IDs live only in `localStorage`; no `revision_tasks.status/completed_at` write exists. Daily minutes are never written to `workspaces.daily_study_minutes` either. On a live reload the plan is rebuilt empty (see #7) and all progress disappears.
- Fix: add `PATCH /api/planner/tasks` (or `/api/planner/tasks/[id]`) that updates `status`, `completed_at`, and validates plan ownership; add a workspace `PATCH` for `daily_study_minutes` and `exam_date`. Hydrate the planner from the server plan + tasks on mount. Keep local state only as an optimistic cache.

---

## P1 — Broken user-facing flows

### 6. Planner calls `/api/planner/generate` and ignores the response
- Where: `src/app/planner/page.tsx:79-92`
- Problem: `onBudgetChange` fires the request with `.catch(() => undefined)` and only runs the client-side `regenerateSchedule`. The server-generated plan (with persisted tasks/version) is discarded, so server and UI states diverge.
- Fix: `await` the response, validate it, call a new `setRevisionSchedule(response)` in context, and surface errors. Prefer making the server the source of truth and using client generation only in demo mode.

### 7. Live hydration loses the revision plan and gap report
- Where: `src/components/workspace-context.tsx:235-270`, `:321-356` (`saveState`), `src/app/dashboard/page.tsx`
- Problem: non-demo hydration always sets `createEmptyGapReport` / `createEmptySchedule`; `revisionSchedule` is not included in `saveState` at all. Dashboard never fetches `/api/gap-report` or the planner, so after reload it renders zero coverage/progress until the user manually regenerates.
- Fix: persist `revisionSchedule` in `saveState`, and/or fetch the latest `revision_plans`, `revision_tasks`, and `/api/gap-report` on hydration. Dashboard should load those endpoints rather than relying on empty context defaults.

### 8. Paper mapping computes exam weights from only the latest batch and duplicates rows on re-map
- Where: `src/app/api/papers/map/route.ts:182-223`, `src/lib/algorithms/topic-mapper.ts:365-404`
- Problem: `computeTopicExamWeights` is fed only `simulatedPaperRows` from the current call, so mapping a second past paper overwrites weights and ignores earlier papers. Re-mapping the same paper inserts duplicate `paper_questions` and double-counts marks because there is no dedupe/upsert key.
- Fix: after inserting, query **all** `paper_questions` for the workspace (excluding `needs_review`) and compute weights over the full set. Add a unique constraint on `(workspace_id, document_id, question_number)` and upsert or delete-and-replace per document. Recompute topic weights atomically.

### 9. `exam` quiz mode is rejected by the generator
- Where: `src/app/diagnostic/page.tsx:108-170`, `src/app/api/quiz/generate/route.ts:25`
- Problem: the UI defines `QuizMode = "diagnostic" | "drill" | "retest" | "exam"`, but the API schema accepts only `["diagnostic", "drill", "retest"]`. Selecting "Exam simulation" and clicking generate returns `400 Invalid request parameters`.
- Fix: either add `"exam"` to the enum and implement exam semantics (timer, no confidence capture, fixed count/difficulty), or map `exam → diagnostic` in the client and label it as a simulation preview. Add a test covering every UI mode.

### 10. Topic hierarchy is never built (`parent_id` never written)
- Where: `src/app/api/topics/extract/route.ts:126-147`, `src/lib/algorithms/topic-mapper.ts` (`buildTopicTree`)
- Problem: extracted topics are inserted without `parent_id`, so `buildTopicTree` always returns flat roots. This contradicts the README's "hierarchical syllabus tree" claim.
- Fix: have extraction emit parent/child relationships (unit/module or LLM-provided parent titles), resolve them to IDs after inserting parents, and write `parent_id`. Validate no cycles before persisting.

### 11. `/api/topics/tree` is dead code
- Where: `src/app/api/topics/tree/route.ts` (no frontend caller; verified via repo-wide `fetch` search), README architecture diagram references it
- Problem: the endpoint exists and is documented as part of the flow, but nothing in the UI consumes it.
- Fix: wire it into the materials outline or gap-report page (with topic/prerequisite refresh), or remove the route and update README. Prefer wiring it once #10 is fixed.

### 12. Demo "simulate upload" produces invalid, non-persisted documents
- Where: `src/app/materials/page.tsx:319-379`
- Problem: simulated docs use `id: doc-${Date.now()}` (not a UUID) and are never sent to the pipeline. If the user then clicks extract/map on that document, route schemas reject the ID (`z.string().uuid()`), and the doc vanishes on reload.
- Fix: use `crypto.randomUUID()`, route the simulation through the real pipeline in demo mode (or a dedicated demo fixture), and/or mark these as preview-only and disable downstream actions.

### 13. Copilot never receives the active topic
- Where: `src/components/copilot-drawer.tsx:116-128`
- Problem: the request always sends `topicId: undefined`; `activeTopicTitle` is only used by the offline fallback. The API supports `topicId`, but topic-scoped retrieval never happens.
- Fix: pass `activeTopicId`/`activeTopicTitle` from the page into `CopilotDrawer` and forward the ID to `/api/copilot/chat`; keep `undefined` only when no topic is selected.

### 14. Scanned PDFs are a dead end
- Where: `src/app/api/documents/process/route.ts` (`needs_ocr`), `src/app/materials/page.tsx:180-206`, `:549-551`
- Problem: scanned PDFs transition to `needs_ocr` and stop. There is no OCR adapter, no manual "paste text" path, and no retry flow; the document can never be indexed.
- Fix: add an OCR step (e.g., server-side OCR provider/worker) or an endpoint/prompt to paste extracted text and re-chunk. At minimum add a "resolve OCR" action that accepts text and resumes indexing.

### 15. Scheduler silently drops completed tasks and reports inconsistent totals
- Where: `src/lib/algorithms/scheduler.ts:139-146`, `:222-229`, `:285-289`
- Problem: historical completed/skipped tasks are only kept if they still fit the day's budget and their original `dayNumber <= validDays`. Dropped tasks disappear from `days`, but `completedMinutes` still counts all of them; `totalAllocatedMinutes` also includes only retained tasks. Plan totals and UI progress become inconsistent.
- Fix: always retain completed/skipped history (reassign overflow to the next available day without consuming the pending budget, or add an "overflow/completed" bucket) and compute `completedMinutes` from the tasks actually retained.

### 16. Custom workspaces never get an exam date or study budget
- Where: `src/components/workspace-context.tsx:403-418`, `:458-478` (inserts `exam_date: null`, `daily_study_minutes: 60`), no UI to edit
- Problem: newly created live workspaces always have `exam_date = null`; the planner falls back to `daysRemaining = 7` and the dashboard shows no countdown. There is no onboarding/settings form to set these.
- Fix: add a workspace setup modal (title, exam date, daily minutes) backed by `PATCH /api/workspaces/[id]`, and use the persisted values in planner/dashboard.

### 17. Retest shortcuts don't preselect the topic or mode
- Where: `src/app/gap-report/page.tsx:516-521`, `src/app/planner/page.tsx:486-497`
- Problem: links go to `/diagnostic` with no query parameters, so the diagnostic page opens in default mode with its default topic set. The "Retest: <topic>" action does not actually retest that topic.
- Fix: link to `/diagnostic?mode=retest&topicId=<id>`, read the params in the diagnostic page, call `/api/quiz/generate` with `topicIds: [id]` and `quizMode: "retest"`, and preselect the mode.

---

## P2 — Logic and data-integrity bugs

### 18. Old revision plans are never deactivated
- Where: `src/app/api/planner/generate/route.ts:210-223`, `src/app/api/quiz/evaluate/route.ts:529-545`
- Problem: new/updated plans set `is_active: true`, but no other plan is set to false. `planner/generate` then picks the most recently updated active plan. Multiple active plans accumulate over time.
- Fix: inside the same transaction/sequence, set `is_active = false` for all other plans in the workspace before activating the new one. Optionally add a partial unique index on `(workspace_id) WHERE is_active`.

### 19. Demo doc metadata leaks into live hybrid retrieval
- Where: `src/lib/rag/hybrid-retrieval.ts:94-119`, `:186-197`
- Problem: `DEMO_DOCUMENTS` are always inserted into `docMap`, including in live mode. Unknown document IDs silently fall back to `"material"` and a generic filename, which can mis-filter allowed doc types and produce wrong citations.
- Fix: only seed `docMap` from `DEMO_DOCUMENTS` when running in demo mode; in live mode build the map from the caller-supplied documents. Fail/skip rather than inventing metadata for unknown IDs.

### 20. Task titles are parsed with an unsafe `split(": ")`
- Where: `src/app/api/planner/generate/route.ts:116`, `:137`, `src/app/api/quiz/evaluate/route.ts:456`
- Problem: `t.title.split(": ")[1]` loses everything after a second colon and yields `undefined` for untitled tasks. Example: `"Remediate Misconceptions: Virtual Memory: Paging"`.
- Fix: store `topic_title` on `revision_tasks`, or resolve the title from `topics` by `topic_id`. If parsing, use `indexOf(": ")` + `slice`.

### 21. Live re-plan uses stale attempt counts for blind-spot risk
- Where: `src/app/api/quiz/evaluate/route.ts:417-428`
- Problem: after grading, `rawFactors` uses `t.total_attempts` (pre-attempt value) but adds only this attempt's blind spots. This inflates `blindSpotRisk` (`blindSpots / effectiveAttempts`) and can over-prioritize topics.
- Fix: use `evalResult.masteryDeltas[t.id].totalAttempts` and the recomputed persisted `blind_spot_count` / `correctAttempts` when building priority factors.

### 22. `upload/sign` creates orphan document rows
- Where: `src/app/api/upload/sign/route.ts:78-107`, `src/app/api/documents/process/route.ts`
- Problem: the `documents` row is inserted before the storage upload. If the direct PUT or processing fails, the row stays in `uploaded`/`extracting`/`failed` forever and the UI may show a phantom document.
- Fix: insert the row after a successful upload (or reconcile on process), and add a stale-document cleanup job or a retry/delete action. Mark failed uploads explicitly and let the UI remove them.

### 23. `documents/process` trusts client-provided `fileBase64` for existing live documents
- Where: `src/app/api/documents/process/route.ts:47`, `:80-140`
- Problem: when a DB document exists, its metadata/storage path is loaded, but a supplied `fileBase64` still takes precedence. A client can overwrite the chunks of an existing document with arbitrary content, bypassing the stored object.
- Fix: when `persistToDb` and `storagePath` exist, always download from Storage. Allow base64 only for demo/offline, newly-created docs without a storage path, or an explicit validated fallback with size/hash checks.

### 24. `upload/sign` / `documents/process` accept inconsistent size limits
- Where: `src/app/api/upload/sign/route.ts:13`, `src/app/api/documents/process/route.ts:18-19`, `:141-147`
- Problem: both cap at 50MB, but the process route checks only after decoding/downloading the full buffer; there is no streaming/early rejection, so a large base64 request can consume memory first. The UI also always base64-falls back if the direct PUT fails, risking platform body limits.
- Fix: validate `Content-Length`/base64 length before decoding, stream Storage downloads, and return a clear `413` before buffering when possible.

### 25. `topics/extract` prerequisite resolution is ambiguous for duplicate titles
- Where: `src/app/api/topics/extract/route.ts:169-196`
- Problem: prerequisites are keyed by `title + unit`; the lookup first tries `titleKey(prereq.topicTitle, null)` (usually misses) then `endsWith("::title")`, which picks an arbitrary topic when the same title appears in multiple units.
- Fix: have the extractor return stable topic keys/IDs (or unit-qualified titles) and resolve prerequisites by exact key. Reject ambiguous matches instead of guessing.

### 26. Past-paper extraction invents 10 marks for unmarked questions
- Where: `src/lib/algorithms/topic-mapper.ts:410-460`
- Problem: when no marks marker is found, `currentMarks` defaults to 10. This silently skews `examWeight` and topic prioritization for papers that use totals or unmarked questions.
- Fix: mark `marks` as unknown/`null` and exclude those questions from weight computation until reviewed, or require the user to confirm marks in the mapping UI.

### 27. Citation metadata is incomplete/hardcoded
- Where: `src/app/api/gap-report/route.ts:118-130`, `src/lib/algorithms/evaluator.ts:387-397`
- Problem: `documentId` is always `""` and `docType` is always `"material"` in citations, even when the source chunk came from a syllabus or past paper. Any UI that links/verifies citations by document ID cannot work reliably.
- Fix: join `document_chunks → documents` (or fetch `documents` for the cited chunk IDs) and populate the real `documentId` and `docType`.

### 28. Client can supply grading fields to `/api/quiz/evaluate`
- Where: `src/app/api/quiz/evaluate/route.ts:25-38`
- Problem: the request schema accepts `answerKey`, `rubric`, and `explanation`. In live mode these are ignored (server loads DB rows), but in demo they are honored. Combined with #3, this lets a client control its own grade and contradicts the "zero-leak" claim.
- Fix: remove these fields from the request schema. Evaluation should only accept `questionId`, `response`, `confidence`, and display-only fields.

### 29. `saveState` can persist stale snapshots
- Where: `src/components/workspace-context.tsx:321-356`
- Problem: `saveState` builds the object from the render-time closure and is called immediately after `setState` in several handlers. Two rapid updates (e.g., `setWorkspaceTopics` + `setGapReport`) can cause the second call to overwrite the first with stale values.
- Fix: persist through a `useEffect` that watches the relevant state, or use functional updates that derive the next persisted snapshot from the latest state.

### 30. Profile/workspace provisioning in `loginCustom` is non-atomic and swallows errors
- Where: `src/components/workspace-context.tsx:430-508`
- Problem: profile insert, workspace lookup, workspace insert, and document/topic hydration run as independent browser queries; any failure is only `console.warn`ed, leaving a signed-in user with a random/incomplete workspace. On a duplicate race, `.maybeSingle()` can also throw.
- Fix: move provisioning to a server route/action using an upsert/transaction, return the canonical profile+workspace, and surface failures in the login UI.

### 31. `exam_date`, `daily_study_minutes`, and `workspace` are never updatable from the UI
- Where: `src/components/workspace-context.tsx` (state setters only), `src/app/dashboard/page.tsx`, `src/app/planner/page.tsx`
- Problem: beyond creation, no page exposes an edit flow for the workspace fields that drive the countdown and scheduler.
- Fix: add a workspace settings panel and a `PATCH /api/workspaces/[id]` route; invalidate/refetch dependent plan/gap data after saving.

### 32. Demo workspace is always authorized, even with a live session
- Where: `src/lib/supabase/auth.ts:43-48`; downstream `isDemo` branches in `upload/sign`, `planner/generate`, etc.
- Problem: `authorizeWorkspace(DEMO_WORKSPACE_ID)` returns `ok` even in live mode and always sets `isDemo: true`. Write endpoints then skip persistence, so a real user who lands on the demo workspace can "upload"/"plan" successfully while nothing is saved. This is confusing and can mask failures.
- Fix: make demo access explicit (only when unauthenticated or when a `demo` flag is set), or make demo workspaces strictly read-only and label it in the UI. Do not silently drop writes.

### 33. `DEMO_USER_ID`/fixture profile IDs do not match the seeded auth user
- Where: `.env.example:58`, `src/lib/demo/os-cs301-fixture.ts:32`, `supabase/seed/os_cs301_seed.sql:7`
- Problem: `.env.example` and the fixture use `00000000-0000-0000-0000-000000000001`, while the seed resolves the real `auth.users` ID by email. If demo data is ever persisted or joined against auth, FK/RLS assumptions break.
- Fix: remove the unused `DEMO_USER_ID` or make the fixture/seed derive the same ID; document that fixture IDs are client-only.

### 34. Retest/mode/topic state does not survive navigation
- Where: `src/app/diagnostic/page.tsx:140-229`
- Problem: mode, generated quiz, and responses are page-local; links from gap-report/planner cannot request a targeted retest, and refreshing loses an in-progress quiz.
- Fix: read `mode`/`topicId` from `useSearchParams` and initialize generation/selection; optionally persist draft responses to session storage.

---

## P3 — Incomplete features and docs drift

### 35. README claims exceed implementation
- Where: `README.md:32`, `:42`, `:59`, `:71`, `:140`
- Problem: the README claims a hierarchical topic tree, `/api/topics/tree` in the gap-report architecture, automatic persistence of plan/task progress, and a fully wired planner. The audit found the tree is flat, `/api/topics/tree` is unused, and task completion is localStorage-only.
- Fix: after fixing #4, #5, #10, #11, update the README architecture/feature matrix to match. If a claim cannot be met, remove it or mark it as demo-only.

### 36. `exam` simulation has no exam behavior
- Where: `src/app/diagnostic/page.tsx:108-170`
- Problem: even if the enum is fixed (#9), there is no timer, no section structure, no confidence suppression, and no exam-specific scoring. The label promises more than the flow provides.
- Fix: implement a timed exam runner (server-authoritative deadline, auto-submit) or rename the mode to "Practice test" and document the missing constraints.

### 37. No loading/error/empty-state handling for live hydration failures
- Where: `src/components/workspace-context.tsx:246-270`
- Problem: direct `supabase.from(...)` hydration ignores `error`; on expired sessions/RLS failures the UI silently shows empty arrays and looks like data loss.
- Fix: check and surface errors, distinguish "no data" from "failed to load", and retry/refresh the session.

### 38. No UI/API for deleting or editing a workspace, and no multi-workspace picker
- Where: `src/components/workspace-context.tsx:454-468` (picks the oldest workspace only)
- Problem: a user with multiple workspaces silently gets the oldest one; there is no create/switch/delete flow.
- Fix: add workspace list/switch/create/delete endpoints + selector in `AppShell`, and persist the active workspace ID.

### 39. Demo fixture dates are hardcoded and will expire
- Where: `src/lib/demo/os-cs301-fixture.ts:39-50` (`exam_date: "2026-12-02"`, static timestamps)
- Problem: after the hardcoded exam date, the dashboard shows `0 days left`/negative-relative messaging, and the demo plan no longer looks coherent.
- Fix: compute demo dates relative to `Date.now()` in the fixture factory (or seed), not as literals.

### 40. No regression tests for the wiring gaps above
- Where: `tests/` (474 passing tests)
- Problem: the suite tests algorithms and route handlers in isolation but not the client↔API contracts that are broken here (delete/reindex, task persistence, multi-paper weights, demo evaluation, exam mode, retest links).
- Fix: add integration tests for: (a) demo generate→evaluate yields incorrect answers for wrong responses; (b) mapping two papers yields combined weights and no duplicates; (c) dashboard/planner hydrate server state; (d) task completion PATCH round-trip; (e) `/diagnostic?mode=retest&topicId=...` requests the right topic.

---

## Suggested fix order

1. **P0 correctness/security:** #1, #2, #3 (demo evaluation), #4/#5 (persistence endpoints).
2. **P1 broken flows:** #6, #7, #8, #9, #10/#11, #12, #13, #17.
3. **P2 data integrity:** #18–#23, #27, #28, #31.
4. **P3 polish/docs:** #35–#40.

## Contract changes to introduce together

- `DELETE /api/documents/[id]`
- `POST /api/documents/[id]/reindex`
- `PATCH /api/planner/tasks` (or `/api/planner/tasks/[id]`)
- `PATCH /api/workspaces/[id]`
- Optional `POST /api/demo/quizzes` cache-backed evaluation (or keep all demo generation on fixtures)
- Unique constraint: `paper_questions (workspace_id, document_id, question_number)`
- Partial unique index: one active `revision_plans` row per workspace
