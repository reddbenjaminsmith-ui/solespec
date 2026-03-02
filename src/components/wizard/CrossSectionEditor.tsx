"use client";

import { useEffect, useState, useCallback } from "react";
import type { CrossSection, RenderedView } from "@/lib/types";
import CrossSectionViewPanel from "./CrossSectionViewPanel";

interface CrossSectionEditorProps {
  projectId: string;
  onStepComplete: () => void;
}

const LABELS = ["A:A", "B:B", "C:C", "D:D", "E:E", "F:F", "G:G", "H:H"];

export default function CrossSectionEditor({
  projectId,
  onStepComplete,
}: CrossSectionEditorProps) {
  const [views, setViews] = useState<RenderedView[]>([]);
  const [lines, setLines] = useState<CrossSection[]>([]);
  const [savedLines, setSavedLines] = useState<CrossSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [placementMode, setPlacementMode] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  // Load data on mount
  useEffect(() => {
    async function load() {
      try {
        const [viewsRes, csRes] = await Promise.all([
          fetch(`/api/views?projectId=${projectId}`),
          fetch(`/api/cross-sections?projectId=${projectId}`),
        ]);

        if (viewsRes.ok) {
          const data = await viewsRes.json();
          setViews(data.views || []);
        }

        if (csRes.ok) {
          const data = await csRes.json();
          setLines(data.items || []);
          setSavedLines(data.items || []);
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // This step is optional - enable next immediately
  useEffect(() => {
    onStepComplete();
  }, [onStepComplete]);

  const topView = views.find((v) => v.viewName === "top");
  const lateralView = views.find((v) => v.viewName === "right");

  const topLines = lines.filter((l) => l.viewType === "top");
  const lateralLines = lines.filter((l) => l.viewType === "right");

  const getNextLabel = useCallback(() => {
    const usedLabels = new Set(lines.map((l) => l.label));
    return LABELS.find((l) => !usedLabels.has(l)) || `${String.fromCharCode(65 + lines.length)}:${String.fromCharCode(65 + lines.length)}`;
  }, [lines]);

  const handleAddLine = useCallback(
    (viewType: "top" | "right", position: number) => {
      if (lines.length >= 8) return;
      const label = getNextLabel();
      const newLine: CrossSection = {
        id: `temp_${Date.now()}`,
        projectId,
        label,
        viewType,
        linePosition: position,
        description: "",
        sortOrder: lines.length,
      };
      setLines((prev) => [...prev, newLine]);
      setPlacementMode(false);
      setSelectedLabel(label);
    },
    [lines, getNextLabel, projectId]
  );

  const handleRemoveLine = useCallback((label: string) => {
    setLines((prev) => prev.filter((l) => l.label !== label));
    setSelectedLabel(null);
  }, []);

  const handleUpdateLinePosition = useCallback(
    (label: string, position: number) => {
      setLines((prev) =>
        prev.map((l) => (l.label === label ? { ...l, linePosition: position } : l))
      );
    },
    []
  );

  const handleUpdateDescription = useCallback(
    (label: string, description: string) => {
      setLines((prev) =>
        prev.map((l) => (l.label === label ? { ...l, description } : l))
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      // Delete all existing lines then create new ones
      for (const saved of savedLines) {
        await fetch("/api/cross-sections", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: saved.id }),
        });
      }

      if (lines.length > 0) {
        const res = await fetch("/api/cross-sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            items: lines.map((l, i) => ({
              label: l.label,
              viewType: l.viewType,
              linePosition: l.linePosition,
              description: l.description,
              sortOrder: i,
            })),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Update lines with real IDs
          const updatedLines = lines.map((l, i) => ({
            ...l,
            id: data.ids[i] || l.id,
          }));
          setLines(updatedLines);
          setSavedLines(updatedLines);
        } else {
          throw new Error("Failed to save");
        }
      } else {
        setSavedLines([]);
      }
    } catch {
      setSaveError("Failed to save cross-sections. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [lines, savedLines, projectId]);

  const hasChanges =
    JSON.stringify(lines.map((l) => ({ label: l.label, viewType: l.viewType, linePosition: l.linePosition, description: l.description }))) !==
    JSON.stringify(savedLines.map((l) => ({ label: l.label, viewType: l.viewType, linePosition: l.linePosition, description: l.description })));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Cross-Section Reference
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Place cut lines where cross-sections should be taken. Optional step.
          </p>
        </div>
        <button
          onClick={() => setPlacementMode(!placementMode)}
          disabled={lines.length >= 8}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
            ${placementMode
              ? "bg-cyan-400/20 text-cyan-400 border border-cyan-400/30"
              : lines.length >= 8
                ? "bg-white/[0.03] text-slate-600 cursor-not-allowed"
                : "bg-white/[0.05] text-slate-300 border border-white/[0.08] hover:border-cyan-400/20 hover:text-cyan-400"
            }
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {placementMode ? "Cancel" : "Add Section"}
        </button>
      </div>

      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {saveError}
        </div>
      )}

      {/* View panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CrossSectionViewPanel
          viewType="top"
          viewLabel="Top View (Toe-Down)"
          imageUrl={topView?.imageUrl || ""}
          lines={topLines}
          onAddLine={(pos) => handleAddLine("top", pos)}
          onRemoveLine={handleRemoveLine}
          onUpdateLine={handleUpdateLinePosition}
          onSelectLine={setSelectedLabel}
          selectedLabel={selectedLabel}
          placementMode={placementMode}
        />
        <CrossSectionViewPanel
          viewType="right"
          viewLabel="Lateral View (Side)"
          imageUrl={lateralView?.imageUrl || ""}
          lines={lateralLines}
          onAddLine={(pos) => handleAddLine("right", pos)}
          onRemoveLine={handleRemoveLine}
          onUpdateLine={handleUpdateLinePosition}
          onSelectLine={setSelectedLabel}
          selectedLabel={selectedLabel}
          placementMode={placementMode}
        />
      </div>

      {/* Section list */}
      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          >
            Sections ({lines.length})
          </h4>
          <div className="space-y-2">
            {lines.map((line) => (
              <div
                key={line.label}
                className={`
                  glass-card-static rounded-xl p-3 transition-all duration-200
                  ${selectedLabel === line.label ? "border-cyan-400/30 shadow-[0_0_12px_rgba(34,211,238,0.08)]" : ""}
                `}
                onClick={() => setSelectedLabel(line.label)}
              >
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 shrink-0 mt-0.5">
                    <span
                      className="inline-flex items-center justify-center w-10 h-6 rounded-md bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-[10px] font-bold"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {line.label}
                    </span>
                    <span className="text-[10px] text-slate-600 capitalize" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {line.viewType === "top" ? "Top" : "Lateral"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => handleUpdateDescription(line.label, e.target.value)}
                      placeholder="Describe what this section shows (e.g., toe cap reinforcement, lining layers)..."
                      className="input-field text-xs w-full"
                      maxLength={500}
                    />
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveLine(line.label);
                    }}
                    className="shrink-0 p-1 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {lines.length === 0 && !placementMode && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          </div>
          <p className="text-xs text-slate-500">
            No cross-sections added yet. Click &quot;Add Section&quot; then click on a view to place cut lines.
          </p>
          <p className="text-[10px] text-slate-600 mt-1">
            This step is optional - you can skip it.
          </p>
        </div>
      )}

      {/* Save button */}
      {lines.length > 0 && (
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`
            btn-primary w-full py-2.5 rounded-xl text-sm
            ${!hasChanges ? "opacity-40 cursor-not-allowed" : ""}
          `}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              {hasChanges ? "Save Cross-Sections" : "Saved"}
            </>
          )}
        </button>
      )}
    </div>
  );
}
