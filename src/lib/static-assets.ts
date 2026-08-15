import fs from "node:fs";
import path from "node:path";
import { UBA_LOGO_B64, COLTECH_LOGO_B64 } from "./logo-b64-data";

/**
 * Returns Uint8Array bytes for institution logos (UBa & COLTECH)
 * resolving from local filesystem or embedded base64 fallback on Vercel.
 */
export async function getLogoBytes(logoId: string): Promise<{ data: Uint8Array; contentType: string } | null> {
  const isUba = logoId === "logo-uba" || logoId === "uba.jpg";
  const isColtech = logoId === "logo-coltech" || logoId === "coltech.jpg";

  if (!isUba && !isColtech) return null;

  const candidatePaths = isUba
    ? [
        path.join(process.cwd(), "public/logo-uba.png"),
        path.join(process.cwd(), "public/uba.jpg"),
        path.join(process.cwd(), ".vercel/output/static/logo-uba.png"),
        path.join(process.cwd(), ".vercel/output/static/uba.jpg"),
      ]
    : [
        path.join(process.cwd(), "public/logo-coltech.jpg"),
        path.join(process.cwd(), "public/coltech.jpg"),
        path.join(process.cwd(), ".vercel/output/static/logo-coltech.jpg"),
        path.join(process.cwd(), ".vercel/output/static/coltech.jpg"),
      ];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const bytes = new Uint8Array(fs.readFileSync(filePath));
        const contentType = filePath.endsWith(".png") ? "image/png" : "image/jpeg";
        return { data: bytes, contentType };
      }
    } catch {
      // Continue to next path or base64 fallback
    }
  }

  // Fallback to embedded base64 strings if filesystem path is absent (e.g. Vercel serverless environment)
  const b64 = isUba ? UBA_LOGO_B64 : COLTECH_LOGO_B64;
  if (b64) {
    const binary = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return { data: binary, contentType: isUba ? "image/jpeg" : "image/jpeg" };
  }

  return null;
}
