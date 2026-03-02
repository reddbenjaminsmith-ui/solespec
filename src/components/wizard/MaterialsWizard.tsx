"use client";

import { useEffect, useState, useCallback } from "react";
import type { ShoeComponent, Specifications } from "@/lib/types";
import { MATERIALS } from "@/lib/constants";
import PantoneInput from "./PantoneInput";

interface MaterialsWizardProps {
  projectId: string;
  onStepComplete: () => void;
}

interface MaterialFormData {
  upperMaterial: string;
  upperSecondary: string;
  liningMaterial: string;
  outsoleMaterial: string;
  midsoleMaterial: string;
  hardware: string;
  additionalNotes: string;
  upperColor: string;
  upperSecondaryColor: string;
  liningColor: string;
  outsoleColor: string;
  midsoleColor: string;
  hardwareColor: string;
}

const EMPTY_FORM: MaterialFormData = {
  upperMaterial: "",
  upperSecondary: "",
  liningMaterial: "",
  outsoleMaterial: "",
  midsoleMaterial: "",
  hardware: "",
  additionalNotes: "",
  upperColor: "",
  upperSecondaryColor: "",
  liningColor: "",
  outsoleColor: "",
  midsoleColor: "",
  hardwareColor: "",
};

export default function MaterialsWizard({ projectId, onStepComplete }: MaterialsWizardProps) {
  const [components, setComponents] = useState<ShoeComponent[]>([]);
  const [existingSpecs, setExistingSpecs] = useState<Specifications | null>(null);
  const [formData, setFormData] = useState<MaterialFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const [compRes, specRes] = await Promise.all([
          fetch(`/api/components?projectId=${projectId}`),
          fetch(`/api/specifications?projectId=${projectId}`),
        ]);

        if (compRes.ok) {
          const data = await compRes.json();
          setComponents((data.components || []).filter((c: ShoeComponent) => c.confirmed));
        }

        if (specRes.ok) {
          const data = await specRes.json();
          if (data.specifications) {
            setExistingSpecs(data.specifications);
            setFormData({
              upperMaterial: data.specifications.upperMaterial || "",
              upperSecondary: data.specifications.upperSecondary || "",
              liningMaterial: data.specifications.liningMaterial || "",
              outsoleMaterial: data.specifications.outsoleMaterial || "",
              midsoleMaterial: data.specifications.midsoleMaterial || "",
              hardware: data.specifications.hardware || "",
              additionalNotes: data.specifications.additionalNotes || "",
              upperColor: data.specifications.upperColor || "",
              upperSecondaryColor: data.specifications.upperSecondaryColor || "",
              liningColor: data.specifications.liningColor || "",
              outsoleColor: data.specifications.outsoleColor || "",
              midsoleColor: data.specifications.midsoleColor || "",
              hardwareColor: data.specifications.hardwareColor || "",
            });
          }
        }
      } catch {
        // Will show empty form
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  const updateField = useCallback((field: keyof MaterialFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      if (existingSpecs) {
        // Update existing
        await fetch("/api/specifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existingSpecs.id, ...formData }),
        });
        setExistingSpecs({ ...existingSpecs, ...formData });
      } else {
        // Create new
        const res = await fetch("/api/specifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, specifications: formData }),
        });
        if (res.ok) {
          const data = await res.json();
          setExistingSpecs(data);
        }
      }
      onStepComplete();
    } catch {
      setSaveError("Failed to save materials. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [existingSpecs, formData, projectId, onStepComplete]);

  // Enable Next only when data has been saved
  useEffect(() => {
    if (existingSpecs) {
      const hasSavedData = existingSpecs.upperMaterial || existingSpecs.outsoleMaterial || existingSpecs.liningMaterial;
      if (hasSavedData) {
        onStepComplete();
      }
    }
  }, [existingSpecs, onStepComplete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // Group components by category
  const hasUpper = components.some((c) => c.category === "upper");
  const hasSole = components.some((c) => c.category === "sole");
  const hasLining = components.some((c) => c.category === "lining");
  const hasHardware = components.some((c) => c.category === "hardware");

  return (
    <div className="flex flex-col gap-5">
      {saveError && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {saveError}
        </div>
      )}
      {/* Upper materials */}
      {hasUpper && (
        <section>
          <h3 className="section-label mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Upper Materials
          </h3>
          <div className="glass-card-static rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Primary Material</label>
              <select
                value={formData.upperMaterial}
                onChange={(e) => updateField("upperMaterial", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select material...</option>
                {MATERIALS.upper.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Primary Color</label>
              <PantoneInput
                value={formData.upperColor}
                onChange={(val) => updateField("upperColor", val)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Secondary Material</label>
              <select
                value={formData.upperSecondary}
                onChange={(e) => updateField("upperSecondary", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select material...</option>
                {MATERIALS.upper.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Secondary Color</label>
              <PantoneInput
                value={formData.upperSecondaryColor}
                onChange={(val) => updateField("upperSecondaryColor", val)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Sole materials */}
      {hasSole && (
        <section>
          <h3 className="section-label mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            Sole Materials
          </h3>
          <div className="glass-card-static rounded-xl p-4 space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Outsole</label>
              <select
                value={formData.outsoleMaterial}
                onChange={(e) => updateField("outsoleMaterial", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select material...</option>
                {MATERIALS.outsole.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Outsole Color</label>
              <PantoneInput
                value={formData.outsoleColor}
                onChange={(val) => updateField("outsoleColor", val)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Midsole</label>
              <select
                value={formData.midsoleMaterial}
                onChange={(e) => updateField("midsoleMaterial", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select material...</option>
                {MATERIALS.midsole.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Midsole Color</label>
              <PantoneInput
                value={formData.midsoleColor}
                onChange={(val) => updateField("midsoleColor", val)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Lining */}
      {hasLining && (
        <section>
          <h3 className="section-label mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Lining
          </h3>
          <div className="glass-card-static rounded-xl p-4 space-y-3">
            <div>
              <select
                value={formData.liningMaterial}
                onChange={(e) => updateField("liningMaterial", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select material...</option>
                {MATERIALS.lining.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Lining Color</label>
              <PantoneInput
                value={formData.liningColor}
                onChange={(val) => updateField("liningColor", val)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Hardware */}
      {hasHardware && (
        <section>
          <h3 className="section-label mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Hardware Finish
          </h3>
          <div className="glass-card-static rounded-xl p-4 space-y-3">
            <div>
              <select
                value={formData.hardware}
                onChange={(e) => updateField("hardware", e.target.value)}
                className="input-field text-sm"
              >
                <option value="">Select finish...</option>
                {MATERIALS.hardware.map((mat) => (
                  <option key={mat} value={mat}>{mat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Hardware Color</label>
              <PantoneInput
                value={formData.hardwareColor}
                onChange={(val) => updateField("hardwareColor", val)}
              />
            </div>
          </div>
        </section>
      )}

      {/* Notes */}
      <section>
        <h3 className="section-label mb-3">Additional Notes</h3>
        <textarea
          value={formData.additionalNotes}
          onChange={(e) => updateField("additionalNotes", e.target.value)}
          placeholder="Special requirements, finish details..."
          className="input-field text-sm min-h-[80px] resize-y"
          maxLength={2000}
        />
      </section>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full py-2.5 rounded-xl text-sm"
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
            Save Materials
          </>
        )}
      </button>
    </div>
  );
}
