// services/recommendationEngine.js
//
// Scheme RECOMMENDATION (step before the OCR eligibility check).
// A transparent expert system: it compares a citizen's self-entered profile
// with the rules already stored on each Scheme document (age window, gender,
// occupation, caste, education, land, academic %, income ceiling) and ranks
// the schemes. It does NOT replace the document-verified eligibility check in
// eligibilityEngine.js — it only tells the citizen which schemes are worth
// applying for. Nothing here writes to the database.
//
// Per criterion the result is one of:
//   match    - the profile satisfies the rule
//   mismatch - the profile clearly violates the rule
//   unknown  - the rule exists but the citizen did not give that detail
//
// Fit level:
//   likely   - no mismatch, nothing unknown
//   possible - no mismatch, but some details missing
//   open     - scheme has no profile-based rule (decided by documents only)
//   unlikely - at least one mismatch
//
// matchScore = matched criteria / all configured criteria (0-100).

const isAll = (list) =>
  !Array.isArray(list) || list.length === 0 || list.some((v) => String(v).toLowerCase() === 'all');
const has = (v) => v !== undefined && v !== null && String(v).trim() !== '';
const inList = (list, v) => list.some((x) => String(x).toLowerCase() === String(v).toLowerCase());
const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN');

function listCriterion(key, label, allowed, value) {
  if (isAll(allowed)) return null;
  const rule = `${label} must be: ${allowed.join(' / ')}`;
  if (!has(value)) return { key, status: 'unknown', rule, detail: `Tell us your ${label.toLowerCase()} to check this.` };
  return inList(allowed, value)
    ? { key, status: 'match', rule, detail: `Your ${label.toLowerCase()} (${value}) fits.` }
    : { key, status: 'mismatch', rule, detail: `Your ${label.toLowerCase()} (${value}) is not in the allowed list.` };
}

function buildCriteria(scheme, p) {
  const out = [];
  const age = has(p.age) ? Number(p.age) : null;

  if (scheme.minAge != null || scheme.maxAge != null) {
    const lo = scheme.minAge != null ? scheme.minAge : 0;
    const hi = scheme.maxAge != null ? scheme.maxAge : 150;
    const rule = `Age between ${lo} and ${hi}`;
    if (age === null || Number.isNaN(age)) out.push({ key: 'age', status: 'unknown', rule, detail: 'Enter your age to check this.' });
    else if (age >= lo && age <= hi) out.push({ key: 'age', status: 'match', rule, detail: `Your age (${age}) is within range.` });
    else out.push({ key: 'age', status: 'mismatch', rule, detail: `Your age (${age}) is outside ${lo}–${hi}.` });
  }

  [
    listCriterion('gender', 'Gender', scheme.genderEligibility, p.gender),
    listCriterion('occupation', 'Occupation', scheme.occupationEligibility, p.occupation),
    listCriterion('caste', 'Caste category', scheme.casteEligibility, p.caste),
    listCriterion('education', 'Education level', scheme.educationEligibility, p.education),
  ].forEach((c) => c && out.push(c));

  if (scheme.landRequired) {
    const rule = 'Must own agricultural land';
    const v = String(p.landOwnership || '').toLowerCase();
    if (v === 'yes') out.push({ key: 'land', status: 'match', rule, detail: 'You own agricultural land.' });
    else if (v === 'no') out.push({ key: 'land', status: 'mismatch', rule, detail: 'This scheme needs land ownership.' });
    else out.push({ key: 'land', status: 'unknown', rule, detail: 'Tell us whether you own land.' });
  }

  if (scheme.minAcademicPercentage != null) {
    const rule = `Academic percentage at least ${scheme.minAcademicPercentage}%`;
    if (!has(p.academicPercentage)) out.push({ key: 'academic', status: 'unknown', rule, detail: 'Enter your academic percentage.' });
    else if (Number(p.academicPercentage) >= scheme.minAcademicPercentage) out.push({ key: 'academic', status: 'match', rule, detail: `Your ${p.academicPercentage}% meets the cut-off.` });
    else out.push({ key: 'academic', status: 'mismatch', rule, detail: `Your ${p.academicPercentage}% is below the cut-off.` });
  }

  if (scheme.maxIncome != null) {
    const rule = `Annual family income up to ${rupees(scheme.maxIncome)}`;
    if (!has(p.annualIncome)) out.push({ key: 'income', status: 'unknown', rule, detail: 'Enter your approximate family income.' });
    else if (Number(p.annualIncome) <= scheme.maxIncome) out.push({ key: 'income', status: 'match', rule, detail: `Your income (${rupees(p.annualIncome)}) is within the limit. The Income Certificate is checked later.` });
    else out.push({ key: 'income', status: 'mismatch', rule, detail: `Your income (${rupees(p.annualIncome)}) is above the limit.` });
  }
  return out;
}

function evaluateScheme(scheme, profile) {
  const criteria = buildCriteria(scheme, profile);
  const matched = criteria.filter((c) => c.status === 'match').length;
  const mismatched = criteria.filter((c) => c.status === 'mismatch').length;
  const unknown = criteria.filter((c) => c.status === 'unknown').length;
  const total = criteria.length;

  let fit;
  if (total === 0) fit = 'open';
  else if (mismatched > 0) fit = 'unlikely';
  else if (unknown > 0) fit = 'possible';
  else fit = 'likely';

  const matchScore = total === 0 ? null : Math.round((matched / total) * 100);
  const summary = {
    likely: 'Your details meet every profile rule for this scheme.',
    possible: `No rule is violated, but ${unknown} detail(s) are missing.`,
    open: 'This scheme has no profile-based restriction; eligibility is decided from your documents.',
    unlikely: `${mismatched} rule(s) do not match your profile.`,
  }[fit];

  return {
    schemeId: scheme._id,
    slug: scheme.slug,
    name: scheme.name,
    category: scheme.category,
    benefits: scheme.benefits,
    requiredDocuments: (scheme.requiredDocuments || []).map((d) => d.label),
    assumptionsNote: scheme.assumptionsNote || '',
    fit, matchScore, summary, criteria,
  };
}

const FIT_ORDER = { likely: 0, possible: 1, open: 2, unlikely: 3 };

function recommendSchemes(schemes, profile = {}) {
  return (schemes || [])
    .map((s) => evaluateScheme(s, profile))
    .sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || (b.matchScore ?? 0) - (a.matchScore ?? 0) || a.name.localeCompare(b.name));
}

module.exports = { recommendSchemes, evaluateScheme };