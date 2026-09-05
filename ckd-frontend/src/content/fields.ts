/**
 * Editorial copy for the 24 assessment questions.
 *
 * This file holds **prose only** — a patient-facing label, the unit as a patient
 * would read it on a lab report, where to find the value, and what it means. It
 * holds no ranges and no allowed values: those come from `GET /openapi.json` at
 * runtime (see `features/assessment/field-schema.ts`), so a bound can never be
 * copied here and drift out of step with the model.
 *
 * The keys must be exactly `/model.feature_schema`. `fields.test.ts` asserts that
 * against a recorded response, so a backend schema change fails the frontend build
 * instead of silently dropping a question.
 */

export interface FieldCopy {
  /** What the question asks, in a patient's words. */
  label: string;
  /** Unit as printed on a lab report. Empty when the value is unitless. */
  unit: string;
  /** The clinical name, so someone holding a lab report can match it up. */
  clinicalName: string;
  /** Where to find this value, or how to answer it. */
  where: string;
  /** What the measurement tells a clinician. Shown in the help tooltip. */
  help: string;
}

/** The step a question belongs to. */
export type StepId = 'about' | 'urine' | 'blood' | 'counts' | 'history';

export interface Step {
  id: StepId;
  title: string;
  /** Why this group is being asked, and that all of it can be skipped. */
  description: string;
  fields: readonly string[];
}

/**
 * Five steps, ordered by where the answers come from rather than by clinical
 * category: everything a person knows without paperwork comes first, the lab
 * report sections are grouped so one document answers a whole step, and history
 * closes because it is answerable by anyone.
 */
export const STEPS: readonly Step[] = [
  {
    id: 'about',
    title: 'About you',
    description:
      'Two questions you can almost certainly answer. Leave either blank if you are unsure — the model estimates what is missing and the result tells you which values were estimated.',
    fields: ['age', 'bp'],
  },
  {
    id: 'urine',
    title: 'Urine test results',
    description:
      'From a urinalysis or urine microscopy report. If you have never had one, skip this whole step.',
    fields: ['sg', 'al', 'su', 'rbc', 'pc', 'pcc', 'ba'],
  },
  {
    id: 'blood',
    title: 'Blood chemistry',
    description:
      'From a blood chemistry or metabolic panel. Serum creatinine and blood urea are the two that matter most for kidney function.',
    fields: ['bgr', 'bu', 'sc', 'sod', 'pot'],
  },
  {
    id: 'counts',
    title: 'Blood counts',
    description:
      'From a complete blood count (CBC). Kidney disease often shows up here as anaemia before anything else is noticed.',
    fields: ['hemo', 'pcv', 'wc', 'rc'],
  },
  {
    id: 'history',
    title: 'Health history',
    description:
      'No lab report needed. Answer what you know about yourself; choose "Not provided" for anything you are unsure of.',
    fields: ['htn', 'dm', 'cad', 'appet', 'pe', 'ane'],
  },
];

/** Flat field order, derived from the steps so the two cannot disagree. */
export const STEP_FIELD_ORDER: readonly string[] = STEPS.flatMap((step) => step.fields);

export const FIELD_COPY: Record<string, FieldCopy> = {
  age: {
    label: 'Your age',
    unit: 'years',
    clinicalName: 'Age',
    where: 'In whole years.',
    help: 'Kidney function declines gradually with age, and risk rises noticeably after 60. Age alone is not a diagnosis.',
  },
  bp: {
    label: 'Blood pressure — the lower number',
    unit: 'mmHg',
    clinicalName: 'Diastolic blood pressure',
    where: 'The second number in a reading like 120/80 — here you would enter 80.',
    help: 'Sustained high blood pressure damages the small vessels in the kidneys, and damaged kidneys in turn raise blood pressure. It is both a cause and a consequence of kidney disease.',
  },

  sg: {
    label: 'Urine specific gravity',
    unit: '',
    clinicalName: 'Specific gravity',
    where: 'On a urinalysis report, usually printed as a number close to 1.020.',
    help: 'How concentrated your urine is. Healthy kidneys concentrate urine; a value that stays low can mean that ability is reduced.',
  },
  al: {
    label: 'Albumin in urine',
    unit: '',
    clinicalName: 'Albumin',
    where: 'On a urinalysis report as a grade rather than a measurement, sometimes shown as "+" marks — count them.',
    help: 'Albumin is a protein that healthy kidneys keep in the blood. Finding it in urine is one of the earliest signs of kidney damage.',
  },
  su: {
    label: 'Sugar in urine',
    unit: '',
    clinicalName: 'Sugar',
    where: 'On a urinalysis report as a grade rather than a measurement, sometimes shown as "+" marks.',
    help: 'Sugar in urine usually means blood sugar is high enough to spill over, which points to diabetes — the leading cause of kidney disease.',
  },
  rbc: {
    label: 'Red blood cells in urine',
    unit: '',
    clinicalName: 'Red blood cells (urine microscopy)',
    where: 'On a urine microscopy report, reported as normal or abnormal.',
    help: 'Blood in urine that is only visible under a microscope can indicate damage to the kidney’s filtering units.',
  },
  pc: {
    label: 'Pus cells in urine',
    unit: '',
    clinicalName: 'Pus cells',
    where: 'On a urine microscopy report, reported as normal or abnormal.',
    help: 'Pus cells point to infection or inflammation somewhere in the urinary tract.',
  },
  pcc: {
    label: 'Pus cell clumps in urine',
    unit: '',
    clinicalName: 'Pus cell clumps',
    where: 'On a urine microscopy report, reported as present or not present.',
    help: 'Clumped pus cells suggest a more established infection than scattered ones.',
  },
  ba: {
    label: 'Bacteria in urine',
    unit: '',
    clinicalName: 'Bacteria',
    where: 'On a urine microscopy report, reported as present or not present.',
    help: 'Bacteria indicate a urinary tract infection, which can reach and affect the kidneys if untreated.',
  },

  bgr: {
    label: 'Blood sugar (random)',
    unit: 'mg/dL',
    clinicalName: 'Random blood glucose',
    where: 'On a blood chemistry report as glucose, from a sample taken at any time of day.',
    help: 'A random reading above about 200 mg/dL suggests diabetes that is not well controlled, which accelerates damage to the kidneys.',
  },
  bu: {
    label: 'Blood urea',
    unit: 'mg/dL',
    clinicalName: 'Blood urea',
    where: 'On a blood chemistry report as urea or BUN.',
    help: 'Urea is a waste product the kidneys clear. It builds up in the blood when filtering slows down.',
  },
  sc: {
    label: 'Serum creatinine',
    unit: 'mg/dL',
    clinicalName: 'Serum creatinine',
    where: 'On a blood chemistry report as creatinine. Often the single most useful value here.',
    help: 'Creatinine is waste from normal muscle activity that only the kidneys remove. A rising level is the standard signal that filtering has slowed.',
  },
  sod: {
    label: 'Sodium',
    unit: 'mEq/L',
    clinicalName: 'Serum sodium',
    where: 'On a blood chemistry or electrolyte panel as sodium or Na.',
    help: 'Kidneys hold sodium and water in balance. A reading away from the middle of the reported range can mean that balance is disturbed; what counts as away from it is a clinician’s judgement, not this app’s.',
  },
  pot: {
    label: 'Potassium',
    unit: 'mEq/L',
    clinicalName: 'Serum potassium',
    where: 'On a blood chemistry or electrolyte panel as potassium or K.',
    help: 'Kidneys excrete excess potassium. When they cannot, it accumulates — which matters because high potassium affects the heart.',
  },

  hemo: {
    label: 'Haemoglobin',
    unit: 'g/dL',
    clinicalName: 'Haemoglobin',
    where: 'On a complete blood count as haemoglobin, Hb, or Hgb.',
    help: 'Kidneys produce the hormone that tells the body to make red blood cells. Low haemoglobin — anaemia — is often the first visible consequence of kidney disease.',
  },
  pcv: {
    label: 'Packed cell volume',
    unit: '%',
    clinicalName: 'Packed cell volume (haematocrit)',
    where: 'On a complete blood count as PCV, haematocrit, or HCT.',
    help: 'The share of your blood made up of red cells. It moves with haemoglobin and tells the same story about anaemia.',
  },
  wc: {
    label: 'White blood cell count',
    unit: 'cells/cumm',
    clinicalName: 'White blood cell count',
    where: 'On a complete blood count as WBC or total leucocyte count.',
    help: 'A raised white cell count signals infection or inflammation, which can involve the kidneys.',
  },
  rc: {
    label: 'Red blood cell count',
    unit: 'millions/cmm',
    clinicalName: 'Red blood cell count',
    where: 'On a complete blood count as RBC.',
    help: 'How many red cells are circulating. A low count is another view of the anaemia that commonly accompanies kidney disease.',
  },

  htn: {
    label: 'Have you been told you have high blood pressure?',
    unit: '',
    clinicalName: 'Hypertension',
    where: 'Answer yes if a clinician has diagnosed it, or if you take medication for it.',
    help: 'High blood pressure is the second most common cause of kidney disease after diabetes.',
  },
  dm: {
    label: 'Have you been diagnosed with diabetes?',
    unit: '',
    clinicalName: 'Diabetes mellitus',
    where: 'Answer yes for type 1 or type 2, whether or not it is currently controlled.',
    help: 'Diabetes is the leading cause of kidney disease worldwide. Persistently high blood sugar damages the kidney’s filters over years.',
  },
  cad: {
    label: 'Have you been diagnosed with heart disease?',
    unit: '',
    clinicalName: 'Coronary artery disease',
    where: 'Answer yes for a diagnosis of coronary artery disease, angina, or a previous heart attack.',
    help: 'The heart and kidneys share the same blood vessels, so disease in one commonly accompanies disease in the other.',
  },
  appet: {
    label: 'How has your appetite been?',
    unit: '',
    clinicalName: 'Appetite',
    where: 'Answer for the last few weeks, not a single day.',
    help: 'Loss of appetite is one of the ways advanced kidney disease makes itself felt, as waste products build up in the blood.',
  },
  pe: {
    label: 'Any swelling in your feet or ankles?',
    unit: '',
    clinicalName: 'Pedal oedema',
    where: 'Answer yes if swelling has been present or comes and goes, particularly by the end of the day.',
    help: 'Swelling means the body is holding fluid, which happens when kidneys cannot clear enough salt and water.',
  },
  ane: {
    label: 'Have you been told you have anaemia?',
    unit: '',
    clinicalName: 'Anaemia',
    where: 'Answer yes if a clinician has diagnosed it or you take iron for it.',
    help: 'Anaemia and kidney disease are closely linked, because damaged kidneys produce less of the hormone that drives red cell production.',
  },
};

/** Copy for a field, or `undefined` when the backend names a field we have no copy for. */
export function fieldCopy(name: string): FieldCopy | undefined {
  return FIELD_COPY[name];
}
