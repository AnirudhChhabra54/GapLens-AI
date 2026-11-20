# GapLens AI — Product Design & Frontend Specification

**Product:** GapLens AI  
**Tagline:** See the gaps. Master what matters.  
**Document purpose:** Single source of truth for the visual redesign, interaction design, accessibility and responsive behaviour of the complete GapLens AI website.  
**Design direction:** Warm, light, editorial, calm and data-focused.  
**Primary audience:** University students using the product, hackathon reviewers, educators and technical evaluators.

---

## 1. Product design goal

GapLens AI should feel like a carefully designed learning product, not a generic AI dashboard and not a futuristic control panel. It should help a student understand their progress, see where their understanding is weak, and decide what to study next without making them decode the interface.

The redesign must improve the whole product—not just its landing page. The dashboard, materials workspace, diagnostic experience, gap report, revision planner, Copilot and login must feel like parts of one coherent application.

### The intended experience

- **Clear:** A student should understand what a page is for within a few seconds.
- **Calm:** The interface should support concentration rather than compete for attention.
- **Trustworthy:** Metrics, citations, status labels and AI responses must represent actual application state.
- **Useful:** Each screen should make the next meaningful action obvious.
- **Accessible:** The product must work with keyboard navigation, assistive technology, readable contrast and reduced motion.
- **Consistent:** Shared components should behave and look the same across the application.
- **Responsive:** The experience should be deliberately designed for laptop, tablet and mobile—not merely shrunk to fit.

### What this is not

Do not turn the product into a beige template, a fintech clone, a generic admin dashboard or a decorative AI concept page. Warm neutrals are the foundation, but the product still needs hierarchy, a distinctive visual identity and strong data presentation.

---

## 2. Review of the current interface and required corrections

The supplied screenshots of Materials, the prerequisite graph, Diagnostic Lab, Gap Report and Revision Planner are the visual baseline for this redesign.

### Issues visible in the current screenshots

1. **Dark surfaces dominate every page.** Large areas of near-black and dark green make the application feel heavy and reduce the sense of an approachable learning environment.
2. **Green is overused.** Navigation indicators, buttons, labels, borders, badges, icons and metric highlights all compete for attention. Green should not be the brand's dominant colour.
3. **The top navigation is crowded.** Brand, workspace selector, exam countdown, page links, one-click demo and profile compete in one narrow horizontal row. Labels wrap and controls feel compressed.
4. **Too many outlined containers.** Upload areas, cards, pipeline steps, document metadata and controls all have similar borders. The interface lacks a clear distinction between primary and secondary information.
5. **Technical micro-labels make the product feel artificial.** Labels such as “SYSTEM 03 / KNOWLEDGE REPOSITORY”, “HERO EVIDENCE REPORT”, “KNAPSACK PACKING” and frequent all-caps monospace text do not help students complete tasks.
6. **The Materials page gives the upload panel too much space.** The ingestion pipeline is always visible beside it, while the indexed documents are presented as cards that leave an awkward incomplete grid.
7. **The topic hierarchy is not visually telling the story of prerequisites.** The current graph view resembles a grid of individual module cards with large blank areas. Topic relationships should be the primary information, with an accessible outline alternative.
8. **The Diagnostic Lab has too many mode cards.** Four equally prominent mode panels compete with the actual question. The question and answer controls should be the focal point.
9. **The Gap Report uses competing large panels.** Coverage, mastery and calibration are given similar visual weight even though the student needs a clear headline diagnosis and next action. The large urgent queue and bright warning treatment are visually aggressive.
10. **The Planner repeats summary information in cards.** Large metric cards, a large budget panel, an invariants panel and two-column task queues create unnecessary visual weight. The task plan should be easier to scan and act on.
11. **The sample identity and shortcut need to go.** Remove the “1-Click Judge Demo” action. Do not show a sample user such as “Alex” unless that is the real authenticated user's profile information.
12. **Dates and metrics must be real.** The UI must not display stale seeded dates as though they are current, invented exam countdowns, fake upload success or made-up usage values.

### Required direction

Use a warm light canvas, readable dark text, restrained slate-blue primary actions, selective warm clay accents, quiet separators and generous whitespace. Use colour to communicate state, not as decoration.

---

## 3. Brand and visual identity

### Brand character

GapLens AI should communicate:

- Clarity rather than hype.
- Evidence rather than guesswork.
- Progress rather than pressure.
- Focus rather than visual noise.
- Intelligence without pretending to be a futuristic machine interface.

Use the product name consistently as **GapLens AI**. Do not randomly switch between “GAPLENS / AI”, “GapFinder”, “Academic Intelligence” and other labels. The tagline is **See the gaps. Master what matters.**

### Colour system

The palette below is the default design system. It is intentionally neutral, warm and low-saturation. Green is not a brand colour and must not dominate the product.

| Token | Hex | Usage |
|---|---|---|
| `--color-canvas` | `#F7F5F0` | Main page background; warm ivory |
| `--color-surface` | `#FFFEFC` | Main content surfaces and forms |
| `--color-surface-subtle` | `#F2EFE8` | Secondary sections and quiet panels |
| `--color-surface-muted` | `#EAE6DE` | Selected neutral areas and disabled surfaces |
| `--color-text` | `#252A2E` | Primary headings and body text |
| `--color-text-secondary` | `#5E666A` | Supporting copy and labels |
| `--color-text-muted` | `#687176` | Secondary metadata; do not reduce contrast further for small text |
| `--color-border` | `#E2DED6` | Dividers, field borders and card edges |
| `--color-border-strong` | `#CFC8BD` | Focus-adjacent and emphasized boundaries |
| `--color-accent` | `#4C6477` | Primary actions, links and active navigation |
| `--color-accent-hover` | `#3C5264` | Hover and pressed primary action |
| `--color-accent-soft` | `#E9EFF2` | Selected navigation, soft information panel |
| `--color-warm-accent` | `#85553F` | Occasional editorial emphasis and warm action accents |
| `--color-warm-soft` | `#F3E8E1` | Soft warm highlight backgrounds |
| `--color-success` | `#356A57` | Successful status only |
| `--color-success-soft` | `#E7F0EA` | Soft success background |
| `--color-warning` | `#8B5E1A` | Warning and attention states |
| `--color-warning-soft` | `#F5EEDC` | Soft warning background |
| `--color-danger` | `#8E4E4A` | Errors and weak mastery state |
| `--color-danger-soft` | `#F5E8E6` | Soft error background |
| `--color-info` | `#4C6477` | Information state |

#### Colour proportions

As a rough visual guide:

- 70–80% warm ivory, white and neutral surfaces.
- 10–20% secondary neutral surfaces and borders.
- 5–10% accent and semantic colours.

These are visual proportions, not a rule that every component must be measured. The key requirement is that the interface remains predominantly light and neutral.

#### Colour rules

- Do not use neon green, emerald glow, dark green page backgrounds or luminous green borders.
- Do not use gradients as a default fill. Use flat colours unless a very subtle tonal transition has a specific purpose.
- Primary buttons should use slate-blue with white text, not bright green.
- Use the warm clay accent sparingly; it is not a second primary colour.
- Weak, developing and strong states must have both text labels and visual indicators. Colour alone must never carry meaning.
- Avoid using red for large blocks of content. Reserve it for the specific issue that needs attention.
- Check actual contrast ratios for all text and interactive states against their rendered backgrounds.

### Typography

Use a modern, highly readable sans-serif family already present in the project if it is suitable. If the current font is not suitable, choose one family for the product and use it consistently. Do not add several decorative font families.

Suggested hierarchy:

| Role | Desktop guide | Mobile guide | Weight |
|---|---:|---:|---|
| Landing hero | 52–64px | 38–44px | 600–700 |
| Page title | 32–40px | 28–32px | 600–650 |
| Section heading | 20–24px | 18–20px | 600 |
| Card / panel heading | 16–18px | 16–18px | 600 |
| Body | 15–16px | 15–16px | 400 |
| Supporting copy | 14–15px | 14–15px | 400 |
| Metadata | 12–13px | 12–13px | 500 |

Use a comfortable line-height: approximately 1.45–1.6 for body text and 1.1–1.25 for large headings. Avoid using monospace for ordinary labels and all body content. Reserve monospace for code, IDs, compact technical values or source metadata where it improves recognition.

### Shape, borders and elevation

- Use a consistent radius scale: 6px for compact controls, 10px for standard surfaces, 14px for larger panels and 18px only for prominent feature areas.
- Prefer 1px neutral borders over heavy outlines.
- Use shadows sparingly: a soft shadow can separate a menu or floating drawer, not every card.
- Avoid nested cards. A panel inside a card inside another card should be redesigned as a flat section with clear dividers.
- Use icons from the existing icon library consistently. Do not use emoji as interface icons.

---

## 4. Layout system and application shell

### Main application layout

Replace the crowded single-row navigation visible in the screenshots with a clear authenticated workspace shell.

#### Desktop

- A left sidebar approximately 232–256px wide.
- A compact top utility bar approximately 60–68px high.
- A content area with a maximum width around 1,280–1,360px.
- Main content padding around 28–40px depending on viewport width.
- Sidebar can collapse to an icon rail if the existing app architecture supports it cleanly.

#### Sidebar navigation

Use plain, understandable labels:

1. Overview
2. Course materials
3. Diagnostic lab
4. Learning gaps
5. Study plan

The sidebar should also include the GapLens AI wordmark, a workspace/course selector where needed, and an account section at the bottom. A selected link should use a quiet slate-blue surface and clear text—not a glowing underline or neon indicator.

#### Top utility bar

Keep only context-specific controls, such as the active course selector, a real exam date/countdown when configured, and the authenticated user's account menu. Do not repeat the entire page navigation in the top bar.

Do not show a global exam countdown if the course has no configured exam date. In that case show a neutral “Exam date not set” state or omit the countdown.

#### Mobile

- Use a compact header with brand and a menu button.
- Put navigation in an accessible drawer or sheet.
- Keep the main content full width with 16–20px side padding.
- Do not squeeze desktop navigation into the header.
- Keep primary actions visible without requiring awkward horizontal scrolling.

### Page header pattern

Each internal page should use a consistent, simple header:

- Small breadcrumb only when it helps orientation.
- Clear page title in sentence case.
- One short sentence describing the page's purpose.
- A right-side primary action only when the page has a genuine primary action.
- Optional inline counts or context values beneath the description.

Remove artificial labels such as “SYSTEM 03 / KNOWLEDGE REPOSITORY”, “SYSTEM 04 / DIAGNOSTIC ENGINE”, “HERO EVIDENCE REPORT” and similar internal code names. These are not useful to students.

---

## 5. Page-by-page design specification

## 5.1 Public landing page

### Purpose
Explain the value of GapLens AI and give visitors a clear path to reviewer sign-in. The landing page is public; the learning workspace is protected.

### Suggested content

**Headline:** “See the gaps. Master what matters.”

**Supporting copy:** “Understand what you know, find the concepts you are missing, and focus your study time where it can make the biggest difference.”

**Primary CTA:** “Reviewer sign in”  
**Secondary CTA:** “Explore how it works”

### Layout

1. A restrained header with the GapLens AI wordmark, a few anchor links and a sign-in action.
2. A balanced hero: message on one side, a genuine product preview on the other. On mobile, stack the message and preview.
3. A short “How it works” section with four to six understandable stages.
4. A few capability sections that explain the actual product rather than repeating feature-card templates.
5. Real screenshots or genuine rendered product excerpts where available.
6. A clear final sign-in action and a compact footer.

### Hero visual

Use a screenshot or composed preview of the actual application. If using a decorative illustration, make it subtle and supportive. Do not create a random particle cloud, neon neural brain, fake 3D data structure or a large animated ornament merely to fill the page.

### Remove

- “1-Click Judge Demo” and every variation of the one-click demo shortcut.
- Fake visitor metrics, fake student counts and unverified product claims.
- Unnecessary system labels and pseudo-terminal language.

---

## 5.2 Reviewer login

### Purpose
Give authorized reviewers a straightforward way to access the seeded CS-301 workspace.

### Layout

- Calm, light background.
- A compact sign-in panel, not a full-page marketing form.
- GapLens AI name and a one-sentence explanation: “Sign in to access your learning workspace.”
- Email field.
- Password field with show/hide control.
- Primary “Sign in” button.
- Clear inline errors and loading feedback.

### Authentication rules

- Remove all public registration and one-click demo controls.
- The reviewer account is provisioned separately through Supabase Auth by an authorized administrator.
- Do not hardcode a reviewer email or password in source code, README, client bundles or screenshots.
- Do not place the reviewer password in Vercel environment variables.
- Do not store the reviewer password in localStorage.
- Server-side session checks and existing RLS/ownership checks remain mandatory.
- Direct navigation to protected pages and direct API calls must be rejected without a valid session.
- After successful sign-in, route to the assigned CS-301 workspace.
- After sign-out, clear the session and return to the public landing page.

The sign-in UI must not imply that the reviewer has permissions beyond the assigned workspace.

---

## 5.3 Dashboard / Overview

### Purpose
Answer three questions immediately:

1. How prepared am I?
2. What needs attention?
3. What should I study next?

### Recommended hierarchy

**First row — Course context**

- Course name and course code.
- Exam date or a clear not-configured state.
- A single useful primary action, such as “Continue studying”.

**Primary overview — Preparation coverage**

- One prominent coverage figure.
- A clear explanation of what the figure represents.
- Assessed topic count, e.g. “6 of 10 topics assessed”, only if that is the real state.
- Avoid presenting coverage as a precise prediction of exam results.

**Learning status — Topic mastery**

- A compact distribution of weak, developing, strong and unassessed topics.
- A readable list of the two or three topics needing attention.
- A link to the full Learning Gaps report.

**Today — Recommended work**

- The next one to three revision tasks.
- Time estimate and source reference.
- A clear action to open the relevant task.

**Recent progress**

- Only show recorded assessment or task activity.
- Do not invent activity when no attempts have been recorded.

### Avoid

- A row of six or more equal-sized metric cards.
- A giant radial chart with no explanation.
- Duplicating the same coverage number in multiple places.
- Hardcoded “14 days left” labels when an actual exam date is unavailable.

---

## 5.4 Course materials

The supplied screenshot currently combines a large upload dropzone, a permanently visible ingestion pipeline and a grid of document cards. The redesign should make the document workspace easier to scan and reduce unnecessary visual weight.

### Page heading

**Title:** “Course materials”  
**Description:** “Manage the notes, syllabus and past papers used to build your course map and source-backed assessments.”

### Upload experience

- Use a clear “Upload material” action near the page heading.
- The drop area should be compact and expand when the user chooses to upload or drags a file into it.
- Explain the accepted formats and the verified size limit from the current backend.
- Support PDF, TXT and Markdown only if the current upload implementation supports them.
- Allow the user to select a file using a labelled file input.
- Do not claim upload success until the storage transfer and processing steps have actually succeeded.

### Upload states

1. Empty: “Drop a file here or choose a file.”
2. Selected: show file name, type and size, with remove/replace action.
3. Uploading: real progress if available; otherwise use an honest indeterminate indicator.
4. Processing: show current stage such as extracting text, splitting sections or indexing.
5. Complete: show indexed status and document details.
6. Needs OCR: explain that the PDF appears to contain scanned pages and text extraction was not available.
7. Failed: show a useful error and retry action.

Never simulate a real upload with a fake progress timer and then label the document as indexed.

### Document list

Prefer a clean table or compact list over a three-column card grid. Each document row should show:

- Document name.
- Type (Syllabus, Notes/Material, Past paper).
- Pages, if known.
- Chunks, if indexed.
- Processing status.
- Last updated, if available.
- A contextual action menu.

Do not show version, size or chunk counts in a heavy dark inset box. Put secondary metadata in one quiet line or an expandable detail row.

Support filters such as All, Syllabus, Notes and Past papers. Filters must change the displayed list and expose their selected state accessibly.

### Ingestion details

The five-stage pipeline from the current screenshot is useful, but it should not permanently occupy half the page. Present it as:

- A compact status stepper for the currently selected document; or
- An expandable “Processing details” panel.

Stages should reflect actual backend progress. Do not show an “Idle” pipeline beside every page when no file is being processed.

---

## 5.5 Topic hierarchy and prerequisite map

The current screenshot displays many module cards with one topic inside each card, leaving a large amount of unused space and making actual dependency relationships hard to see.

### Primary experience

Present the syllabus as a coherent curriculum structure. The main view should help a student understand:

- Which topics belong to each module/unit.
- Which topics are prerequisites for others.
- Which topics are weak or strong based on observed assessment evidence.
- Which dependencies may block progress.

### View modes

Provide two clear, functional views:

1. **Dependency map:** a true node-and-edge view using the existing graph library, if available.
2. **Outline:** an accessible hierarchical list grouped by module/unit.

Do not use a grid of separate module cards as a substitute for a knowledge graph.

### Dependency map behaviour

- Use readable node sizes and labels.
- Use consistent edge directions and unobtrusive connectors.
- Avoid crossing edges where the layout engine can reduce them.
- Keep status labels visible without relying on coloured borders alone.
- Selecting a node opens a topic detail panel with mastery, exam importance, attempts, prerequisites and downstream topics.
- Include fit-to-view and zoom controls only if they are useful and accessible.
- Provide an equivalent outline/list view for keyboard and screen-reader users.

### Topic status

Use plain labels such as “Needs work”, “Developing”, “Strong” and “Not assessed”. Show the actual mastery value only if it is based on recorded data. Explain that an unassessed topic is unknown, not automatically weak.

---

## 5.6 Diagnostic Lab

The diagnostic experience should prioritize the question. The current screenshot gives four mode cards equal visual prominence and adds a separate integrity panel. Reduce this competition.

### Page heading

**Title:** “Check your understanding”  
**Description:** “Answer questions based on your course material. Rate your confidence before your result is revealed.”

### Assessment header

Show:

- Assessment mode in a compact selector or segmented control.
- Question progress, e.g. “Question 2 of 5”.
- Topic and difficulty.
- A clear progress bar with accessible text.

Avoid four large mode cards above the main question. Use a compact selector with a short explanation of the selected mode.

### Question layout

- Keep the question within a readable max width of approximately 760–820px.
- Present the question in a clear, high-contrast content area.
- MCQ options should be full-width selectable rows with a visible radio/selected state.
- Short-answer controls should have a visible label and helpful placeholder.
- Keep answer option text readable; do not make it tiny or low-contrast.

### Confidence capture

Confidence is a core differentiator. Make it easy to understand without making it look like a developer control.

Use three clearly labelled choices:

- Low confidence
- Medium confidence
- High confidence

Include a short explanation: “Rate how sure you are before seeing the result.” Ensure the choice is recorded before grading and do not reveal answer correctness prematurely.

### Actions

- Primary action: “Continue” or “Submit assessment”, depending on the actual step.
- Secondary action: “Previous”.
- Clearly show whether an answer is required before continuing.
- Prevent duplicate submissions while a request is pending.

### Feedback after submission

Show:

- Correct/incorrect result.
- Short explanation based on the evaluator.
- The cited source document and page/section where available.
- The mastery or confidence insight only when the backend returns it.
- A clear next action.

Keep answer keys and rubrics server-side. The frontend redesign must not change the zero-leak projection rules.

### Supporting information

Move technical integrity explanations into a small “How this assessment works” disclosure. They should not compete with the question.

---

## 5.7 Learning Gaps / Gap Report

This is the product's most distinctive page. It should feel like a clear diagnostic report, not a wall of dashboards.

### Page heading

**Title:** “Your learning gaps”  
**Description:** “See which topics need attention, what your answers reveal and where to focus next.”

Avoid the current dramatic phrase “Where Your Understanding Breaks”. The product should identify gaps without shaming the student.

### Recommended information hierarchy

**A. Preparation summary**

- One clear Preparation Coverage measure.
- A concise description of its basis.
- Number of assessed topics and total topics.
- A visible sample-size note where relevant.

Do not imply this is an exam score or guaranteed pass probability.

**B. Topic mastery overview**

- A compact distribution of Needs work, Developing, Strong and Not assessed.
- A sortable topic list or matrix.
- Each topic should show mastery, assessment evidence count and exam importance where available.

**C. Confidence calibration**

- Show high-confidence incorrect answers and low-confidence correct answers separately.
- Display denominators, e.g. “2 of 3 answers”, so percentages are not misleading.
- Explain what the measure means in plain language.
- Do not display a strong conclusion from a very small sample without qualification.

**D. Priority recommendations**

Present a concise “Recommended next steps” section. Use one or two priority items with a reason and a direct link to the relevant study task.

Avoid a large alarming red panel spanning the page. Use a restrained warning icon, a clear heading and a quiet tinted background.

**E. Evidence ledger**

Each insight should allow the student to inspect:

- Topic.
- Observed answer or assessment result.
- Why it was flagged.
- Verified source excerpt.
- Document name and page/section.
- Suggested next step.

Make the evidence expandable. Do not truncate the source title to the point that it becomes unrecognizable. Provide a full title in the expanded state or tooltip.

### Trust rules

- Show “Not enough evidence yet” when there are too few attempts.
- Distinguish measured mastery from estimated or prior-based mastery.
- Do not show a 0% calibration rate when the correct interpretation is “no qualifying observations”.
- Never invent source citations or quotes.
- Use dates and answer history from actual stored records.

---

## 5.8 Study plan / Revision Planner

The current screenshot has four large summary cards, a large time-budget panel beside a separate invariant panel, and a two-column queue. Simplify the hierarchy and make tasks easier to follow.

### Page heading

**Title:** “Your study plan”  
**Description:** “A realistic schedule based on your priorities and the time you have available.”

### Summary

Use a compact summary row rather than four oversized cards. Useful values include:

- Daily study budget.
- Time allocated.
- Tasks remaining.
- Deferred tasks, if any.

Only show values derived from the current plan.

### Time budget control

- Put the selected number of minutes beside a clearly labelled slider or numeric input.
- Provide a small set of useful presets (e.g. 30, 45, 60, 90 minutes) only if supported by the algorithm's limits.
- Explain that the schedule will update when the budget changes.
- Support keyboard operation and direct numeric entry where practical.
- Ensure total scheduled time never exceeds the selected daily budget.

### Schedule layout

Prefer a clean day-by-day timeline or stacked list over two dense columns of full-width task cards.

A task should show:

- Task name.
- Topic.
- Task type.
- Duration.
- Priority or reason for recommendation.
- Source material link, if available.
- Completion state.

Use a compact row with a clear expand/detail affordance. Do not repeat an “Ask Copilot” button on every task if it adds clutter. Put the Copilot action in the task detail or a consistent global entry point.

### Task states

- Pending.
- In progress, if the data model supports it.
- Completed.
- Deferred/not scheduled.
- Skipped, if supported.

Completed tasks should be visually distinct but still readable. Do not rely only on strikethrough and a green checkmark.

### Dates

Do not display old seed dates as if they are current. Render relative labels such as “Today”, “Tomorrow” and “Day 3” from the plan's actual dates. If a plan is a static synthetic example, label it as sample data and avoid presenting it as a current personal calendar.

### Copilot entry

Use a single clear “Ask the study assistant” action that opens a responsive side drawer on desktop and a full-height sheet on mobile.

---

## 5.9 Study Copilot

The Copilot should feel like a contextual learning assistant, not a generic chat clone.

### Layout

- Desktop: side drawer or panel that preserves access to the current task/topic.
- Mobile: full-screen sheet with a clear close/back action.
- Clear assistant heading and the selected course/topic context.
- Readable conversation width and comfortable line length.
- Composer anchored at the bottom without covering messages.

### Response presentation

- Use typography that supports explanations, steps and short lists.
- Display citations close to the claims they support.
- Make citation details expandable to show document, page and excerpt.
- Show a clear evidence-unavailable refusal when the material does not support an answer.
- Preserve conversation loading, error and retry states.
- Never fabricate a source citation or imply that a response was grounded if retrieval failed.

### Suggested prompts

Offer two or three context-aware example questions only when they are grounded in the current course or topic. Do not use random generic prompts.

---

## 6. Shared components and interaction rules

Build a small, coherent component system. Reuse components where their purpose and behaviour are genuinely shared.

### Core components

- `AppShell` and responsive navigation.
- `PageHeader` and breadcrumb.
- `Button` variants: primary, secondary, quiet, destructive.
- `FormField`, `Input`, `Select`, `Textarea` and validation message.
- `StatusBadge` with text and icon/shape.
- `Metric` for compact summary values.
- `ProgressBar` and accessible progress text.
- `TopicStatus` and `MasteryIndicator`.
- `DocumentRow` and `DocumentStatus`.
- `EvidenceCitation` and `EvidenceDisclosure`.
- `EmptyState`, `ErrorState`, `LoadingSkeleton` and `InlineNotice`.
- `Dialog`, `Drawer` and mobile sheet.
- `StudyTaskRow` and `StudyDayGroup`.

### Buttons

- Every button must have a clear verb-based label.
- Primary action: one main action per major section.
- Secondary action: lower visual weight.
- Destructive action: explicit confirmation when data may be deleted.
- Disabled controls must explain why they are unavailable when the reason is not obvious.
- Provide visible hover, active, disabled and focus states.

### Forms

- Every input has a persistent visible label.
- Placeholder text is not a replacement for a label.
- Validation messages identify the field and explain how to correct it.
- Preserve the user's input when a non-destructive validation error occurs.
- Announce async success/failure messages to assistive technology.

### Feedback

Use inline notices for local context. Use toasts only for short, non-critical feedback. Do not use a toast as the only place an important error is communicated.

---

## 7. Accessibility requirements

Accessibility is a release requirement, not optional polish. Target **WCAG 2.2 AA** for the implemented interface where applicable.

### Colour and contrast

- Normal text: minimum contrast ratio 4.5:1.
- Large text: minimum 3:1.
- Essential UI boundaries and graphical indicators: minimum 3:1 against adjacent colours.
- Check muted metadata. Do not make small labels so pale that they become decorative rather than readable.
- Do not rely on colour alone to identify weak/strong topics, errors, selected controls or completed tasks.

### Keyboard and focus

- Every interactive element must be keyboard reachable.
- Preserve a logical tab order.
- Provide a clearly visible focus ring.
- Dialogs and drawers must manage focus, close with Escape where appropriate and return focus to the trigger.
- Do not use clickable `div` elements where a button or link is appropriate.
- Graph interactions must have an equivalent keyboard-accessible outline view.

### Semantics and assistive technology

- Use semantic page landmarks: header, nav, main, aside and footer where appropriate.
- Maintain a logical heading hierarchy.
- Give icon-only buttons accessible names.
- Provide labels for all inputs.
- Use `aria-live` or appropriate status semantics for async upload, processing and assessment feedback.
- Give charts a text summary and accessible data alternative.
- Ensure progress indicators expose their current value and label.

### Motion and input

- Respect `prefers-reduced-motion`.
- No essential information may depend on animation.
- Avoid rapid flashing or large parallax effects.
- Maintain adequate touch target sizes (aim for at least 44×44 CSS pixels for primary mobile controls).

---

## 8. Responsive design requirements

Verify at the following viewports:

| Viewport | Purpose |
|---|---|
| 1440 × 900 | Large desktop |
| 1280 × 800 | Standard laptop |
| 1024 × 768 | Small laptop / landscape tablet |
| 768 × 1024 | Tablet portrait |
| 390 × 844 | Modern mobile |
| 360 × 800 | Narrow mobile |

### Responsive rules

- No horizontal page overflow.
- No navigation label wrapping into unreadable fragments.
- Tables should become scrollable with a clear affordance or transform into stacked rows on mobile.
- Charts should resize and retain their labels; if necessary, show a simplified visualization and detailed text list.
- The prerequisite graph should support zoom/pan on touch only if controls are usable; otherwise, default mobile to the outline view.
- Diagnostic answers must be comfortably tappable.
- The planner must not require horizontal scrolling to see task duration or completion state.
- Copilot must use the full mobile viewport when open.
- Keep page gutters consistent and content readable at all widths.

---

## 9. Content and language style

Use natural, student-friendly language. Be specific and calm. Do not make ordinary actions sound like engineering operations.

### Preferred copy examples

| Avoid | Prefer |
|---|---|
| `SYSTEM 03 / KNOWLEDGE REPOSITORY` | `Course materials` |
| `INGESTION & TOPOLOGY` | `Documents and topics` |
| `Where Your Understanding Breaks` | `Your learning gaps` |
| `HERO EVIDENCE REPORT` | Remove it |
| `KNAPSACK PACKING` | `Study time allocation` |
| `Active Fixture` | `Sample course data` when applicable |
| `Grounded Topics` | `Topics mapped` |
| `Indexed Course Materials` | `Your course materials` |
| `Launch Study Copilot` | `Ask the study assistant` |
| `Blind Spot` without explanation | `High-confidence mistake` with a short explanation |

### Writing rules

- Use sentence case for headings and controls.
- Keep helper text to one or two short sentences.
- Explain technical terms when students need them.
- Reserve “RAG”, “RRF”, “Bayesian”, “vector” and other implementation vocabulary for an optional technical explanation or documentation.
- Do not use fake urgency. Avoid dramatic labels like “URGENT REMEDIATION” unless the product's data truly indicates an urgent deadline.
- Never imply a student's ability or intelligence is poor. Describe the evidence and next action, not the person.

---

## 10. Data integrity and realistic UI behaviour

The interface must display application state, not invented content.

### Metrics

- Read values from the existing workspace and assessment state.
- Show sample sizes and denominators where percentages are derived from a small number of answers.
- Do not display stale exam countdowns.
- Do not show “indexed” before document processing and indexing have succeeded.
- Do not claim a file upload is complete if only a local file selection occurred.
- Do not present offline/mock AI output as live Groq or Jina output.

### Synthetic demo data

The Operating Systems CS-301 dataset is synthetic demonstration content. When the user is in that workspace, label it as sample course data in an appropriate low-emphasis location. Do not repeat a warning on every screen.

### Empty states

Design useful empty states for:

- No course materials.
- No mapped topics.
- No assessments completed.
- No mastery evidence yet.
- No blind spots detected.
- No revision tasks available.
- No Copilot conversation.

Each empty state should explain what is missing and provide one clear next action when possible.

### Error states

Design actionable errors for:

- Authentication/session expiry.
- File type or size not supported.
- Upload failure.
- Processing failure.
- OCR-required PDF.
- AI provider rate limit.
- AI provider unavailable.
- Retrieval found no relevant evidence.
- Database/network failure.
- Unauthorized workspace access.

Do not expose raw stack traces, API keys, database details or internal provider responses to users.

---

## 11. Reviewer access and public site behaviour

The public landing page may be viewed without authentication. The learning workspace must require a valid authenticated session.

- Remove the “1-Click Judge Demo” control from every page and component.
- Remove automatic demo login and any client-side demo bypass.
- Provide a “Reviewer sign in” or “Sign in” action on the public site.
- Do not provide public self-registration unless the product requirements explicitly change.
- The reviewer account should be provisioned through Supabase Auth by an administrator.
- The reviewer Auth user must be associated with the intended CS-301 workspace using the real Auth user UUID.
- Protect all workspace pages and API routes server-side.
- Continue enforcing workspace ownership and RLS. Hiding a navigation item is not authorization.
- Never store reviewer passwords in source code, localStorage, public documentation or Vercel variables.
- Do not show a fictional user name such as “Alex”. Display the authenticated profile name or a neutral account label.

This document describes the UI and expected auth behaviour; it does not authorize changes to the existing Supabase schema or RLS architecture.

---

## 12. Motion and visual feedback

Keep motion subtle and purposeful.

Allowed examples:

- Short hover/focus transitions.
- Smooth drawer and dialog transitions.
- Progress bar updates after a real state change.
- Expand/collapse for evidence and topic details.
- Small chart transitions when data changes.

Avoid:

- Always-moving background particles.
- Neon glows.
- Repeated scroll-trigger animations on every section.
- Large parallax layers.
- Long page transitions.
- Animations that delay input or navigation.

Use a consistent short transition range, generally around 120–200ms for simple controls. Respect reduced-motion preferences and disable nonessential transitions when requested.

---

## 13. Technical implementation constraints

This is a frontend redesign, not permission to rebuild the product.

### Preserve

- Existing Next.js App Router architecture.
- TypeScript types and validation.
- Current API route contracts.
- Supabase Auth and SSR session handling.
- Workspace ownership and RLS protections.
- Groq generation integration.
- Jina embedding integration.
- Existing RAG pipeline and citation verification.
- Materials upload and document processing.
- Diagnostic question and answer evaluation.
- Confidence calibration and mastery reconstruction.
- Gap Report data calculations.
- Revision scheduling and task persistence.
- Copilot grounding and refusal behaviour.
- Existing test fixtures and demo state persistence, except removal of the obsolete one-click auth bypass.

### Implementation approach

1. Inspect the current components and identify reusable parts.
2. Create centralized design tokens in the existing styling approach.
3. Implement the new application shell and navigation.
4. Implement the shared component patterns.
5. Redesign one page at a time.
6. Wire every component to existing state and API data.
7. Verify functionality before moving to the next page.
8. Refine actual rendered screenshots at each viewport.

Use the project's installed libraries where possible. Do not add a large UI or animation dependency without a clear reason. Do not introduce a second design system that conflicts with the existing one.

### Code quality

- Use typed component props.
- Avoid duplicated page-specific CSS where a shared component is appropriate.
- Keep components readable and reasonably sized.
- Avoid global selectors that unintentionally alter unrelated components.
- Keep state management in the existing architecture.
- Do not build decorative controls with no behaviour.

---

## 14. Visual QA and acceptance checklist

A page is not complete because the code compiles. The actual rendered page must be inspected.

### Visual review

For every route, inspect:

- First viewport composition.
- Page title and supporting text.
- Content alignment and max width.
- Typography hierarchy.
- Spacing rhythm.
- Button and field consistency.
- Border and shadow restraint.
- Data visualization readability.
- Empty/loading/error states.
- Mobile layout.

### Functional review

Verify:

- Public landing page loads without a session.
- Reviewer login works with the provisioned Supabase account.
- Unauthenticated users cannot access workspace routes or APIs.
- Sidebar navigation points to the correct routes.
- Workspace and profile labels use real session data.
- Materials filters work.
- File selection, upload and processing statuses are accurate.
- Topic map and outline view show the same underlying topic data.
- Diagnostic mode selection works.
- Answers and confidence are captured correctly.
- Answer correctness is not exposed before submission.
- Gap Report values update from real assessment results.
- Evidence citations expand and point to actual sources.
- Planner budget changes repack the schedule correctly.
- Completed tasks remain completed after a refresh where persistence is expected.
- Copilot citations and refusal behaviour remain intact.
- Sign-out clears the session.

### Accessibility review

- Keyboard-only navigation works.
- Focus is visible.
- Labels and accessible names exist.
- Dialog and drawer focus is managed.
- Text and control contrast meet target requirements.
- Charts have text alternatives.
- Status is not colour-only.
- Reduced motion works.

### Technical gates

Run the actual scripts defined by `package.json`, including the equivalent of:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If Playwright or another real browser test runner is installed, use it for key flows and screenshots. Do not label Vitest/jsdom tests as real browser E2E tests. Do not claim a viewport has been visually verified unless it was actually inspected.

---

## 15. Suggested design tokens

Implement these as CSS custom properties or the project's existing token mechanism. Adapt the syntax to the current codebase rather than introducing a conflicting system.

```css
:root {
  --color-canvas: #F7F5F0;
  --color-surface: #FFFEFC;
  --color-surface-subtle: #F2EFE8;
  --color-surface-muted: #EAE6DE;

  --color-text: #252A2E;
  --color-text-secondary: #5E666A;
  --color-text-muted: #687176;

  --color-border: #E2DED6;
  --color-border-strong: #CFC8BD;

  --color-accent: #4C6477;
  --color-accent-hover: #3C5264;
  --color-accent-soft: #E9EFF2;

  --color-warm-accent: #85553F;
  --color-warm-soft: #F3E8E1;

  --color-success: #356A57;
  --color-success-soft: #E7F0EA;
  --color-warning: #8B5E1A;
  --color-warning-soft: #F5EEDC;
  --color-danger: #8E4E4A;
  --color-danger-soft: #F5E8E6;

  --radius-control: 6px;
  --radius-card: 10px;
  --radius-panel: 14px;
  --radius-feature: 18px;

  --shadow-menu: 0 8px 24px rgba(37, 42, 46, 0.10);
  --shadow-dialog: 0 16px 48px rgba(37, 42, 46, 0.16);
}
```

The muted text and accent values have been selected to provide a useful contrast baseline on the proposed light surfaces, but all rendered component combinations must still be checked. Do not lower opacity on text to create hierarchy if it makes the content unreadable.

---

## 16. Definition of done

The redesign is accepted only when all of the following are true:

1. The overall website is predominantly light, warm and neutral—not green-heavy.
2. The main content surfaces use ivory, white and restrained beige.
3. Slate-blue is the primary interactive accent; clay is used sparingly.
4. The application no longer uses the old crowded top navigation.
5. The 1-Click Judge Demo and automatic demo login are removed.
6. The public landing page and reviewer login are clear and polished.
7. Every authenticated screen has been redesigned, not only the landing page.
8. Materials and topic hierarchy are easier to scan and understand.
9. The Diagnostic Lab gives the question and answer controls visual priority.
10. The Gap Report communicates evidence, confidence and next steps clearly.
11. The Planner is easy to scan and does not present stale dates or fake metrics.
12. The Copilot remains readable, source-grounded and usable on mobile.
13. No dead buttons, fake upload states or invented statistics are introduced.
14. The UI meets the stated accessibility and responsive requirements.
15. Existing backend behaviour, API contracts, data integrity and security are preserved.
16. All applicable typecheck, lint, test and production build commands pass.
17. Any unverified visual or live-integration behaviour is explicitly reported rather than claimed as complete.

**Final standard:** The result should look like a real product made for students: calm enough to study in, clear enough to trust, accessible enough to use, and polished enough to show to a reviewer. Every design decision should improve understanding or usability. If a visual effect does not serve that purpose, leave it out.
