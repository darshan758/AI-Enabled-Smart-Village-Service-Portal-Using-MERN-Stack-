// src/features/schemes/services/api.js
//
// Talks to the scheme-eligibility-checker routes, which now live on the
// SAME backend as the rest of the app (mounted at /api/schemes,
// /api/documents, /api/eligibility in server.js). Reuses the app's shared
// axios client instead of a separate fetch-based client pointed at a
// different port — there's only one backend now.

import api from '../../../utils/api';

function unwrap(res) {
  // Existing backend response shape: { success, data } | { success, ...fields }
  const body = res.data;
  if (body.success === false) {
    throw new Error(body.message || 'Something went wrong.');
  }
  return body.data !== undefined ? body.data : body;
}

function friendlyError(err) {
  const message =
    err.response?.data?.message ||
    err.message ||
    'The server returned an unexpected response.';
  return new Error(message);
}

export async function fetchSchemes() {
  try {
    const res = await api.get('/schemes');
    return unwrap(res);
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function fetchScheme(idOrSlug) {
  try {
    const res = await api.get(`/schemes/${idOrSlug}`);
    return unwrap(res);
  } catch (err) {
    throw friendlyError(err);
  }
}

export async function verifySingleDocument({ file, documentType, schemeId }) {
  const form = new FormData();
  form.append('file', file);
  form.append('documentType', documentType);
  if (schemeId) form.append('schemeId', schemeId);

  try {
    const res = await api.post('/documents/verify', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  } catch (err) {
    throw friendlyError(err);
  }
}

/**
 * checkEligibility()
 * files: { [documentType]: File }
 */
export async function checkEligibility({ schemeId, formData, files }) {
  const form = new FormData();
  form.append('schemeId', schemeId);
  form.append('formData', JSON.stringify(formData));

  Object.entries(files).forEach(([type, file]) => {
    if (file) form.append(type, file);
  });

  try {
    const res = await api.post('/eligibility/check', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(res);
  } catch (err) {
    throw friendlyError(err);
  }
}