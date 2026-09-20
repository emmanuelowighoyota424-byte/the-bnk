import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy API route to forward requests to the ML Liveness backend
 *
 * This allows the frontend to make requests to /api/voice-liveness/*
 * which are proxied to the ML backend service, avoiding CORS issues
 * in development and enabling path-based routing in production.
 */

const ML_BACKEND_URL =
  process.env.ML_LIVENESS_API_URL || "http://localhost:8000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxyRequest(request, await params);
}

async function proxyRequest(
  request: NextRequest,
  params: { path: string[] }
): Promise<NextResponse> {
  const path = params.path.join("/");
  const url = `${ML_BACKEND_URL}/${path}`;

  // Forward headers (except host)
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  try {
    // Get body for non-GET requests
    let body: BodyInit | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      // Check if it's a form data request
      const contentType = request.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        body = await request.formData();
      } else {
        body = await request.text();
      }
    }

    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
    });

    // Get response body
    const responseBody = await response.text();

    // Create response with same status and headers
    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    });

    // Copy response headers
    response.headers.forEach((value, key) => {
      if (
        !["content-encoding", "transfer-encoding", "content-length"].includes(
          key.toLowerCase()
        )
      ) {
        proxyResponse.headers.set(key, value);
      }
    });

    return proxyResponse;
  } catch (error) {
    console.error("[v0] ML Liveness proxy error:", error);
    return NextResponse.json(
      { error: "Failed to connect to ML backend service" },
      { status: 502 }
    );
  }
}
