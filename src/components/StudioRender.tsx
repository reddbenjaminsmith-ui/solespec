"use client";

import { useState, useCallback, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { CAMERA_POSITIONS } from "@/lib/three/camera-positions";
import {
  extractDimensions,
  calculateCameraDistance,
} from "@/lib/three/extract-dimensions";
import { TECHNICAL_VIEWS, type TechnicalView } from "@/lib/constants";
import type { RenderedView } from "@/lib/types";
import type { ThreeRefs } from "./ModelViewer";
import * as THREE from "three";

interface StudioRenderProps {
  projectId: string;
  threeRefs: ThreeRefs | null;
  modelScene: THREE.Group | null;
  existingRenders?: RenderedView[];
  onStudioModeChange: (active: boolean) => void;
  onComplete?: (views: RenderedView[]) => void;
}

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

const VIEW_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Medial",
  right: "Lateral",
  top: "Top",
  bottom: "Bottom",
  three_quarter: "3/4 View",
};

export default function StudioRender({
  projectId,
  threeRefs,
  modelScene,
  existingRenders,
  onStudioModeChange,
  onComplete,
}: StudioRenderProps) {
  const hasExisting = existingRenders && existingRenders.length > 0;
  const [phase, setPhase] = useState<"idle" | "rendering" | "complete" | "error">(
    hasExisting ? "complete" : "idle"
  );
  const [renderedViews, setRenderedViews] = useState<RenderedView[]>(
    hasExisting ? existingRenders : []
  );
  const [progress, setProgress] = useState({ current: 0, total: TECHNICAL_VIEWS.length, label: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const renderingRef = useRef(false);

  const handleRender = useCallback(async () => {
    if (renderingRef.current) return;
    if (!threeRefs || !modelScene) {
      setErrorMsg("3D viewer not ready. Please wait and try again.");
      setPhase("error");
      return;
    }

    renderingRef.current = true;
    setPhase("rendering");
    setRenderedViews([]);
    setErrorMsg("");

    // Switch to studio mode
    onStudioModeChange(true);

    // Wait for renderer to settle with new settings
    await new Promise((r) => setTimeout(r, 800));

    const { camera, gl, controls, scene, canvas } = threeRefs;
    const dims = extractDimensions(modelScene);
    const distance = calculateCameraDistance(dims);
    const captured: RenderedView[] = [];

    // Increase renderer resolution for HD captures
    const renderer = gl as unknown as THREE.WebGLRenderer;
    const origSize = renderer.getSize(new THREE.Vector2());
    const origPixelRatio = renderer.getPixelRatio();
    const hdWidth = 2048;
    const hdHeight = 2048; // Square for studio renders
    renderer.setPixelRatio(1);
    renderer.setSize(hdWidth, hdHeight, false);
    const cam = camera as THREE.PerspectiveCamera;
    const origAspect = cam.aspect;
    cam.aspect = 1; // Square
    cam.updateProjectionMatrix();

    try {
      for (let i = 0; i < TECHNICAL_VIEWS.length; i++) {
        const viewName = TECHNICAL_VIEWS[i] as TechnicalView;
        const camPos = CAMERA_POSITIONS[viewName];

        setProgress({ current: i + 1, total: TECHNICAL_VIEWS.length, label: camPos.label });

        // Scale camera positions by model size
        const scale = distance / 3;
        cam.position.set(
          camPos.position[0] * scale + dims.center.x,
          camPos.position[1] * scale + dims.center.y,
          camPos.position[2] * scale + dims.center.z
        );
        cam.lookAt(dims.center.x, dims.center.y, dims.center.z);

        // Update orbit controls target
        if (controls && typeof controls === "object" && "target" in controls) {
          const ctrl = controls as { target: THREE.Vector3; update: () => void };
          ctrl.target.set(dims.center.x, dims.center.y, dims.center.z);
          ctrl.update();
        }

        // Force render and wait for frames to complete
        const threeScene = scene as THREE.Scene;
        renderer.render(threeScene, cam);
        await waitFrames(5); // Extra frames for post-processing to settle

        // Capture canvas as PNG
        const dataUrl = canvas.toDataURL("image/png");
        const fetchRes = await fetch(dataUrl);
        const imageBlob = await fetchRes.blob();

        // Upload to Vercel Blob
        const uploadResult = await upload(
          `studio-renders/${projectId}/${viewName}.png`,
          imageBlob,
          {
            access: "public",
            handleUploadUrl: "/api/upload/token",
          }
        );

        // Save to Airtable with studio render flag
        const viewResponse = await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            viewName,
            imageUrl: uploadResult.url,
            isStudioRender: true,
          }),
        });

        if (!viewResponse.ok) {
          throw new Error(`Failed to save ${camPos.label} studio render`);
        }

        const viewData = await viewResponse.json();
        captured.push(viewData);
      }

      setRenderedViews(captured);
      setPhase("complete");
      onComplete?.(captured);
    } catch (err) {
      console.error(
        "Studio render failed:",
        err instanceof Error ? err.message : "Unknown error"
      );
      setErrorMsg("Studio render failed. Please try again.");
      setPhase("error");
    } finally {
      // Restore original renderer size
      renderer.setPixelRatio(origPixelRatio);
      renderer.setSize(origSize.x, origSize.y, false);
      cam.aspect = origAspect;
      cam.updateProjectionMatrix();

      // Switch back to design mode
      onStudioModeChange(false);
      renderingRef.current = false;
    }
  }, [threeRefs, modelScene, projectId, onStudioModeChange, onComplete]);

  if (phase === "idle") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cyan-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
            </svg>
          </div>
          <h3
            className="text-sm font-semibold text-white mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            3D Studio Renders
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Render your 3D model with professional studio lighting for perfectly consistent product shots
          </p>
          <button onClick={handleRender} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
            </svg>
            Generate Studio Renders
          </button>
        </div>
      </div>
    );
  }

  if (phase === "rendering") {
    const pct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Rendering {progress.label || "..."}
            </span>
            <span className="text-xs text-cyan-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="glass-card-static p-6 rounded-xl">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
          </div>
          <p className="text-sm text-red-400 mb-3">{errorMsg}</p>
          <button onClick={handleRender} className="btn-secondary px-4 py-2 rounded-xl text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Complete - show renders
  return (
    <div className="glass-card-static p-4 rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-xs font-medium text-emerald-400"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {renderedViews.length} studio renders
        </span>
        <button onClick={handleRender} className="text-xs text-cyan-400 hover:text-cyan-300 underline">
          Re-render
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {renderedViews.map((view) => (
          <div key={view.id || view.viewName} className="rounded-lg overflow-hidden border border-white/[0.06] group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.imageUrl}
              alt={VIEW_LABELS[view.viewName] || view.viewName}
              className="w-full aspect-square object-contain bg-white/[0.02]"
            />
            <div className="px-2 py-1.5 bg-white/[0.02]">
              <p className="text-[10px] text-slate-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                {VIEW_LABELS[view.viewName] || view.viewName}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
