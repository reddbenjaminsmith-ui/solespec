"use client";

const STATUS_CONFIG = {
  draft: {
    bg: "bg-slate-500/10",
    text: "text-slate-400",
    border: "border-slate-500/20",
    label: "Draft",
    pulse: false,
  },
  analyzing: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/20",
    label: "Analyzing",
    pulse: true,
  },
  in_progress: {
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
    border: "border-cyan-500/20",
    label: "In Progress",
    pulse: false,
  },
  complete: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/20",
    label: "Complete",
    pulse: false,
  },
} as const;

type ProjectStatus = keyof typeof STATUS_CONFIG;

interface StatusBadgeProps {
  status: ProjectStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border
        ${config.bg} ${config.text} ${config.border}
      `}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
        </span>
      )}
      {config.label}
    </span>
  );
}
