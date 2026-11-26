import "server-only";
import { NextResponse } from "next/server";

export function fail(e: unknown, status = 500) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(msg);
  return NextResponse.json({ error: msg }, { status });
}

export const MAX_PHOTO = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB; the app compresses to ~1 MB first

export async function readPhoto(req: Request): Promise<{ file: Blob; fields: FormData }> {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof Blob)) throw Object.assign(new Error("No photo in the upload."), { status: 400 });
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw Object.assign(new Error("Only JPEG, PNG or WebP photos."), { status: 400 });
  if (file.size > MAX_PHOTO) throw Object.assign(new Error("Photo is too big after compression (max 4 MB)."), { status: 413 });
  return { file, fields: fd };
}
