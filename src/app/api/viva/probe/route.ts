// ==============================================================================
// GapLens AI — Sub-Second Oral Viva / Follow-Up Interrogation API Route
// POST /api/viva/probe
// Conducts a multi-turn technical viva, probing hesitations or shallow answers
// using Groq sub-second inference grounded in workspace syllabus/chunks.
// ==============================================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeWorkspace } from "@/lib/supabase/auth";
import { generateStructured } from "@/lib/ai/provider";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

const VivaTurnSchema = z.object({
  role: z.enum(["examiner", "student"]),
  text: z.string(),
});

const VivaProbeRequestSchema = z.object({
  workspaceId: z.string().uuid("Invalid workspace ID"),
  topicTitle: z.string().min(1),
  history: z.array(VivaTurnSchema).default([]),
  studentReply: z.string().optional(),
});

const VivaProbeResponseSchema = z.object({
  examinerPrompt: z.string(),
  assessmentNote: z.string(),
  depthScore: z.number().min(0).max(100),
  isComplete: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = VivaProbeRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid viva request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { workspaceId, topicTitle, history, studentReply } = parsed.data;
    const auth = await authorizeWorkspace(workspaceId);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const rl = checkRateLimit(`viva:${auth.userId}`, 40, 60_000);
    if (!rl.allowed) {
      return rateLimitExceededResponse(rl.retryAfterSeconds);
    }

    const turnCount = history.filter((h) => h.role === "student").length + (studentReply ? 1 : 0);
    const transcript = [
      ...history.map((h) => `${h.role === "examiner" ? "Examiner" : "Student"}: ${h.text}`),
      ...(studentReply ? [`Student: ${studentReply}`] : []),
    ].join("\n");

    const prompt = `Topic under examination: "${topicTitle}"
Current student turn count: ${turnCount} of 3.

Viva Transcript so far:
${transcript || "(Starting viva — ask the opening conceptual question.)"}

Respond as a rigorous university oral examiner:
- If starting (turn 0), ask a crisp, mechanism-focused opening question on ${topicTitle}.
- If student replied, briefly note what was accurate or missing in assessmentNote, give depthScore (0-100), and either ask a targeted follow-up probe on the weakest part of their answer or conclude if turnCount >= 3 (isComplete: true).`;

    const mockFallback = () => {
      if (turnCount === 0) {
        return {
          examinerPrompt: `Let's begin your oral viva on ${topicTitle}. Explain its core mechanism and one critical trade-off or failure mode.`,
          assessmentNote: "Opening viva prompt ready.",
          depthScore: 50,
          isComplete: false,
        };
      }
      if (turnCount < 3) {
        return {
          examinerPrompt: `You touched on the main idea, but what happens under boundary or high-load conditions in ${topicTitle}? Walk me through the exact step-by-step state transition.`,
          assessmentNote: "Good initial intuition; probing deeper into edge cases and invariants.",
          depthScore: Math.min(88, 55 + turnCount * 15),
          isComplete: false,
        };
      }
      return {
        examinerPrompt: `Viva complete for ${topicTitle}. Review your highlighted gaps in the Gap Report to solidify edge-case mastery.`,
        assessmentNote: "Completed 3-turn viva interrogation.",
        depthScore: 82,
        isComplete: true,
      };
    };

    const result = await generateStructured({
      prompt,
      schema: VivaProbeResponseSchema,
      systemInstruction:
        "You are a crisp, rigorous university oral examiner. Never flatter vague answers; probe underlying mechanisms.",
      mockFallback,
    });

    return NextResponse.json({
      success: true,
      ...result.data,
      isMock: result.isMock,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to run oral viva probe", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
