"use client";

const WIZARD_STEPS = [
  { number: 1, label: "Components" },
  { number: 2, label: "Measurements" },
  { number: 3, label: "Sections" },
  { number: 4, label: "Materials" },
  { number: 5, label: "Construction" },
  { number: 6, label: "BOM" },
  { number: 7, label: "Export" },
];

interface WizardStepperProps {
  currentStep: number;
  onStepClick: (step: number) => void;
}

export default function WizardStepper({ currentStep, onStepClick }: WizardStepperProps) {
  return (
    <div className="glass-card-static px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, i) => {
          const isCompleted = step.number < currentStep;
          const isActive = step.number === currentStep;
          const isFuture = step.number > currentStep;

          return (
            <div key={step.number} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <button
                onClick={() => isCompleted && onStepClick(step.number)}
                disabled={isFuture || isActive}
                className={`
                  flex flex-col items-center gap-1.5 group relative
                  ${isCompleted ? "cursor-pointer" : isFuture ? "cursor-not-allowed opacity-40" : "cursor-default"}
                `}
              >
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                    transition-all duration-300
                    ${isCompleted
                      ? "bg-cyan-400/15 border border-cyan-400/40 text-cyan-400"
                      : isActive
                        ? "bg-cyan-400/20 border-2 border-cyan-400 text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                        : "bg-white/[0.04] border border-white/[0.08] text-slate-600"
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span
                  className={`
                    text-[10px] font-medium whitespace-nowrap
                    ${isActive ? "text-cyan-400" : isCompleted ? "text-slate-300" : "text-slate-600"}
                  `}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  {step.label}
                </span>
              </button>

              {/* Connecting line */}
              {i < WIZARD_STEPS.length - 1 && (
                <div className="flex-1 mx-2 mt-[-18px]">
                  <div
                    className={`
                      h-[2px] w-full rounded-full transition-colors duration-300
                      ${step.number < currentStep ? "bg-cyan-400/40" : "bg-white/[0.06]"}
                    `}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
