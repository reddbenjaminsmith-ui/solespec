"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ModelViewerWrapper from "@/components/ModelViewerWrapper";
import type { ThreeRefs } from "@/components/ModelViewerWrapper";
import ViewCaptureWrapper from "@/components/ViewCaptureWrapper";
import PhotorealisticRender from "@/components/PhotorealisticRender";
import StudioRender from "@/components/StudioRender";
import HeroRender from "@/components/HeroRender";
import WizardContainer from "@/components/wizard/WizardContainer";
import type { Project, RenderedView, SketchAnalysisResult } from "@/lib/types";
import type * as THREE from "three";
import { CAMERA_POSITIONS } from "@/lib/three/camera-positions";
import type { TechnicalView } from "@/lib/constants";
import { useSSEStream } from "@/lib/useSSEStream";
import { upload } from "@vercel/blob/client";
import {
  extractDimensions,
  calculateCameraDistance,
} from "@/lib/three/extract-dimensions";

// Views to capture from the predecessor model
const PREDECESSOR_CAPTURE_VIEWS: TechnicalView[] = ["right", "left", "front", "back", "three_quarter"];

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    function tick() {
      remaining--;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

type WorkspacePhase = "predecessor-capture" | "sketch-analysis" | "sketch-views" | "capture" | "analysis" | "wizard" | "complete";

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

  // Sketch workflow state
  const [sketchAnalysisResult, setSketchAnalysisResult] = useState<SketchAnalysisResult | null>(null);
  const [sketchStatus, setSketchStatus] = useState("");
  const [sketchError, setSketchError] = useState("");
  const [generatedViews, setGeneratedViews] = useState<Array<{ viewName: string; imageUrl: string }>>([]);
  const [viewGenStatus, setViewGenStatus] = useState("");
  const [viewGenError, setViewGenError] = useState("");
  const { start: startSketchSSE, isStreaming: analyzingSketch } = useSSEStream();
  const { start: startViewGenSSE, isStreaming: generatingViews } = useSSEStream();

  // Separate basic captures from photorealistic/studio renders
  const basicViews = useMemo(() => views.filter((v) => !v.isPhotorealistic && !v.isStudioRender), [views]);
  const photoViews = useMemo(() => views.filter((v) => v.isPhotorealistic), [views]);
  const studioViews = useMemo(() => views.filter((v) => v.isStudioRender), [views]);
  const heroRefViews = useMemo(() => views.filter((v) => v.isHeroReference), [views]);

  // Predecessor capture state
  const [predecessorRenders, setPredecessorRenders] = useState<Array<{ viewName: string; imageUrl: string }>>([]);
  const [predecessorCaptureStatus, setPredecessorCaptureStatus] = useState("");
  const [predecessorCaptureError, setPredecessorCaptureError] = useState("");
  const [capturingPredecessor, setCapturingPredecessor] = useState(false);

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
        let fetchedViewCount = 0;
        const viewsRes = await fetch(`/api/views?projectId=${projectId}`);
        if (viewsRes.ok) {
          const viewsData = await viewsRes.json();
          if (viewsData.views && viewsData.views.length > 0) {
            setViews(viewsData.views);
            fetchedViewCount = viewsData.views.length;
            const minViews = data.sourceType === "Sketch" ? 5 : 7;
            if (viewsData.views.length >= minViews) {
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
        } else if (data.sourceType === "Sketch") {
          // Sketch workflow: parse existing analysis if available
          if (data.sketchAnalysis) {
            try {
              setSketchAnalysisResult(JSON.parse(data.sketchAnalysis));
            } catch { /* ignore parse error */ }
          }
          if (fetchedViewCount >= 5) {
            // Views already generated - go to component analysis
            setCaptureComplete(true);
            setPhase("analysis");
          } else {
            // Need predecessor captures first - they provide the AI with
            // actual visual reference of the 3D form and proportions
            setPhase("predecessor-capture");
          }
        } else if (fetchedViewCount >= 7) {
          // 3D model with views already captured - go to analysis
          setCaptureComplete(true);
          setPhase("analysis");
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

  // Capture predecessor model from 5 angles for AI reference
  const capturePredecessorViews = useCallback(async () => {
    if (capturingPredecessor || !threeRefs || !modelScene) return;
    setCapturingPredecessor(true);
    setPredecessorCaptureError("");
    setPredecessorCaptureStatus("Capturing reference model...");

    const { camera, gl, controls, scene, canvas } = threeRefs;
    const dims = extractDimensions(modelScene);
    const distance = calculateCameraDistance(dims);
    const captures: Array<{ viewName: string; imageUrl: string }> = [];

    try {
      for (let i = 0; i < PREDECESSOR_CAPTURE_VIEWS.length; i++) {
        const viewName = PREDECESSOR_CAPTURE_VIEWS[i];
        const camPos = CAMERA_POSITIONS[viewName];
        setPredecessorCaptureStatus(`Capturing ${camPos.label} (${i + 1}/${PREDECESSOR_CAPTURE_VIEWS.length})...`);

        const scale = distance / 3;
        const cam = camera as unknown as { position: { set: (x: number, y: number, z: number) => void }; lookAt: (x: number, y: number, z: number) => void };
        cam.position.set(
          camPos.position[0] * scale + dims.center.x,
          camPos.position[1] * scale + dims.center.y,
          camPos.position[2] * scale + dims.center.z
        );
        cam.lookAt(dims.center.x, dims.center.y, dims.center.z);

        if (controls && typeof controls === "object" && "target" in controls) {
          const ctrl = controls as { target: { set: (x: number, y: number, z: number) => void }; update: () => void };
          ctrl.target.set(dims.center.x, dims.center.y, dims.center.z);
          ctrl.update();
        }

        const renderer = gl as unknown as { render: (scene: unknown, camera: unknown) => void };
        renderer.render(scene, cam);
        await waitFrames(3);

        const dataUrl = canvas.toDataURL("image/png");
        const fetchRes = await fetch(dataUrl);
        const imageBlob = await fetchRes.blob();

        const uploadResult = await upload(
          `predecessor-views/${projectId}/${viewName}.png`,
          imageBlob,
          { access: "public", handleUploadUrl: "/api/upload/token" }
        );

        captures.push({ viewName, imageUrl: uploadResult.url });
      }

      setPredecessorRenders(captures);
      setPredecessorCaptureStatus("Reference captures ready");

      // Transition to the right sketch phase
      if (sketchAnalysisResult) {
        setPhase("sketch-views");
      } else {
        setPhase("sketch-analysis");
      }
    } catch (err) {
      console.error(
        "Predecessor capture failed:",
        err instanceof Error ? err.message : "Unknown error"
      );
      setPredecessorCaptureError("Failed to capture reference model. Please try again.");
    } finally {
      setCapturingPredecessor(false);
    }
  }, [capturingPredecessor, threeRefs, modelScene, projectId, sketchAnalysisResult]);

  // Auto-trigger predecessor capture when model is ready
  useEffect(() => {
    if (phase === "predecessor-capture" && modelReady && threeRefs && modelScene && !capturingPredecessor && predecessorRenders.length === 0) {
      const timer = setTimeout(() => capturePredecessorViews(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, modelReady, threeRefs, modelScene, capturingPredecessor, predecessorRenders.length, capturePredecessorViews]);

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
    if (analyzing) return; // Prevent duplicate streams
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
  }, [analyzing, projectId, startSSE]);

  // Sketch analysis handler
  const handleStartSketchAnalysis = useCallback(() => {
    if (analyzingSketch) return; // Prevent duplicate streams
    setSketchStatus("Starting sketch analysis...");
    setSketchError("");
    setSketchAnalysisResult(null);

    const lateralRender = predecessorRenders.find(v => v.viewName === "right");
    startSketchSSE(
      "/api/sketch/analyze",
      { projectId, predecessorLateralUrl: lateralRender?.imageUrl },
      {
        onEvent: (event, data) => {
          const d = data as Record<string, unknown>;
          switch (event) {
            case "status":
              setSketchStatus((d.message as string) || "Processing...");
              break;
            case "analysis":
            case "complete":
              if (d.analysis) {
                setSketchAnalysisResult(d.analysis as unknown as SketchAnalysisResult);
                setSketchStatus("Analysis complete");
              }
              break;
            case "error":
              setSketchError((d.message as string) || "Analysis failed");
              break;
          }
        },
        onError: (err) => {
          setSketchError(err);
        },
      }
    );
  }, [analyzingSketch, projectId, startSketchSSE, predecessorRenders]);

  // View generation handler
  const handleStartViewGeneration = useCallback(() => {
    if (generatingViews) return; // Prevent duplicate streams
    setViewGenStatus("Starting view generation...");
    setViewGenError("");
    setGeneratedViews([]);

    startViewGenSSE(
      "/api/sketch/generate-views",
      { projectId, predecessorViews: predecessorRenders },
      {
        onEvent: (event, data) => {
          const d = data as Record<string, unknown>;
          switch (event) {
            case "status":
              setViewGenStatus((d.message as string) || "Processing...");
              break;
            case "view_saved":
              setGeneratedViews(prev => [...prev, {
                viewName: d.viewName as string,
                imageUrl: d.imageUrl as string,
              }]);
              setViews(prev => [...prev, {
                id: d.recordId as string,
                projectId,
                viewName: d.viewName as string,
                imageUrl: d.imageUrl as string,
              } as RenderedView]);
              break;
            case "view_error":
              setViewGenStatus(`Warning: Failed to generate ${d.viewName} view`);
              break;
            case "complete":
              setViewGenStatus("All views generated");
              setCaptureComplete(true);
              break;
            case "error":
              setViewGenError((d.message as string) || "View generation failed");
              break;
          }
        },
        onError: (err) => {
          setViewGenError(err);
        },
      }
    );
  }, [generatingViews, projectId, startViewGenSSE, predecessorRenders]);

  // Transition from sketch-analysis to sketch-views and start generation
  const handleGenerateViews = useCallback(() => {
    if (generatingViews) return; // Prevent duplicate streams
    setPhase("sketch-views");
    setViewGenStatus("Starting view generation...");
    setViewGenError("");
    setGeneratedViews([]);

    startViewGenSSE(
      "/api/sketch/generate-views",
      { projectId, predecessorViews: predecessorRenders },
      {
        onEvent: (event, data) => {
          const d = data as Record<string, unknown>;
          switch (event) {
            case "status":
              setViewGenStatus((d.message as string) || "Processing...");
              break;
            case "view_saved":
              setGeneratedViews(prev => [...prev, {
                viewName: d.viewName as string,
                imageUrl: d.imageUrl as string,
              }]);
              setViews(prev => [...prev, {
                id: d.recordId as string,
                projectId,
                viewName: d.viewName as string,
                imageUrl: d.imageUrl as string,
              } as RenderedView]);
              break;
            case "view_error":
              setViewGenStatus(`Warning: Failed to generate ${d.viewName} view`);
              break;
            case "complete":
              setViewGenStatus("All views generated");
              setCaptureComplete(true);
              break;
            case "error":
              setViewGenError((d.message as string) || "View generation failed");
              break;
          }
        },
        onError: (err) => {
          setViewGenError(err);
        },
      }
    );
  }, [generatingViews, projectId, startViewGenSSE, predecessorRenders]);

  // Transition from sketch-views to analysis
  const handleSketchContinue = useCallback(() => {
    setPhase("analysis");
  }, []);

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
        {/* Left: Sketch Image or 3D Viewer */}
        <div className="lg:w-[60%] p-4 lg:p-6">
          <div className="h-[50vh] lg:h-full rounded-2xl overflow-hidden border border-white/[0.06]">
            {phase === "predecessor-capture" && (project.predecessorModelUrl || project.modelUrl) ? (
              <ModelViewerWrapper
                modelUrl={project.predecessorModelUrl || project.modelUrl}
                onModelLoaded={handleModelLoaded}
                onReady={handleThreeReady}
              />
            ) : (phase === "sketch-analysis" || phase === "sketch-views") && project.sketchUrl ? (
              <div className="w-full h-full flex items-center justify-center bg-surface-900/80 p-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.sketchUrl}
                  alt="Shoe sketch"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            ) : project.modelUrl ? (
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
          {/* Phase: Predecessor Capture */}
          {phase === "predecessor-capture" && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-8">
                {predecessorCaptureError ? (
                  <>
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 mb-3">{predecessorCaptureError}</p>
                    <button
                      onClick={() => {
                        setPredecessorCaptureError("");
                        capturePredecessorViews();
                      }}
                      className="btn-secondary px-4 py-2 rounded-xl text-sm"
                    >
                      Retry Capture
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 mx-auto mb-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <h3
                      className="text-sm font-semibold text-white mb-1"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Preparing Reference Model
                    </h3>
                    <p className="text-xs text-slate-500 mb-2">
                      Capturing predecessor from multiple angles so AI can match proportions
                    </p>
                    <p
                      className="text-xs text-cyan-400"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {predecessorCaptureStatus || "Loading 3D model..."}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Phase: Sketch Analysis */}
          {phase === "sketch-analysis" && (
            <>
              <div>
                <h2
                  className="text-base font-semibold text-white mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Sketch Analysis
                </h2>
                <p className="text-xs text-slate-500">
                  AI analyzes your sketch to identify components and design elements
                </p>
              </div>

              <div className="glass-card-static p-6 rounded-xl">
                {!analyzingSketch && !sketchAnalysisResult && !sketchError && (
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
                      Analyze Your Sketch
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      GPT-5.2 Vision will identify components, panel lines, and design elements from your lateral sketch
                    </p>
                    <button
                      onClick={handleStartSketchAnalysis}
                      className="btn-primary px-5 py-2.5 rounded-xl text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                      </svg>
                      Run Sketch Analysis
                    </button>
                  </div>
                )}

                {analyzingSketch && (
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-white mb-1">{sketchStatus}</p>
                    <p className="text-xs text-slate-500">This may take 15-30 seconds</p>
                  </div>
                )}

                {sketchError && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 mb-3">{sketchError}</p>
                    <button onClick={handleStartSketchAnalysis} className="btn-secondary px-4 py-2 rounded-xl text-sm">
                      Retry Analysis
                    </button>
                  </div>
                )}

                {sketchAnalysisResult && !analyzingSketch && (
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
                      Sketch Analyzed
                    </h3>
                    <div className="flex justify-center gap-6 mb-3">
                      <div className="text-center">
                        <p
                          className="text-2xl font-bold text-cyan-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {sketchAnalysisResult.components.length}
                        </p>
                        <p className="text-xs text-slate-500">Components</p>
                      </div>
                      <div className="text-center">
                        <p
                          className="text-2xl font-bold text-cyan-400"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {sketchAnalysisResult.panelLines.length}
                        </p>
                        <p className="text-xs text-slate-500">Panel Lines</p>
                      </div>
                    </div>
                    {sketchAnalysisResult.shoeType && (
                      <p className="text-xs text-slate-400 mb-1">
                        Type: {sketchAnalysisResult.shoeType}
                      </p>
                    )}
                    {sketchAnalysisResult.styleDescription && (
                      <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                        {sketchAnalysisResult.styleDescription}
                      </p>
                    )}
                    <button
                      onClick={handleGenerateViews}
                      className="btn-primary px-6 py-2.5 rounded-xl text-sm"
                    >
                      Generate Multi-View Images
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Component list */}
              {sketchAnalysisResult && sketchAnalysisResult.components.length > 0 && (
                <div>
                  <p className="section-label mb-2">Detected Components</p>
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {sketchAnalysisResult.components.map((comp, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                      >
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 uppercase tracking-wider"
                          style={{ fontFamily: "'JetBrains Mono', monospace" }}
                        >
                          {comp.category}
                        </span>
                        <span className="text-xs text-white">{comp.name}</span>
                        <span className="text-[10px] text-slate-500 ml-auto">{comp.region}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Phase: Sketch Views */}
          {phase === "sketch-views" && (
            <>
              <div>
                <h2
                  className="text-base font-semibold text-white mb-1"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  Multi-View Generation
                </h2>
                <p className="text-xs text-slate-500">
                  AI generates additional angles from your lateral sketch
                </p>
              </div>

              <div className="glass-card-static p-6 rounded-xl">
                {!generatingViews && generatedViews.length === 0 && !viewGenError && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                    </div>
                    <h3
                      className="text-sm font-semibold text-white mb-1"
                      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      Ready to Generate Views
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      Generate medial, front, back, and 3/4 views from your sketch
                    </p>
                    <button
                      onClick={handleStartViewGeneration}
                      className="btn-primary px-5 py-2.5 rounded-xl text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                      </svg>
                      Generate Views
                    </button>
                  </div>
                )}

                {generatingViews && (
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-white mb-1">{viewGenStatus}</p>
                    <p className="text-xs text-slate-500">Each view takes 15-30 seconds</p>
                    {generatedViews.length > 0 && (
                      <p className="text-xs text-cyan-400 mt-2">
                        {generatedViews.length} view{generatedViews.length !== 1 ? "s" : ""} generated
                      </p>
                    )}
                  </div>
                )}

                {viewGenError && !generatingViews && (
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
                      <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-400 mb-3">{viewGenError}</p>
                    <button onClick={handleStartViewGeneration} className="btn-secondary px-4 py-2 rounded-xl text-sm">
                      Retry Generation
                    </button>
                  </div>
                )}

                {!generatingViews && generatedViews.length > 0 && !viewGenError && (
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
                      Views Generated
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      {generatedViews.length} views ready for tech pack generation
                    </p>
                    <button
                      onClick={handleSketchContinue}
                      className="btn-primary px-6 py-2.5 rounded-xl text-sm"
                    >
                      Continue to Tech Pack
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>

              {/* Generated views grid */}
              {generatedViews.length > 0 && (
                <div>
                  <p className="section-label mb-2">Generated Views</p>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 flex-1 content-start">
                    {generatedViews.map((view) => (
                      <div
                        key={view.viewName}
                        className="group rounded-xl overflow-hidden border border-white/[0.06] bg-surface-900/50 transition-all duration-200 hover:border-accent/20"
                      >
                        <div className="aspect-square relative bg-surface-950">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={view.imageUrl}
                            alt={`${view.viewName} view`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="px-3 py-2">
                          <p
                            className="text-xs text-slate-300 font-medium"
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                          >
                            {view.viewName.replace("_", " ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

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

              {/* 3D Studio renders (consistent, from actual model) */}
              <StudioRender
                projectId={projectId}
                threeRefs={threeRefs}
                modelScene={modelScene}
                existingRenders={studioViews}
              />

              {/* Hero reference renders (structured JSON prompting + style reference) */}
              <HeroRender
                projectId={projectId}
                existingHeroUrl={project?.heroImageUrl || undefined}
                existingRenders={heroRefViews}
              />

              {/* AI photorealistic renders (legacy - generic prompt) */}
              <PhotorealisticRender projectId={projectId} existingRenders={photoViews} />

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
              {views.length > 0 && (() => {
                const displayViews = heroRefViews.length > 0 ? heroRefViews : studioViews.length > 0 ? studioViews : photoViews.length > 0 ? photoViews : basicViews;
                const label = heroRefViews.length > 0 ? "Hero Reference Renders" : studioViews.length > 0 ? "Studio Renders" : photoViews.length > 0 ? "Product Shots" : "Captured Views";
                return (
                  <div>
                    <p className="section-label mb-2">{label}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {displayViews.slice(0, 4).map((view) => (
                        <div key={view.id} className="rounded-lg overflow-hidden border border-white/[0.06]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={view.imageUrl} alt={view.viewName} className="w-full aspect-square object-contain bg-white/[0.02]" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
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
