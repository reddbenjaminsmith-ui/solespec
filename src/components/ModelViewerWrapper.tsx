"use client";

import dynamic from "next/dynamic";
import type { ThreeRefs } from "./ModelViewer";

// SSR-safe wrapper - Three.js crashes in Node.js without browser APIs
const ModelViewer = dynamic(() => import("./ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] rounded-xl bg-surface-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-3 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p
          className="text-sm text-slate-400"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Loading 3D viewer...
        </p>
      </div>
    </div>
  ),
});

export type { ThreeRefs };
export default ModelViewer;
