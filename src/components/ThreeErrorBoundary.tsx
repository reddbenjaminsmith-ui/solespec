"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  retryCount: number;
}

function classifyError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("dracoloader") || lower.includes("draco")) {
    return "This model uses Draco compression. Please re-upload the file or try a different model.";
  }
  if (lower.includes("meshopt")) {
    return "This model uses meshopt compression. Please try a different model.";
  }
  if (
    lower.includes("fetch") ||
    lower.includes("network") ||
    lower.includes("failed to load") ||
    lower.includes("404") ||
    lower.includes("aborted")
  ) {
    return "The 3D file could not be downloaded. Check your internet connection or try re-uploading the file.";
  }
  if (
    lower.includes("parse") ||
    lower.includes("unexpected token") ||
    lower.includes("magic bytes")
  ) {
    return "The file does not appear to be a valid GLB/GLTF model.";
  }
  // Only match actual WebGL context errors, not generic "context" mentions
  if (
    lower.includes("webgl") ||
    lower.includes("getcontext") ||
    lower.includes("webgl2") ||
    lower.includes("gpu")
  ) {
    return "Your browser could not create a WebGL context. Try closing other tabs or restarting your browser.";
  }
  if (lower.includes("memory") || lower.includes("allocation")) {
    return "The model is too large for your browser to handle. Try a smaller file.";
  }
  return "Failed to load the 3D model. Try refreshing the page.";
}

// Max auto-retries before showing error to user
const MAX_AUTO_RETRIES = 2;

export default class ThreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "", retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      errorMessage: error.message || "Failed to load 3D viewer",
    };
  }

  componentDidCatch(error: Error) {
    console.error("3D viewer error:", error.message);

    // Auto-retry up to MAX_AUTO_RETRIES times with a delay
    if (this.state.retryCount < MAX_AUTO_RETRIES) {
      setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          errorMessage: "",
          retryCount: prev.retryCount + 1,
        }));
      }, 1000 * (this.state.retryCount + 1)); // 1s, 2s delays
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= MAX_AUTO_RETRIES) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const userMessage = classifyError(this.state.errorMessage);

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
            <p className="text-xs text-slate-500 mb-4">{userMessage}</p>
            <p className="text-[10px] text-slate-600 mb-4 max-w-xs mx-auto break-words">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() =>
                this.setState({ hasError: false, errorMessage: "", retryCount: 0 })
              }
              className="btn-secondary px-4 py-2 rounded-xl text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
