"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import StatusBadge from "@/components/StatusBadge";
import type { Project } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const res = await fetch("/api/projects?email=placeholder@solespec.app");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects || []);
        }
      } catch {
        // Will show empty state
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 bg-surface-900/60 backdrop-blur-xl border-b border-white/[0.04]">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight no-underline"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="text-accent">Sole</span>
          <span className="text-white">Spec</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/project/new"
            className="btn-primary text-sm py-2 px-4 rounded-lg no-underline"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            New Tech Pack
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 md:px-12 py-12">
        {/* Page header */}
        <div className="mb-10">
          <h1
            className="text-3xl font-bold text-white tracking-tight mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Your Tech Packs
          </h1>
          <p className="text-slate-400">
            Upload a 3D model to start a new tech pack.
          </p>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card-static rounded-2xl overflow-hidden">
                <div className="aspect-video skeleton" />
                <div className="p-4 space-y-3">
                  <div className="h-5 w-3/4 skeleton" />
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-20 skeleton" />
                    <div className="h-3 w-24 skeleton" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Project grid or empty state */}
        {!loading && projects.length === 0 && (
          <div className="glass-card-static p-16 text-center rounded-2xl">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25"
                />
              </svg>
            </div>
            <h2
              className="text-xl font-semibold text-white mb-2"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              No tech packs yet
            </h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Upload a .glb 3D model to generate your first AI-assisted tech
              pack. Works with files from Vizcom, Blender, Meshy, and more.
            </p>
            <Link
              href="/project/new"
              className="btn-primary py-3 px-8 rounded-xl no-underline inline-flex"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
                />
              </svg>
              Upload Your First 3D Model
            </Link>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => router.push(`/project/${project.id}`)}
                className="glass-card rounded-2xl overflow-hidden text-left group"
              >
                {/* Thumbnail */}
                <div className="aspect-video bg-surface-900/50 relative overflow-hidden">
                  {project.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={project.thumbnailUrl}
                      alt={project.name}
                      className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-10 h-10 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-2.25-1.313M21 7.5v2.25m0-2.25-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3 2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75 2.25-1.313M12 21.75V19.5m0 2.25-2.25-1.313m0-16.875L12 2.25l2.25 1.313M21 14.25v2.25l-2.25 1.313m-13.5 0L3 16.5v-2.25" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3
                    className="text-sm font-semibold text-white truncate mb-2"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {project.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={project.status} />
                    <span
                      className="text-[10px] text-slate-600"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {new Date(project.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
