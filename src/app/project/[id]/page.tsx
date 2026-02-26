"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ModelViewerWrapper from "@/components/ModelViewerWrapper";
import type { ThreeRefs } from "@/components/ModelViewerWrapper";
import ViewCaptureWrapper from "@/components/ViewCaptureWrapper";
import type { Project, RenderedView } from "@/lib/types";
import type * as THREE from "three";
import { CAMERA_POSITIONS } from "@/lib/three/camera-positions";
import type { TechnicalView } from "@/lib/constants";

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

  const handleCaptureComplete = useCallback((capturedViews: RenderedView[]) => {
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
          status: "in_progress",
          wizardStep: 1,
        }),
      }).catch(() => {
        // Non-critical - don't block the user
      });
    }
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
          <Link href="/dashboard" className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold no-underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const needsCapture = modelReady && threeRefs && modelScene && !captureComplete && views.length === 0;

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

        {/* Right: Views panel */}
        <div className="lg:w-[40%] p-4 lg:p-6 lg:pl-0 flex flex-col gap-4">
          {/* Section header */}
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

          {/* View capture controls */}
          {needsCapture && threeRefs && modelScene && (
            <ViewCaptureWrapper
              projectId={projectId}
              threeRefs={threeRefs}
              modelScene={modelScene}
              onCaptureComplete={handleCaptureComplete}
              autoStart={true}
            />
          )}

          {/* View thumbnails grid */}
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

          {/* Empty state while waiting for model */}
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

          {/* Continue button */}
          {captureComplete && (
            <div className="mt-auto pt-4 border-t border-white/[0.06]">
              <button
                disabled
                className="w-full py-3 rounded-xl text-sm font-semibold bg-white/[0.04] text-slate-600 cursor-not-allowed"
                title="AI Analysis coming in Phase 3"
              >
                Continue to AI Analysis
              </button>
              <p
                className="text-xs text-slate-600 mt-2 text-center"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                Coming next - AI component detection
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
