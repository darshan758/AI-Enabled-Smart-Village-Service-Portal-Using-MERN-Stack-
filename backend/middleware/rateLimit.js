// middleware/rateLimit.js — tiny in-memory per-IP rate limiter (no new package).
// Usage: router.post('/x', rateLimit({ max: 10, windowMs: 60000 }), handler)
function rateLimit({ max = 10, windowMs = 60 * 1000, message } = {}) {
  const hits = new Map();
  return (req, res, next) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      const retry = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({
        success: false,
        message: message || `Too many requests. Please wait ${retry}s and try again.`,
      });
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 5000) hits.clear(); // keep memory bounded
    next();
  };
}
module.exports = { rateLimit };