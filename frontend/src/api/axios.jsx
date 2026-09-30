// src/api/axios.jsx
//
// Previously this duplicated the exact same axios setup as
// src/utils/api.js (two separate instances, kept in sync by hand — the
// 401 redirect logic had already drifted out of sync between them).
// Now just re-exports the single real instance so there's one source
// of truth for base URL, auth header injection, and the 401 handler.
export { default } from '../utils/api';