"use client";

import { useState, useCallback, useRef } from "react";
import type { Annotation } from "@/lib/types";

interface AnnotationOverlayProps {
  imageUrl: string;
  annotations: Annotation[];
  onAddAnnotation: (startX: number, startY: number, endX: number, endY: number) => void;
  onRemoveAnnotation: (id: string) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  isEditing: boolean;
}

export default function AnnotationOverlay({
  imageUrl,
  annotations,
  onAddAnnotation,
  onRemoveAnnotation,
  selectedId,
  onSelect,
  isEditing,
}: AnnotationOverlayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawEnd, setDrawEnd] = useState<{ x: number; y: number } | null>(null);
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

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!isEditing) return;
      const coords = getSvgCoords(e);
      setDrawStart(coords);
      setDrawEnd(coords);
    },
    [isEditing, getSvgCoords]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!drawStart) return;
      setDrawEnd(getSvgCoords(e));
    },
    [drawStart, getSvgCoords]
  );

  const handleMouseUp = useCallback(() => {
    if (drawStart && drawEnd) {
      const dx = Math.abs(drawEnd.x - drawStart.x);
      const dy = Math.abs(drawEnd.y - drawStart.y);
      // Only create annotation if dragged at least a small distance
      if (dx > 2 || dy > 2) {
        onAddAnnotation(drawStart.x, drawStart.y, drawEnd.x, drawEnd.y);
      }
    }
    setDrawStart(null);
    setDrawEnd(null);
  }, [drawStart, drawEnd, onAddAnnotation]);

  return (
    <div
      className={`
        relative w-full aspect-[4/3] rounded-xl overflow-hidden border transition-all duration-300
        ${isEditing
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
          alt="Technical view"
          className="absolute inset-0 w-full h-full object-contain"
          style={{ imageRendering: "auto" }}
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setDrawStart(null);
          setDrawEnd(null);
        }}
        style={{ cursor: isEditing ? "crosshair" : "default" }}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="#22d3ee" />
          </marker>
          <marker
            id="arrowhead-preview"
            markerWidth="6"
            markerHeight="4"
            refX="5"
            refY="2"
            orient="auto"
          >
            <polygon points="0 0, 6 2, 0 4" fill="#22d3ee" opacity="0.5" />
          </marker>
          <filter id="arrowGlow">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Existing annotations */}
        {annotations.map((ann) => {
          const isSelected = ann.id === selectedId;
          const isHovered = ann.id === hoveredId;
          const active = isSelected || isHovered;

          // Position label near the end point
          const labelX = ann.arrowEndX > 85 ? ann.arrowEndX - 15 : ann.arrowEndX + 2;
          const labelY = ann.arrowEndY > 90 ? ann.arrowEndY - 4 : ann.arrowEndY + 3;

          return (
            <g key={ann.id} style={{ pointerEvents: "all" }}>
              {/* Arrow line */}
              <line
                x1={ann.arrowStartX}
                y1={ann.arrowStartY}
                x2={ann.arrowEndX}
                y2={ann.arrowEndY}
                stroke="#22d3ee"
                strokeWidth={active ? "0.5" : "0.3"}
                opacity={active ? 1 : 0.7}
                markerEnd="url(#arrowhead)"
                filter={active ? "url(#arrowGlow)" : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ann.id);
                }}
                onMouseEnter={() => setHoveredId(ann.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer" }}
              />

              {/* Start point dot */}
              <circle
                cx={ann.arrowStartX}
                cy={ann.arrowStartY}
                r={active ? "1" : "0.6"}
                fill="#22d3ee"
                opacity={active ? 1 : 0.5}
              />

              {/* Label */}
              {(active || ann.text.length <= 30) && (
                <g>
                  <rect
                    x={labelX - 0.5}
                    y={labelY - 2}
                    width={Math.min(ann.text.length * 0.9 + 2, 30)}
                    height="3"
                    rx="0.5"
                    fill="rgba(0,0,0,0.8)"
                    stroke={active ? "#22d3ee" : "transparent"}
                    strokeWidth="0.15"
                  />
                  <text
                    x={labelX + 0.5}
                    y={labelY}
                    fill={active ? "#22d3ee" : "#e2e8f0"}
                    fontSize="1.6"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="500"
                  >
                    {ann.text.length > 25 ? ann.text.slice(0, 25) + "..." : ann.text}
                  </text>
                </g>
              )}

              {/* Delete button */}
              {active && (
                <g
                  transform={`translate(${ann.arrowEndX + 3}, ${ann.arrowEndY - 3})`}
                  style={{ cursor: "pointer", pointerEvents: "all" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveAnnotation(ann.id);
                  }}
                >
                  <circle r={1.5} fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="0.2" />
                  <line x1={-0.6} y1={-0.6} x2={0.6} y2={0.6} stroke="#ef4444" strokeWidth="0.25" />
                  <line x1={0.6} y1={-0.6} x2={-0.6} y2={0.6} stroke="#ef4444" strokeWidth="0.25" />
                </g>
              )}
            </g>
          );
        })}

        {/* Draw preview */}
        {drawStart && drawEnd && (
          <line
            x1={drawStart.x}
            y1={drawStart.y}
            x2={drawEnd.x}
            y2={drawEnd.y}
            stroke="#22d3ee"
            strokeWidth="0.4"
            strokeDasharray="1 0.5"
            opacity="0.5"
            markerEnd="url(#arrowhead-preview)"
            style={{ pointerEvents: "none" }}
          />
        )}
      </svg>
    </div>
  );
}
