"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ModelViewerWrapper from "@/components/ModelViewerWrapper";
import type { ThreeRefs } from "@/components/ModelViewerWrapper";
import ViewCaptureWrapper from "@/components/ViewCaptureWrapper";
import PhotorealisticRender from "@/components/PhotorealisticRender";
import WizardContainer from "@/components/wizard/WizardContainer";
import type { Project, RenderedView } from "@/lib/types";
import type * as THREE from "three";
import { CAMERA_POSITIONS } from "@/lib/three/camera-positions";
import type { TechnicalView } from "@/lib/constants";
import { useSSEStream } from "@/lib/useSSEStream";

type WorkspacePhase = "capture" | "analysis" | "wizard" | "complete";

export default function ProjectWorkspacePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [views, setViews] = useState<RenderedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Three.js state from ModelViewer
  const [threeRefs, setThreeRefs] = useState<ThreeRefs | null>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [captureComplete, setCaptureComplete] = useState(false);

  // Phase state machine
  const [phase, setPhase] = useState<WorkspacePhase>("capture");

  // Analysis state
  const [analysisStatus, setAnalysisStatus] = useState("");
  const [analysisSummary, setAnalysisSummary] = useState<{
    componentCount: number;
    measurementCount: number;
    shoeType: string;
  } | null>(null);
  const [analysisError, setAnalysisError] = useState("");
  const { start: startSSE, isStreaming: analyzing } = useSSEStream();

  // Wizard state
  const [wizardStep, setWizardStep] = useState(1);

  // Fetch project + existing views
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load project");
          }
          return;
        }
        const data = await res.json();
        setProject(data);

        // Check for existing views
        const viewsRes = await fetch(`/api/views?projectId=${projectId}`);
        if (viewsRes.ok) {
          const viewsData = await viewsRes.json();
          if (viewsData.views && viewsData.views.length > 0) {
            setViews(viewsData.views);
            if (viewsData.views.length >= 7) {
              setCaptureComplete(true);
            }
          }
        }

        // Smart resume: determine phase from project state
        if (data.status === "complete") {
          setPhase("complete");
        } else if (data.wizardStep >= 1) {
          setPhase("wizard");
          setWizardStep(data.wizardStep);
          setCaptureComplete(true);
        } else if (data.status === "in_progress") {
          setPhase("wizard");
          setWizardStep(1);
          setCaptureComplete(true);
        }
      } catch {
        setError("Failed to load project");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [projectId]);

  const handleModelLoaded = useCallback((scene: THREE.Group) => {
    setModelScene(scene);
  }, []);

  const handleThreeReady = useCallback((refs: ThreeRefs) => {
    setThreeRefs(refs);
    setModelReady(true);
  }, []);

  const handleCaptureComplete = useCallback(
    (capturedViews: RenderedView[]) => {
      setViews(capturedViews);
      setCaptureComplete(true);

      // Set the 3/4 view as thumbnail
      const threeQuarter = capturedViews.find(
        (v) => v.viewName === "three_quarter"
      );
      if (threeQuarter) {
        fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            thumbnailUrl: threeQuarter.imageUrl,
          }),
        }).catch(() => {});
      }

      setPhase("analysis");
    },
    [projectId]
  );

  // Start AI analysis
  const handleStartAnalysis = useCallback(() => {
    setAnalysisStatus("Starting analysis...");
    setAnalysisError("");
    setAnalysisSummary(null);

    startSSE(
      "/api/analyze",
      { projectId },
      {
        onEvent: (event, data) => {
          const d = data as Record<string, unknown>;
          switch (event) {
            case "status":
              setAnalysisStatus((d.message as string) || "Processing...");
              break;
            case "components":
              setAnalysisStatus(
                `Found ${d.count || 0} components (${d.shoeType || "shoe"})`
              );
              break;
            case "measurements":
              setAnalysisStatus(
                `Estimated ${d.count || 0} measurements`
              );
              break;
            case "complete":
              setAnalysisSummary({
                componentCount: (d.componentCount as number) || 0,
                measurementCount: (d.measurementCount as number) || 0,
                shoeType: (d.shoeType as string) || "",
              });
              setAnalysisStatus("Analysis complete");
              break;
            case "error":
              setAnalysisError(
                (d.message as string) || "Analysis failed"
              );
              break;
          }
        },
        onError: (err) => {
          setAnalysisError(err);
        },
      }
    );
  }, [projectId, startSSE]);

  const handleGoToWizard = useCallback(() => {
    setPhase("wizard");
    setWizardStep(1);
  }, []);

  const handleWizardComplete = useCallback(() => {
    // Export PDF
    window.open(`/api/export/pdf/${projectId}`, "_blank");
    setPhase("complete");
    // Update project status
    fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete" }),
    }).catch(() => {});
  }, [projectId]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Loading project...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h2
            className="text-xl font-bold text-white mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {error || "Project not found"}
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            The project you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.
          </p>
          <Link
            href="/dashboard"
            className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold no-underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const needsCapture =
    modelReady &&
    threeRefs &&
    modelScene &&
    !captureComplete &&
    views.length === 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 py-3 bg-surface-900/60 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-lg font-bold tracking-tight no-underline"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="text-accent">Sole</span>
            <span className="text-white">Spec</span>
          </Link>
          <span className="text-white/[0.12]">|</span>
          <h1
            className="text-sm font-medium text-white truncate max-w-[300px]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {project.name}
          </h1>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-400 hover:text-white transition-colors no-underline flex items-center gap-1.5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
            />
          </svg>
          Dashboard
        </Link>
      </nav>

      {/* Main workspace */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: 3D Viewer */}
        <div className="lg:w-[60%] p-4 lg:p-6">
          <div className="h-[50vh] lg:h-full rounded-2xl overflow-hidden border border-white/[0.06]">
            {project.modelUrl ? (
              <ModelViewerWrapper
                modelUrl={project.modelUrl}
                onModelLoaded={handleModelLoaded}
                onReady={handleThreeReady}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-surface-900">
                <p className="text-sm text-slate-500">No 3D model uploaded</p>
              </div>
            )}
          </div>
        </div>

        {/* Right panel - changes based on phase */}
        <div className="lg:w-[40%] p-4 lg:p-6 lg:pl-0 flex flex-col gap-4">
          {/* Phase: Capture */}
          {phase === "capture" && (
            <>
              <div>
                <h2
                  className="text-base font-semibold text-white mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Technical Views
                </h2>
                <p className="text-xs text-slate-500">
                  {captureComplete
                    ? "7 views captured and saved"
                    : needsCapture
                      ? "Ready to capture 7 standard views"
                      : modelReady
                        ? "Preparing view capture..."
                        : "Load the 3D model to capture views"}
                </p>
              </div>

              {needsCapture && threeRefs && modelScene && (
                <ViewCaptureWrapper
                  projectId={projectId}
                  threeRefs={threeRefs}
                  modelScene={modelScene}
                  onCaptureComplete={handleCaptureComplete}
                  autoStart={true}
                />
              )}

              {views.length > 0 && (
                <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 flex-1 content-start">
                  {views.map((view) => {
                    const camPos =
                      CAMERA_POSITIONS[view.viewName as TechnicalView];
                    return (
                      <div
                        key={view.id}
                        className="group rounded-xl overflow-hidden border border-white/[0.06] bg-surface-900/50 transition-all duration-200 hover:border-accent/20"
                      >
                        <div className="aspect-square relative bg-surface-950">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={view.imageUrl}
                            alt={`${camPos?.label || view.viewName} view`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="px-3 py-2">
                          <p
                            className="text-xs text-slate-300 font-medium"
                            style={{
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {camPos?.label || view.viewName}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {views.length === 0 && !needsCapture && !captureComplete && (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center p-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.04] flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-slate-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
                        />
                      </svg>
                    </div>
                    <p className="text-sm text-slate-500">
                      Views will be captured once the model loads
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Phase: Analysis */}
          {phase === "analysis" && (
            <>
              <div>
                <h2
                  className="text-base font-semibold text-white mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  AI Analysis
                </h2>
                <p className="text-xs text-slate-500">
                  Detect components and estimate measurements from your captures
                </p>
              </div>

              {/* Photorealistic render (optional) */}
              <PhotorealisticRender projectId={projectId} />

              {/* Analysis section */}
              <div className="glass-card-static p-6 rounded-xl">
                {!analyzing && !analysisSummary && !analysisError && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                      </svg>
                    </div>
                    <h3
                      className="text-sm font-semibold text-white mb-1"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Component Detection
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      AI analyzes your 7 views to identify components and estimate measurements
                    </p>
                    <button
                      onClick={handleStartAnalysis}
                      className="btn-primary px-5 py-2.5 rounded-xl text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                      Run AI Analysis
                    </button>
                  </div>
                )}

                {analyzing && (
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-white mb-1">{analysisStatus}</p>
                    <p className="text-xs text-slate-500">This may take 30-60 seconds</p>
                  </div>
                )}

                {analysisError && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 mb-3">{analysisError}</p>
                    <button onClick={handleStartAnalysis} className="btn-secondary px-4 py-2 rounded-xl text-sm">
                      Retry Analysis
                    </button>
                  </div>
                )}

                {analysisSummary && !analyzing && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <h3
                      className="text-sm font-semibold text-white mb-2"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Analysis Complete
                    </h3>
                    <div className="flex justify-center gap-6 mb-4">
                      <div className="text-center">
                        <p
                          className="text-2xl font-bold text-cyan-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {analysisSummary.componentCount}
                        </p>
                        <p className="text-xs text-slate-500">Components</p>
                      </div>
                      <div className="text-center">
                        <p
                          className="text-2xl font-bold text-cyan-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {analysisSummary.measurementCount}
                        </p>
                        <p className="text-xs text-slate-500">Measurements</p>
                      </div>
                    </div>
                    {analysisSummary.shoeType && (
                      <p className="text-xs text-slate-400 mb-4">
                        Detected: {analysisSummary.shoeType}
                      </p>
                    )}
                    <button
                      onClick={handleGoToWizard}
                      className="btn-primary px-6 py-2.5 rounded-xl text-sm"
                    >
                      Continue to Review
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* View thumbnails */}
              {views.length > 0 && (
                <div>
                  <p className="section-label mb-2">Captured Views</p>
                  <div className="grid grid-cols-4 gap-2">
                    {views.slice(0, 4).map((view) => (
                      <div key={view.id} className="rounded-lg overflow-hidden border border-white/[0.06]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={view.imageUrl} alt={view.viewName} className="w-full aspect-square object-contain bg-white/[0.02]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Phase: Wizard */}
          {phase === "wizard" && (
            <WizardContainer
              projectId={projectId}
              initialStep={wizardStep}
              onStepChange={setWizardStep}
              onComplete={handleWizardComplete}
            />
          )}

          {/* Phase: Complete */}
          {phase === "complete" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                </div>
                <h2
                  className="text-xl font-semibold text-white mb-2"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Tech Pack Complete
                </h2>
                <p className="text-sm text-slate-400 mb-6">
                  Your factory-ready tech pack has been generated.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => window.open(`/api/export/pdf/${projectId}`, "_blank")}
                    className="btn-primary px-6 py-3 rounded-xl text-sm"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                    </svg>
                    Download PDF Tech Pack
                  </button>
                  <button
                    onClick={() => { setPhase("wizard"); setWizardStep(1); }}
                    className="btn-secondary px-6 py-3 rounded-xl text-sm"
                  >
                    Edit Tech Pack
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
