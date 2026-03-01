"use client";

import { useState } from "react";
import type { ShoeComponent } from "@/lib/types";

interface AnnotatedViewProps {
  imageUrl: string;
  components: ShoeComponent[];
  selectedComponentId: string | null;
  onComponentSelect: (id: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  upper: "#22d3ee",
  sole: "#a78bfa",
  lining: "#34d399",
  hardware: "#fbbf24",
  other: "#94a3b8",
};

export default function AnnotatedView({
  imageUrl,
  components,
  selectedComponentId,
  onComponentSelect,
}: AnnotatedViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="relative w-full aspect-[4/3] bg-white/[0.02] rounded-xl overflow-hidden border border-white/[0.06]">
      {/* Base image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Technical view"
        className="absolute inset-0 w-full h-full object-contain"
      />

      {/* SVG overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: "none" }}
      >
        {components.map((comp) => {
          const isSelected = comp.id === selectedComponentId;
          const isHovered = comp.id === hoveredId;
          const color = CATEGORY_COLORS[comp.category] || CATEGORY_COLORS.other;
          const opacity = comp.confirmed ? 1 : 0.7;

          // Label position - offset from dot
          const labelX = comp.labelX > 70 ? comp.labelX - 15 : comp.labelX + 5;
          const labelY = comp.labelY > 85 ? comp.labelY - 5 : comp.labelY + 4;

          return (
            <g key={comp.id} style={{ pointerEvents: "all", cursor: "pointer" }}>
              {/* Pulse ring on selected */}
              {isSelected && (
                <circle
                  cx={comp.labelX}
                  cy={comp.labelY}
                  r="2.5"
                  fill="none"
                  stroke={color}
                  strokeWidth="0.3"
                  opacity={0.4}
                >
                  <animate
                    attributeName="r"
                    values="1.5;3;1.5"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.6;0;0.6"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}

              {/* Dot */}
              <circle
                cx={comp.labelX}
                cy={comp.labelY}
                r={isSelected || isHovered ? "1.5" : "1"}
                fill={color}
                opacity={opacity}
                onClick={() => onComponentSelect(comp.id)}
                onMouseEnter={() => setHoveredId(comp.id)}
                onMouseLeave={() => setHoveredId(null)}
              />

              {/* Leader line */}
              <line
                x1={comp.labelX}
                y1={comp.labelY}
                x2={labelX}
                y2={labelY - 1.5}
                stroke={color}
                strokeWidth="0.2"
                opacity={isSelected || isHovered ? 0.8 : 0.4}
              />

              {/* Label background */}
              {(isSelected || isHovered) && (
                <rect
                  x={labelX - 0.5}
                  y={labelY - 2.5}
                  width={comp.name.length * 1.1 + 1}
                  height="3"
                  rx="0.5"
                  fill="rgba(0,0,0,0.7)"
                  onClick={() => onComponentSelect(comp.id)}
                  onMouseEnter={() => setHoveredId(comp.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              )}

              {/* Label text */}
              {(isSelected || isHovered) && (
                <text
                  x={labelX}
                  y={labelY}
                  fill={color}
                  fontSize="1.8"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="500"
                  onClick={() => onComponentSelect(comp.id)}
                  onMouseEnter={() => setHoveredId(comp.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {comp.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
