const pending = new Map<string, { key: string; fingerprint: string }>();

/** Keep a logical request key until its successful response is received. */
export function pendingRequest(scope: string, body: unknown, preferredKey?: string): { key: string; done: () => void } {
  const storage = `pos-request:${scope}`;
  const fingerprint = JSON.stringify(body);
  let saved = pending.get(storage) ?? null;
  try { saved = JSON.parse(localStorage.getItem(storage) || 'null') ?? saved; } catch { }
  if (preferredKey && saved?.key === preferredKey && saved.fingerprint !== fingerprint) {
    throw new Error('A pending request key cannot be reused with different content');
  }
  if (!saved || typeof saved.key !== 'string' || saved.key.length < 8 || saved.fingerprint !== fingerprint || (preferredKey && preferredKey !== saved.key)) {
    saved = { key: preferredKey || crypto.randomUUID(), fingerprint };
    try { localStorage.setItem(storage, JSON.stringify(saved)); } catch { }
  }
  pending.set(storage, saved);
  const key = saved.key;
  return { key, done: () => {
    if (pending.get(storage)?.key === key) pending.delete(storage);
    try {
      if (JSON.parse(localStorage.getItem(storage) || 'null')?.key === key) localStorage.removeItem(storage);
    } catch { }
  } };
}
