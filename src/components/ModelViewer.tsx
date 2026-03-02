"use client";

import { useRef, useEffect, useState, Suspense, useCallback } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Center } from "@react-three/drei";
import * as THREE from "three";
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
}: {
  url: string;
  onLoaded?: (scene: THREE.Group) => void;
}) {
  const gltf = useGLTF(url);
  const called = useRef(false);

  // Reset callback flag when URL changes so onLoaded fires for new models
  useEffect(() => {
    called.current = false;
  }, [url]);

  useEffect(() => {
    if (gltf.scene && onLoaded && !called.current) {
      called.current = true;
      onLoaded(gltf.scene);
    }
  }, [gltf.scene, onLoaded]);

  return (
    <Center>
      <primitive object={gltf.scene} />
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
  const [loading, setLoading] = useState(true);
  const controlsRef = useRef(null);

  const handleModelLoaded = useCallback(
    (scene: THREE.Group) => {
      setModelScene(scene);
      setLoading(false);
      onModelLoaded?.(scene);
    },
    [onModelLoaded]
  );

  // Validate URL before attempting to load
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

  return (
    <ThreeErrorBoundary key={modelUrl}>
      <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-surface-900/90">
            <div className="text-center">
              <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p
                className="text-sm text-slate-400"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Loading 3D model...
              </p>
            </div>
          </div>
        )}
        <Canvas
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          camera={{ fov: 50, near: 0.01, far: 1000 }}
          style={{ background: "#12121e" }}
        >
          <Suspense fallback={null}>
            <Model url={modelUrl} onLoaded={handleModelLoaded} />
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
          </Suspense>
        </Canvas>
      </div>
    </ThreeErrorBoundary>
  );
}
