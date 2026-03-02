"use client";

import { useEffect, useState, useCallback } from "react";
import type { ShoeComponent, RenderedView } from "@/lib/types";
import type { TechnicalView, ComponentCategory } from "@/lib/constants";
import { COMPONENT_CATEGORIES } from "@/lib/constants";
import { CAMERA_POSITIONS } from "@/lib/three/camera-positions";
import AnnotatedView from "./AnnotatedView";

interface ComponentReviewProps {
  projectId: string;
  onStepComplete: () => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string }> = {
  upper: { bg: "bg-cyan-500/10", text: "text-cyan-400" },
  sole: { bg: "bg-purple-500/10", text: "text-purple-400" },
  lining: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  hardware: { bg: "bg-amber-500/10", text: "text-amber-400" },
  other: { bg: "bg-slate-500/10", text: "text-slate-400" },
};

export default function ComponentReview({ projectId, onStepComplete }: ComponentReviewProps) {
  const [components, setComponents] = useState<ShoeComponent[]>([]);
  const [views, setViews] = useState<RenderedView[]>([]);
  const [selectedView, setSelectedView] = useState<TechnicalView>("three_quarter");
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<ComponentCategory>("upper");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<ComponentCategory>("upper");
  const [saveError, setSaveError] = useState("");

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [compRes, viewsRes] = await Promise.all([
          fetch(`/api/components?projectId=${projectId}`),
          fetch(`/api/views?projectId=${projectId}`),
        ]);
        if (compRes.ok) {
          const data = await compRes.json();
          setComponents(data.components || []);
        }
        if (viewsRes.ok) {
          const data = await viewsRes.json();
          setViews(data.views || []);
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Enable next when components exist (user can confirm individually or proceed)
  useEffect(() => {
    if (components.length > 0) {
      onStepComplete();
    }
  }, [components, onStepComplete]);

  const currentViewImage = views.find((v) => v.viewName === selectedView);
  const viewComponents = components.filter((c) => c.bestView === selectedView);

  const handleConfirm = useCallback(async (id: string) => {
    setSaveError("");
    try {
      const res = await fetch("/api/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, confirmed: true }),
      });
      if (res.ok) {
        setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, confirmed: true } : c)));
      }
    } catch {
      setSaveError("Failed to confirm component. Please try again.");
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    setSaveError("");
    try {
      const res = await fetch("/api/components", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setComponents((prev) => prev.filter((c) => c.id !== id));
      }
    } catch {
      setSaveError("Failed to delete component. Please try again.");
    }
  }, []);

  const startEdit = useCallback((comp: ShoeComponent) => {
    setEditingId(comp.id);
    setEditName(comp.name);
    setEditCategory(comp.category);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;
    setSaveError("");
    try {
      const res = await fetch("/api/components", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, name: editName.trim(), category: editCategory }),
      });
      if (res.ok) {
        setComponents((prev) =>
          prev.map((c) =>
            c.id === editingId ? { ...c, name: editName.trim(), category: editCategory } : c
          )
        );
      }
    } catch {
      setSaveError("Failed to save edit. Please try again.");
    }
    setEditingId(null);
  }, [editingId, editName, editCategory]);

  const handleAddComponent = useCallback(async () => {
    if (!newName.trim()) return;
    setSaveError("");
    try {
      const res = await fetch("/api/components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          components: [{
            name: newName.trim(),
            category: newCategory,
            bestView: selectedView,
            labelX: 50,
            labelY: 50,
            confirmed: false,
          }],
        }),
      });
      if (res.ok) {
        // Refetch to get the new record with its ID
        const compRes = await fetch(`/api/components?projectId=${projectId}`);
        if (compRes.ok) {
          const data = await compRes.json();
          setComponents(data.components || []);
        }
      }
    } catch {
      setSaveError("Failed to add component. Please try again.");
    }
    setNewName("");
    setNewCategory("upper");
    setAddingNew(false);
  }, [newName, newCategory, selectedView, projectId]);

  const handleConfirmAll = useCallback(async () => {
    setSaving(true);
    const unconfirmed = components.filter((c) => !c.confirmed);
    for (const comp of unconfirmed) {
      try {
        await fetch("/api/components", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: comp.id, confirmed: true }),
        });
      } catch {
        // Continue with next
      }
    }
    setComponents((prev) => prev.map((c) => ({ ...c, confirmed: true })));
    setSaving(false);
  }, [components]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (components.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">No components detected. Run AI analysis first.</p>
      </div>
    );
  }

  const confirmedCount = components.filter((c) => c.confirmed).length;

  return (
    <div className="flex flex-col gap-4">
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {saveError}
        </div>
      )}
      {/* View selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {views.map((view) => {
          const label = CAMERA_POSITIONS[view.viewName as TechnicalView]?.label || view.viewName;
          const isActive = view.viewName === selectedView;
          return (
            <button
              key={view.id}
              onClick={() => setSelectedView(view.viewName as TechnicalView)}
              className={`
                flex-shrink-0 rounded-lg overflow-hidden border transition-all duration-200
                ${isActive ? "border-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.2)]" : "border-white/[0.06] hover:border-white/[0.12]"}
              `}
            >
              <div className="w-16 h-16 bg-white/[0.02]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={view.imageUrl} alt={label} className="w-full h-full object-contain" />
              </div>
              <div className="px-1.5 py-1 bg-white/[0.02]">
                <p className="text-[9px] text-center text-slate-500 whitespace-nowrap" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Annotated view */}
      {currentViewImage && (
        <AnnotatedView
          imageUrl={currentViewImage.imageUrl}
          components={viewComponents}
          selectedComponentId={selectedComponentId}
          onComponentSelect={setSelectedComponentId}
        />
      )}

      {/* Component list */}
      <div className="glass-card-static rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Components
          </h3>
          <span className="text-xs text-slate-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            {confirmedCount}/{components.length} confirmed
          </span>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {components.map((comp) => {
            const style = CATEGORY_STYLES[comp.category] || CATEGORY_STYLES.other;
            const isEditing = editingId === comp.id;
            const isSelected = selectedComponentId === comp.id;

            return (
              <div
                key={comp.id}
                onClick={() => setSelectedComponentId(comp.id)}
                className={`
                  flex items-center gap-3 p-2.5 rounded-lg border transition-all duration-200 cursor-pointer
                  ${isSelected ? "border-cyan-400/30 bg-cyan-400/[0.04]" : "border-white/[0.04] hover:border-white/[0.08]"}
                  ${comp.confirmed ? "opacity-100" : "opacity-80"}
                `}
              >
                {isEditing ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field flex-1 text-sm py-1"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    />
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as ComponentCategory)}
                      className="input-field w-24 text-xs py-1"
                    >
                      {Object.keys(COMPONENT_CATEGORIES).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button onClick={saveEdit} className="text-emerald-400 hover:text-emerald-300 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </button>
                    <button onClick={() => setEditingId(null)} className="text-slate-500 hover:text-slate-300 p-1">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Confirmed indicator */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${comp.confirmed ? "bg-emerald-400" : "bg-amber-400"}`} />

                    {/* Name */}
                    <span className="text-sm text-white flex-1 truncate">{comp.name}</span>

                    {/* Category badge */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${style.bg} ${style.text}`} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {comp.category}
                    </span>

                    {/* Confidence bar */}
                    <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden flex-shrink-0">
                      <div
                        className={`h-full rounded-full ${
                          comp.aiConfidence > 0.8 ? "bg-emerald-400" : comp.aiConfidence > 0.5 ? "bg-amber-400" : "bg-red-400"
                        }`}
                        style={{ width: `${comp.aiConfidence * 100}%` }}
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!comp.confirmed && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConfirm(comp.id); }}
                          className="text-emerald-400/60 hover:text-emerald-400 p-1"
                          title="Confirm"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(comp); }}
                        className="text-slate-500 hover:text-slate-300 p-1"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(comp.id); }}
                        className="text-red-400/40 hover:text-red-400 p-1"
                        title="Remove"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Add new component */}
          {addingNew ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.02]">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Component name"
                className="input-field flex-1 text-sm py-1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddComponent()}
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ComponentCategory)}
                className="input-field w-24 text-xs py-1"
              >
                {Object.keys(COMPONENT_CATEGORIES).map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <button onClick={handleAddComponent} className="text-emerald-400 hover:text-emerald-300 p-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </button>
              <button onClick={() => setAddingNew(false)} className="text-slate-500 hover:text-slate-300 p-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="w-full py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-500 hover:text-slate-300 hover:border-white/[0.15] transition-colors"
            >
              + Add Component
            </button>
          )}
        </div>

        {/* Confirm All */}
        {confirmedCount < components.length && (
          <button
            onClick={handleConfirmAll}
            disabled={saving}
            className="btn-primary w-full py-2.5 rounded-xl text-sm mt-4"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Confirming...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Confirm All ({components.length - confirmedCount} remaining)
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
