"use client";

import { useEffect, useState, useCallback } from "react";
import type { Specifications } from "@/lib/types";
import { CONSTRUCTION_METHODS } from "@/lib/constants";

interface ConstructionWizardProps {
  projectId: string;
  onStepComplete: () => void;
}

export default function ConstructionWizard({ projectId, onStepComplete }: ConstructionWizardProps) {
  const [existingSpecs, setExistingSpecs] = useState<Specifications | null>(null);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [stitchingType, setStitchingType] = useState("");
  const [adhesiveNotes, setAdhesiveNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load existing specs
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/specifications?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.specifications) {
            setExistingSpecs(data.specifications);
            if (data.specifications.constructionMethod) {
              setSelectedMethod(data.specifications.constructionMethod);
            }
            // Parse additional notes for stitching/adhesive
            const notes = data.specifications.additionalNotes || "";
            const stitchMatch = notes.match(/Stitching: (.+?)(?:\n|$)/);
            const adhesiveMatch = notes.match(/Adhesive: (.+?)(?:\n|$)/);
            if (stitchMatch) setStitchingType(stitchMatch[1]);
            if (adhesiveMatch) setAdhesiveNotes(adhesiveMatch[1]);
          }
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  // Enable next when method is selected
  useEffect(() => {
    if (selectedMethod && existingSpecs?.constructionMethod) {
      onStepComplete();
    }
  }, [selectedMethod, existingSpecs, onStepComplete]);

  const handleSave = useCallback(async () => {
    if (!selectedMethod) return;
    setSaving(true);
    setSaveError("");

    // Build additional notes with stitching/adhesive
    const parts: string[] = [];
    if (stitchingType.trim()) parts.push(`Stitching: ${stitchingType.trim()}`);
    if (adhesiveNotes.trim()) parts.push(`Adhesive: ${adhesiveNotes.trim()}`);
    // Preserve any existing notes that aren't stitching/adhesive
    if (existingSpecs?.additionalNotes) {
      const existing = existingSpecs.additionalNotes
        .replace(/Stitching: .+?(\n|$)/g, "")
        .replace(/Adhesive: .+?(\n|$)/g, "")
        .trim();
      if (existing) parts.push(existing);
    }
    const additionalNotes = parts.join("\n");

    try {
      if (existingSpecs) {
        await fetch("/api/specifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existingSpecs.id,
            constructionMethod: selectedMethod,
            additionalNotes,
          }),
        });
        setExistingSpecs({ ...existingSpecs, constructionMethod: selectedMethod, additionalNotes });
      } else {
        const res = await fetch("/api/specifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            specifications: { constructionMethod: selectedMethod, additionalNotes },
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setExistingSpecs(data);
        }
      }
      onStepComplete();
    } catch {
      setSaveError("Failed to save construction method. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [selectedMethod, stitchingType, adhesiveNotes, existingSpecs, projectId, onStepComplete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {saveError}
        </div>
      )}
      <div>
        <h3
          className="text-sm font-semibold text-white mb-1"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Construction Method
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Select how the upper and sole are joined
        </p>
      </div>

      {/* Method cards */}
      <div className="grid grid-cols-2 gap-3">
        {CONSTRUCTION_METHODS.map((method) => {
          const isSelected = selectedMethod === method.value;
          return (
            <button
              key={method.value}
              onClick={() => setSelectedMethod(method.value)}
              className={`
                text-left p-3.5 rounded-xl border transition-all duration-200
                ${isSelected
                  ? "border-cyan-400/40 bg-cyan-400/[0.06] shadow-[0_0_12px_rgba(34,211,238,0.1)]"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
                }
              `}
            >
              <div className="flex items-start justify-between mb-1.5">
                <span
                  className={`text-sm font-medium ${isSelected ? "text-cyan-400" : "text-white"}`}
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {method.label}
                </span>
                {isSelected && (
                  <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {method.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Additional fields */}
      <div className="glass-card-static rounded-xl p-4 space-y-3">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Stitching Type</label>
          <input
            value={stitchingType}
            onChange={(e) => setStitchingType(e.target.value)}
            placeholder="e.g., lockstitch, chain stitch, zigzag"
            className="input-field text-sm"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Adhesive Notes</label>
          <input
            value={adhesiveNotes}
            onChange={(e) => setAdhesiveNotes(e.target.value)}
            placeholder="e.g., polyurethane adhesive, heat-activated"
            className="input-field text-sm"
            maxLength={200}
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !selectedMethod}
        className={`btn-primary w-full py-2.5 rounded-xl text-sm ${!selectedMethod ? "opacity-40 cursor-not-allowed" : ""}`}
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
            Save Construction
          </>
        )}
      </button>
    </div>
  );
}
