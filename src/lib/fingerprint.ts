import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cachedVisitorId: string | null = null;

export async function getDeviceFingerprint(): Promise<string> {
  if (cachedVisitorId) return cachedVisitorId;
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedVisitorId = result.visitorId;
    return result.visitorId;
  } catch {
    return "unknown";
  }
}
