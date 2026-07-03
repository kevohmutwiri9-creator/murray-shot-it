const LIMITS = {
  post: { max: 12, windowMs: 60 * 60 * 1000 },
  comment: { max: 40, windowMs: 15 * 60 * 1000 },
  message: { max: 60, windowMs: 15 * 60 * 1000 },
};

function storageKey(action, uid) {
  return `sv_rate_${action}_${uid}`;
}

export function checkRateLimit(action, uid) {
  const cfg = LIMITS[action];
  if (!cfg || !uid) return;

  const raw = localStorage.getItem(storageKey(action, uid));
  const now = Date.now();
  let times = raw ? JSON.parse(raw) : [];
  times = times.filter((t) => now - t < cfg.windowMs);

  if (times.length >= cfg.max) {
    const mins = Math.ceil(cfg.windowMs / 60000);
    throw new Error(`Slow down — too many ${action}s. Try again in a few minutes (limit: ${cfg.max} per ${mins} min).`);
  }
}

export function recordRateLimit(action, uid) {
  const cfg = LIMITS[action];
  if (!cfg || !uid) return;

  const key = storageKey(action, uid);
  const now = Date.now();
  let times = [];
  try {
    times = JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    times = [];
  }
  times = times.filter((t) => now - t < cfg.windowMs);
  times.push(now);
  localStorage.setItem(key, JSON.stringify(times));
}
