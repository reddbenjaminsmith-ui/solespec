# SoleSpec - AI-Assisted Tech Pack Generator for Footwear Designers

**Purpose**: Upload a 3D shoe model, AI identifies components and estimates measurements, designer confirms/adjusts, exports factory-ready PDF tech pack.
**Problem**: Footwear designers spend 4+ hours manually creating tech packs from 3D models. No tool auto-generates them.
**Solution**: AI-assisted tech pack scaffolding - generates 70% of the work, designer confirms the rest.

---

## Architecture

```
3D File Upload -> Three.js Viewer -> AI Analysis (GPT-4o Vision) -> Guided Wizard -> PDF Export
                    |                       |
              Vercel Blob            OpenAI API
              (file storage)     (component detection +
                                  measurement estimation)
```

**Data flow:** Airtable stores all project data (projects, components, measurements, specs, BOM items)

---

## Tech Stack

| Component | Version | Notes |
|-----------|---------|-------|
| Next.js | 14 | App Router |
| TypeScript | 5.x | |
| Tailwind CSS | v3 | Dark theme with cyan accent (#22d3ee) |
| Three.js | latest | 3D rendering in browser |
| @react-three/fiber | v8 | React Three.js integration (React 18 compatible) |
| @react-three/drei | v9 | Three.js helpers (GLB loader, orbit controls) |
| OpenAI | GPT-4o | Vision API for component detection + measurements |
| Airtable | Team plan | Primary database |
| Vercel Blob | | 3D file + rendered image storage |
| @react-pdf/renderer | | PDF tech pack generation |
| NextAuth | v4 | Magic link authentication |

---

## Project Structure

```
src/
  app/
    page.tsx                    # Landing page
    layout.tsx                  # Root layout
    globals.css                 # Dark theme design system
    dashboard/page.tsx          # Project list
    project/
      new/page.tsx              # Upload + name project
      [id]/page.tsx             # Main workspace (3D viewer + wizard)
    auth/callback/route.ts      # Magic link callback
    api/
      upload/token/route.ts     # Vercel Blob upload token
      projects/route.ts         # Create/list projects
      projects/[id]/route.ts    # Get/update/delete project
      analyze/route.ts          # AI analysis (streaming)
      specifications/route.ts   # Save wizard data
      bom/route.ts              # CRUD BOM items
      export/pdf/[id]/route.ts  # Generate PDF
  components/                   # All React components
  lib/                          # Utilities, AI prompts, Three.js helpers
```

---

## Airtable Schema

**Base name:** SoleSpec

| Table | Key Fields | Notes |
|-------|-----------|-------|
| Projects | Name, Email, Status, Model URL, Thumbnail URL, Wizard Step | One row per tech pack |
| Rendered Views | Project (linked), View Name, Image URL | 7 views per project |
| Components | Project (linked), Name, Category, AI Confidence, Confirmed | AI-detected shoe parts |
| Measurements | Project (linked), Name, Value MM, AI Estimated, Confirmed | Dimensions |
| Specifications | Project (linked), Materials, Construction Method | Wizard step 1-2 data |
| BOM Items | Project (linked), Component, Material Name, Supplier, Color, Qty | Bill of Materials |

---

## Design System

- **Theme:** Dark with cyan/teal accent - feels like an engineering/CAD tool
- **Accent color:** #22d3ee (cyan)
- **Warning color:** #f59e0b (amber)
- **Background:** Dark blue-black gradient
- **Glass-morphism:** Same pattern as other projects but with cyan tint
- **3D viewer area:** Neutral gray background for clean model rendering

---

## Deployment

- **Live URL:** TBD (solespec.vercel.app or similar)
- **GitHub:** https://github.com/reddbenjaminsmith-ui/solespec
- **Vercel:** Auto-deploy from main branch

---

## Common Fixes Reference

- **Three.js SSR crash**: Always use `next/dynamic` with `{ ssr: false }` for 3D components
- **Vercel Blob upload limit**: Use client-side upload with signed tokens (bypasses 4.5MB serverless limit)
- **AI streaming timeout**: Vercel Hobby allows 25s for streaming responses (vs 10s for non-streaming)
- **@react-pdf/renderer SSR**: Must render PDFs on server only, not in browser
- **Three.js `toDataURL`**: Requires `preserveDrawingBuffer: true` on WebGLRenderer
- **Airtable linked fields**: Always pass as arrays: `[recordId]` not `recordId`
