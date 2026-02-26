import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export async function POST(request: Request): Promise<NextResponse> {
  const ip = getClientIp(request);
  const limit = rateLimit(`upload:${ip}`, 20, 60000); // 20/min to accommodate view captures (7 uploads in sequence)
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const lower = pathname.toLowerCase();

        if (!lower.endsWith(".glb") && !lower.endsWith(".png")) {
          throw new Error("Only .glb and .png files are allowed");
        }

        const isGlb = lower.endsWith(".glb");

        return {
          allowedContentTypes: isGlb
            ? ["model/gltf-binary", "application/octet-stream"]
            : ["image/png"],
          maximumSizeInBytes: isGlb
            ? 100 * 1024 * 1024 // 100MB for GLB models
            : 5 * 1024 * 1024, // 5MB for PNG view captures
        };
      },
      onUploadCompleted: async () => {
        // No-op for now. Could log upload metrics here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error(
      "Upload token failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
