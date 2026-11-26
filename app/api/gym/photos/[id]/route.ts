import { photoUrl } from "@/lib/notion";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

// Streams a progress photo through the app (behind the passcode), never exposing Notion's file link.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const url = await photoUrl(id);
    if (!url) return fail(new Error("Photo not found."), 404);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) return fail(new Error("Could not load the photo from Notion."), 502);
    return new Response(res.body, { headers: { "Content-Type": res.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, no-store" } });
  } catch (e) {
    return fail(e);
  }
}
