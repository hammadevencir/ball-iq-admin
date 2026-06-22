import { NextResponse } from "next/server";

/**
 * Proxies game data fetch to bypass CORS.
 * Server-side fetch has no CORS restrictions.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      { error: "Missing url parameter" },
      { status: 400 },
    );
  }

  // Only allow Firebase Storage URLs for security
  if (
    !url.startsWith("https://firebasestorage.googleapis.com/") &&
    !url.startsWith("https://storage.googleapis.com/")
  ) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Storage returned ${res.status}` },
        { status: res.status },
      );
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Game data proxy error:", err);
    return NextResponse.json(
      { error: "Failed to fetch game data" },
      { status: 500 },
    );
  }
}
