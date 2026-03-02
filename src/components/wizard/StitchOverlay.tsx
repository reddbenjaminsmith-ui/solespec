"use client";

import { useState, useCallback, useRef } from "react";
import type { StitchCallout } from "@/lib/types";
import { STITCH_PATTERNS, THREAD_TYPES } from "@/lib/constants";

interface StitchOverlayProps {
  imageUrl: string;
  callouts: StitchCallout[];
  onAddCallout: (x: number, y: number) => void;
  onRemoveCallout: (id: string) => void;
  onUpdateCallout: (id: string, updates: Partial<StitchCallout>) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isEditing: boolean;
}

export default function StitchOverlay({
  imageUrl,
  callouts,
  onAddCallout,
  onRemoveCallout,
  onUpdateCallout,
  selectedId,
  onSelect,
  isEditing,
}: StitchOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgCoords = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      return {
        x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
        y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
      };
    },
    []
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isEditing) {
        onSelect(null);
        return;
      }
      const coords = getSvgCoords(e);
      onAddCallout(coords.x, coords.y);
    },
    [isEditing, getSvgCoords, onAddCallout, onSelect]
  );

  const selectedCallout = callouts.find((c) => c.id === selectedId);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={`
          relative w-full aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-300
          ${isEditing
            ? "border-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.1)] cursor-crosshair"
            : "border-white/[0.06]"
          }
        `}
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Technical view"
            className="absolute inset-0 w-full h-full object-contain"
            style={{ imageRendering: "auto" }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
            No view captured
          </div>
        )}

        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleSvgClick}
          style={{ cursor: isEditing ? "crosshair" : "default" }}
        >
          {callouts.map((callout) => {
            const isSelected = callout.id === selectedId;
            const isHovered = callout.id === hoveredId;
            const active = isSelected || isHovered;

            return (
              <g key={callout.id} style={{ pointerEvents: "all" }}>
                {/* Pulse ring */}
                {isSelected && (
                  <circle
                    cx={callout.positionX}
                    cy={callout.positionY}
                    r="2.5"
                    fill="none"
                    stroke="#fbbf24"
                    strokeWidth="0.2"
                  >
                    <animate attributeName="r" values="1.5;3.5;1.5" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Stitch marker - small circle with cross pattern */}
                <circle
                  cx={callout.positionX}
                  cy={callout.positionY}
                  r={active ? "2" : "1.5"}
                  fill={active ? "rgba(251,191,36,0.3)" : "rgba(251,191,36,0.15)"}
                  stroke="#fbbf24"
                  strokeWidth={active ? "0.3" : "0.2"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(callout.id);
                  }}
                  onMouseEnter={() => setHoveredId(callout.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{ cursor: "pointer" }}
                />
                {/* Cross stitch icon */}
                <line
                  x1={callout.positionX - 0.7}
                  y1={callout.positionY - 0.7}
                  x2={callout.positionX + 0.7}
                  y2={callout.positionY + 0.7}
                  stroke="#fbbf24"
                  strokeWidth="0.2"
                  style={{ pointerEvents: "none" }}
                />
                <line
                  x1={callout.positionX + 0.7}
                  y1={callout.positionY - 0.7}
                  x2={callout.positionX - 0.7}
                  y2={callout.positionY + 0.7}
                  stroke="#fbbf24"
                  strokeWidth="0.2"
                  style={{ pointerEvents: "none" }}
                />

                {/* Quick label on hover */}
                {active && (
                  <g>
                    <rect
                      x={callout.positionX + 3}
                      y={callout.positionY - 2}
                      width={12}
                      height={3}
                      rx={0.5}
                      fill="rgba(0,0,0,0.8)"
                      stroke="#fbbf24"
                      strokeWidth="0.15"
                    />
                    <text
                      x={callout.positionX + 4}
                      y={callout.positionY + 0.2}
                      fill="#fbbf24"
                      fontSize="1.5"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="500"
                    >
                      {callout.spi}SPI {callout.stitchPattern}
                    </text>
                  </g>
                )}

                {/* Delete button */}
                {isSelected && (
                  <g
                    transform={`translate(${callout.positionX + 3}, ${callout.positionY - 4})`}
                    style={{ cursor: "pointer", pointerEvents: "all" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveCallout(callout.id);
                    }}
                  >
                    <circle r={1.3} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="0.2" />
                    <line x1={-0.5} y1={-0.5} x2={0.5} y2={0.5} stroke="#ef4444" strokeWidth="0.25" />
                    <line x1={0.5} y1={-0.5} x2={-0.5} y2={0.5} stroke="#ef4444" strokeWidth="0.25" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail form for selected callout */}
      {selectedCallout && (
        <div className="glass-card-static rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Stitch Detail
            </span>
            <button
              onClick={() => onRemoveCallout(selectedCallout.id)}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Delete
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">SPI</label>
              <input
                type="number"
                value={selectedCallout.spi || ""}
                onChange={(e) => onUpdateCallout(selectedCallout.id, { spi: parseInt(e.target.value) || 0 })}
                className="input-field text-xs"
                min={4}
                max={30}
                placeholder="8"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Thread Type</label>
              <select
                value={selectedCallout.threadType || ""}
                onChange={(e) => onUpdateCallout(selectedCallout.id, { threadType: e.target.value as StitchCallout["threadType"] })}
                className="input-field text-xs"
              >
                <option value="">Select...</option>
                {THREAD_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Stitch Pattern</label>
              <select
                value={selectedCallout.stitchPattern || ""}
                onChange={(e) => onUpdateCallout(selectedCallout.id, { stitchPattern: e.target.value as StitchCallout["stitchPattern"] })}
                className="input-field text-xs"
              >
                <option value="">Select...</option>
                {STITCH_PATTERNS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 mb-0.5 block">Thread Color</label>
              <input
                type="text"
                value={selectedCallout.threadColor || ""}
                onChange={(e) => onUpdateCallout(selectedCallout.id, { threadColor: e.target.value })}
                className="input-field text-xs"
                placeholder="Pantone code"
                maxLength={100}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-0.5 block">Notes</label>
            <input
              type="text"
              value={selectedCallout.notes || ""}
              onChange={(e) => onUpdateCallout(selectedCallout.id, { notes: e.target.value })}
              className="input-field text-xs"
              placeholder="Additional notes..."
              maxLength={2000}
            />
          </div>
        </div>
      )}
    </div>
  );
}
