"use client";

import { useEffect, useState, useCallback } from "react";
import type { Measurement } from "@/lib/types";

interface MeasurementReviewProps {
  projectId: string;
  onStepComplete: () => void;
}

const SIZE_OPTIONS = [
  "US Men's 6", "US Men's 6.5", "US Men's 7", "US Men's 7.5",
  "US Men's 8", "US Men's 8.5", "US Men's 9", "US Men's 9.5",
  "US Men's 10", "US Men's 10.5", "US Men's 11", "US Men's 11.5",
  "US Men's 12", "US Men's 13", "US Men's 14", "US Men's 15",
  "US Women's 5", "US Women's 5.5", "US Women's 6", "US Women's 6.5",
  "US Women's 7", "US Women's 7.5", "US Women's 8", "US Women's 8.5",
  "US Women's 9", "US Women's 9.5", "US Women's 10", "US Women's 10.5",
  "US Women's 11", "US Women's 12",
];

export default function MeasurementReview({ projectId, onStepComplete }: MeasurementReviewProps) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  const [sizeReference, setSizeReference] = useState("US Men's 9");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [saveError, setSaveError] = useState("");

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/measurements?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const m = data.measurements || [];
          setMeasurements(m);
          // Pre-fill edit values
          const vals: Record<string, number> = {};
          for (const item of m) {
            vals[item.id] = item.valueMm;
          }
          setEditValues(vals);
          // Use first measurement's size reference if set
          if (m.length > 0 && m[0].sizeReference) {
            setSizeReference(m[0].sizeReference);
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

  // Check if all confirmed
  useEffect(() => {
    if (measurements.length > 0 && measurements.every((m) => m.confirmed)) {
      onStepComplete();
    }
  }, [measurements, onStepComplete]);

  const handleValueChange = useCallback((id: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0 && num <= 10000) {
      setEditValues((prev) => ({ ...prev, [id]: num }));
    }
  }, []);

  const handleConfirmAll = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    const total = measurements.length;
    setSaveProgress({ current: 0, total });
    const succeededIds = new Set<string>();

    for (let i = 0; i < measurements.length; i++) {
      const m = measurements[i];
      setSaveProgress({ current: i + 1, total });
      try {
        const res = await fetch("/api/measurements", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: m.id,
            valueMm: editValues[m.id] ?? m.valueMm,
            confirmed: true,
            sizeReference,
          }),
        });
        if (res.ok) {
          succeededIds.add(m.id);
        }
      } catch {
        // This one failed - don't add to succeededIds
      }
    }

    if (succeededIds.size < measurements.length) {
      setSaveError(
        `${measurements.length - succeededIds.size} measurement(s) failed to save. Please try again.`
      );
    }

    // Only mark the ones that actually saved as confirmed
    setMeasurements((prev) =>
      prev.map((m) => ({
        ...m,
        confirmed: succeededIds.has(m.id) ? true : m.confirmed,
        valueMm: succeededIds.has(m.id) ? (editValues[m.id] ?? m.valueMm) : m.valueMm,
        sizeReference: succeededIds.has(m.id) ? sizeReference : m.sizeReference,
      }))
    );
    setSaving(false);
  }, [measurements, editValues, sizeReference]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (measurements.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-slate-500">No measurements found. Run AI analysis first.</p>
      </div>
    );
  }

  const confirmedCount = measurements.filter((m) => m.confirmed).length;

  return (
    <div className="flex flex-col gap-4">
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {saveError}
        </div>
      )}
      {/* Reference size */}
      <div className="flex items-center justify-between">
        <label className="section-label">Reference Size</label>
        <select
          value={sizeReference}
          onChange={(e) => setSizeReference(e.target.value)}
          className="input-field w-48 text-sm py-1.5"
        >
          {SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      {/* Measurements table */}
      <div className="glass-card-static rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
          <span className="text-[10px] text-slate-500 font-semibold uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Measurement
          </span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            AI (mm)
          </span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase text-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Source
          </span>
          <span className="text-[10px] text-slate-500 font-semibold uppercase text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Value (mm)
          </span>
        </div>

        {/* Rows */}
        {measurements.map((m) => (
          <div
            key={m.id}
            className={`
              grid grid-cols-[1fr_80px_80px_100px] gap-2 px-4 py-2.5 border-b border-white/[0.03]
              transition-colors duration-200
              ${m.confirmed ? "bg-cyan-400/[0.02]" : ""}
            `}
          >
            {/* Name */}
            <span className="text-sm text-white truncate">{m.name}</span>

            {/* AI estimate */}
            <span
              className="text-sm text-slate-400 text-right tabular-nums"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              {m.valueMm.toFixed(1)}
            </span>

            {/* Source badge */}
            <div className="flex justify-center">
              {m.aiEstimated ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  AI
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Manual
                </span>
              )}
            </div>

            {/* Editable value */}
            <div className="flex justify-end">
              <input
                type="number"
                value={editValues[m.id] ?? m.valueMm}
                onChange={(e) => handleValueChange(m.id, e.target.value)}
                className="input-field w-20 text-sm text-right py-1 tabular-nums"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
                step="0.1"
                min="0.1"
                max="10000"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confirm All */}
      {confirmedCount < measurements.length && (
        <button
          onClick={handleConfirmAll}
          disabled={saving}
          className="btn-primary w-full py-2.5 rounded-xl text-sm"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Saving {saveProgress.current} of {saveProgress.total}...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Confirm All Measurements
            </>
          )}
        </button>
      )}
    </div>
  );
}
