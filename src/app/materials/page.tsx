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
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-context";
import { PrerequisiteGraph } from "@/components/prerequisite-graph";
import { DEMO_DOCUMENTS, DEMO_PREREQUISITES } from "@/lib/demo/os-cs301-fixture";
import type { DocumentRow } from "@/types/database";
import { Card, PageHeader, StatusBadge, Button } from "@/components/ui/design-system";

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

  // Sync with context initialDocs
  useEffect(() => {
    if (initialDocs && initialDocs.length > 0) {
      setDocuments(initialDocs);
    }
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

      const signData = await signRes.json();
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
      if (!uploadedDirectly) {
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
          docType,
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
      const res = await fetch("/api/topics/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace?.id || "10000000-0000-0000-0000-000000000001",
          documentId: docId,
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
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to map past-paper questions.");
      }
      setActionSuccess(
        `Mapped ${data.mappedCount} past-paper questions to syllabus topics and updated exam weights!`
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
          }, 500);
        }, 500);
      }, 500);
    }, 500);
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleReindexDoc = (id: string) => {
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "indexed", updated_at: new Date().toISOString() } : d))
    );
  };

  // Group topics by Unit for Outline View
  const unitsMap = new Map<string, typeof topics>();
  for (const t of topics) {
    const unit = t.unit_module || "Core Operating Systems";
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
                  <div className="mt-3 p-2.5 rounded-control bg-[#FAF2EE] border border-[#E8CFC4] text-xs text-[#85553F]">
                    <strong>Needs OCR:</strong> Scanned image PDF detected (&lt;50 characters per page). Text extraction requires OCR preprocessing.
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
        <div className="p-3.5 rounded-card bg-[#F4F8F6] border border-[#CDE5DB] text-status-success text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button type="button" onClick={() => setActionSuccess(null)} className="text-xs hover:opacity-75">
            ✕
          </button>
        </div>
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
          <PrerequisiteGraph topics={topics} prerequisites={isDemo ? DEMO_PREREQUISITES : (prerequisites || [])} />
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

            <div className="space-y-4">
              {topics.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <div className="h-10 w-10 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto">
                    <Layers className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-brandText-primary">No curriculum topics extracted yet</h4>
                  <p className="text-xs text-brandText-secondary max-w-sm mx-auto">
                    Upload your course syllabus in the upload area above and click &quot;Extract topics&quot; to build your topic tree.
                  </p>
                </div>
              ) : (
                Array.from(unitsMap.entries()).map(([unitName, unitTopics], uIdx) => (
                <div
                  key={unitName}
                  className="rounded-card border border-brandBorder bg-surface-subtle p-4 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-brandBorder">
                    <span className="text-xs font-semibold text-brandText-primary">
                      Unit {uIdx + 1}: {unitName}
                    </span>
                    <span className="text-xs text-brandText-muted font-mono">
                      {unitTopics.length} core topics
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {unitTopics.map((topic) => (
                      <div
                        key={topic.id}
                        className="rounded-control border border-brandBorder bg-surface p-3 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-brandText-primary block">{topic.title}</span>
                          <span className="text-[11px] text-brandText-muted font-mono">
                            Exam weight: {topic.exam_weight ? `${Math.round(topic.exam_weight * 100)}%` : "N/A"} •{" "}
                            {topic.total_attempts || 0} attempts
                          </span>
                        </div>

                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-mono font-medium ${
                            topic.classification === "strong"
                              ? "bg-accent-soft text-accent"
                              : topic.classification === "medium"
                              ? "bg-[#FEF5E7] text-[#C27803]"
                              : "bg-[#FDF0EE] text-[#B84A39]"
                          }`}
                        >
                          {Math.round(topic.current_mastery ?? 45)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
