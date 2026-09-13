import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.join(process.cwd(), "public", "geo");

function location(storageKey: string) {
  const absolute = path.resolve(ROOT, storageKey);
  if (!absolute.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error("Invalid station dataset storage key.");
  }
  return absolute;
}

export async function putStationDatasetSource({
  storageKey,
  body,
}: {
  storageKey: string;
  body: Uint8Array;
}) {
  const target = location(storageKey);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function getStationDatasetSource(storageKey: string) {
  return { bytes: new Uint8Array(await readFile(location(storageKey))), contentType: "application/geo+json" };
}

export async function deleteStationDatasetSource(storageKey: string) {
  await rm(location(storageKey), { force: true });
}
