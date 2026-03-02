"use client";

import { useState, useCallback, useRef } from "react";
import type { CrossSection } from "@/lib/types";

interface CrossSectionViewPanelProps {
  viewType: "top" | "right";
  viewLabel: string;
  imageUrl: string;
  lines: CrossSection[];
  onAddLine: (position: number) => void;
  onRemoveLine: (label: string) => void;
  onUpdateLine: (label: string, position: number) => void;
  onSelectLine: (label: string | null) => void;
  selectedLabel: string | null;
  placementMode: boolean;
}

export default function CrossSectionViewPanel({
  viewLabel,
  imageUrl,
  lines,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
  onSelectLine,
  selectedLabel,
  placementMode,
}: CrossSectionViewPanelProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgX = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return 0;
      const rect = svgRef.current.getBoundingClientRect();
      return ((e.clientX - rect.left) / rect.width) * 100;
    },
    []
  );

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (dragging) return;
      if (placementMode) {
        const x = getSvgX(e);
        onAddLine(Math.round(x * 10) / 10);
      } else {
        onSelectLine(null);
      }
    },
    [placementMode, dragging, getSvgX, onAddLine, onSelectLine]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!dragging) return;
      const x = getSvgX(e);
      onUpdateLine(dragging, Math.round(x * 10) / 10);
    },
    [dragging, getSvgX, onUpdateLine]
  );

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4
          className="text-xs font-semibold text-slate-300 uppercase tracking-wider"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {viewLabel}
        </h4>
        {placementMode && (
          <span className="text-[10px] text-cyan-400 animate-pulse" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Click to place line
          </span>
        )}
      </div>
      <div
        className={`
          relative w-full aspect-[4/3] rounded-xl overflow-hidden
          border transition-all duration-300
          ${placementMode
            ? "border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.1)] cursor-crosshair"
            : "border-white/[0.06]"
          }
        `}
        style={{ background: "rgba(255,255,255,0.02)" }}
      >
        {/* Base image */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={viewLabel}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ imageRendering: "auto" }}
            loading="eager"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-xs">
            No view captured
          </div>
        )}

        {/* SVG overlay */}
        <svg
          ref={svgRef}
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          onClick={handleSvgClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ cursor: placementMode ? "crosshair" : "default" }}
        >
          <defs>
            <filter id="lineGlow">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {lines.map((line) => {
            const isSelected = line.label === selectedLabel;
            const isHovered = line.label === hoveredLabel;
            const active = isSelected || isHovered;

            return (
              <g key={line.label} style={{ pointerEvents: "all" }}>
                {/* Full-height vertical line */}
                <line
                  x1={line.linePosition}
                  y1={0}
                  x2={line.linePosition}
                  y2={100}
                  stroke="#22d3ee"
                  strokeWidth={active ? "0.6" : "0.4"}
                  strokeDasharray={active ? "none" : "1.5 1"}
                  opacity={active ? 1 : 0.7}
                  filter={active ? "url(#lineGlow)" : undefined}
                  style={{ cursor: "ew-resize" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setDragging(line.label);
                    onSelectLine(line.label);
                  }}
                  onMouseEnter={() => setHoveredLabel(line.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                />

                {/* Top label badge */}
                <g
                  transform={`translate(${line.linePosition}, 3)`}
                  style={{ cursor: "pointer", pointerEvents: "all" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectLine(line.label);
                  }}
                  onMouseEnter={() => setHoveredLabel(line.label)}
                  onMouseLeave={() => setHoveredLabel(null)}
                >
                  <rect
                    x={-3.5}
                    y={-2}
                    width={7}
                    height={3.5}
                    rx={0.8}
                    fill={active ? "rgba(34,211,238,0.2)" : "rgba(0,0,0,0.7)"}
                    stroke="#22d3ee"
                    strokeWidth={active ? "0.3" : "0.15"}
                  />
                  <text
                    x={0}
                    y={0.6}
                    fill="#22d3ee"
                    fontSize="2"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {line.label}
                  </text>
                </g>

                {/* Bottom label badge */}
                <g
                  transform={`translate(${line.linePosition}, 97)`}
                  style={{ pointerEvents: "all" }}
                >
                  <rect
                    x={-3.5}
                    y={-2}
                    width={7}
                    height={3.5}
                    rx={0.8}
                    fill={active ? "rgba(34,211,238,0.2)" : "rgba(0,0,0,0.7)"}
                    stroke="#22d3ee"
                    strokeWidth={active ? "0.3" : "0.15"}
                  />
                  <text
                    x={0}
                    y={0.6}
                    fill="#22d3ee"
                    fontSize="2"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {line.label}
                  </text>
                </g>

                {/* Delete button on hover/select */}
                {active && (
                  <g
                    transform={`translate(${line.linePosition + 4.5}, 3)`}
                    style={{ cursor: "pointer", pointerEvents: "all" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveLine(line.label);
                    }}
                  >
                    <circle r={1.8} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="0.2" />
                    <line x1={-0.8} y1={-0.8} x2={0.8} y2={0.8} stroke="#ef4444" strokeWidth="0.3" />
                    <line x1={0.8} y1={-0.8} x2={-0.8} y2={0.8} stroke="#ef4444" strokeWidth="0.3" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
