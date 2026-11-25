"use client";

// ==============================================================================
// GapLens AI — Screen 3: Materials, Ingestion Pipeline & Topic Hierarchy
// File: src/app/materials/page.tsx
// Redesigned: Editorial light-first palette, clean document table, compact upload
// dropzone, and integrated dependency map / curriculum outline view.
// ==============================================================================

import React, { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Layers,
  GitBranch,
  BookOpen,
  Filter,
  FileCheck,
  ChevronDown,
  ChevronUp,
  FileUp,
  Sparkles,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { PrerequisiteGraph } from "@/components/prerequisite-graph";
import { computeTopicExamWeights } from "@/lib/algorithms/topic-mapper";
import { DEMO_DOCUMENTS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";
import type { DocumentRow } from "@/types/database";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";

const SAFE_BASE64_FALLBACK_BYTES = 4 * 1024 * 1024;

async function readJsonResponse(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error:
        res.status === 413
          ? "The document is too large to process. Please upload a smaller file or try again."
          : `Unexpected server response (${res.status}). Please retry.`,
    };
  }
}

export default function MaterialsPage() {
  const {
    workspace,
    documents: initialDocs,
    topics,
    prerequisites,
    setWorkspaceTopics,
    setWorkspaceDocuments,
    setWorkspacePrerequisites,
    isDemo,
  } = useWorkspace();
  const [documents, setDocuments] = useState<DocumentRow[]>(initialDocs || DEMO_DOCUMENTS);
  const [docFilter, setDocFilter] = useState<"all" | "syllabus" | "material" | "past_paper">("all");
  const [activeTab, setActiveTab] = useState<"dag" | "outline">("dag");
  const [showUploadArea, setShowUploadArea] = useState(false);
  const [isExtractingTopics, setIsExtractingTopics] = useState(false);
  const [isMappingPapers, setIsMappingPapers] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // OCR resolution modal state
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrTargetDoc, setOcrTargetDoc] = useState<{ id: string; filename: string } | null>(null);
  const [ocrInputText, setOcrInputText] = useState("");
  const [isResolvingOcr, setIsResolvingOcr] = useState(false);

  // Topic Tree state (from GET /api/topics/tree)
  const [topicTree, setTopicTree] = useState<any[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  // Past-paper mapping verification state (for needs_review items)
  const [mappedQuestionsReview, setMappedQuestionsReview] = useState<any[]>([]);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  // Sync with context initialDocs
  useEffect(() => {
    setDocuments(initialDocs || []);
  }, [initialDocs]);

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

    setShowUploadArea(true);
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

      const signData = await readJsonResponse(signRes);
      if (!signRes.ok || !signData.success) {
        throw new Error(signData.error || "Storage upload authorization failed.");
      }

      setUploadProgress(35);
      setStateMachineStage("extracting");

      // Step 2: Attempt direct storage upload to bypass Vercel 4.5MB payload limit
      let uploadedDirectly = false;
      if (signData.uploadUrl && !signData.uploadUrl.includes("mock-storage")) {
        try {
          const uploadRes = await fetch(signData.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": mime },
            body: file,
          });
          if (uploadRes.ok) {
            uploadedDirectly = true;
          }
        } catch {
          // Direct PUT failed or offline; continue to Base64 payload fallback
        }
      }

      let base64Data: string | undefined = undefined;
      // Read base64 payload when inline fallback is safe (<4MB) or when direct storage upload did not succeed
      if (!uploadedDirectly || file.size <= SAFE_BASE64_FALLBACK_BYTES) {
        try {
          base64Data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              const base64 = result.includes(",") ? result.split(",")[1] : result;
              resolve(base64);
            };
            reader.onerror = () => reject(new Error("Failed to read local file contents."));
            reader.readAsDataURL(file);
          });
        } catch {
          if (!uploadedDirectly) {
            throw new Error("Failed to read local file contents.");
          }
        }
      }

      setUploadProgress(60);
      setStateMachineStage("chunking");

      // Step 3: Run real extraction, heading-aware chunking, and embedding
      const processRes = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: signData.documentId,
          workspaceId: workspace?.id,
          filename: file.name,
          storagePath: signData.storagePath,
          docType,
          fileBase64: base64Data,
          indexVersion: 1,
        }),
      });

      const processData = await readJsonResponse(processRes);

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
        setDocuments((prev) => {
          const nextDocs = [ocrDoc, ...prev.filter((d) => d.id !== ocrDoc.id)];
          setWorkspaceDocuments(nextDocs);
          return nextDocs;
        });
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
          ...({ extracted_text: processData.extractedText } as any),
        };
        setDocuments((prev) => {
          const nextDocs = [newDoc, ...prev];
          setWorkspaceDocuments(nextDocs);
          return nextDocs;
        });
      }, 350);
    } catch (err: any) {
      setIsUploading(false);
      setStateMachineStage("idle");
      setUploadError(err?.message || "Failed to process document upload.");
    }
  };

  // Connected syllabus extraction
  const handleExtractTopics = async (docId?: string) => {
    setIsExtractingTopics(true);
    setActionSuccess(null);
    setUploadError(null);
    try {
      const targetDoc = documents.find((d) => d.id === docId);
      const res = await fetch("/api/topics/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
          documentId: docId,
          syllabusText: (targetDoc as any)?.extracted_text || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to extract syllabus topics.");
      }
      if (Array.isArray(data.topics) && data.topics.length > 0) {
        setWorkspaceTopics(data.topics);
        if (Array.isArray(data.prerequisites)) {
          setWorkspacePrerequisites(data.prerequisites);
        }
        setActionSuccess(
          `Extracted ${data.topics.length} topics and ${data.prerequisites?.length || 0} prerequisite dependencies from syllabus!`
        );
        setActiveTab("outline");
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to extract syllabus topics.");
    } finally {
      setIsExtractingTopics(false);
    }
  };

  // Connected past paper question mapping
  const handleMapPastPaper = async (paperDoc: DocumentRow) => {
    setIsMappingPapers(true);
    setActionSuccess(null);
    setUploadError(null);
    try {
      const res = await fetch("/api/papers/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
          documentId: paperDoc.id,
          topics,
          paperText: (paperDoc as any)?.extracted_text || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to map past-paper questions.");
      }
      if (data.examWeights && Array.isArray(data.examWeights)) {
        const weightMap = new Map<string, { examFrequency: number; examTotalMarks: number; examWeight: number }>(
          data.examWeights.map((w: any) => [w.topicId, w])
        );
        const updatedTopics = topics.map((t) => {
          const w = weightMap.get(t.id);
          if (w) {
            return {
              ...t,
              exam_frequency: w.examFrequency,
              exam_total_marks: w.examTotalMarks,
              exam_weight: w.examWeight,
            };
          }
          return t;
        });
        setWorkspaceTopics(updatedTopics);
      }
      if (Array.isArray(data.mappedQuestions) && data.mappedQuestions.length > 0) {
        setMappedQuestionsReview(data.mappedQuestions);
        if (data.needsReviewCount > 0) {
          setShowReviewPanel(true);
        }
      }
      setActionSuccess(
        data.needsReviewCount > 0
          ? `Mapped ${data.mappedCount} past-paper questions (${data.needsReviewCount} flagged for manual review below).`
          : `Mapped ${data.mappedCount} past-paper questions to syllabus topics and updated exam weights!`
      );
    } catch (err: any) {
      setUploadError(err.message || "Failed to map past paper.");
    } finally {
      setIsMappingPapers(false);
    }
  };

  // Demo file upload simulation
  const handleSimulateUpload = (fileName: string, isOcrDemo = false) => {
    setShowUploadArea(true);
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
              id: crypto.randomUUID(),
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

            setDocuments((prev) => {
              const nextDocs = [newDoc, ...prev];
              setWorkspaceDocuments(nextDocs);
              return nextDocs;
            });
          }, 500);
        }, 500);
      }, 500);
    }, 500);
  };

  const handleDeleteDoc = async (id: string) => {
    if (!isDemo && workspace?.id) {
      try {
        const res = await fetch(`/api/documents/${id}?workspaceId=${workspace.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await readJsonResponse(res);
          setUploadError(data.error || "Failed to delete document from database.");
          return;
        }
      } catch (err: any) {
        setUploadError(err.message || "Failed to delete document.");
        return;
      }
    }
    const nextDocs = documents.filter((d) => d.id !== id);
    setDocuments(nextDocs);
    setWorkspaceDocuments(nextDocs);
    setActionSuccess("Document removed.");
  };

  const handleReindexDoc = async (id: string) => {
    if (!isDemo && workspace?.id) {
      try {
        const res = await fetch(`/api/documents/${id}/reindex`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: workspace.id }),
        });
        const data = await readJsonResponse(res);
        if (!res.ok || !data.success) {
          setUploadError(data.error || "Failed to reindex document.");
          return;
        }
        const nextDocs = documents.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "indexed" as const,
                index_version: (data.indexVersion as number) ?? d.index_version + 1,
                chunk_count: data.chunkCount ?? d.chunk_count,
                updated_at: new Date().toISOString(),
              }
            : d
        );
        setDocuments(nextDocs);
        setWorkspaceDocuments(nextDocs);
        setActionSuccess("Document re-indexed successfully.");
        return;
      } catch (err: any) {
        setUploadError(err.message || "Failed to reindex document.");
        return;
      }
    }
    const nextDocs = documents.map((d) =>
      d.id === id ? { ...d, status: "indexed" as const, updated_at: new Date().toISOString() } : d
    );
    setDocuments(nextDocs);
    setWorkspaceDocuments(nextDocs);
    setActionSuccess("Document re-indexed.");
  };

  const handleResolveOcr = async () => {
    if (!ocrTargetDoc || !ocrInputText.trim() || !workspace?.id) return;
    setIsResolvingOcr(true);
    setUploadError(null);
    try {
      const res = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          documentId: ocrTargetDoc.id,
          filename: ocrTargetDoc.filename,
          ocrText: ocrInputText.trim(),
        }),
      });
      const data = await readJsonResponse(res);
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process OCR text.");
      }
      const nextDocs = documents.map((d) =>
        d.id === ocrTargetDoc.id
          ? {
              ...d,
              status: "indexed" as const,
              chunk_count: data.chunkCount || d.chunk_count,
              extracted_char_count: ocrInputText.trim().length,
              page_count: data.pageCount || d.page_count,
              error_message: null,
              updated_at: new Date().toISOString(),
              ...({ extracted_text: ocrInputText.trim() } as any),
            }
          : d
      );
      setDocuments(nextDocs);
      setWorkspaceDocuments(nextDocs);
      setStateMachineStage("indexed");
      setActionSuccess(`OCR text resolved. Document indexed with ${data.chunkCount || 0} chunks.`);
      setOcrModalOpen(false);
      setOcrTargetDoc(null);
      setOcrInputText("");
    } catch (err: any) {
      setUploadError(err.message || "Failed to resolve OCR.");
    } finally {
      setIsResolvingOcr(false);
    }
  };

  const fetchTopicTree = async () => {
    if (!workspace?.id) return;
    setLoadingTree(true);
    try {
      const res = await fetch(`/api/topics/tree?workspaceId=${workspace.id}`);
      const data = await res.json();
      if (res.ok && data.tree) {
        setTopicTree(data.tree);
      }
    } catch {
      // Fallback to flat outline
    } finally {
      setLoadingTree(false);
    }
  };

  useEffect(() => {
    if (activeTab === "outline") {
      fetchTopicTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, workspace?.id, topics.length]);

  // Group topics by Unit for Outline View
  const unitsMap = new Map<string, typeof topics>();
  for (const t of topics) {
    const unit = t.unit_module || workspace?.title || "Core Curriculum";
    if (!unitsMap.has(unit)) unitsMap.set(unit, []);
    unitsMap.get(unit)!.push(t);
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* =========================================================================
          PAGE HEADER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-brandBorder">
        <PageHeader
          title="Course materials"
          description="Manage the notes, syllabus and past papers used to build your course map and source-backed assessments."
        />

        <div className="flex items-center gap-3">
          <Button
            variant={showUploadArea ? "secondary" : "primary"}
            onClick={() => setShowUploadArea(!showUploadArea)}
            className="shrink-0"
          >
            <FileUp className="h-4 w-4" />
            <span>{showUploadArea ? "Hide upload area" : "Upload material"}</span>
          </Button>
        </div>
      </div>

      {/* =========================================================================
          COMPACT UPLOAD DROPZONE & INGESTION PIPELINE (Expandable)
          ========================================================================= */}
      {showUploadArea && (
        <Card className="border-dashed border-2 border-brandBorder bg-surface-subtle">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drop area */}
            <div className="lg:col-span-2 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-accent-soft text-accent flex items-center justify-center">
                <UploadCloud className="h-6 w-6" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-brandText-primary">
                  Drop a file here or choose a file
                </h3>
                <p className="text-xs text-brandText-secondary mt-1">
                  Supported formats: PDF, TXT, Markdown (up to 50MB)
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                id="file-upload-input"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleRealFileUpload(file);
                  e.target.value = "";
                }}
              />

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <label
                  htmlFor="file-upload-input"
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span>Choose file</span>
                </label>
                <button
                  type="button"
                  onClick={() => handleSimulateUpload("Operating_Systems_Midterm_Review.pdf")}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-control text-xs font-mono text-brandText-secondary bg-surface border border-brandBorder hover:border-brandBorder-strong transition-colors disabled:opacity-50"
                >
                  Sample: Review PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateUpload("Scanned_Lecture_Diagrams.pdf", true)}
                  disabled={isUploading}
                  className="px-3 py-1.5 rounded-control text-xs font-mono text-[#85553F] bg-[#FAF2EE] border border-[#E8CFC4] hover:bg-[#F3E8E1] transition-colors disabled:opacity-50"
                >
                  Sample: Scanned PDF (OCR)
                </button>
              </div>

              {uploadError && (
                <div className="p-3 rounded-control bg-[#FDF0EE] border border-[#F2C9BE] text-[#B84A39] text-xs flex items-center gap-2 text-left w-full mt-3">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* Stepper / Status */}
            <div className="bg-surface rounded-card p-4 border border-brandBorder flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
                  <span className="text-xs font-semibold text-brandText-primary">
                    Processing pipeline
                  </span>
                  <span className="text-[11px] font-mono text-brandText-muted">
                    {isUploading ? "Active" : stateMachineStage === "idle" ? "Idle" : "Complete"}
                  </span>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  {[
                    { id: "uploaded", label: "1. Upload", desc: "Storage transfer" },
                    { id: "extracting", label: "2. Text extraction", desc: "Page-level text" },
                    { id: "chunking", label: "3. Chunking", desc: "Heading-aware sections" },
                    { id: "embedding", label: "4. Vector indexing", desc: "768-dim embeddings" },
                    { id: "indexed", label: "5. Complete", desc: "Ready for RAG & DAG" },
                  ].map((step, idx) => {
                    const stages = ["uploaded", "extracting", "chunking", "embedding", "indexed"];
                    const currentIdx = stages.indexOf(stateMachineStage);
                    const stepIdx = stages.indexOf(step.id);
                    const isPast = currentIdx > stepIdx;
                    const isCurrent = currentIdx === stepIdx;

                    return (
                      <div
                        key={step.id}
                        className={`flex items-center gap-2.5 p-2 rounded-control border text-xs transition-colors ${
                          isCurrent
                            ? "border-accent bg-accent-soft/40 text-accent font-medium"
                            : isPast
                            ? "border-brandBorder bg-surface-subtle text-brandText-primary"
                            : "border-transparent text-brandText-muted"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-mono shrink-0 ${
                            isPast
                              ? "bg-accent text-white"
                              : isCurrent
                              ? "bg-accent text-white animate-pulse"
                              : "bg-surface-muted text-brandText-muted"
                          }`}
                        >
                          {isPast ? "✓" : idx + 1}
                        </div>
                        <div className="min-w-0 flex-1 flex items-center justify-between">
                          <span className="truncate">{step.label}</span>
                          <span className="text-[10px] text-brandText-muted">{step.desc}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {stateMachineStage === "needs_ocr" && (
                  <div className="mt-3 p-2.5 rounded-control bg-[#FAF2EE] border border-[#E8CFC4] text-xs text-[#85553F] space-y-2">
                    <div>
                      <strong>Needs OCR:</strong> Scanned image PDF detected (&lt;50 characters per page). Text extraction requires OCR preprocessing.
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        const doc = documents.find((d) => d.status === "needs_ocr") || {
                          id: crypto.randomUUID(),
                          filename: uploadFilename || "Scanned_Document.pdf",
                        };
                        setOcrTargetDoc({ id: doc.id, filename: doc.filename });
                        setOcrModalOpen(true);
                      }}
                      className="text-xs text-[#85553F]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>Paste extracted OCR text</span>
                    </Button>
                  </div>
                )}
              </div>

              {isUploading && (
                <div className="pt-2 border-t border-brandBorder space-y-1">
                  <div className="flex justify-between text-[11px] font-mono text-brandText-secondary">
                    <span className="truncate max-w-[160px]">{uploadFilename}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* =========================================================================
          DOCUMENT REPOSITORY TABLE
          ========================================================================= */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brandBorder">
          <div>
            <h3 className="text-base font-semibold text-brandText-primary">
              Indexed materials ({filteredDocs.length})
            </h3>
            <p className="text-xs text-brandText-secondary mt-0.5">
              Source documents partitioned for RAG retrieval and verified citations.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-subtle p-1 rounded-control border border-brandBorder text-xs">
            {(["all", "syllabus", "material", "past_paper"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setDocFilter(filter)}
                className={`px-3 py-1 rounded-control capitalize transition-colors font-medium ${
                  docFilter === filter
                    ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder"
                    : "text-brandText-muted hover:text-brandText-primary border border-transparent"
                }`}
              >
                {filter === "all" ? "All" : filter.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Clean Responsive Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-brandBorder text-brandText-muted font-medium">
                <th className="py-2.5 px-3">Document name</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Pages</th>
                <th className="py-2.5 px-3">Chunks</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brandBorder">
              {filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="py-3 px-3 font-medium text-brandText-primary">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-accent shrink-0" />
                      <span className="truncate max-w-xs sm:max-w-md" title={doc.filename}>
                        {doc.filename}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="capitalize px-2 py-0.5 rounded-full text-[11px] bg-surface-subtle border border-brandBorder text-brandText-secondary font-mono">
                      {doc.doc_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-brandText-secondary">
                    {doc.page_count ?? "—"}
                  </td>
                  <td className="py-3 px-3 font-mono text-brandText-secondary">
                    {doc.chunk_count ?? "—"}
                  </td>
                  <td className="py-3 px-3">
                    {doc.status === "indexed" ? (
                      <StatusBadge variant="info" label="Indexed" />
                    ) : doc.status === "needs_ocr" ? (
                      <StatusBadge variant="warm" label="Needs OCR" />
                    ) : (
                      <StatusBadge variant="neutral" label="Processing" />
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {doc.doc_type === "syllabus" && doc.status === "indexed" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleExtractTopics(doc.id)}
                          disabled={isExtractingTopics}
                          className="text-xs text-accent"
                          title="Extract syllabus topics"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>{isExtractingTopics ? "Extracting..." : "Extract topics"}</span>
                        </Button>
                      )}
                      {doc.doc_type === "past_paper" && doc.status === "indexed" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleMapPastPaper(doc)}
                          disabled={isMappingPapers}
                          className="text-xs text-accent"
                          title="Map exam questions & compute weights"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>{isMappingPapers ? "Mapping..." : "Analyze weights"}</span>
                        </Button>
                      )}
                      {doc.status === "needs_ocr" && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setOcrTargetDoc({ id: doc.id, filename: doc.filename });
                            setOcrModalOpen(true);
                          }}
                          className="text-xs text-[#85553F]"
                          title="Resolve OCR"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Resolve OCR</span>
                        </Button>
                      )}
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => handleReindexDoc(doc.id)}
                        title="Re-index document"
                        aria-label="Re-index document"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="hover:text-status-danger"
                        title="Delete document"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Action Notification Banner */}
      {actionSuccess && (
        <div className="p-3.5 rounded-card bg-[#F4F8F6] border border-[#CDE5DB] text-status-success text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {mappedQuestionsReview.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReviewPanel((p) => !p)}
                className="underline font-medium hover:opacity-80"
              >
                {showReviewPanel ? "Hide review" : `Review mappings (${mappedQuestionsReview.length})`}
              </button>
            )}
            <button type="button" onClick={() => setActionSuccess(null)} className="text-xs hover:opacity-75">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Past-Paper Low-Confidence Mapping Verification Panel */}
      {showReviewPanel && mappedQuestionsReview.length > 0 && (
        <Card className="space-y-4 border-accent/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-brandBorder">
            <div>
              <h3 className="text-sm font-semibold text-brandText-primary flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#C27803]" />
                <span>Review Past-Paper Topic Mappings</span>
              </h3>
              <p className="text-xs text-brandText-secondary mt-0.5">
                Questions below 60% confidence are flagged for manual verification. Reassign topics and recalculate exam weights.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const weightMap = computeTopicExamWeights(
                    topics,
                    mappedQuestionsReview.map((q) => ({
                      mapped_topic_id: q.mappedTopicId,
                      marks: q.marks || 5,
                    })) as any
                  );
                  const updated = topics.map((t) => {
                    const w = weightMap.get(t.id);
                    return w
                      ? {
                          ...t,
                          exam_frequency: w.examFrequency,
                          exam_total_marks: w.examTotalMarks,
                          exam_weight: w.examWeight,
                        }
                      : t;
                  });
                  setWorkspaceTopics(updated);
                  setActionSuccess("Recalculated exam weights from verified past-paper mappings!");
                  setShowReviewPanel(false);
                }}
              >
                <span>Apply & recalculate weights</span>
              </Button>
              <Button variant="quiet" size="sm" onClick={() => setShowReviewPanel(false)}>
                Close
              </Button>
            </div>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {mappedQuestionsReview.map((q, qIdx) => (
              <div
                key={`${q.questionNumber}-${qIdx}`}
                className={`rounded-control border p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  q.needsReview
                    ? "border-[#E8CFC4] bg-[#FEF9F2]"
                    : "border-brandBorder bg-surface-subtle"
                }`}
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-brandText-primary">Q{q.questionNumber}</span>
                    <span className="text-brandText-muted">• {q.marks} marks</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        q.needsReview
                          ? "bg-[#FEF5E7] text-[#C27803] font-semibold"
                          : "bg-accent-soft text-accent"
                      }`}
                    >
                      {Math.round((q.mappingConfidence || 0) * 100)}% confidence{q.needsReview ? " • Needs review" : ""}
                    </span>
                  </div>
                  <p className="text-brandText-secondary line-clamp-2">{q.questionText}</p>
                </div>

                <select
                  value={q.mappedTopicId || ""}
                  onChange={(e) => {
                    const nextTopicId = e.target.value;
                    setMappedQuestionsReview((prev) =>
                      prev.map((item, idx) =>
                        idx === qIdx
                          ? { ...item, mappedTopicId: nextTopicId, needsReview: false, mappingConfidence: 1.0 }
                          : item
                      )
                    );
                  }}
                  className="rounded-control border border-brandBorder bg-surface px-2.5 py-1.5 text-xs text-brandText-primary focus:border-accent focus:outline-none sm:w-56 shrink-0"
                  aria-label={`Assign topic for question ${q.questionNumber}`}
                >
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* =========================================================================
          CURRICULUM TOPIC HIERARCHY & DEPENDENCY MAP
          ========================================================================= */}
      <div className="space-y-4">
        {topics.length === 0 && documents.some((d) => d.doc_type === "syllabus" && d.status === "indexed") && (
          <div className="p-4 rounded-card border border-accent/30 bg-accent-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-brandText-primary">
                Syllabus indexed and ready for topic extraction
              </p>
              <p className="text-xs text-brandText-secondary mt-0.5">
                Extract curriculum units, topics, and prerequisite relationships to unlock your Diagnostic Lab and Study Plan.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={isExtractingTopics}
              onClick={() => {
                const syllabusDoc = documents.find((d) => d.doc_type === "syllabus" && d.status === "indexed");
                handleExtractTopics(syllabusDoc?.id);
              }}
              className="shrink-0"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isExtractingTopics ? "Extracting topics..." : "Extract curriculum topics"}</span>
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-surface-subtle p-1 rounded-control border border-brandBorder">
            <button
              type="button"
              onClick={() => setActiveTab("dag")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-medium transition-colors ${
                activeTab === "dag"
                  ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder"
                  : "text-brandText-muted hover:text-brandText-primary"
              }`}
            >
              <GitBranch className="h-3.5 w-3.5 text-accent" />
              <span>Dependency map</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("outline")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-control text-xs font-medium transition-colors ${
                activeTab === "outline"
                  ? "bg-surface text-brandText-primary shadow-xs border border-brandBorder"
                  : "text-brandText-muted hover:text-brandText-primary"
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-accent" />
              <span>Curriculum outline</span>
            </button>
          </div>
        </div>

        {/* View 1: Dependency map */}
        {activeTab === "dag" && (
          <PrerequisiteGraph
            topics={topics}
            prerequisites={isDemo ? DEMO_PREREQUISITES : (prerequisites || [])}
            onAddPrerequisite={async (topicId, prereqTopicId) => {
              const res = await fetch("/api/topics/prerequisites", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
                  topicId,
                  prerequisiteTopicId: prereqTopicId,
                }),
              });
              const data = await res.json();
              if (res.ok && data.prerequisite) {
                const current = isDemo ? DEMO_PREREQUISITES : (prerequisites || []);
                setWorkspacePrerequisites([...current, data.prerequisite]);
                setActionSuccess("Prerequisite dependency linked.");
              }
            }}
            onRemovePrerequisite={async (prereqId) => {
              const wsId = workspace?.id || "10000000-0000-0000-0000-000000000001";
              await fetch(`/api/topics/prerequisites?id=${encodeURIComponent(prereqId)}&workspaceId=${encodeURIComponent(wsId)}`, {
                method: "DELETE",
              }).catch(() => undefined);
              const current = isDemo ? DEMO_PREREQUISITES : (prerequisites || []);
              setWorkspacePrerequisites(current.filter((p) => p.id !== prereqId));
              setActionSuccess("Prerequisite dependency removed.");
            }}
          />
        )}

        {/* View 2: Curriculum outline */}
        {activeTab === "outline" && (
          <Card className="space-y-6">
            <div className="pb-3 border-b border-brandBorder">
              <h3 className="text-base font-semibold text-brandText-primary flex items-center gap-2">
                <Layers className="h-4 w-4 text-accent" />
                <span>Extracted Curriculum Units & Topics</span>
              </h3>
              <p className="text-xs text-brandText-secondary mt-0.5">
                Structured hierarchy extracted from verified syllabus materials.
              </p>
            </div>

            <div className="p-3.5 rounded-control bg-accent-soft/30 border border-accent/20 flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-brandText-primary block">
                  Curriculum Weights & Bayesian Mastery Priors
                </span>
                <p className="text-brandText-secondary text-[11px] leading-relaxed">
                  • <strong>Curriculum Baseline Weight:</strong> Topics receive an initial balanced baseline weight across all extracted topics. Upload past exam papers and click &quot;Analyze weights&quot; to calculate empirical weights from actual historical exam questions and marks.
                  <br />
                  • <strong>Mastery Prior (45%):</strong> Newly extracted topics begin with a 45% Bayesian Knowledge Tracing prior until calibrated in the Diagnostic Lab.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {loadingTree ? (
                <div className="py-10 text-center text-xs text-brandText-muted font-mono">
                  Loading curriculum tree hierarchy...
                </div>
              ) : topics.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-brandText-primary">No curriculum topics extracted yet</h4>
                  <p className="text-xs text-brandText-secondary max-w-sm mx-auto">
                    Upload your course syllabus in the upload area above and click &quot;Extract topics&quot; to build your topic tree.
                  </p>
                </div>
              ) : topicTree && topicTree.length > 0 ? (
                topicTree.map((rootNode: any, rIdx: number) => {
                  const hasChildren = rootNode.children && rootNode.children.length > 0;
                  const childNodes = hasChildren ? rootNode.children : [rootNode];
                  const totalTreeWeight = childNodes.reduce((sum: number, t: any) => sum + (t.exam_weight || 0), 0);
                  return (
                    <div
                      key={rootNode.id || rIdx}
                      className="rounded-card border border-brandBorder bg-surface-subtle p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
                        <div>
                          <span className="text-xs font-semibold text-brandText-primary">
                            {hasChildren ? rootNode.title : `Module: ${rootNode.unit_module || rootNode.title}`}
                          </span>
                          {rootNode.description && (
                            <p className="text-[11px] text-brandText-secondary mt-0.5">
                              {rootNode.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-brandText-muted font-mono">
                          <span>
                            {childNodes.length} {childNodes.length === 1 ? "topic" : "topics"}
                          </span>
                          {totalTreeWeight > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-accent font-medium">{Math.round(totalTreeWeight * 100)}% weight</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {childNodes.map((topic: any) => (
                          <div
                            key={topic.id}
                            className="rounded-control border border-brandBorder bg-surface p-3 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <span className="font-medium text-brandText-primary block truncate">
                                {topic.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brandText-muted font-mono">
                                <span>
                                  Exam weight:{" "}
                                  {topic.exam_frequency && topic.exam_frequency > 0
                                    ? `${Math.round((topic.exam_weight || 0) * 100)}% (${topic.exam_frequency} Qs${topic.exam_total_marks ? `, ${topic.exam_total_marks} marks` : ""})`
                                    : topic.exam_weight && topic.exam_weight > 0
                                    ? `${Math.round(topic.exam_weight * 100)}% (Baseline)`
                                    : "Unweighted"}
                                </span>
                                <span>•</span>
                                <span>{topic.total_attempts || 0} attempts</span>
                              </div>
                              {topic.prerequisites && topic.prerequisites.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {topic.prerequisites.map((p: any, pIdx: number) => (
                                    <span
                                      key={pIdx}
                                      className="rounded bg-surface-subtle border border-brandBorder px-1.5 py-0.5 text-[9px] text-brandText-secondary font-mono"
                                    >
                                      requires: {p.prerequisiteTitle || "prerequisite"}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium shrink-0 ${
                                (topic.total_attempts || 0) === 0
                                  ? "bg-surface-subtle text-brandText-secondary border border-brandBorder"
                                  : topic.classification === "strong"
                                  ? "bg-accent-soft text-accent"
                                  : topic.classification === "medium"
                                  ? "bg-[#FEF5E7] text-[#C27803]"
                                  : "bg-[#FDF0EE] text-[#B84A39]"
                              }`}
                              title={
                                (topic.total_attempts || 0) === 0
                                  ? "Untested initial 45% Bayesian prior"
                                  : `Mastery calibrated across ${topic.total_attempts} attempts`
                              }
                            >
                              {(topic.total_attempts || 0) === 0 ? "45% (Prior)" : `${Math.round(topic.current_mastery ?? 45)}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              ) : (
                Array.from(unitsMap.entries()).map(([unitName, unitTopics], uIdx) => {
                  const totalUnitWeight = unitTopics.reduce((sum, t) => sum + (t.exam_weight || 0), 0);
                  return (
                    <div
                      key={unitName}
                      className="rounded-card border border-brandBorder bg-surface-subtle p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
                        <span className="text-xs font-semibold text-brandText-primary">
                          Unit {uIdx + 1}: {unitName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-brandText-muted font-mono">
                          <span>
                            {unitTopics.length} {unitTopics.length === 1 ? "topic" : "topics"}
                          </span>
                          {totalUnitWeight > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-accent font-medium">{Math.round(totalUnitWeight * 100)}% weight</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {unitTopics.map((topic) => (
                          <div
                            key={topic.id}
                            className="rounded-control border border-brandBorder bg-surface p-3 flex items-center justify-between text-xs"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <span className="font-medium text-brandText-primary block truncate">{topic.title}</span>
                              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brandText-muted font-mono">
                                <span>
                                  Exam weight:{" "}
                                  {topic.exam_frequency && topic.exam_frequency > 0
                                    ? `${Math.round((topic.exam_weight || 0) * 100)}% (${topic.exam_frequency} Qs${topic.exam_total_marks ? `, ${topic.exam_total_marks} marks` : ""})`
                                    : topic.exam_weight && topic.exam_weight > 0
                                    ? `${Math.round(topic.exam_weight * 100)}% (Baseline)`
                                    : "Unweighted"}
                                </span>
                                <span>•</span>
                                <span>{topic.total_attempts || 0} attempts</span>
                              </div>
                            </div>

                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium shrink-0 ${
                                (topic.total_attempts || 0) === 0
                                  ? "bg-surface-subtle text-brandText-secondary border border-brandBorder"
                                  : topic.classification === "strong"
                                  ? "bg-accent-soft text-accent"
                                  : topic.classification === "medium"
                                  ? "bg-[#FEF5E7] text-[#C27803]"
                                  : "bg-[#FDF0EE] text-[#B84A39]"
                              }`}
                              title={
                                (topic.total_attempts || 0) === 0
                                  ? "Untested initial 45% Bayesian prior"
                                  : `Mastery calibrated across ${topic.total_attempts} attempts`
                              }
                            >
                              {(topic.total_attempts || 0) === 0 ? "45% (Prior)" : `${Math.round(topic.current_mastery ?? 45)}%`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        )}
      </div>

      {/* OCR Resolution Modal */}
      {ocrModalOpen && ocrTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-card border border-brandBorder bg-surface p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-brandBorder pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <h3 className="text-sm font-semibold text-brandText-primary">
                  Resolve Scanned Document OCR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOcrModalOpen(false);
                  setOcrTargetDoc(null);
                }}
                className="rounded-control p-1 text-brandText-muted hover:text-brandText-primary transition"
                aria-label="Close OCR modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-left">
              <p className="text-xs text-brandText-secondary leading-relaxed">
                Paste the extracted or transcribed text for <strong>{ocrTargetDoc.filename}</strong> below.
                GapLens AI will automatically chunk and embed the text into your course knowledge base.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-brandText-primary">
                    Extracted Text Content
                  </label>
                  <label className="text-[11px] font-mono text-accent hover:underline cursor-pointer">
                    <span>Import .txt / .md file</span>
                    <input
                      type="file"
                      accept=".txt,.md,.markdown"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          const txt = await f.text();
                          setOcrInputText(txt);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  value={ocrInputText}
                  onChange={(e) => setOcrInputText(e.target.value)}
                  rows={8}
                  placeholder="Paste OCR text, markdown notes, or transcription here..."
                  className="w-full px-3 py-2 text-xs rounded-control border border-brandBorder bg-surface-subtle focus:bg-surface focus:border-accent focus:outline-none transition-colors font-mono leading-relaxed"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-brandBorder">
              <button
                type="button"
                onClick={() => {
                  setOcrModalOpen(false);
                  setOcrTargetDoc(null);
                }}
                className="px-3 py-1.5 rounded-control text-xs font-medium text-brandText-secondary hover:bg-surface-subtle transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResolveOcr}
                disabled={isResolvingOcr || !ocrInputText.trim()}
                className="px-4 py-1.5 rounded-control bg-accent hover:bg-accent-hover text-white text-xs font-semibold shadow-subtle transition-all disabled:opacity-50"
              >
                {isResolvingOcr ? "Processing..." : "Process and index"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
