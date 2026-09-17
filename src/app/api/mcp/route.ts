import { NextRequest, NextResponse } from "next/server";
import { dispatchMcp } from "@/lib/mcp/tools";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Auth — token passed as ?token=SECRET in the URL
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.MCP_SECRET_KEY;
  if (!secret) return false;
  const token = req.nextUrl.searchParams.get("token");
  return token === secret;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version",
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

export async function GET() {
  // SSE streaming is incompatible with Vercel serverless functions — connections
  // would hang until the platform timeout kills them, burning CPU on free tier.
  // MCP clients must use POST (Streamable HTTP transport).
  return new NextResponse("SSE transport not supported. Use POST.", {
    status: 405,
    headers: { ...CORS, Allow: "POST, OPTIONS" },
  });
}

// ---------------------------------------------------------------------------
// POST — Streamable HTTP transport (2025-03-26): returns JSON directly.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401, headers: CORS });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return json({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }, 400); }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map(dispatchMcp))).filter((r) => r !== null);
    return json(results);
  }

  const result = await dispatchMcp(body);
  if (result === null) return new NextResponse(null, { status: 202, headers: CORS });
  return json(result);
}
