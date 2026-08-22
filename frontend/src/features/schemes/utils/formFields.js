/**
 * getVisibleFields()
 * Decides which eligibility-form fields to render based purely on
 * the scheme's configuration from the database — never hardcoded
 * per scheme name. This is what keeps the form "dynamic" per the
 * project's requirement.
 */
export function getVisibleFields(scheme) {
  if (!scheme) return [];

  const fields = [];
  const hasRestriction = (arr) => Array.isArray(arr) && arr.length > 0 && !arr.map((v) => v.toLowerCase()).includes('all');

  if (scheme.minAge !== null || scheme.maxAge !== null) {
    fields.push('age');
  }
  if (hasRestriction(scheme.genderEligibility)) {
    fields.push('gender');
  }
  if (hasRestriction(scheme.occupationEligibility)) {
    fields.push('occupation');
  }
  if (hasRestriction(scheme.educationEligibility)) {
    fields.push('education');
  }
  if (hasRestriction(scheme.casteEligibility)) {
    fields.push('caste');
  }
  if (scheme.landRequired) {
    fields.push('landOwnership');
  }
  if (scheme.minAcademicPercentage !== null && scheme.minAcademicPercentage !== undefined) {
    fields.push('academicPercentage');
  }
  if (scheme.maxIncome !== null && scheme.maxIncome !== undefined) {
    // Shown for context only — actual income used for the eligibility
    // decision comes from the parsed Income Certificate, not this field,
    // whenever an income_certificate document is required.
    fields.push('selfReportedIncome');
  }

  return fields;
}

export const FIELD_CONFIG = {
  age: { label: 'Age', type: 'number' },
  gender: {
    label: 'Gender',
    type: 'select',
    options: ['Male', 'Female', 'Other'],
  },
  occupation: {
    label: 'Occupation',
    type: 'select',
    options: ['Farmer', 'Student', 'Salaried', 'Self-Employed', 'Unemployed', 'Other'],
  },
  education: {
    label: 'Current/Highest Education Level',
    type: 'select',
    options: ['Class 11', 'Class 12', 'Diploma', 'Undergraduate', 'Postgraduate'],
  },
  caste: {
    label: 'Caste Category',
    type: 'select',
    options: ['SC', 'ST', 'OBC', 'GENERAL'],
  },
  landOwnership: {
    label: 'Do you own agricultural land?',
    type: 'select',
    options: ['yes', 'no'],
  },
  academicPercentage: { label: 'Academic Percentage (%)', type: 'number' },
  selfReportedIncome: {
    label: 'Approximate Annual Family Income (₹)',
    type: 'number',
    hint: 'Final income verification uses your uploaded Income Certificate, not this field.',
  },
};