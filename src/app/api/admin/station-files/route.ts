import { NextRequest, NextResponse } from "next/server";
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { PERMISSIONS } from "@/lib/auth/permissions";

const ROOT = path.join(process.cwd(), "public", "geo");

async function list(directory: string): Promise<Array<{ path: string; size: number; modifiedAt: string }>> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return list(absolute);
    if (!/\.geojson$/i.test(entry.name)) return [];
    const meta = await stat(absolute);
    return [{ path: path.relative(ROOT, absolute).replaceAll("\\", "/"), size: meta.size, modifiedAt: meta.mtime.toISOString() }];
  }));
  return files.flat();
}

function target(value: string) {
  const absolute = path.resolve(ROOT, value);
  if (!absolute.startsWith(`${ROOT}${path.sep}`) || !/\.geojson$/i.test(absolute)) throw new Error("Invalid GeoJSON file path.");
  return absolute;
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.STATIONS_MANAGE, req.nextUrl.searchParams.get("region"));
  if (!auth.authorized) return auth.response;
  return NextResponse.json({ files: await list(ROOT) });
}

export async function DELETE(req: NextRequest) {
  const auth = await adminAuth(PERMISSIONS.STATIONS_MANAGE, req.nextUrl.searchParams.get("region"));
  if (!auth.authorized) return auth.response;
  let filePath: string;
  try { filePath = String((await req.json()).path ?? ""); await rm(target(filePath)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove file.";
    const readOnlyDeployment = process.env.VERCEL === "1" || /EROFS|EPERM|ENOENT/.test(message);
    return NextResponse.json({ error: readOnlyDeployment ? "This deployment cannot remove files from public/geo. Remove the file from the repository and redeploy." : message }, { status: readOnlyDeployment ? 503 : 400 });
  }
  return NextResponse.json({ ok: true });
}
