import React from 'react';

export function StatusBanner({ status }) {
  const map = {
    ELIGIBLE: { className: 'sch-eligible', text: '✅ Eligible' },
    NOT_ELIGIBLE: { className: 'sch-not-eligible', text: '❌ Not Eligible' },
    VERIFICATION_FAILED: { className: 'sch-verification-failed', text: '⚠️ Verification Failed' },
  };
  const info = map[status] || { className: '', text: status };
  return <div className={`sch-status-banner ${info.className}`}>{info.text}</div>;
}

export function DocPill({ verified }) {
  return <span className={`sch-pill ${verified ? 'sch-ok' : 'sch-bad'}`}>{verified ? 'Verified' : 'Failed'}</span>;
}