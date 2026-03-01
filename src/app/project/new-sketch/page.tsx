"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import Link from "next/link";

const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_MODEL_SIZE = 100 * 1024 * 1024; // 100MB

export default function NewSketchProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [isDraggingSketch, setIsDraggingSketch] = useState(false);
  const [isDraggingModel, setIsDraggingModel] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");

  const validateSketchFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return "Only PNG and JPG images are supported. Export your sketch from Illustrator as PNG or JPG.";
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return "Sketch image too large. Maximum size is 10MB.";
    }
    return null;
  }, []);

  const validateModelFile = useCallback((file: File): string | null => {
    if (!file.name.toLowerCase().endsWith(".glb")) {
      return "Only .glb files are supported for the predecessor model.";
    }
    if (file.size > MAX_MODEL_SIZE) {
      return "Model file too large. Maximum size is 100MB.";
    }
    return null;
  }, []);

  // Sketch drag handlers
  const handleSketchDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSketch(true);
  }, []);
  const handleSketchDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingSketch(false);
  }, []);
  const handleSketchDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingSketch(false);
      setError("");
      const dropped = e.dataTransfer.files[0];
      if (!dropped) return;
      const err = validateSketchFile(dropped);
      if (err) {
        setError(err);
        return;
      }
      setSketchFile(dropped);
    },
    [validateSketchFile]
  );
  const handleSketchSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError("");
      const selected = e.target.files?.[0];
      if (!selected) return;
      const err = validateSketchFile(selected);
      if (err) {
        setError(err);
        return;
      }
      setSketchFile(selected);
    },
    [validateSketchFile]
  );

  // Model drag handlers
  const handleModelDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingModel(true);
  }, []);
  const handleModelDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingModel(false);
  }, []);
  const handleModelDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingModel(false);
      setError("");
      const dropped = e.dataTransfer.files[0];
      if (!dropped) return;
      const err = validateModelFile(dropped);
      if (err) {
        setError(err);
        return;
      }
      setModelFile(dropped);
    },
    [validateModelFile]
  );
  const handleModelSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError("");
      const selected = e.target.files?.[0];
      if (!selected) return;
      const err = validateModelFile(selected);
      if (err) {
        setError(err);
        return;
      }
      setModelFile(selected);
    },
    [validateModelFile]
  );

  const handleSubmit = async () => {
    if (!sketchFile || !modelFile || !projectName.trim()) return;

    setUploading(true);
    setError("");

    try {
      // Step 1: Upload sketch image to Vercel Blob
      setUploadStatus("Uploading sketch...");
      const sketchBlob = await upload(sketchFile.name, sketchFile, {
        access: "public",
        handleUploadUrl: "/api/upload/token",
      });

      // Step 2: Upload predecessor model to Vercel Blob
      setUploadStatus("Uploading predecessor model...");
      const modelBlob = await upload(modelFile.name, modelFile, {
        access: "public",
        handleUploadUrl: "/api/upload/token",
      });

      // Step 3: Create project in Airtable
      setUploadStatus("Creating project...");
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          email: "placeholder@solespec.app",
          sourceType: "Sketch",
          sketchUrl: sketchBlob.url,
          predecessorModelUrl: modelBlob.url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await response.json();

      // Step 4: Redirect to workspace
      router.push(`/project/${project.id}`);
    } catch (err) {
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setUploading(false);
      setUploadStatus("");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-surface-900/60 backdrop-blur-xl border-b border-white/[0.04]">
        <Link
          href="/dashboard"
          className="text-lg font-bold tracking-tight no-underline"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="text-accent">Sole</span>
          <span className="text-white">Spec</span>
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-white transition-colors no-underline"
        >
          Cancel
        </Link>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-16">
        {/* Header with badge */}
        <div className="flex items-center gap-3 mb-2">
          <span
            className="text-[10px] font-medium tracking-widest uppercase px-2.5 py-1 rounded-full bg-cyan-500/10 text-accent border border-cyan-500/20"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sketch to 3D
          </span>
        </div>
        <h1
          className="text-3xl font-bold text-white tracking-tight mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          New Tech Pack from Sketch
        </h1>
        <p className="text-slate-400 mb-10">
          Upload your 2D sketch and predecessor 3D model. AI will analyze the
          design and generate multi-view renders.
        </p>

        <div className="space-y-8">
          {/* Project name */}
          <div>
            <label className="section-label block mb-2">Project Name</label>
            <input
              type="text"
              className="input-field text-base py-3"
              placeholder='e.g. "Runner V3 - Spring 2027"'
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Two upload zones side by side on desktop */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Sketch upload */}
            <div>
              <label className="section-label block mb-2">
                <span className="flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                    />
                  </svg>
                  2D Sketch
                </span>
              </label>
              <div
                onDragOver={handleSketchDragOver}
                onDragLeave={handleSketchDragLeave}
                onDrop={handleSketchDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer min-h-[200px] flex flex-col items-center justify-center ${
                  isDraggingSketch
                    ? "border-accent bg-accent/[0.06]"
                    : sketchFile
                      ? "border-accent/30 bg-accent/[0.03]"
                      : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
                }`}
                onClick={() =>
                  document.getElementById("sketch-input")?.click()
                }
              >
                <input
                  id="sketch-input"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleSketchSelect}
                />

                {sketchFile ? (
                  <div className="animate-fade-in">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent/10 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z"
                        />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">
                      {sketchFile.name}
                    </p>
                    <p
                      className="text-xs text-slate-400"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatFileSize(sketchFile.size)}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSketchFile(null);
                      }}
                      className="mt-2 text-xs text-slate-500 hover:text-white transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">
                      Lateral view sketch
                    </p>
                    <p className="text-xs text-slate-500">
                      PNG or JPG - max 10MB
                    </p>
                    <p
                      className="text-[10px] text-slate-600 mt-2"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      From Illustrator, Procreate, or scan
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Predecessor model upload */}
            <div>
              <label className="section-label block mb-2">
                <span className="flex items-center gap-2">
                  <svg
                    className="w-3.5 h-3.5 text-accent"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"
                    />
                  </svg>
                  Predecessor 3D Model
                </span>
              </label>
              <div
                onDragOver={handleModelDragOver}
                onDragLeave={handleModelDragLeave}
                onDrop={handleModelDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer min-h-[200px] flex flex-col items-center justify-center ${
                  isDraggingModel
                    ? "border-accent bg-accent/[0.06]"
                    : modelFile
                      ? "border-accent/30 bg-accent/[0.03]"
                      : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
                }`}
                onClick={() =>
                  document.getElementById("model-input")?.click()
                }
              >
                <input
                  id="model-input"
                  type="file"
                  accept=".glb"
                  className="hidden"
                  onChange={handleModelSelect}
                />

                {modelFile ? (
                  <div className="animate-fade-in">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-accent/10 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-accent"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"
                        />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">
                      {modelFile.name}
                    </p>
                    <p
                      className="text-xs text-slate-400"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {formatFileSize(modelFile.size)} - GLB
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setModelFile(null);
                      }}
                      className="mt-2 text-xs text-slate-500 hover:text-white transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-slate-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                        />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">
                      Last season or base last
                    </p>
                    <p className="text-xs text-slate-500">
                      .glb format - max 100MB
                    </p>
                    <p
                      className="text-[10px] text-slate-600 mt-2"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      Provides proportions and form reference
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info callout */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-cyan-500/[0.05] border border-cyan-500/10">
            <svg
              className="w-5 h-5 text-accent mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
              />
            </svg>
            <div className="text-sm text-slate-400">
              <p className="text-white font-medium mb-1">How it works</p>
              <p>
                AI analyzes your lateral sketch to identify components and panel
                lines, then generates additional views (medial, front, back) using
                the predecessor model for correct proportions. These views feed
                into the standard tech pack pipeline.
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300 animate-fade-in">
              <svg
                className="w-5 h-5 text-red-400 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                />
              </svg>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!sketchFile || !modelFile || !projectName.trim() || uploading}
            className={`w-full py-4 rounded-xl text-base font-semibold transition-all duration-300 ${
              sketchFile && modelFile && projectName.trim() && !uploading
                ? "btn-primary"
                : "bg-white/[0.04] text-slate-600 cursor-not-allowed"
            }`}
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {uploadStatus || "Uploading..."}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z"
                  />
                </svg>
                Analyze Sketch & Create Tech Pack
              </span>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
