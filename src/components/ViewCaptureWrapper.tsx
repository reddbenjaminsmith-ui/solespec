"use client";

import dynamic from "next/dynamic";

// SSR-safe wrapper - ViewCapture imports Three.js types
const ViewCapture = dynamic(() => import("./ViewCapture"), { ssr: false });

export default ViewCapture;
