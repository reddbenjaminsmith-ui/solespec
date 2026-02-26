"use client";

import { useState } from "react";

const STEPS = [
  {
    number: "01",
    title: "Upload Your 3D Model",
    description:
      "Drop in a .glb file from Vizcom, Blender, Meshy, or any 3D tool. SoleSpec renders it instantly in your browser.",
    detail: "Supports .glb format with full material and texture preservation.",
  },
  {
    number: "02",
    title: "AI Identifies Components",
    description:
      "GPT-4o Vision analyzes 7 technical views and identifies every shoe component - upper, sole, lining, hardware - with confidence scores.",
    detail:
      "You confirm or adjust each detection. AI scaffolds, you approve.",
  },
  {
    number: "03",
    title: "Fill in the Gaps",
    description:
      "A guided wizard for materials, construction method, and Bill of Materials. Smart defaults for common footwear specs - just confirm or change.",
    detail:
      "Pre-filled with AI suggestions based on what it detected in your model.",
  },
  {
    number: "04",
    title: "Export Factory-Ready PDF",
    description:
      "Multi-page tech pack with technical views, component breakdown, measurements, material specs, and BOM. Ready to send to your factory.",
    detail: "Professional layout that factories take seriously.",
  },
];

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="min-h-screen">
      {/* Noise overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{
          opacity: 0.035,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Nav */}
      <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-8 px-6 py-3 rounded-full bg-surface-900/60 backdrop-blur-xl border border-white/[0.06]">
        <span
          className="text-lg font-bold tracking-tight"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          <span className="text-accent">Sole</span>
          <span className="text-white">Spec</span>
        </span>
        <div className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
          <a
            href="#how-it-works"
            className="hover:text-white transition-colors duration-200"
          >
            How It Works
          </a>
          <a
            href="#pricing"
            className="hover:text-white transition-colors duration-200"
          >
            Pricing
          </a>
        </div>
        <a
          href="/dashboard"
          className="btn-primary text-sm py-2 px-4 rounded-full no-underline"
        >
          Get Started
        </a>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col justify-end pb-24 px-6 md:px-12 lg:px-20 overflow-hidden">
        {/* Blueprint grid background */}
        <div className="absolute inset-0 opacity-[0.04]">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern
                id="grid"
                width="60"
                height="60"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 60 0 L 0 0 0 60"
                  fill="none"
                  stroke="#22d3ee"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Gradient accent glow */}
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-cyan-500/[0.06] blur-[120px]" />
        <div className="absolute bottom-1/3 left-[16%] w-[300px] h-[300px] rounded-full bg-cyan-400/[0.04] blur-[100px]" />

        <div className="relative z-10 max-w-5xl">
          <div className="flex items-center gap-3 mb-6 animate-fade-in">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span
              className="text-xs font-medium tracking-widest uppercase text-accent"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              For Footwear Designers
            </span>
          </div>

          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-8 animate-slide-up"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <span className="text-white">3D Model to</span>
            <br />
            <span className="text-accent">Tech Pack</span>
            <br />
            <span className="text-slate-400 text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium italic" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              in minutes, not hours.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed animate-slide-up stagger-2">
            Upload a .glb file from Vizcom, Blender, or any 3D tool. AI
            identifies every component, estimates measurements, and scaffolds
            your tech pack. You confirm the details and export a factory-ready
            PDF.
          </p>

          <div className="flex flex-wrap gap-4 animate-slide-up stagger-3">
            <a
              href="/project/new"
              className="btn-primary text-base py-3 px-8 rounded-xl no-underline"
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
              Upload 3D Model
            </a>
            <a
              href="#how-it-works"
              className="btn-secondary text-base py-3 px-8 rounded-xl no-underline"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in stagger-4">
          <span className="text-xs text-slate-500 tracking-widest uppercase" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Scroll
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-accent/40 to-transparent" />
        </div>
      </section>

      {/* Problem Statement */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-slate-500 text-lg md:text-xl leading-relaxed mb-8">
            Every footwear designer knows the drill. You spend hours in Vizcom
            or Blender crafting the perfect 3D model. Then you spend
            <span className="text-white font-medium"> even more hours </span>
            manually creating the tech pack - extracting measurements, drawing
            flats, writing specs, building the BOM.
          </p>
          <p
            className="text-3xl md:text-4xl font-bold text-white tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            The design takes an hour.
            <br />
            <span className="text-accent">The paperwork takes four.</span>
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="relative py-32 px-6 md:px-12 lg:px-20"
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-px bg-accent" />
            <span
              className="section-label text-accent"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            >
              How It Works
            </span>
          </div>
          <h2
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-16"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Four steps. One PDF.
          </h2>

          <div className="grid lg:grid-cols-[1fr_1.5fr] gap-12">
            {/* Step selector */}
            <div className="flex flex-col gap-2">
              {STEPS.map((step, i) => (
                <button
                  key={step.number}
                  onClick={() => setActiveStep(i)}
                  className={`text-left p-5 rounded-xl transition-all duration-300 border ${
                    activeStep === i
                      ? "bg-cyan-500/[0.08] border-cyan-500/20 shadow-glow-cyan"
                      : "bg-transparent border-transparent hover:bg-white/[0.02] hover:border-white/[0.04]"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`text-sm font-medium mt-0.5 transition-colors duration-300 ${
                        activeStep === i ? "text-accent" : "text-slate-600"
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {step.number}
                    </span>
                    <div>
                      <h3
                        className={`text-lg font-semibold mb-1 transition-colors duration-300 ${
                          activeStep === i ? "text-white" : "text-slate-400"
                        }`}
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                      >
                        {step.title}
                      </h3>
                      {activeStep === i && (
                        <p className="text-sm text-slate-400 leading-relaxed animate-fade-in">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Step detail card */}
            <div className="glass-card-static p-8 md:p-10 flex flex-col justify-center min-h-[320px]">
              <div className="animate-fade-in" key={activeStep}>
                <span
                  className="text-6xl md:text-7xl font-bold text-accent/20 mb-4 block"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {STEPS[activeStep].number}
                </span>
                <h3
                  className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-4"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {STEPS[activeStep].title}
                </h3>
                <p className="text-slate-400 leading-relaxed text-lg mb-6">
                  {STEPS[activeStep].description}
                </p>
                <div className="flex items-center gap-2 text-sm text-accent/70">
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
                      d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"
                    />
                  </svg>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {STEPS[activeStep].detail}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Without SoleSpec */}
            <div className="surface-panel p-8 rounded-2xl">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span
                  className="text-xs font-medium tracking-widest uppercase text-red-400"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Without SoleSpec
                </span>
              </div>
              <ul className="space-y-4 text-slate-400">
                {[
                  "Manually screenshot every angle",
                  "Draw technical flats in Illustrator",
                  "Measure dimensions by hand",
                  "Write BOM in Excel",
                  "Assemble everything into a PDF",
                  "4-6 hours per style",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-red-500/60 mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With SoleSpec */}
            <div className="glass-card-static p-8 rounded-2xl border-accent/20">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span
                  className="text-xs font-medium tracking-widest uppercase text-accent"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  With SoleSpec
                </span>
              </div>
              <ul className="space-y-4 text-slate-300">
                {[
                  "Upload .glb - views render automatically",
                  "AI labels every component for you",
                  "Measurements extracted from mesh",
                  "BOM pre-filled from AI detection",
                  "One-click PDF export",
                  "30 minutes per style",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-accent mt-0.5 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="relative py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Stop making tech packs
            <br />
            <span className="text-accent">by hand.</span>
          </h2>
          <p className="text-lg text-slate-400 mb-10 leading-relaxed">
            Upload your first 3D model and see what AI-assisted tech pack
            generation looks like. Free to try - no credit card required.
          </p>
          <a
            href="/project/new"
            className="btn-primary text-lg py-4 px-10 rounded-xl no-underline inline-flex"
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
            Upload Your 3D Model
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 px-6 md:px-12 lg:px-20 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="text-lg font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              <span className="text-accent">Sole</span>
              <span className="text-white">Spec</span>
            </span>
            <span className="text-xs text-slate-600">
              AI-assisted tech packs for footwear designers
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              System Operational
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
