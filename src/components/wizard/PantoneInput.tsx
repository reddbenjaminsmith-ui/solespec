"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { PANTONE_COLORS } from "@/lib/constants";

interface PantoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function findPantoneHex(value: string): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  const match = PANTONE_COLORS.find(
    (c) => lower.includes(c.code.toLowerCase()) || lower.includes(c.name.toLowerCase())
  );
  return match?.hex || null;
}

export default function PantoneInput({
  value,
  onChange,
  placeholder = "e.g., 19-4052 TCX Classic Blue",
}: PantoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hex = findPantoneHex(value);

  const filtered = search.trim()
    ? PANTONE_COLORS.filter((c) => {
        const q = search.toLowerCase();
        return c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
      }).slice(0, 8)
    : PANTONE_COLORS.slice(0, 8);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val);
      setSearch(val);
      if (val.length > 0) {
        setOpen(true);
      }
    },
    [onChange]
  );

  const handleSelect = useCallback(
    (color: (typeof PANTONE_COLORS)[number]) => {
      onChange(`${color.code} ${color.name}`);
      setOpen(false);
      setSearch("");
      inputRef.current?.blur();
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-2">
        {/* Color swatch */}
        <div
          className="w-6 h-6 rounded-md border border-white/[0.1] shrink-0"
          style={{ backgroundColor: hex || "#1e1e2e" }}
        />
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="input-field text-xs flex-1"
          maxLength={100}
        />
      </div>

      {/* Dropdown */}
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl overflow-hidden border border-white/[0.08] shadow-xl" style={{ background: "rgba(15,15,25,0.95)", backdropFilter: "blur(20px)" }}>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((color) => (
              <button
                key={color.code}
                onClick={() => handleSelect(color)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.05] transition-colors"
              >
                <div
                  className="w-4 h-4 rounded-sm border border-white/[0.1] shrink-0"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="text-[10px] text-slate-400 font-medium shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  {color.code}
                </span>
                <span className="text-xs text-slate-300 truncate">
                  {color.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
