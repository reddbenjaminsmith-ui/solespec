"use client";

import { useEffect, useState, useCallback } from "react";
import type { BOMItem, ShoeComponent, Specifications } from "@/lib/types";

interface BOMGeneratorProps {
  projectId: string;
  onStepComplete: () => void;
}

interface LocalBOMItem {
  id?: string;
  component: string;
  materialName: string;
  supplier: string;
  color: string;
  quantityPerPair: string;
  notes: string;
}

export default function BOMGenerator({ projectId, onStepComplete }: BOMGeneratorProps) {
  const [items, setItems] = useState<LocalBOMItem[]>([]);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load existing BOM items
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/bom?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const bomItems: BOMItem[] = data.items || [];
          if (bomItems.length > 0) {
            setItems(bomItems.map((item) => ({
              id: item.id,
              component: item.component,
              materialName: item.materialName,
              supplier: item.supplier,
              color: item.color,
              quantityPerPair: item.quantityPerPair,
              notes: item.notes,
            })));
            setExistingIds(bomItems.map((item) => item.id));
            onStepComplete();
          }
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId, onStepComplete]);

  const generateFromComponents = useCallback(async () => {
    setLoading(true);
    try {
      const [compRes, specRes] = await Promise.all([
        fetch(`/api/components?projectId=${projectId}`),
        fetch(`/api/specifications?projectId=${projectId}`),
      ]);

      let components: ShoeComponent[] = [];
      let specs: Specifications | null = null;

      if (compRes.ok) {
        const data = await compRes.json();
        components = (data.components || []).filter((c: ShoeComponent) => c.confirmed);
      }
      if (specRes.ok) {
        const data = await specRes.json();
        specs = data.specifications;
      }

      // Map category to material from specs
      const materialMap: Record<string, string> = {};
      if (specs) {
        materialMap.upper = specs.upperMaterial || "";
        materialMap.sole = specs.outsoleMaterial || "";
        materialMap.lining = specs.liningMaterial || "";
        materialMap.hardware = specs.hardware || "";
        materialMap.other = "";
      }

      // Paired components (two per pair of shoes)
      const pairedNames = ["quarter", "eyelet", "hook", "d-ring", "speed hook"];

      const generated: LocalBOMItem[] = components.map((comp) => ({
        component: comp.name,
        materialName: materialMap[comp.category] || "",
        supplier: "",
        color: "",
        quantityPerPair: pairedNames.some((p) => comp.name.toLowerCase().includes(p)) ? "2" : "1",
        notes: "",
      }));

      setItems(generated);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Auto-generate if empty
  useEffect(() => {
    if (!loading && items.length === 0) {
      generateFromComponents();
    }
  }, [loading, items.length, generateFromComponents]);

  const updateItem = useCallback((index: number, field: keyof LocalBOMItem, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const addRow = useCallback(() => {
    setItems((prev) => [
      ...prev,
      { component: "", materialName: "", supplier: "", color: "", quantityPerPair: "1", notes: "" },
    ]);
  }, []);

  const removeRow = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(async () => {
    const validItems = items.filter((item) => item.component.trim());
    if (validItems.length === 0) return;

    setSaving(true);
    try {
      // Delete existing items first
      for (const id of existingIds) {
        await fetch("/api/bom", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
      }

      // Create all new items
      const res = await fetch("/api/bom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          items: validItems.map((item, i) => ({
            component: item.component.trim(),
            materialName: item.materialName.trim(),
            supplier: item.supplier.trim(),
            color: item.color.trim(),
            quantityPerPair: item.quantityPerPair.trim() || "1",
            notes: item.notes.trim(),
            sortOrder: i,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setExistingIds(data.ids || []);
        onStepComplete();
      }
    } catch {
      // Silent fail
    } finally {
      setSaving(false);
    }
  }, [items, existingIds, projectId, onStepComplete]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3
            className="text-sm font-semibold text-white"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Bill of Materials
          </h3>
          <p className="text-xs text-slate-500">{items.length} items</p>
        </div>
        <button
          onClick={generateFromComponents}
          className="btn-secondary px-3 py-1.5 rounded-lg text-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
          Regenerate
        </button>
      </div>

      {/* BOM table */}
      <div className="glass-card-static rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_1fr_1fr_100px_80px_60px_40px] gap-1 px-3 py-2 border-b border-white/[0.06] bg-white/[0.02]">
          {["#", "Component", "Material", "Supplier", "Color", "Qty", ""].map((h) => (
            <span key={h} className="text-[9px] text-slate-500 font-semibold uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div className="max-h-[400px] overflow-y-auto">
          {items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-[40px_1fr_1fr_100px_80px_60px_40px] gap-1 px-3 py-1.5 border-b border-white/[0.02] hover:bg-white/[0.02]"
            >
              <span className="text-xs text-slate-600 self-center" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {index + 1}
              </span>
              <input
                value={item.component}
                onChange={(e) => updateItem(index, "component", e.target.value)}
                className="input-field text-xs py-1"
                placeholder="Component"
                maxLength={200}
              />
              <input
                value={item.materialName}
                onChange={(e) => updateItem(index, "materialName", e.target.value)}
                className="input-field text-xs py-1"
                placeholder="Material"
                maxLength={500}
              />
              <input
                value={item.supplier}
                onChange={(e) => updateItem(index, "supplier", e.target.value)}
                className="input-field text-xs py-1"
                placeholder="Supplier"
                maxLength={200}
              />
              <input
                value={item.color}
                onChange={(e) => updateItem(index, "color", e.target.value)}
                className="input-field text-xs py-1"
                placeholder="Color"
                maxLength={200}
              />
              <input
                value={item.quantityPerPair}
                onChange={(e) => updateItem(index, "quantityPerPair", e.target.value)}
                className="input-field text-xs py-1 text-center"
                placeholder="1"
                maxLength={100}
              />
              <button
                onClick={() => removeRow(index)}
                className="text-red-400/40 hover:text-red-400 self-center justify-self-center p-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        <button
          onClick={addRow}
          className="w-full py-2 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/[0.02] transition-colors border-t border-white/[0.04]"
        >
          + Add Row
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || items.filter((i) => i.component.trim()).length === 0}
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
            Save BOM ({items.filter((i) => i.component.trim()).length} items)
          </>
        )}
      </button>
    </div>
  );
}
