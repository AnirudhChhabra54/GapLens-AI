"use client";

// ==============================================================================
// GapLens AI — Screen 3: Materials, Ingestion State Machine & Topic Hierarchy
// File: src/app/materials/page.tsx
// Redesigned: Dark obsidian (#080D0C), emerald/mint lighting (#00D6A0, #B7FFE8),
// hairline borders, telemetry labels, and clear document ingestion pipelines.
// ==============================================================================

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  FolderGit2,
  Layers,
  GitBranch,
  BookOpen,
  ArrowRight,
  Filter,
  Eye,
  FileCheck,
  Sparkles,
  Info,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { PrerequisiteGraph } from "@/components/prerequisite-graph";
import { DEMO_DOCUMENTS, DEMO_TOPICS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";
import type { DocumentRow } from "@/types/database";

export default function MaterialsPage() {
  const { workspace, documents: initialDocs, topics } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocs || DEMO_DOCUMENTS);
  const [docFilter, setDocFilter] = useState<"all" | "syllabus" | "material" | "past_paper">("all");
  const [activeTab, setActiveTab] = useState<"dag" | "tree">("dag");

  // Upload simulation and real processing state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stateMachineStage, setStateMachineStage] = useState<
    "idle" | "uploaded" | "extracting" | "chunking" | "embedding" | "indexed" | "needs_ocr"
  >("idle");
  const [uploadFilename, setUploadFilename] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Filter documents
  const filteredDocs = documents.filter((d) => {
    if (docFilter === "all") return true;
    return d.doc_type === docFilter;
  });

  // Real document upload and extraction pipeline (/api/upload/sign -> /api/documents/process)
  const handleRealFileUpload = async (file: File) => {
    if (!file) return;

    const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const isAllowedExt = ext === "pdf" || ext === "txt" || ext === "md";
    const mime = file.type || (ext === "pdf" ? "application/pdf" : ext === "md" ? "text/markdown" : "text/plain");

    if (!isAllowedExt && !allowedTypes.includes(mime)) {
      setUploadError("Unsupported file format. Please upload a PDF, TXT, or Markdown document.");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds maximum allowed size of 50MB.");
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadFilename(file.name);
    setUploadError(null);
    setStateMachineStage("uploaded");

    try {
      const docType = file.name.toLowerCase().includes("syllabus")
        ? "syllabus"
        : file.name.toLowerCase().includes("exam") || file.name.toLowerCase().includes("paper")
        ? "past_paper"
        : "material";

      // Step 1: Request presigned storage upload path
      const signRes = await fetch("/api/upload/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
          filename: file.name,
          fileType: mime,
          declaredSizeBytes: file.size,
          docType,
        }),
      });

      const signData = await signRes.json();
      if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "Storage upload authorization failed.");
      }

      setUploadProgress(35);
      setStateMachineStage("extracting");

      // Step 2: Read file as Base64 for unpdf extraction and embedding pipeline
      const base64Data: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.includes(",") ? result.split(",")[1] : result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read local file contents."));
        reader.readAsDataURL(file);
      });

      setUploadProgress(60);
      setStateMachineStage("chunking");

      // Step 3: Run real extraction, heading-aware chunking, and 768d embedding
      const processRes = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: signData.documentId,
          fileBase64: base64Data,
          indexVersion: 1,
        }),
      });

      const processData = await processRes.json();

      if (processData.status === "needs_ocr") {
        setUploadProgress(100);
        setStateMachineStage("needs_ocr");
        setUploadError(processData.ocrReason || "Scanned image PDF detected (<50 chars/page). OCR processing required.");
        setIsUploading(false);

        const ocrDoc: DocumentRow = {
          id: signData.documentId,
          workspace_id: workspace?.id || "10000000-0000-0000-0000-000000000001",
          user_id: "00000000-0000-0000-0000-000000000001",
          filename: file.name,
          storage_path: signData.storagePath || `demo/${file.name}`,
          file_type: mime,
          declared_size_bytes: file.size,
          doc_type: docType,
          status: "needs_ocr",
          page_count: processData.pageCount || 1,
          extracted_char_count: processData.extractedCharCount || 0,
          chunk_count: 0,
          current_checkpoint: { step: "needs_ocr" },
          error_message: processData.ocrReason,
          parser_version: "unpdf-v2.2",
          index_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDocuments((prev) => [ocrDoc, ...prev]);
        return;
      }

      if (!processRes.ok || !processData.success) {
        throw new Error(processData.error || "Document processing failed.");
      }

      setUploadProgress(85);
      setStateMachineStage("embedding");

      setTimeout(() => {
        setUploadProgress(100);
        setStateMachineStage("indexed");
        setIsUploading(false);

        const newDoc: DocumentRow = {
          id: processData.documentId || signData.documentId,
          workspace_id: workspace?.id || "10000000-0000-0000-0000-000000000001",
          user_id: "00000000-0000-0000-0000-000000000001",
          filename: file.name,
          storage_path: signData.storagePath || `demo/${file.name}`,
          file_type: mime,
          declared_size_bytes: file.size,
          doc_type: docType,
          status: "indexed",
          page_count: processData.pageCount || 1,
          extracted_char_count: processData.extractedCharCount || 0,
          chunk_count: processData.chunkCount || 1,
          current_checkpoint: { step: "indexed", timestamp: new Date().toISOString() },
          error_message: null,
          parser_version: "unpdf-v2.2",
          index_version: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setDocuments((prev) => [newDoc, ...prev]);
      }, 350);
    } catch (err: any) {
      setIsUploading(false);
      setStateMachineStage("idle");
      setUploadError(err?.message || "Failed to process document upload.");
    }
  };

  // Simulate document upload & state machine progression
  const handleSimulateUpload = (fileName: string, isOcrDemo = false) => {
    setIsUploading(true);
    setUploadProgress(10);
    setUploadFilename(fileName);
    setUploadError(null);
    setStateMachineStage("uploaded");

    setTimeout(() => {
      setUploadProgress(35);
      setStateMachineStage("extracting");

      setTimeout(() => {
        if (isOcrDemo) {
          setUploadProgress(50);
          setStateMachineStage("needs_ocr");
          setIsUploading(false);
          return;
        }

        setUploadProgress(65);
        setStateMachineStage("chunking");

        setTimeout(() => {
          setUploadProgress(85);
          setStateMachineStage("embedding");

          setTimeout(() => {
            setUploadProgress(100);
            setStateMachineStage("indexed");
            setIsUploading(false);

            const newDoc: DocumentRow = {
              id: `doc-${Date.now()}`,
              workspace_id: workspace?.id || "10000000-0000-0000-0000-000000000001",
              user_id: "00000000-0000-0000-0000-000000000001",
              filename: fileName,
              storage_path: `demo/${fileName}`,
              file_type: "application/pdf",
              declared_size_bytes: 450000,
              doc_type: fileName.toLowerCase().includes("syllabus")
                ? "syllabus"
                : fileName.toLowerCase().includes("exam")
                ? "past_paper"
                : "material",
              status: "indexed",
              page_count: 12,
              extracted_char_count: 18400,
              chunk_count: 6,
              current_checkpoint: {},
              error_message: null,
              parser_version: "1.0",
              index_version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            setDocuments((prev) => [newDoc, ...prev]);
          }, 600);
        }, 600);
      }, 700);
    }, 600);
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleReindexDoc = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "indexed", updated_at: new Date().toISOString() } : d))
    );
  };

  // Group topics by Unit for Tree View
  const unitsMap = new Map<string, typeof topics>();
  for (const t of topics) {
    const unit = t.unit_module || "Core Operating Systems";
    if (!unitsMap.has(unit)) unitsMap.set(unit, []);
    unitsMap.get(unit)!.push(t);
  }

  return (
    <div className="min-h-screen bg-[#080D0C] text-[#F1F7F4] relative overflow-hidden">
      {/* Background atmospheric emerald ambient glow */}
      <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-[#00D6A0]/[0.035] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[#B7FFE8]/[0.08]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#00D6A0]">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00D6A0] animate-pulse" />
              <span>[ SYSTEM 03 / KNOWLEDGE REPOSITORY ]</span>
              <span className="text-[#6D7C74]">•</span>
              <span className="text-[#A0ADA6]">INGESTION & TOPOLOGY</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F1F7F4]">
              Materials & Topic Hierarchy
            </h1>
            <p className="text-sm text-[#A0ADA6] max-w-2xl">
              Curate course syllabi, lecture slides, and past papers. Inspect verified semantic chunks and prerequisite DAG relationships.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <span className="rounded-xl bg-[#0D1512] border border-[#00D6A0]/30 px-3.5 py-1.5 text-xs font-mono text-[#00D6A0]">
              {documents.length} Indexed Materials
            </span>
            <span className="rounded-xl bg-[#0D1512] border border-[#B7FFE8]/[0.1] px-3.5 py-1.5 text-xs font-mono text-[#A0ADA6]">
              {topics.length} Grounded Topics
            </span>
          </div>
        </div>

        {/* =========================================================================
            SECTION 1: DRAG & DROP UPLOAD AREA & INGESTION STATE MACHINE
            ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Dropzone */}
          <div className="lg:col-span-2 rounded-2xl border-2 border-dashed border-[#B7FFE8]/[0.12] hover:border-[#00D6A0]/40 bg-[#0D1512]/90 p-6 sm:p-8 flex flex-col items-center justify-center text-center transition-all duration-300 group relative">
            <div className="h-14 w-14 rounded-2xl bg-[#00D6A0]/10 border border-[#00D6A0]/30 flex items-center justify-center text-[#00D6A0] mb-4 group-hover:scale-105 transition-all">
              <UploadCloud className="h-7 w-7" />
            </div>

            <h3 className="text-base sm:text-lg font-bold text-[#F1F7F4]">
              Upload Course Documents
            </h3>
            <p className="text-xs sm:text-sm text-[#A0ADA6] max-w-md mt-1.5 leading-relaxed">
              Drag and drop your course syllabus, lecture slides, or past exam papers for chunking, vector indexing, and topic alignment.
            </p>
            <p className="text-[11px] text-[#6D7C74] font-mono mt-1">
              Direct signed storage upload: .pdf, .txt, .md (Max 50MB)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRealFileUpload(file);
                e.target.value = "";
              }}
            />

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="rounded-xl bg-[#00D6A0] hover:bg-[#00D6A0]/90 text-[#080D0C] font-semibold px-4 py-2 text-xs shadow-lg shadow-[#00D6A0]/20 transition disabled:opacity-50 inline-flex items-center gap-2 font-mono"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Select Real File (.pdf, .txt, .md)</span>
              </button>
              <button
                type="button"
                onClick={() => handleSimulateUpload("Operating_Systems_Midterm_Review.pdf")}
                disabled={isUploading}
                className="rounded-xl bg-[#121D18] hover:bg-[#17231D] text-[#F1F7F4] border border-[#B7FFE8]/[0.1] px-3.5 py-2 text-xs font-mono transition disabled:opacity-50"
              >
                Demo: Midterm Review PDF
              </button>
              <button
                type="button"
                onClick={() => handleSimulateUpload("Scanned_Lecture_Diagrams.pdf", true)}
                disabled={isUploading}
                className="rounded-xl bg-[#121D18] hover:bg-[#17231D] text-[#FBBF24] border border-[#FBBF24]/30 px-3.5 py-2 text-xs font-mono transition disabled:opacity-50"
              >
                Demo: Scanned PDF (needs_ocr)
              </button>
            </div>

            {uploadError && (
              <div className="mt-4 max-w-md rounded-xl border border-[#F87171]/40 bg-[#F87171]/10 p-3 text-xs text-[#F87171] flex items-center gap-2 text-left">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#F87171]" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* State Machine Status Visualizer */}
          <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-5 sm:p-6 space-y-3.5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#B7FFE8]/[0.06]">
                <h4 className="text-xs font-mono font-bold text-[#A0ADA6] uppercase tracking-wider">
                  Ingestion Pipeline
                </h4>
                <span className="text-[10px] font-mono text-[#00D6A0]">
                  {isUploading ? "Processing..." : stateMachineStage === "idle" ? "Idle" : "Ready"}
                </span>
              </div>

              {/* Stepper Display */}
              <div className="space-y-2 pt-3 text-xs">
                {[
                  { id: "uploaded", label: "1. Storage Upload", desc: "Presigned direct upload" },
                  { id: "extracting", label: "2. unpdf Parser", desc: "1-based page metadata" },
                  { id: "chunking", label: "3. Semantic Chunker", desc: "500-800 tokens, 100 overlap" },
                  { id: "embedding", label: "4. Vector Embeddings", desc: "768-dim dense vectors" },
                  { id: "indexed", label: "5. Grounded Index", desc: "Vector + FTS RPC ready" },
                ].map((step, idx) => {
                  const stages = ["uploaded", "extracting", "chunking", "embedding", "indexed"];
                  const currentIdx = stages.indexOf(stateMachineStage);
                  const stepIdx = stages.indexOf(step.id);
                  const isPast = currentIdx > stepIdx;
                  const isCurrent = currentIdx === stepIdx;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        isCurrent
                          ? "border-[#00D6A0]/80 bg-[#00D6A0]/10 text-[#B7FFE8]"
                          : isPast
                          ? "border-[#00D6A0]/30 bg-[#00D6A0]/[0.04] text-[#00D6A0]"
                          : "border-[#B7FFE8]/[0.04] bg-[#080D0C]/40 text-[#6D7C74]"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                          isPast
                            ? "bg-[#00D6A0] text-[#080D0C] font-bold"
                            : isCurrent
                            ? "bg-[#00D6A0] text-[#080D0C] font-bold animate-pulse"
                            : "bg-[#17231D] text-[#6D7C74]"
                        }`}
                      >
                        {isPast ? "✓" : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold block text-xs truncate">{step.label}</span>
                        <span className="text-[10px] opacity-75 truncate block">{step.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Warning state for OCR */}
              {stateMachineStage === "needs_ocr" && (
                <div className="mt-3 rounded-xl bg-[#FBBF24]/10 border border-[#FBBF24]/40 p-3 text-xs text-[#FBBF24] flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-[#FBBF24] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Status: needs_ocr</span>
                    Scanned image or empty-text PDF detected (&lt;50 extracted characters). Honest OCR warning attached.
                  </div>
                </div>
              )}
            </div>

            {/* Progress bar */}
            {isUploading && (
              <div className="space-y-1.5 pt-2 border-t border-[#B7FFE8]/[0.06]">
                <div className="flex justify-between text-[11px] text-[#00D6A0] font-mono">
                  <span className="truncate max-w-[200px]">{uploadFilename}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 w-full bg-[#17231D] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#00D6A0] to-[#B7FFE8] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: INDEXED DOCUMENTS REPOSITORY TABLE
            ========================================================================= */}
        <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 space-y-4 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#B7FFE8]/[0.06]">
            <div>
              <h3 className="text-base font-bold text-[#F1F7F4] flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-[#00D6A0]" />
                <span>Indexed Course Materials</span>
              </h3>
              <p className="text-xs text-[#A0ADA6] mt-0.5">
                Active documents in workspace partition with verifiable chunk citations.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-[#080D0C] p-1 rounded-xl border border-[#B7FFE8]/[0.08] text-xs font-mono">
              {(["all", "syllabus", "material", "past_paper"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setDocFilter(filter)}
                  className={`px-3 py-1 rounded-lg capitalize transition-all ${
                    docFilter === filter
                      ? "bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/40 font-semibold"
                      : "text-[#A0ADA6] hover:text-[#F1F7F4] border border-transparent"
                  }`}
                >
                  {filter.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          {/* Document Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/70 p-4 space-y-3.5 flex flex-col justify-between hover:border-[#00D6A0]/30 hover:bg-[#121D18] transition-all duration-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                        doc.doc_type === "syllabus"
                          ? "bg-sky-500/10 text-sky-300 border border-sky-500/30"
                          : doc.doc_type === "past_paper"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                          : "bg-[#00D6A0]/10 text-[#00D6A0] border border-[#00D6A0]/30"
                      }`}
                    >
                      {doc.doc_type.replace("_", " ")}
                    </span>
                    <span className="flex items-center gap-1 text-[#00D6A0] text-[10px] font-mono">
                      <CheckCircle2 className="h-3 w-3" /> Indexed
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#F1F7F4] truncate" title={doc.filename}>
                    {doc.filename}
                  </h4>

                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] text-[#A0ADA6] bg-[#080D0C]/60 p-2.5 rounded-lg border border-[#B7FFE8]/[0.06] font-mono">
                    <span>Pages: {doc.page_count}</span>
                    <span>Chunks: {doc.chunk_count}</span>
                    <span>Size: {(doc.declared_size_bytes / 1024).toFixed(0)} KB</span>
                    <span>Ver: {doc.parser_version}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#B7FFE8]/[0.06] text-xs font-mono">
                  <button
                    type="button"
                    onClick={() => handleReindexDoc(doc.id)}
                    className="text-[#A0ADA6] hover:text-[#00D6A0] flex items-center gap-1.5 transition text-[11px]"
                  >
                    <RefreshCw className="h-3 w-3" /> Re-index
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteDoc(doc.id)}
                    className="text-[#A0ADA6] hover:text-[#F87171] flex items-center gap-1.5 transition text-[11px]"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            SECTION 3: CURRICULUM TOPIC HIERARCHY TREE & PREREQUISITE DAG
            ========================================================================= */}
        <div className="space-y-4">
          {/* View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("dag")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition ${
                  activeTab === "dag"
                    ? "bg-[#00D6A0] text-[#080D0C] shadow-lg shadow-[#00D6A0]/20"
                    : "bg-[#0D1512] border border-[#B7FFE8]/[0.08] text-[#A0ADA6] hover:text-[#F1F7F4]"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Prerequisite DAG Flow
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tree")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-semibold transition ${
                  activeTab === "tree"
                    ? "bg-[#00D6A0] text-[#080D0C] shadow-lg shadow-[#00D6A0]/20"
                    : "bg-[#0D1512] border border-[#B7FFE8]/[0.08] text-[#A0ADA6] hover:text-[#F1F7F4]"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Hierarchical Tree View
              </button>
            </div>
          </div>

          {/* View 1: Prerequisite DAG Flow */}
          {activeTab === "dag" && (
            <PrerequisiteGraph topics={topics} prerequisites={DEMO_PREREQUISITES} />
          )}

          {/* View 2: Hierarchical Tree View */}
          {activeTab === "tree" && (
            <div className="rounded-2xl border border-[#B7FFE8]/[0.08] bg-[#0D1512]/90 p-6 shadow-xl space-y-6">
              <div className="pb-3 border-b border-[#B7FFE8]/[0.06]">
                <h3 className="text-base font-bold text-[#F1F7F4] flex items-center gap-2">
                  <Layers className="h-5 w-5 text-[#00D6A0]" />
                  <span>Grounded Course Units & Topics</span>
                </h3>
                <p className="text-xs text-[#A0ADA6] mt-0.5">
                  Extracted directly from CS301_Operating_Systems_Syllabus.pdf.
                </p>
              </div>

              <div className="space-y-4">
                {Array.from(unitsMap.entries()).map(([unitName, unitTopics], uIdx) => (
                  <div
                    key={unitName}
                    className="rounded-xl border border-[#B7FFE8]/[0.08] bg-[#121D18]/60 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#B7FFE8]/[0.06]">
                      <span className="text-sm font-bold text-[#B7FFE8]">
                        Unit {uIdx + 1}: {unitName}
                      </span>
                      <span className="text-xs text-[#A0ADA6] font-mono">
                        {unitTopics.length} Core Topics
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {unitTopics.map((topic) => (
                        <div
                          key={topic.id}
                          className="rounded-lg border border-[#B7FFE8]/[0.06] bg-[#080D0C]/60 p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-semibold text-[#F1F7F4] block">{topic.title}</span>
                            <span className="text-[11px] text-[#6D7C74] font-mono">
                              Weight: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"} •{" "}
                              {topic.total_attempts || 0} attempts
                            </span>
                          </div>

                          <span
                            className={`rounded px-2.5 py-0.5 text-[10px] font-mono font-bold ${
                              topic.classification === "strong"
                                ? "bg-[#00D6A0]/15 text-[#00D6A0] border border-[#00D6A0]/30"
                                : topic.classification === "medium"
                                ? "bg-[#FBBF24]/15 text-[#FBBF24] border border-[#FBBF24]/30"
                                : "bg-[#F87171]/15 text-[#F87171] border border-[#F87171]/30"
                            }`}
                          >
                            {Math.round(topic.current_mastery ?? 45)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
