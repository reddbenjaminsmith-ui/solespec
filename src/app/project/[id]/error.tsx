"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Project page error:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-6">
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
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h2
          className="text-xl font-bold text-white mb-2"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Something went wrong
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          The project page ran into an error. This can happen if the 3D model
          failed to load or there was a temporary issue.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="btn-primary px-6 py-3 rounded-xl text-sm font-semibold"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary px-6 py-3 rounded-xl text-sm font-semibold no-underline text-center"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
