"use client";

// ==============================================================================
// GapLens AI — Grounded Study Copilot Drawer / Split Panel
// Source-locked conversational assistant. Answers strictly from retrieved course chunks.
// Rejects out-of-scope inquiries and attaches verified textbook citations.
// Redesigned: Editorial light styling with warm surface, slate-blue accents, and charcoal typography.
// ==============================================================================

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Sparkles,
  Send,
  X,
  BookOpen,
  ShieldCheck,
  AlertCircle,
  Bot,
  User,
} from "lucide-react";
import { CitationBadge } from "@/components/citation-badge";
import { useWorkspace } from "@/components/workspace-context";
import { DEMO_CHUNKS } from "@/lib/demo/os-cs301-fixture";
import { processCopilotChat } from "@/lib/algorithms/copilot";
import type { CopilotChatResponse } from "@/types/planner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/design-system";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isGrounded?: boolean;
  citation?: {
    documentName?: string | null;
    pageStart?: number | null;
    pageEnd?: number | null;
    sectionHeading?: string | null;
    quote?: string | null;
    isQuoteVerified?: boolean;
  };
  outOfScope?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "Explain TLB miss handling in virtual memory",
  "How does Banker's Algorithm guarantee safety?",
  "Difference between Counting Semaphore and Mutex",
];

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTopicId?: string;
  activeTopicTitle?: string;
  className?: string;
}

export function CopilotDrawer({
  isOpen,
  onClose,
  activeTopicId,
  activeTopicTitle,
  className,
}: CopilotDrawerProps) {
  const { workspace, topics, isDemo } = useWorkspace();
  const courseTitle = workspace?.title || (isDemo ? "Operating Systems" : "your course");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-msg",
      role: "assistant",
      content: `Hello! I am your Study Copilot, grounded in your ${courseTitle} syllabus and verified course notes. Ask me any conceptual question or ask for clarification on your diagnosed blind spots.`,
      isGrounded: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    if (topics && topics.length > 0) {
      return topics.slice(0, 3).map((t) => `Explain key concepts in ${t.title}`);
    }
    if (isDemo) {
      return DEFAULT_SUGGESTIONS;
    }
    return [
      "What are the core foundational topics in this course?",
      "How should I prioritize my study revision?",
      "Summarize the key objectives of this syllabus",
    ];
  }, [topics, isDemo]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || loading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
          message: messageText,
          topicId: activeTopicId || undefined,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (res.ok) {
        const data: CopilotChatResponse = await res.json();
        const assistantMsg: Message = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          isGrounded: !data.isRefusal,
          citation: data.citations?.[0]
            ? {
                documentName: data.citations[0].documentName,
                pageStart: data.citations[0].pageStart,
                pageEnd: data.citations[0].pageEnd,
                sectionHeading: data.citations[0].sectionHeading,
                quote: data.citations[0].quote,
                isQuoteVerified: data.citations[0].isQuoteVerified,
              }
            : undefined,
          outOfScope: data.isRefusal,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error("API call failed");
      }
    } catch {
      let assistantMsg: Message;

      if (isDemo) {
        const fallbackResult: CopilotChatResponse = await processCopilotChat({
          message: messageText,
          chunks: DEMO_CHUNKS,
          topicTitle: activeTopicTitle,
        });

        assistantMsg = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: fallbackResult.answer,
          isGrounded: !fallbackResult.isRefusal,
          citation: fallbackResult.citations?.[0]
            ? {
                documentName: fallbackResult.citations[0].documentName,
                pageStart: fallbackResult.citations[0].pageStart,
                pageEnd: fallbackResult.citations[0].pageEnd,
                sectionHeading: fallbackResult.citations[0].sectionHeading,
                quote: fallbackResult.citations[0].quote,
                isQuoteVerified: fallbackResult.citations[0].isQuoteVerified,
              }
            : undefined,
          outOfScope: fallbackResult.isRefusal,
        };
      } else {
        assistantMsg = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content:
            "The uploaded course material does not provide sufficient information to answer this question.",
          isGrounded: false,
          outOfScope: true,
        };
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-panel border border-brandBorder bg-surface shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-brandBorder px-5 py-4 bg-surface">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-control bg-accent-soft text-accent flex items-center justify-center">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-brandText-primary">Study Copilot</h3>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-mono text-accent">
                Source-locked
              </span>
            </div>
            <p className="text-[11px] text-brandText-muted">
              Grounded in verified course notes and syllabus
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-control text-brandText-muted hover:text-brandText-primary hover:bg-surface-subtle transition"
          aria-label="Close study copilot"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex gap-3 max-w-[90%]",
              m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono",
                m.role === "user"
                  ? "bg-accent text-white font-medium"
                  : "bg-surface-subtle text-accent border border-brandBorder"
              )}
            >
              {m.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            </div>

            <div className="space-y-2">
              <div
                className={cn(
                  "p-3.5 rounded-control leading-relaxed text-xs",
                  m.role === "user"
                    ? "bg-accent text-white rounded-tr-none shadow-xs"
                    : m.outOfScope
                    ? "bg-[#FAF2EE] border border-[#E8CFC4] text-[#85553F] rounded-tl-none"
                    : "bg-surface-subtle border border-brandBorder text-brandText-primary rounded-tl-none"
                )}
              >
                {m.outOfScope && (
                  <div className="flex items-center gap-1.5 text-[#85553F] font-semibold mb-1 text-[11px] font-mono">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Out-of-Scope Query Refusal</span>
                  </div>
                )}

                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>

              {/* Attached Citation */}
              {m.citation && (
                <div className="mt-1">
                  <CitationBadge
                    documentName={m.citation.documentName}
                    pageStart={m.citation.pageStart}
                    pageEnd={m.citation.pageEnd}
                    sectionHeading={m.citation.sectionHeading}
                    quote={m.citation.quote}
                    isQuoteVerified={m.citation.isQuoteVerified}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-brandText-muted text-xs font-mono italic">
            <Bot className="h-4 w-4 animate-spin text-accent" />
            <span>Retrieving syllabus chunks and formulating grounded answer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Chips */}
      <div className="px-4 py-2.5 bg-surface-subtle border-t border-brandBorder">
        <p className="text-[10px] font-mono uppercase tracking-wider text-brandText-muted mb-1.5">
          Suggested questions:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="rounded-full bg-surface hover:bg-surface-muted border border-brandBorder text-brandText-secondary hover:text-brandText-primary px-2.5 py-1 text-[11px] transition text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input composer */}
      <div className="p-3 bg-surface border-t border-brandBorder">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot about any course topic..."
            className="flex-1 rounded-control border border-brandBorder bg-surface px-3 py-2 text-xs text-brandText-primary placeholder-brandText-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={!input.trim() || loading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </form>
        <p className="text-[10px] font-mono text-brandText-muted text-center mt-1.5">
          Source-locked: strictly grounded in verified syllabus chunks.
        </p>
      </div>
    </div>
  );
}
