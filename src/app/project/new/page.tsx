"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError("");

    const dropped = e.dataTransfer.files[0];
    if (!dropped) return;

    if (!dropped.name.toLowerCase().endsWith(".glb")) {
      setError("Only .glb files are supported. Export your model as GLB from your 3D tool.");
      return;
    }

    if (dropped.size > 100 * 1024 * 1024) {
      setError("File too large. Maximum size is 100MB.");
      return;
    }

    setFile(dropped);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError("");
      const selected = e.target.files?.[0];
      if (!selected) return;

      if (!selected.name.toLowerCase().endsWith(".glb")) {
        setError("Only .glb files are supported. Export your model as GLB from your 3D tool.");
        return;
      }

      if (selected.size > 100 * 1024 * 1024) {
        setError("File too large. Maximum size is 100MB.");
        return;
      }

      setFile(selected);
    },
    []
  );

  const handleSubmit = async () => {
    if (!file || !projectName.trim()) return;

    setUploading(true);
    setError("");

    // Step 1: Upload .glb to Vercel Blob
    let blob;
    try {
      setUploadStatus("Uploading 3D model...");
      blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/token",
      });
    } catch (uploadErr) {
      console.error("Upload failed:", uploadErr instanceof Error ? uploadErr.message : "Unknown error");
      setError("Failed to upload 3D model. Check your connection and try again.");
      setUploading(false);
      setUploadStatus("");
      return;
    }

    // Step 2: Create project in Airtable
    try {
      setUploadStatus("Creating project...");
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          email: "placeholder@solespec.app", // Until auth is built
          modelUrl: blob.url,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create project");
      }

      const project = await response.json();

      // Step 3: Redirect to workspace
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Project creation failed:", err instanceof Error ? err.message : "Unknown error");
      setError(
        err instanceof Error && err.message !== "Failed to fetch"
          ? err.message
          : "Failed to create project. Please try again."
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
        <h1
          className="text-3xl font-bold text-white tracking-tight mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          New Tech Pack
        </h1>
        <p className="text-slate-400 mb-10">
          Upload a 3D shoe model and name your project.
        </p>

        <div className="space-y-8">
          {/* Project name */}
          <div>
            <label className="section-label block mb-2">Project Name</label>
            <input
              type="text"
              className="input-field text-base py-3"
              placeholder='e.g. "Runner V2 - Black"'
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* File upload */}
          <div>
            <label className="section-label block mb-2">3D Model</label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
                isDragging
                  ? "border-accent bg-accent/[0.06]"
                  : file
                  ? "border-accent/30 bg-accent/[0.03]"
                  : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
              }`}
              onClick={() =>
                document.getElementById("file-input")?.click()
              }
            >
              <input
                id="file-input"
                type="file"
                accept=".glb"
                className="hidden"
                onChange={handleFileSelect}
              />

              {file ? (
                <div className="animate-fade-in">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-accent/10 flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-accent"
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
                  <p className="text-white font-medium mb-1">{file.name}</p>
                  <p
                    className="text-sm text-slate-400"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    {formatFileSize(file.size)} - GLB
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="mt-3 text-xs text-slate-500 hover:text-white transition-colors"
                  >
                    Remove and choose different file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="w-14 h-14 mx-auto mb-4 rounded-xl bg-white/[0.04] flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-slate-500"
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
                  <p className="text-white font-medium mb-1">
                    Drop your .glb file here
                  </p>
                  <p className="text-sm text-slate-500">
                    or click to browse - max 100MB
                  </p>
                  <p
                    className="text-xs text-slate-600 mt-3"
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    Works with exports from Vizcom, Blender, Meshy, Gravity
                    Sketch
                  </p>
                </div>
              )}
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
            disabled={!file || !projectName.trim() || uploading}
            className={`w-full py-4 rounded-xl text-base font-semibold transition-all duration-300 ${
              file && projectName.trim() && !uploading
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
              "Create Tech Pack"
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
