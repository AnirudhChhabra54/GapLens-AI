"use client";

// ==============================================================================
// GapLens AI — Screen 3: Materials, Ingestion State Machine & Topic Hierarchy
// File: src/app/materials/page.tsx
// Features: Drag-and-drop upload zone, signed upload progress, processing state machine,
// needs_ocr warning demo, filterable document list, and interactive prerequisite DAG.
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
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { PrerequisiteGraph } from "@/components/prerequisite-graph";
import { DEMO_DOCUMENTS, DEMO_TOPICS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";
import type { DocumentRow } from "@/types/database";

export default function MaterialsPage() {
  const { workspace, documents: initialDocs, topics } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocs || DEMO_DOCUMENTS);
  const [docFilter, setDocFilter] = useState<"all" | "syllabus" | "material" | "past_paper">("all");
  const [activeTab, setActiveTab] = useState<"tree" | "dag">("dag");

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

            // Add newly indexed document to list
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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-[#0B0F19] text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono mb-1">
            <FolderGit2 className="h-3.5 w-3.5" />
            <span>COURSE REPOSITORY & KNOWLEDGE GRAPH</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            Materials & Curriculum Topic Hierarchy
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage course syllabi, lecture notes, past exam papers, and inspect grounded topic DAGs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-950 border border-cyan-800/80 px-3 py-1 text-xs font-mono text-cyan-300">
            {documents.length} Indexed Materials
          </span>
          <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-xs font-mono text-slate-300">
            {topics.length} Grounded Topics
          </span>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: DRAG & DROP UPLOAD AREA & INGESTION STATE MACHINE
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Dropzone */}
        <div className="lg:col-span-2 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/60 bg-slate-900/50 p-6 flex flex-col items-center justify-center text-center transition group relative">
          <div className="h-12 w-12 rounded-2xl bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-400 mb-3 group-hover:scale-105 transition">
            <UploadCloud className="h-6 w-6" />
          </div>

          <h3 className="text-base font-bold text-white">
            Upload Course Materials & Syllabi
          </h3>
          <p className="text-xs text-slate-400 max-w-md mt-1">
            Drag and drop your course syllabus, lecture slides, or past exam papers. Direct signed uploads to private storage bucket.
          </p>
          <p className="text-[11px] text-slate-500 font-mono mt-1">
            Supported: .pdf, .txt, .md (Up to 50MB)
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

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-4 py-1.5 text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              <span>Choose Real File (.pdf, .txt, .md)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSimulateUpload("Operating_Systems_Midterm_Review.pdf")}
              disabled={isUploading}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3.5 py-1.5 text-xs font-semibold shadow transition disabled:opacity-50"
            >
              Demo Simulation: Midterm PDF
            </button>
            <button
              type="button"
              onClick={() => handleSimulateUpload("Scanned_Lecture_Diagrams.pdf", true)}
              disabled={isUploading}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-900/40 px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
            >
              Demo Simulation: Scanned PDF (needs_ocr)
            </button>
          </div>

          {uploadError && (
            <div className="mt-4 max-w-md rounded-lg border border-amber-800/80 bg-amber-950/40 p-2.5 text-xs text-amber-300 flex items-center gap-2 text-left">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>

        {/* State Machine Status Visualizer */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Ingestion State Machine
            </h4>
            <span className="text-[10px] font-mono text-cyan-400">
              {isUploading ? "Processing..." : stateMachineStage === "idle" ? "Idle" : "Ready"}
            </span>
          </div>

          {/* Stepper Display */}
          <div className="space-y-2 text-xs">
            {[
              { id: "uploaded", label: "1. Storage Upload", desc: "Direct signed URL upload" },
              { id: "extracting", label: "2. unpdf Extraction", desc: "1-based page metadata parsed" },
              { id: "chunking", label: "3. Semantic Chunker", desc: "500-800 tokens, 100 overlap" },
              { id: "embedding", label: "4. Gemini Embeddings", desc: "768-dim dense vectors" },
              { id: "indexed", label: "5. Indexed to DB", desc: "Vector + FTS RPC ready" },
            ].map((step, idx) => {
              const stages = ["uploaded", "extracting", "chunking", "embedding", "indexed"];
              const currentIdx = stages.indexOf(stateMachineStage);
              const stepIdx = stages.indexOf(step.id);
              const isPast = currentIdx > stepIdx;
              const isCurrent = currentIdx === stepIdx;

              return (
                <div
                  key={step.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border transition ${
                    isCurrent
                      ? "border-cyan-500/80 bg-cyan-950/40 text-cyan-200"
                      : isPast
                      ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-300"
                      : "border-slate-800/60 bg-slate-950/30 text-slate-500"
                  }`}
                >
                  <div
                    className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-mono ${
                      isPast
                        ? "bg-emerald-600 text-white"
                        : isCurrent
                        ? "bg-cyan-500 text-slate-950 font-bold animate-pulse"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    {isPast ? "✓" : idx + 1}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold block text-[11px]">{step.label}</span>
                    <span className="text-[10px] opacity-75">{step.desc}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warning state for OCR */}
          {stateMachineStage === "needs_ocr" && (
            <div className="mt-2 rounded-lg bg-amber-950/60 border border-amber-800 p-2.5 text-xs text-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Status: needs_ocr</span>
                Scanned or empty-text PDF detected (&lt;50 extracted characters). Honest OCR warning attached.
              </div>
            </div>
          )}

          {/* Progress bar */}
          {isUploading && (
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[11px] text-cyan-400 font-mono">
                <span>{uploadFilename}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
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
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-cyan-400" />
              Indexed Course Documents
            </h3>
            <p className="text-xs text-slate-400">
              Active documents in workspace partition with verifiable chunk citations.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(["all", "syllabus", "material", "past_paper"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setDocFilter(filter)}
                className={`px-2.5 py-1 rounded-md capitalize font-medium transition ${
                  docFilter === filter
                    ? "bg-slate-800 text-cyan-300 shadow-sm"
                    : "text-slate-400 hover:text-white"
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
              className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 space-y-3 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase ${
                      doc.doc_type === "syllabus"
                        ? "bg-blue-950 text-blue-300 border border-blue-800"
                        : doc.doc_type === "past_paper"
                        ? "bg-amber-950 text-amber-300 border border-amber-800"
                        : "bg-cyan-950 text-cyan-300 border border-cyan-800"
                    }`}
                  >
                    {doc.doc_type.replace("_", " ")}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-mono">
                    <CheckCircle2 className="h-3 w-3" /> Indexed
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-100 truncate" title={doc.filename}>
                  {doc.filename}
                </h4>

                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                  <span>Pages: {doc.page_count}</span>
                  <span>Chunks: {doc.chunk_count}</span>
                  <span>Size: {(doc.declared_size_bytes / 1024).toFixed(0)} KB</span>
                  <span>Ver: {doc.parser_version}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <button
                  type="button"
                  onClick={() => handleReindexDoc(doc.id)}
                  className="text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition text-[11px]"
                >
                  <RefreshCw className="h-3 w-3" /> Re-index
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteDoc(doc.id)}
                  className="text-slate-400 hover:text-rose-400 flex items-center gap-1 transition text-[11px]"
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "dag"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5" />
              Prerequisite DAG Flow
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tree")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === "tree"
                  ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
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
          <div className="rounded-2xl border border-slate-800 bg-[#0B0F19]/90 p-6 shadow-xl space-y-6">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-cyan-400" />
                Grounded Course Units & Topics
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Extracted directly from CS301_Operating_Systems_Syllabus.pdf.
              </p>
            </div>

            <div className="space-y-4">
              {Array.from(unitsMap.entries()).map(([unitName, unitTopics], uIdx) => (
                <div key={unitName} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-sm font-bold text-cyan-300">
                      Unit {uIdx + 1}: {unitName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {unitTopics.length} Core Topics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {unitTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-200 block">{topic.title}</span>
                          <span className="text-[11px] text-slate-500">
                            Exam Weight: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"} •{" "}
                            {topic.total_attempts || 0} attempts
                          </span>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-mono font-bold ${
                            topic.classification === "strong"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : topic.classification === "medium"
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-rose-950 text-rose-400 border border-rose-800"
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
  );
}
