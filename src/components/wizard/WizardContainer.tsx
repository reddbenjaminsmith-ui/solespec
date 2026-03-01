"use client";

import { useState, useCallback } from "react";
import WizardStepper from "./WizardStepper";
import ComponentReview from "./ComponentReview";
import MeasurementReview from "./MeasurementReview";
import MaterialsWizard from "./MaterialsWizard";
import ConstructionWizard from "./ConstructionWizard";
import BOMGenerator from "./BOMGenerator";

interface WizardContainerProps {
  projectId: string;
  initialStep: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
}

export default function WizardContainer({
  projectId,
  initialStep,
  onStepChange,
  onComplete,
}: WizardContainerProps) {
  const [currentStep, setCurrentStep] = useState(Math.max(1, Math.min(6, initialStep)));
  const [stepReady, setStepReady] = useState(false);

  const goToStep = useCallback(
    async (step: number) => {
      if (step < 1 || step > 6) return;

      // Update wizard step in Airtable
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wizardStep: step }),
        });
      } catch {
        // Non-critical - don't block navigation
      }

      setCurrentStep(step);
      setStepReady(false);
      onStepChange(step);
    },
    [projectId, onStepChange]
  );

  const handleStepComplete = useCallback(() => {
    setStepReady(true);
  }, []);

  const handleNext = useCallback(() => {
    if (currentStep === 6) {
      onComplete();
      return;
    }
    goToStep(currentStep + 1);
  }, [currentStep, goToStep, onComplete]);

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const renderStep = () => {
    const props = { projectId, onStepComplete: handleStepComplete };

    switch (currentStep) {
      case 1:
        return <ComponentReview {...props} />;
      case 2:
        return <MeasurementReview {...props} />;
      case 3:
        return <MaterialsWizard {...props} />;
      case 4:
        return <ConstructionWizard {...props} />;
      case 5:
        return <BOMGenerator {...props} />;
      case 6:
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="text-center">
              <h3
                className="text-lg font-semibold text-white mb-1"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                Tech Pack Ready
              </h3>
              <p className="text-sm text-slate-400">
                All data confirmed. Export your factory-ready tech pack.
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <WizardStepper currentStep={currentStep} onStepClick={goToStep} />

      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.06]">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`
            btn-secondary px-4 py-2 rounded-xl text-sm
            ${currentStep === 1 ? "opacity-30 cursor-not-allowed" : ""}
          `}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
          Back
        </button>

        <span
          className="text-xs text-slate-600"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          Step {currentStep} of 6
        </span>

        <button
          onClick={handleNext}
          disabled={!stepReady && currentStep !== 6}
          className={`
            btn-primary px-4 py-2 rounded-xl text-sm
            ${!stepReady && currentStep !== 6 ? "opacity-40 cursor-not-allowed" : ""}
          `}
        >
          {currentStep === 6 ? "Export PDF" : "Next"}
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
