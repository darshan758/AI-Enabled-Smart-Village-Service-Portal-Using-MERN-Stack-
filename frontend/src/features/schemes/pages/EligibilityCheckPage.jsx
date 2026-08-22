import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchScheme, checkEligibility } from '../services/api';
import { getVisibleFields, FIELD_CONFIG } from '../utils/formFields';
import { StatusBanner, DocPill } from '../components/StatusIndicator';

const PROCESSING_STEPS = ['Uploading documents', 'Running OCR verification', 'Checking eligibility rules'];

export default function EligibilityCheckPage() {
  const { idOrSlug } = useParams();
  const [scheme, setScheme] = useState(null);
  const [loadingScheme, setLoadingScheme] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [formData, setFormData] = useState({});
  const [files, setFiles] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});

  const [submitting, setSubmitting] = useState(false);
  const [processingStepIndex, setProcessingStepIndex] = useState(0);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchScheme(idOrSlug)
      .then(setScheme)
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoadingScheme(false));
  }, [idOrSlug]);

  if (loadingScheme) return <p className="sch-muted">Loading…</p>;
  if (loadError) return <p className="sch-error-text">{loadError}</p>;
  if (!scheme) return null;

  const visibleFields = getVisibleFields(scheme);

  function handleFieldChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function handleFileChange(docType, file) {
    setFiles((prev) => ({ ...prev, [docType]: file }));
  }

  function validateBeforeSubmit() {
    const errors = {};
    for (const field of visibleFields) {
      if (field === 'selfReportedIncome') continue; // optional/context field
      if (formData[field] === undefined || formData[field] === '') {
        errors[field] = 'This field is required.';
      }
    }
    for (const doc of scheme.requiredDocuments) {
      if (!files[doc.type]) {
        errors[`doc_${doc.type}`] = `Please upload ${doc.label}.`;
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError(null);
    setResult(null);

    if (!validateBeforeSubmit()) return;

    setSubmitting(true);
    setProcessingStepIndex(0);

    // Purely cosmetic step progression so the UI never looks frozen
    // during the (potentially slow) OCR pipeline on the backend.
    const stepTimer = setInterval(() => {
      setProcessingStepIndex((i) => Math.min(i + 1, PROCESSING_STEPS.length - 1));
    }, 1500);

    try {
      const data = await checkEligibility({ schemeId: scheme._id, formData, files });
      setResult(data);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      clearInterval(stepTimer);
      setSubmitting(false);
    }
  }

  if (result) {
    return <ResultView scheme={scheme} result={result} />;
  }

  return (
    <div>
      <h2>{scheme.name} — Eligibility Check</h2>

      <form onSubmit={handleSubmit}>
        <div className="sch-card">
          <h3>Your Details</h3>
          {visibleFields.length === 0 && <p className="sch-muted">No additional details required for this scheme.</p>}
          {visibleFields.map((field) => (
            <FieldInput
              key={field}
              field={field}
              value={formData[field] || ''}
              onChange={(v) => handleFieldChange(field, v)}
              error={fieldErrors[field]}
            />
          ))}
        </div>

        <div className="sch-card">
          <h3>Upload Required Documents</h3>
          {scheme.requiredDocuments.map((doc) => (
            <UploadRow
              key={doc.type}
              doc={doc}
              file={files[doc.type]}
              onChange={(file) => handleFileChange(doc.type, file)}
              error={fieldErrors[`doc_${doc.type}`]}
            />
          ))}
        </div>

        {submitting && (
          <div className="sch-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="sch-spinner" />
              <strong>Processing your application…</strong>
            </div>
            <div className="sch-processing-steps">
              {PROCESSING_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`sch-processing-step ${
                    i < processingStepIndex ? 'sch-done' : i === processingStepIndex ? 'sch-active' : ''
                  }`}
                >
                  {i < processingStepIndex ? '✓' : '○'} {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {submitError && (
          <div className="sch-card">
            <p className="sch-error-text">{submitError}</p>
          </div>
        )}

        <button className="sch-btn" type="submit" disabled={submitting}>
          {submitting ? 'Processing…' : 'Check Eligibility'}
        </button>
      </form>
    </div>
  );
}

function FieldInput({ field, value, onChange, error }) {
  const config = FIELD_CONFIG[field];
  if (!config) return null;

  return (
    <div className="sch-form-group">
      <label htmlFor={field}>{config.label}</label>
      {config.type === 'select' ? (
        <select id={field} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {config.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={field}
          type={config.type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {config.hint && <div className="sch-form-hint">{config.hint}</div>}
      {error && <div className="sch-error-text">{error}</div>}
    </div>
  );
}

function UploadRow({ doc, file, onChange, error }) {
  return (
    <div>
      <div className="sch-upload-row">
        <div>
          <div className="sch-file-label">{doc.label}</div>
          {file ? (
            <div className="sch-upload-status sch-ok">Selected: {file.name}</div>
          ) : (
            <div className="sch-upload-status sch-pending">PDF, JPG, JPEG or PNG</div>
          )}
        </div>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => onChange(e.target.files[0] || null)}
        />
      </div>
      {error && <div className="sch-error-text">{error}</div>}
    </div>
  );
}

function ResultView({ scheme, result }) {
  return (
    <div>
      <StatusBanner status={result.status} />

      <div className="sch-card">
        <h3>Why?</h3>
        <ul className="sch-reason-list">
          {result.reasons.map((reason, i) => (
            <li key={i}>{reason}</li>
          ))}
        </ul>
      </div>

      <div className="sch-card">
        <h3>Document Verification Results</h3>
        {result.documentResults.map((doc) => (
          <div key={doc.type} className="sch-doc-result-row">
            <div>
              <div>{doc.label}</div>
              <div className="sch-muted" style={{ fontSize: '0.82rem' }}>
                {doc.message}
              </div>
            </div>
            <DocPill verified={doc.verified} />
          </div>
        ))}
      </div>

      <Link className="sch-btn sch-btn-secondary" to={`/schemes/${scheme.slug}`}>
        Back to Scheme
      </Link>
    </div>
  );
}