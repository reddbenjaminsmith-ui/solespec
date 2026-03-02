"use client";

import { useState, useCallback, useRef } from "react";
import { useSSEStream } from "@/lib/useSSEStream";

interface RenderView {
  viewName: string;
  imageUrl: string;
  id?: string;
}

interface PhotorealisticRenderProps {
  projectId: string;
  existingRenders?: RenderView[];
  onComplete?: (views: RenderView[]) => void;
}

export default function PhotorealisticRender({ projectId, existingRenders, onComplete }: PhotorealisticRenderProps) {
  const hasExisting = existingRenders && existingRenders.length > 0;
  const [phase, setPhase] = useState<"idle" | "streaming" | "complete" | "error">(
    hasExisting ? "complete" : "idle"
  );
  const [progress, setProgress] = useState({ current: 0, total: 7, viewName: "" });
  const [renderedViews, setRenderedViews] = useState<RenderView[]>(
    hasExisting ? existingRenders : []
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [failedCount, setFailedCount] = useState(0);
  const [lastFailMsg, setLastFailMsg] = useState("");
  const errorRef = useRef(false);
  const { start, isStreaming } = useSSEStream();

  const handleStart = useCallback(() => {
    setPhase("streaming");
    setRenderedViews([]);
    setFailedCount(0);
    setLastFailMsg("");
    setProgress({ current: 0, total: 7, viewName: "" });
    errorRef.current = false;

    start("/api/render", { projectId }, {
      onEvent: (event, data) => {
        const d = data as Record<string, unknown>;
        switch (event) {
          case "progress":
            setProgress({
              current: (d.current as number) || 0,
              total: (d.total as number) || 7,
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
            setLastFailMsg((d.message as string) || "");
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

  const VIEW_LABELS: Record<string, string> = {
    front: "Front",
    back: "Back",
    left: "Medial",
    right: "Lateral",
    top: "Top",
    bottom: "Bottom",
    three_quarter: "3/4 View",
  };

  if (phase === "idle") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
            </svg>
          </div>
          <h3
            className="text-sm font-semibold text-white mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Photorealistic Renders
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            AI transforms your 3D captures into studio-quality product shots
          </p>
          <button onClick={handleStart} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
            </svg>
            Generate Product Shots
          </button>
        </div>
      </div>
    );
  }

  if (phase === "streaming" || isStreaming) {
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Rendering {VIEW_LABELS[progress.viewName] || progress.viewName || "..."}
            </span>
            <span className="text-xs text-cyan-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {progress.current}/{progress.total}
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
        {/* Show rendered images as they arrive */}
        {renderedViews.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-4">
            {renderedViews.map((view) => (
              <div key={view.viewName} className="rounded-lg overflow-hidden border border-white/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={view.imageUrl} alt={VIEW_LABELS[view.viewName] || view.viewName} className="w-full aspect-square object-contain bg-white/[0.02]" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

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
          <button onClick={handleStart} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Complete - all views failed
  if (renderedViews.length === 0) {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm text-amber-400 mb-1">All renders failed</p>
          <p className="text-xs text-slate-500 mb-3">
            {failedCount > 0
              ? `${failedCount} view${failedCount !== 1 ? "s" : ""} failed to generate.`
              : "No views could be generated. The AI service may be temporarily unavailable."}
          </p>
          {lastFailMsg && (
            <p className="text-xs text-slate-400 mb-4 px-3 py-2 bg-white/[0.03] rounded-lg" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {lastFailMsg}
            </p>
          )}
          <button onClick={handleStart} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Complete - with results
  return (
    <div className="glass-card-static p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium text-emerald-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {renderedViews.length} renders complete
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
        {renderedViews.map((view) => (
          <div key={view.viewName} className="rounded-lg overflow-hidden border border-white/[0.06] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.imageUrl}
              alt={VIEW_LABELS[view.viewName] || view.viewName}
              className="w-full aspect-square object-contain bg-white/[0.02]"
            />
            <div className="px-2 py-1.5 bg-white/[0.02]">
              <p className="text-[10px] text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {VIEW_LABELS[view.viewName] || view.viewName}
              </p>
            </div>
          </div>
        ))}
      </div>
      {failedCount > 0 && (
        <div className="mt-3 flex justify-center">
          <button onClick={handleStart} className="text-xs text-cyan-400 hover:text-cyan-300 underline">
            Re-render all views
          </button>
        </div>
      )}
    </div>
  );
}
