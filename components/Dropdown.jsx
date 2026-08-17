"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export default function Dropdown({ value, onChange, options, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      >
        <span className="truncate">{selected?.label}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-full min-w-[12rem] rounded-xl border border-white/10 bg-[#111] shadow-2xl shadow-black/50 py-1.5 max-h-64 overflow-y-auto">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm cursor-pointer transition-all ${
                  isSelected
                    ? "text-blue-400 bg-blue-500/10"
                    : "text-gray-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
