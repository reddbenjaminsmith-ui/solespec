"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Center } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {
  extractDimensions,
  calculateCameraDistance,
} from "@/lib/three/extract-dimensions";
import ThreeErrorBoundary from "./ThreeErrorBoundary";

export interface ThreeRefs {
  camera: THREE.PerspectiveCamera;
  gl: THREE.WebGLRenderer;
  controls: unknown;
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
}

interface ModelViewerProps {
  modelUrl: string;
  onModelLoaded?: (scene: THREE.Group) => void;
  onReady?: (refs: ThreeRefs) => void;
}

function Model({
  url,
  onLoaded,
  onProgress,
  onError,
}: {
  url: string;
  onLoaded?: (scene: THREE.Group) => void;
  onProgress?: (percent: number) => void;
  onError?: (message: string) => void;
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const callbacksRef = useRef({ onLoaded, onProgress, onError });
  callbacksRef.current = { onLoaded, onProgress, onError };

  useEffect(() => {
    let disposed = false;

    const loader = new GLTFLoader();

    // Draco decoder - handles Draco-compressed meshes (very common in modern GLBs)
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(
      "https://www.gstatic.com/draco/versioned/decoders/1.5.7/"
    );
    loader.setDRACOLoader(dracoLoader);

    // Meshopt decoder - handles meshopt-compressed meshes
    loader.setMeshoptDecoder(
      MeshoptDecoder as unknown as typeof import("three/examples/jsm/libs/meshopt_decoder.module.js").MeshoptDecoder
    );

    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        setScene(gltf.scene);
        callbacksRef.current.onLoaded?.(gltf.scene);
      },
      (event) => {
        if (disposed) return;
        if (event.lengthComputable) {
          callbacksRef.current.onProgress?.(
            Math.round((event.loaded / event.total) * 100)
          );
        }
      },
      (error) => {
        if (disposed) return;
        const msg =
          error instanceof Error ? error.message : String(error);
        console.error("GLB load error:", msg);
        callbacksRef.current.onError?.(msg);
      }
    );

    return () => {
      disposed = true;
      dracoLoader.dispose();
    };
  }, [url]);

  if (!scene) return null;

  return (
    <Center>
      <primitive object={scene} />
    </Center>
  );
}

function CameraSetup({ modelScene }: { modelScene: THREE.Group | null }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!modelScene) return;
    const dims = extractDimensions(modelScene);
    const distance = calculateCameraDistance(dims);
    camera.position.set(
      distance * 0.7,
      distance * 0.5,
      distance * 0.7
    );
    camera.lookAt(dims.center.x, dims.center.y, dims.center.z);
  }, [modelScene, camera]);

  return null;
}

function ReadyNotifier({
  onReady,
  controlsRef,
}: {
  onReady?: (refs: ThreeRefs) => void;
  controlsRef: React.RefObject<unknown>;
}) {
  const { camera, gl, scene } = useThree();
  const called = useRef(false);

  useEffect(() => {
    if (onReady && controlsRef.current && !called.current) {
      called.current = true;
      onReady({
        camera: camera as THREE.PerspectiveCamera,
        gl: gl as unknown as THREE.WebGLRenderer,
        controls: controlsRef.current,
        scene,
        canvas: gl.domElement,
      });
    }
  }, [camera, gl, scene, onReady, controlsRef]);

  return null;
}

export default function ModelViewer({
  modelUrl,
  onModelLoaded,
  onReady,
}: ModelViewerProps) {
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [status, setStatus] = useState<
    "checking" | "loading" | "loaded" | "error"
  >("checking");
  const [loadProgress, setLoadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const controlsRef = useRef(null);

  // Pre-flight URL check - verify file is accessible before handing to Three.js
  useEffect(() => {
    let cancelled = false;

    async function checkUrl() {
      setStatus("checking");
      try {
        const res = await fetch(modelUrl, { method: "HEAD" });
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setErrorMessage(
            res.status === 404
              ? "The 3D file was not found. It may have been deleted. Try re-uploading."
              : `The file server returned an error (status ${res.status}). Try re-uploading.`
          );
          return;
        }
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          setStatus("error");
          setErrorMessage(
            "The URL returned a web page instead of a 3D file. Try re-uploading."
          );
          return;
        }
        setStatus("loading");
      } catch {
        if (cancelled) return;
        // HEAD might fail due to CORS - try loading the model anyway
        setStatus("loading");
      }
    }

    checkUrl();
    return () => {
      cancelled = true;
    };
  }, [modelUrl, retryKey]);

  const handleModelLoaded = useCallback(
    (scene: THREE.Group) => {
      setModelScene(scene);
      setStatus("loaded");
      onModelLoaded?.(scene);
    },
    [onModelLoaded]
  );

  const handleLoadProgress = useCallback((percent: number) => {
    setLoadProgress(percent);
  }, []);

  const handleLoadError = useCallback((message: string) => {
    setStatus("error");
    setErrorMessage(message || "Failed to load the 3D model.");
  }, []);

  // URL validation
  if (!modelUrl || modelUrl.trim() === "") {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-surface-900 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-sm text-slate-500">No 3D model URL provided</p>
        </div>
      </div>
    );
  }

  let isValidUrl = false;
  try {
    new URL(modelUrl);
    isValidUrl = true;
  } catch {
    // Invalid URL format
  }

  if (!isValidUrl) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-surface-900 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-sm text-red-400">Invalid model URL format</p>
        </div>
      </div>
    );
  }

  // Error state - show before Canvas to avoid unnecessary WebGL context creation
  if (status === "error") {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl bg-surface-900 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-400"
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
          <p
            className="text-sm font-medium text-white mb-1"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            3D Viewer Error
          </p>
          <p className="text-xs text-slate-500 mb-4">{errorMessage}</p>
          <button
            onClick={() => {
              setErrorMessage("");
              setLoadProgress(0);
              setRetryKey((k) => k + 1);
            }}
            className="btn-secondary px-4 py-2 rounded-xl text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <ThreeErrorBoundary key={`${modelUrl}-${retryKey}`}>
      <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden">
        {status !== "loaded" && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-900/90">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p
                className="text-sm text-slate-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {status === "checking"
                  ? "Checking file..."
                  : loadProgress > 0
                  ? `Loading 3D model... ${loadProgress}%`
                  : "Loading 3D model..."}
              </p>
              {status === "loading" && loadProgress > 0 && (
                <div className="w-48 mx-auto mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        {status !== "checking" && (
          <Canvas
            gl={{ preserveDrawingBuffer: true, antialias: true }}
            camera={{ fov: 50, near: 0.01, far: 1000 }}
            style={{ background: "#12121e" }}
          >
            <Model
              url={modelUrl}
              onLoaded={handleModelLoaded}
              onProgress={handleLoadProgress}
              onError={handleLoadError}
            />
            <CameraSetup modelScene={modelScene} />
            <OrbitControls
              ref={controlsRef}
              enablePan={true}
              enableZoom={true}
              enableRotate={true}
              minDistance={0.5}
              maxDistance={50}
            />
            <Environment preset="studio" />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 5, 5]} intensity={1} />
            <directionalLight position={[-3, 2, -3]} intensity={0.3} />
            <ReadyNotifier onReady={onReady} controlsRef={controlsRef} />
          </Canvas>
        )}
      </div>
    </ThreeErrorBoundary>
  );
}
