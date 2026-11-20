"use client";

// ==============================================================================
// GapLens AI — Grounded Study Copilot Drawer / Split Panel
// Source-locked conversational assistant. Answers strictly from retrieved course chunks.
// Rejects out-of-scope inquiries and attaches verified textbook citations.
// ==============================================================================

import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Send,
  X,
  BookOpen,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Bot,
  User,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { CitationBadge } from "@/components/citation-badge";
import { useWorkspace } from "@/components/workspace-context";
import { DEMO_CHUNKS } from "@/lib/demo/os-cs301-fixture";
import { processCopilotChat } from "@/lib/algorithms/copilot";
import type { CopilotChatResponse } from "@/types/planner";
import { cn } from "@/lib/utils";

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
  "Explain TLB miss handling in Virtual Memory",
  "How does Banker's Algorithm guarantee safety?",
  "Difference between Counting Semaphore and Mutex",
  "Write me a Python game script (Test Out-of-Scope Defense)",
];

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTopicTitle?: string;
  className?: string;
}

export function CopilotDrawer({
  isOpen,
  onClose,
  activeTopicTitle,
  className,
}: CopilotDrawerProps) {
  const { workspace, isDemo } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-msg",
      role: "assistant",
      content:
        "Hello! I am your GapLens Study Copilot, grounded strictly in your Operating Systems (CS-301) syllabus and Silberschatz OS Concepts notes. Ask me any conceptual question or ask for clarification on your diagnosed blind spots.",
      isGrounded: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
          topicId: undefined,
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
        "flex flex-col h-full rounded-2xl border border-[rgba(183,255,232,0.12)] bg-[#080D0C]/98 backdrop-blur-2xl shadow-2xl overflow-hidden",
        className
      )}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-[rgba(183,255,232,0.08)] px-5 py-4 bg-[#0D1512]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-xl bg-[#121D18] border border-[rgba(0,214,160,0.3)] flex items-center justify-center text-[#00D6A0]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#F1F7F4] tracking-tight">Study Copilot</h3>
              <span className="rounded-full bg-[#121D18] border border-[rgba(0,214,160,0.3)] px-2 py-0.5 text-[10px] font-mono text-[#00D6A0]">
                Source-Locked
              </span>
            </div>
            <p className="text-[11px] text-[#A0ADA6]">
              Grounded strictly in Silberschatz OS Concepts
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#6D7C74] hover:text-[#F1F7F4] hover:bg-[#121D18] transition"
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
              "flex gap-3 max-w-[92%]",
              m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-mono",
                m.role === "user"
                  ? "bg-[#00D6A0] text-[#080D0C] font-bold"
                  : "bg-[#121D18] text-[#00D6A0] border border-[rgba(183,255,232,0.12)]"
              )}
            >
              {m.role === "user" ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
            </div>

            <div className="space-y-2">
              <div
                className={cn(
                  "p-3.5 rounded-2xl leading-relaxed text-xs",
                  m.role === "user"
                    ? "bg-[#17231D] border border-[rgba(183,255,232,0.14)] text-[#F1F7F4] rounded-tr-none"
                    : m.outOfScope
                    ? "bg-[#121D18] border border-[rgba(251,191,36,0.25)] text-[#FBBF24] rounded-tl-none"
                    : "bg-[#0D1512] border border-[rgba(183,255,232,0.08)] text-[#F1F7F4] rounded-tl-none"
                )}
              >
                {m.outOfScope && (
                  <div className="flex items-center gap-1.5 text-[#FBBF24] font-semibold mb-1 text-[11px] font-mono">
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
          <div className="flex items-center gap-2 text-[#A0ADA6] text-xs font-mono italic">
            <Bot className="h-4 w-4 animate-spin text-[#00D6A0]" />
            <span>Retrieving syllabus chunks and formulating grounded answer...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Chips */}
      <div className="px-4 py-2.5 bg-[#0D1512] border-t border-[rgba(183,255,232,0.08)]">
        <p className="text-[10px] font-mono uppercase tracking-wider text-[#6D7C74] mb-1.5">
          Suggested Inquiries:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_SUGGESTIONS.map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              className="rounded-full bg-[#121D18] hover:bg-[#17231D] border border-[rgba(183,255,232,0.08)] hover:border-[#00D6A0]/40 text-[#A0ADA6] hover:text-[#F1F7F4] px-2.5 py-1 text-[11px] transition text-left"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Input bar */}
      <div className="p-3 bg-[#0D1512] border-t border-[rgba(183,255,232,0.08)]">
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
            placeholder="Ask Copilot about any OS topic..."
            className="flex-1 rounded-xl border border-[rgba(183,255,232,0.10)] bg-[#080D0C] px-3.5 py-2.5 text-xs text-[#F1F7F4] placeholder-[#6D7C74] focus:outline-none focus:border-[#00D6A0] focus:ring-1 focus:ring-[#00D6A0]"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="rounded-xl bg-gradient-to-r from-[#00D6A0] to-[#00B887] p-2.5 text-[#080D0C] font-semibold hover:shadow-[0_0_15px_rgba(0,214,160,0.3)] disabled:opacity-30 transition shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="text-[10px] font-mono text-[#6D7C74] text-center mt-1.5">
          Protected by strict prompt-injection defense & deterministic citation grounding.
        </p>
      </div>
    </div>
  );
}
