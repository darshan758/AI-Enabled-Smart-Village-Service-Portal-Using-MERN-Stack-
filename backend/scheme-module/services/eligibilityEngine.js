const { documentNamesMatch } = require('../utils/normalize');

const NAME_MATCH_THRESHOLD = parseFloat(process.env.NAME_MATCH_THRESHOLD || '0.82');

function includesOrAll(list, value) {
  if (!list || list.length === 0) return true;
  if (list.map((v) => v.toLowerCase()).includes('all')) return true;
  if (value === undefined || value === null || value === '') return false;
  return list.map((v) => v.toLowerCase()).includes(String(value).toLowerCase());
}

/**
 * evaluateFormCriteria()
 * Checks the applicant-entered form fields against the scheme's
 * configured rules. Does NOT look at documents — that's a separate
 * pass, since a form value (e.g. self-reported income) is only a
 * pre-check; the document is the actual source of truth where one
 * was uploaded and successfully parsed.
 */
function evaluateFormCriteria(scheme, formData) {
  const reasons = [];
  const failedCriteria = [];

  // Age
  if (scheme.minAge !== null && scheme.minAge !== undefined) {
    if (formData.age === undefined || formData.age === null || formData.age === '') {
      failedCriteria.push('age');
      reasons.push('Age was not provided.');
    } else if (Number(formData.age) < scheme.minAge) {
      failedCriteria.push('age');
      reasons.push(`Applicant age is below the minimum required age of ${scheme.minAge}.`);
    }
  }
  if (scheme.maxAge !== null && scheme.maxAge !== undefined && formData.age !== undefined && formData.age !== '') {
    if (Number(formData.age) > scheme.maxAge) {
      failedCriteria.push('age');
      reasons.push(`Applicant age exceeds the maximum allowed age of ${scheme.maxAge}.`);
    }
  }

  // Gender
  if (!includesOrAll(scheme.genderEligibility, formData.gender)) {
    failedCriteria.push('gender');
    reasons.push('Your gender does not match the eligibility criteria for this scheme.');
  }

  // Occupation
  if (!includesOrAll(scheme.occupationEligibility, formData.occupation)) {
    failedCriteria.push('occupation');
    reasons.push('Your occupation does not match the eligibility criteria for this scheme.');
  }

  // Caste (form-declared; the caste certificate check below is authoritative
  // when a caste certificate is required and successfully parsed)
  if (!includesOrAll(scheme.casteEligibility, formData.caste)) {
    failedCriteria.push('caste');
    reasons.push('Your caste does not match the eligibility criteria for this scheme.');
  }

  // Land requirement
  if (scheme.landRequired) {
    if (formData.landOwnership !== true && formData.landOwnership !== 'yes') {
      failedCriteria.push('land');
      reasons.push('This scheme requires land ownership, which was not confirmed.');
    }
  }

  // Academic percentage, if configured
  if (scheme.minAcademicPercentage !== null && scheme.minAcademicPercentage !== undefined) {
    const pct = formData.academicPercentage !== undefined ? Number(formData.academicPercentage) : null;
    if (pct === null || Number.isNaN(pct)) {
      failedCriteria.push('academicPercentage');
      reasons.push('Academic percentage was not provided.');
    } else if (pct < scheme.minAcademicPercentage) {
      failedCriteria.push('academicPercentage');
      reasons.push(`Academic percentage is below the minimum required ${scheme.minAcademicPercentage}%.`);
    }
  }

  return { reasons, failedCriteria };
}

/**
 * evaluateDocumentCriteria()
 * Cross-checks verified document results against scheme rules:
 * - every required document present + verified
 * - income (from Income Certificate, if required) <= scheme.maxIncome
 * - caste (from Caste Certificate, if required) is in casteEligibility
 * - education (from Education Certificate, if required) is in educationEligibility
 * - cross-document name matching among all documents that requiresNameMatch
 */
function evaluateDocumentCriteria(scheme, documentResultsByType) {
  const reasons = [];
  const failedCriteria = [];
  const verifiedDocuments = [];

  const requiredDocs = scheme.requiredDocuments || [];

  // 1. Presence + basic verification of every required document.
  for (const reqDoc of requiredDocs) {
    const result = documentResultsByType[reqDoc.type];
    if (!result) {
      failedCriteria.push(`document:${reqDoc.type}`);
      reasons.push(`Please upload ${reqDoc.label}.`);
      continue;
    }
    if (!result.verified) {
      failedCriteria.push(`document:${reqDoc.type}`);
      reasons.push(result.message || `${reqDoc.label} could not be verified.`);
      continue;
    }
    verifiedDocuments.push(reqDoc.type);
  }

  // 2. Income Certificate -> maxIncome check (document is authoritative).
  const incomeDoc = documentResultsByType['income_certificate'];
  if (requiredDocs.some((d) => d.type === 'income_certificate') && incomeDoc && incomeDoc.verified) {
    const income = incomeDoc.extraFields ? incomeDoc.extraFields.annualIncome : null;
    if (income === null || income === undefined) {
      failedCriteria.push('income_extraction');
      reasons.push('Could not reliably extract annual income from the Income Certificate.');
    } else if (scheme.maxIncome !== null && scheme.maxIncome !== undefined && income > scheme.maxIncome) {
      failedCriteria.push('income');
      reasons.push('Your income exceeds the maximum income allowed for this scheme.');
    }
  }

  // 3. Caste Certificate -> casteEligibility check (document is authoritative
  //    when present; a caste certificate existing is NOT automatically a pass).
  const casteDoc = documentResultsByType['caste_certificate'];
  if (requiredDocs.some((d) => d.type === 'caste_certificate') && casteDoc && casteDoc.verified) {
    const casteCategory = casteDoc.extraFields ? casteDoc.extraFields.casteCategory : null;
    const allowed = scheme.casteEligibility || [];
    const allowsAll = allowed.map((v) => v.toLowerCase()).includes('all');

    if (!allowsAll) {
      if (!casteCategory) {
        failedCriteria.push('caste_extraction');
        reasons.push(
          'Could not confidently determine the caste category from the Caste Certificate. Please upload a clearer document.'
        );
      } else if (!allowed.map((v) => v.toUpperCase()).includes(casteCategory.toUpperCase())) {
        failedCriteria.push('caste');
        reasons.push('Your caste does not match the eligibility criteria for this scheme.');
      }
    }
  }

  // 4. Education Certificate -> educationEligibility check.
  const eduDoc = documentResultsByType['education_certificate'];
  if (requiredDocs.some((d) => d.type === 'education_certificate') && eduDoc && eduDoc.verified) {
    const level = eduDoc.extraFields ? eduDoc.extraFields.educationLevel : null;
    const allowed = scheme.educationEligibility || [];
    const allowsAll = allowed.map((v) => v.toLowerCase()).includes('all');

    if (!allowsAll) {
      if (!level) {
        failedCriteria.push('education_extraction');
        reasons.push(
          'Could not confidently determine the education level from the Education Certificate.'
        );
      } else if (!allowed.map((v) => v.toLowerCase()).includes(level.toLowerCase())) {
        failedCriteria.push('education');
        reasons.push('Your education level does not match the eligibility criteria for this scheme.');
      }
    }
  }

  // 5. Cross-document name matching.
  const nameMatchTypes =
    scheme.nameMatchGroup && scheme.nameMatchGroup.length > 0
      ? scheme.nameMatchGroup
      : requiredDocs.filter((d) => d.requiresNameMatch).map((d) => d.type);

  const namedDocs = nameMatchTypes
    .map((type) => ({ type, result: documentResultsByType[type] }))
    .filter((d) => d.result && d.result.verified);

  if (namedDocs.length >= 2) {
    const reference = namedDocs.find((d) => d.result.extractedName) || namedDocs[0];

    for (const doc of namedDocs) {
      if (doc.type === reference.type) continue;
      if (!doc.result.extractedName || !reference.result.extractedName) {
        failedCriteria.push(`name_extraction:${doc.type}`);
        reasons.push(`Could not extract the name from the ${labelFor(scheme, doc.type)}.`);
        continue;
      }
      const { match } = documentNamesMatch(
        reference.result.extractedName,
        doc.result.extractedName,
        NAME_MATCH_THRESHOLD
      );
      if (!match) {
        failedCriteria.push(`name_mismatch:${doc.type}`);
        reasons.push(
          `The ${labelFor(scheme, reference.type)} name does not match the ${labelFor(scheme, doc.type)} name.`
        );
      }
    }
  }

  return { reasons, failedCriteria, verifiedDocuments };
}

function labelFor(scheme, type) {
  const doc = (scheme.requiredDocuments || []).find((d) => d.type === type);
  return doc ? doc.label : type;
}

/**
 * evaluateEligibility()
 * Combines form + document evaluation into the final structured result.
 */
function evaluateEligibility(scheme, formData, documentResultsByType) {
  const formResult = evaluateFormCriteria(scheme, formData);
  const docResult = evaluateDocumentCriteria(scheme, documentResultsByType);

  const reasons = [...formResult.reasons, ...docResult.reasons];
  const failedCriteria = [...formResult.failedCriteria, ...docResult.failedCriteria];

  const anyDocVerificationFailed = failedCriteria.some((f) => f.startsWith('document:'));
  const eligible = reasons.length === 0;

  let status = 'ELIGIBLE';
  if (!eligible) {
    status = anyDocVerificationFailed ? 'VERIFICATION_FAILED' : 'NOT_ELIGIBLE';
  }

  return {
    eligible,
    status,
    reasons: eligible ? ['All required document checks passed.'] : reasons,
    failedCriteria,
    verifiedDocuments: docResult.verifiedDocuments,
  };
}

module.exports = {
  evaluateFormCriteria,
  evaluateDocumentCriteria,
  evaluateEligibility,
};