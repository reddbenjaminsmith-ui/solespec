"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ThreeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || "Failed to load 3D viewer",
    };
  }

  componentDidCatch(error: Error) {
    console.error("3D viewer error:", error.message);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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
            <p className="text-xs text-slate-500 mb-4">
              {this.state.errorMessage.toLowerCase().includes("fetch") ||
              this.state.errorMessage.toLowerCase().includes("network") ||
              this.state.errorMessage.toLowerCase().includes("failed to load")
                ? "The 3D file could not be downloaded. Check your internet connection or try re-uploading the file."
                : this.state.errorMessage.toLowerCase().includes("parse") ||
                  this.state.errorMessage.toLowerCase().includes("invalid") ||
                  this.state.errorMessage.toLowerCase().includes("unexpected token")
                ? "The file does not appear to be a valid GLB/GLTF model."
                : "Failed to load the 3D model. Try refreshing the page."}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, errorMessage: "" })}
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
