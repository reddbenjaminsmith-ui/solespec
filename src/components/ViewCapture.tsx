"use client";

import { useState, useCallback } from "react";
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

interface ViewCaptureProps {
  projectId: string;
  threeRefs: ThreeRefs;
  modelScene: THREE.Group;
  onCaptureComplete: (views: RenderedView[]) => void;
  autoStart?: boolean;
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    function tick() {
      remaining--;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    }
    requestAnimationFrame(tick);
  });
}

export default function ViewCapture({
  projectId,
  threeRefs,
  modelScene,
  onCaptureComplete,
  autoStart = false,
}: ViewCaptureProps) {
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  const captureAllViews = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setError("");

    const { camera, gl, controls, scene, canvas } = threeRefs;
    const dims = extractDimensions(modelScene);
    const distance = calculateCameraDistance(dims);
    const capturedViews: RenderedView[] = [];

    try {
      for (let i = 0; i < TECHNICAL_VIEWS.length; i++) {
        const viewName = TECHNICAL_VIEWS[i] as TechnicalView;
        const camPos = CAMERA_POSITIONS[viewName];

        setProgress({
          current: i + 1,
          total: TECHNICAL_VIEWS.length,
          label: camPos.label,
        });

        // Scale camera positions by model size (CAMERA_POSITIONS use distance 3)
        const scale = distance / 3;
        const cam = camera as THREE.PerspectiveCamera;
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
        const renderer = gl as unknown as THREE.WebGLRenderer;
        const threeScene = scene as THREE.Scene;
        renderer.render(threeScene, cam);
        await waitFrames(3);

        // Capture canvas as PNG
        const dataUrl = canvas.toDataURL("image/png");

        // Convert data URL to Blob for upload
        const fetchRes = await fetch(dataUrl);
        const imageBlob = await fetchRes.blob();

        // Upload to Vercel Blob
        const uploadResult = await upload(
          `views/${projectId}/${viewName}.png`,
          imageBlob,
          {
            access: "public",
            handleUploadUrl: "/api/upload/token",
          }
        );

        // Save to Airtable
        const viewResponse = await fetch("/api/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            viewName,
            imageUrl: uploadResult.url,
          }),
        });

        if (!viewResponse.ok) {
          throw new Error(`Failed to save ${camPos.label} view`);
        }

        const viewData = await viewResponse.json();
        capturedViews.push(viewData);
      }

      onCaptureComplete(capturedViews);
    } catch (err) {
      console.error(
        "View capture failed:",
        err instanceof Error ? err.message : "Unknown error"
      );
      setError("Failed to capture views. Please try again.");
    } finally {
      setCapturing(false);
      setProgress(null);
    }
  }, [capturing, threeRefs, modelScene, projectId, onCaptureComplete]);

  // Auto-start capture on mount if requested
  if (autoStart && !started && !capturing) {
    setStarted(true);
    // Delay slightly to let the canvas settle
    setTimeout(() => captureAllViews(), 500);
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
        <p className="text-sm text-red-300 mb-3">{error}</p>
        <button
          onClick={() => {
            setError("");
            captureAllViews();
          }}
          className="btn-secondary text-sm px-4 py-2"
        >
          Retry Capture
        </button>
      </div>
    );
  }

  if (capturing && progress) {
    return (
      <div className="p-6 rounded-xl glass-card-static">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p
            className="text-sm text-white font-medium"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Capturing {progress.label}...
          </p>
        </div>
        <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${(progress.current / progress.total) * 100}%`,
            }}
          />
        </div>
        <p
          className="text-xs text-slate-500 mt-2"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {progress.current} of {progress.total} views
        </p>
      </div>
    );
  }

  if (!autoStart && !started) {
    return (
      <button
        onClick={() => {
          setStarted(true);
          captureAllViews();
        }}
        className="btn-primary w-full py-3 text-sm font-semibold rounded-xl"
      >
        Capture Technical Views
      </button>
    );
  }

  return null;
}
