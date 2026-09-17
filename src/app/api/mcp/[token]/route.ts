import { NextRequest, NextResponse } from "next/server";
import { dispatchMcp } from "@/lib/mcp/tools";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth — token passed as a path segment
// ---------------------------------------------------------------------------

function isAuthorized(token: string): boolean {
  const secret = process.env.MCP_SECRET_KEY;
  if (!secret) return false;
  return token === secret;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: CORS });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  // SSE not supported in serverless — tell clients to use POST
  return new NextResponse(null, { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!isAuthorized(token)) return new NextResponse("Unauthorized", { status: 401, headers: CORS });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, 400);
  }

  // Handle batch requests
  if (Array.isArray(body)) {
    const results = await Promise.all(body.map(dispatchMcp));
    const responses = results.filter((r) => r !== null);
    return json(responses);
  }

  const result = await dispatchMcp(body);
  if (result === null) {
    // Notification — no content
    return new NextResponse(null, { status: 202, headers: CORS });
  }
  return json(result);
}
