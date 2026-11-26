// Shrinks a photo in the browser before upload: longest side 1600 px, JPEG, stepping quality down until it's under ~1 MB.
export async function compress(input: Blob, maxSide = 1600, target = 950_000): Promise<Blob> {
  const bmp = await createImageBitmap(input).catch(() => null);
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void;
  if (bmp) { w = bmp.width; h = bmp.height; draw = (c) => c.drawImage(bmp, 0, 0, cw, ch); }
  else {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(input); });
    w = img.naturalWidth; h = img.naturalHeight; draw = (c) => c.drawImage(img, 0, 0, cw, ch);
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.round(w * scale), ch = Math.round(h * scale);
  const canvas = document.createElement("canvas"); canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext("2d")!; draw(ctx);
  let q = 0.85, out: Blob | null = null;
  for (let i = 0; i < 6; i++) {
    out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (out && out.size <= target) break;
    q -= 0.12;
  }
  if (!out) throw new Error("Could not process the photo.");
  return out;
}
