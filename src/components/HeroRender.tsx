"use client";

import { useState, useCallback, useRef } from "react";
import { useSSEStream } from "@/lib/useSSEStream";
import { MATERIALS } from "@/lib/constants";
import { upload } from "@vercel/blob/client";

interface RenderView {
  viewName: string;
  imageUrl: string;
  id?: string;
}

interface HeroRenderProps {
  projectId: string;
  existingHeroUrl?: string;
  existingRenders?: RenderView[];
  onComplete?: (views: RenderView[]) => void;
}

type HeroPhase =
  | "idle"
  | "material-select"
  | "generating"
  | "uploading"
  | "hero-review"
  | "reference-rendering"
  | "complete"
  | "error";

const VIEW_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Medial",
  right: "Lateral",
  top: "Top",
  bottom: "Bottom",
  three_quarter: "3/4 View",
};

export default function HeroRender({
  projectId,
  existingHeroUrl,
  existingRenders,
  onComplete,
}: HeroRenderProps) {
  const hasExisting = existingRenders && existingRenders.length > 0;

  const [phase, setPhase] = useState<HeroPhase>(
    hasExisting ? "complete" : existingHeroUrl ? "hero-review" : "idle"
  );
  const [heroImageUrl, setHeroImageUrl] = useState(existingHeroUrl || "");
  const [errorMsg, setErrorMsg] = useState("");

  // Material selection state
  const [upper, setUpper] = useState<string>(MATERIALS.upper[0]);
  const [outsole, setOutsole] = useState<string>(MATERIALS.outsole[0]);
  const [midsole, setMidsole] = useState<string>(MATERIALS.midsole[0]);
  const [lining, setLining] = useState<string>(MATERIALS.lining[0]);
  const [hardware, setHardware] = useState<string>(MATERIALS.hardware[0]);
  const [colorDescription, setColorDescription] = useState("");

  // Reference rendering state
  const [progress, setProgress] = useState({ current: 0, total: 6, viewName: "" });
  const [renderedViews, setRenderedViews] = useState<RenderView[]>(
    hasExisting ? existingRenders : []
  );
  const [failedCount, setFailedCount] = useState(0);
  const errorRef = useRef(false);
  const { start, isStreaming } = useSSEStream();

  // Generate hero shot via API
  const handleGenerateHero = useCallback(async () => {
    if (!colorDescription.trim()) return;
    setPhase("generating");
    setErrorMsg("");

    try {
      const res = await fetch("/api/render/hero", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          materials: { upper, outsole, midsole, lining, hardware },
          colorDescription: colorDescription.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Hero generation failed");
        setPhase("error");
        return;
      }

      setHeroImageUrl(data.heroImageUrl);
      setPhase("hero-review");
    } catch {
      setErrorMsg("Failed to connect. Check your connection and try again.");
      setPhase("error");
    }
  }, [projectId, upper, outsole, midsole, lining, hardware, colorDescription]);

  // Upload external hero image
  const handleUploadHero = useCallback(async (file: File) => {
    setPhase("uploading");
    setErrorMsg("");

    try {
      // Upload to Vercel Blob
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload/token",
      });

      // Register with our API
      const res = await fetch("/api/render/hero-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, heroImageUrl: blob.url }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Hero upload failed");
        setPhase("error");
        return;
      }

      setHeroImageUrl(blob.url);
      setPhase("hero-review");
    } catch {
      setErrorMsg("Upload failed. Check your connection and try again.");
      setPhase("error");
    }
  }, [projectId]);

  // File picker for external hero
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setErrorMsg("Only PNG, JPEG, and WebP images are supported.");
      setPhase("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Image too large. Maximum size is 10MB.");
      setPhase("error");
      return;
    }

    handleUploadHero(file);
  }, [handleUploadHero]);

  // Start reference-based rendering for remaining 6 views
  const handleStartReferenceRender = useCallback(() => {
    setPhase("reference-rendering");
    setRenderedViews([]);
    setFailedCount(0);
    setProgress({ current: 0, total: 6, viewName: "" });
    errorRef.current = false;

    start("/api/render/hero-reference", { projectId }, {
      onEvent: (event, data) => {
        const d = data as Record<string, unknown>;
        switch (event) {
          case "progress":
            setProgress({
              current: (d.current as number) || 0,
              total: (d.total as number) || 6,
              viewName: (d.viewName as string) || "",
            });
            break;
          case "viewComplete":
            setRenderedViews((prev) => [
              ...prev,
              { viewName: d.viewName as string, imageUrl: d.imageUrl as string },
            ]);
            break;
          case "viewError":
            setFailedCount((prev) => prev + 1);
            break;
          case "complete": {
            if (errorRef.current) break;
            const views = (d.views as RenderView[]) || [];
            setRenderedViews(views);
            setPhase("complete");
            onComplete?.(views);
            break;
          }
          case "error":
            errorRef.current = true;
            setErrorMsg((d.message as string) || "Rendering failed");
            setPhase("error");
            break;
        }
      },
      onError: (err) => {
        setErrorMsg(err);
        setPhase("error");
      },
      onDone: () => {
        if (!errorRef.current) setPhase("complete");
      },
    });
  }, [projectId, start, onComplete]);

  // --- IDLE STATE ---
  if (phase === "idle") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
          </div>
          <h3
            className="text-sm font-semibold text-white mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Hero Reference Renders
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Generate a hero shot, approve it, then render all views with consistent materials and lighting
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setPhase("material-select")}
              className="btn-primary px-4 py-2.5 rounded-xl text-sm w-full"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
              Generate Hero Shot
            </button>
            <label className="btn-secondary px-4 py-2.5 rounded-xl text-sm w-full cursor-pointer text-center flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
              </svg>
              Upload Hero Image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // --- MATERIAL SELECT STATE ---
  if (phase === "material-select") {
    return (
      <div className="glass-card-static p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Material Selection
          </h3>
          <button
            onClick={() => setPhase("idle")}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            Back
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>Upper</label>
            <select
              value={upper}
              onChange={(e) => setUpper(e.target.value)}
              className="input-field text-sm py-2 w-full"
            >
              {MATERIALS.upper.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>Outsole</label>
              <select
                value={outsole}
                onChange={(e) => setOutsole(e.target.value)}
                className="input-field text-sm py-2 w-full"
              >
                {MATERIALS.outsole.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>Midsole</label>
              <select
                value={midsole}
                onChange={(e) => setMidsole(e.target.value)}
                className="input-field text-sm py-2 w-full"
              >
                {MATERIALS.midsole.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>Lining</label>
              <select
                value={lining}
                onChange={(e) => setLining(e.target.value)}
                className="input-field text-sm py-2 w-full"
              >
                {MATERIALS.lining.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}>Hardware</label>
              <select
                value={hardware}
                onChange={(e) => setHardware(e.target.value)}
                className="input-field text-sm py-2 w-full"
              >
                {MATERIALS.hardware.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}>Color Description</label>
            <input
              type="text"
              value={colorDescription}
              onChange={(e) => setColorDescription(e.target.value)}
              placeholder='e.g. "Black upper with white midsole, gum outsole"'
              className="input-field text-sm py-2 w-full"
              maxLength={500}
            />
          </div>

          <button
            onClick={handleGenerateHero}
            disabled={!colorDescription.trim()}
            className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
              colorDescription.trim()
                ? "btn-primary"
                : "bg-white/[0.04] text-slate-600 cursor-not-allowed"
            }`}
          >
            Generate Hero Shot
          </button>
        </div>
      </div>
    );
  }

  // --- GENERATING / UPLOADING STATE ---
  if (phase === "generating" || phase === "uploading") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-white mb-1">
            {phase === "generating" ? "Generating hero shot..." : "Uploading hero image..."}
          </p>
          <p className="text-xs text-slate-500">
            {phase === "generating" ? "AI is rendering your hero with specified materials" : "Saving to project..."}
          </p>
        </div>
      </div>
    );
  }

  // --- HERO REVIEW STATE ---
  if (phase === "hero-review") {
    return (
      <div className="glass-card-static p-5 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Hero Shot Review
          </h3>
          <span
            className="text-[10px] text-amber-400 uppercase tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Pending Approval
          </span>
        </div>

        {/* Hero image preview */}
        <div className="rounded-xl overflow-hidden border border-white/[0.08] mb-4">
          <div className="aspect-square relative bg-surface-950">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt="Hero shot - 3/4 view"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="px-3 py-2 bg-white/[0.02]">
            <p
              className="text-xs text-slate-300 font-medium"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              3/4 View - Hero Reference
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          This hero shot will be used as the style reference for all other views. Approve it to render the remaining 6 angles with matching materials and lighting.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleStartReferenceRender}
            className="btn-primary px-4 py-2.5 rounded-xl text-sm w-full"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            Approve & Render All Views
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setPhase("material-select")}
              className="btn-secondary px-4 py-2 rounded-xl text-xs flex-1"
            >
              Regenerate
            </button>
            <label className="btn-secondary px-4 py-2 rounded-xl text-xs flex-1 cursor-pointer text-center flex items-center justify-center">
              Upload Different
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          </div>
        </div>
      </div>
    );
  }

  // --- REFERENCE RENDERING STATE ---
  if (phase === "reference-rendering" || isStreaming) {
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    return (
      <div className="glass-card-static p-5 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Hero Reference Rendering
          </h3>
          <span
            className="text-xs text-cyan-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {progress.current}/{progress.total}
          </span>
        </div>

        {/* Hero thumbnail as anchor */}
        {heroImageUrl && (
          <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-white/[0.03] border border-cyan-500/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt="Hero reference"
              className="w-12 h-12 rounded-lg object-contain bg-white/[0.02]"
            />
            <div>
              <p className="text-xs text-cyan-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                Style Reference
              </p>
              <p className="text-[10px] text-slate-500">
                Matching materials & lighting from hero
              </p>
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {progress.viewName ? `Rendering ${progress.viewName}` : "Preparing..."}
            </span>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {failedCount > 0 && (
            <p className="text-xs text-amber-400 mt-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {failedCount} view{failedCount !== 1 ? "s" : ""} failed
            </p>
          )}
        </div>

        {/* Rendered views as they arrive */}
        {renderedViews.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {renderedViews.map((view) => (
              <div key={view.viewName} className="rounded-lg overflow-hidden border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={view.imageUrl}
                  alt={VIEW_LABELS[view.viewName] || view.viewName}
                  className="w-full aspect-square object-contain bg-white/[0.02]"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // --- ERROR STATE ---
  if (phase === "error") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => heroImageUrl ? setPhase("hero-review") : setPhase("idle")}
              className="btn-secondary px-4 py-2 rounded-xl text-sm"
            >
              {heroImageUrl ? "Back to Hero Review" : "Try Again"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- COMPLETE STATE ---
  const allViews = heroImageUrl
    ? [{ viewName: "three_quarter", imageUrl: heroImageUrl }, ...renderedViews]
    : renderedViews;

  return (
    <div className="glass-card-static p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium text-emerald-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {allViews.length} hero-ref renders complete
        </span>
        {failedCount > 0 && (
          <span
            className="text-xs text-amber-400"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            {failedCount} failed
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {allViews.map((view) => (
          <div
            key={view.viewName}
            className={`rounded-lg overflow-hidden border group ${
              view.viewName === "three_quarter"
                ? "border-cyan-500/30 ring-1 ring-cyan-500/10"
                : "border-white/[0.06]"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.imageUrl}
              alt={VIEW_LABELS[view.viewName] || view.viewName}
              className="w-full aspect-square object-contain bg-white/[0.02]"
            />
            <div className="px-2 py-1.5 bg-white/[0.02] flex items-center justify-between">
              <p className="text-[10px] text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {VIEW_LABELS[view.viewName] || view.viewName}
              </p>
              {view.viewName === "three_quarter" && (
                <span className="text-[9px] text-cyan-400 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Hero
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      {failedCount > 0 && (
        <div className="mt-3 flex justify-center">
          <button
            onClick={handleStartReferenceRender}
            className="text-xs text-cyan-400 hover:text-cyan-300 underline"
          >
            Re-render failed views
          </button>
        </div>
      )}
    </div>
  );
}
