/**
 * Editorial copy for the Learn area.
 *
 * Prose only, like `fields.ts`, and held here for the same reason: it is written by
 * this project rather than returned by the API, so keeping it out of the components
 * makes the boundary between "what the service said" and "what we wrote" greppable.
 *
 * Two editorial rules govern everything in this file:
 *
 * - **It explains, it does not advise.** Describing what a clinician measures and why
 *   is education. Telling someone what to take, what to stop, or what their numbers
 *   mean for them is clinical advice, and nothing here does it.
 * - **It does not lean on the model.** This content is about chronic kidney disease
 *   and about how screening works in general. It is accurate whether or not the model
 *   is loaded, and it never cites the model's output as evidence for a medical claim.
 */

export interface Article {
  id: string;
  title: string;
  /** One line, used as the card summary and the section description. */
  summary: string;
  /** Paragraphs. Rendered in order, as prose. */
  body: readonly string[];
  /** Optional list rendered after the body — steps, signs, factors. */
  points?: readonly { term: string; detail: string }[];
}

export const ARTICLES: readonly Article[] = [
  {
    id: 'what-ckd-is',
    title: 'What chronic kidney disease is',
    summary:
      'Kidney function that has been reduced, or kidney damage that has been present, for more than three months.',
    body: [
      'Your kidneys filter waste and excess fluid out of your blood, and they do a great deal besides: they regulate blood pressure, keep salts like sodium and potassium in balance, help maintain bone health, and produce the hormone that tells your body to make red blood cells.',
      'Chronic kidney disease means that filtering capacity has fallen, or that there is measurable damage to the kidneys, and that the change has lasted longer than three months. The word chronic is doing real work there — a single abnormal result is not chronic kidney disease. It is a reason to repeat the test.',
      'It is described in stages, and the stages are not a countdown to failure. Most people diagnosed with chronic kidney disease never reach the point of needing dialysis or a transplant. The stage matters because it tells a clinician how closely to watch, and how much can still be protected.',
    ],
    points: [
      {
        term: 'Filtering capacity (eGFR)',
        detail:
          'Estimated glomerular filtration rate — how much blood the kidneys clear per minute, estimated from a creatinine blood test with age and sex. Stages G1 to G5 are defined by it.',
      },
      {
        term: 'Kidney damage (albuminuria)',
        detail:
          'Protein leaking into the urine, which healthy kidneys largely retain. Graded A1 to A3. It can be present while filtering capacity still looks normal, which is why both are measured.',
      },
    ],
  },
  {
    id: 'why-missed',
    title: 'Why it is so often missed',
    summary:
      'Early kidney disease has almost no symptoms, and the kidneys compensate until a great deal of function is already gone.',
    body: [
      'The kidneys have substantial reserve. Function can fall a long way before anything feels wrong, and the symptoms that eventually appear — tiredness, swollen ankles, poor appetite, disturbed sleep, needing to pass urine at night — are so common and so unremarkable that they get attributed to age, to work, to stress, to anything but the kidneys.',
      'The consequence is that a large share of people with chronic kidney disease do not know they have it, and are found incidentally by a blood test ordered for some other reason. That is the specific gap screening exists to close: not to replace the test, but to identify who should have one.',
      'It matters because the window in which progression can be slowed is the window in which there are no symptoms. By the time someone feels unwell, the most protective interventions have less to work with.',
    ],
  },
  {
    id: 'risk-factors',
    title: 'Who is most at risk',
    summary:
      'Diabetes and high blood pressure are the two leading causes worldwide, and together account for most cases.',
    body: [
      'Chronic kidney disease is usually a consequence of something else. The two dominant causes are diabetes and long-standing high blood pressure, both of which damage the small blood vessels the kidneys filter through. Neither causes it quickly, and both are treatable — which is why they are the first thing a clinician asks about.',
    ],
    points: [
      { term: 'Diabetes', detail: 'The single largest cause. High blood glucose damages the filtering vessels over years.' },
      { term: 'High blood pressure', detail: 'Both a cause and a consequence: damaged kidneys raise blood pressure, which damages them further.' },
      { term: 'Cardiovascular disease', detail: 'The same vessel disease that affects the heart affects the kidneys.' },
      { term: 'Family history', detail: 'Kidney disease in a close relative raises risk, and some kidney conditions are directly inherited.' },
      { term: 'Age', detail: 'Filtering capacity declines gradually with age, so the same eGFR means different things at 30 and at 75.' },
      { term: 'A previous episode of acute kidney injury', detail: 'Kidneys that have been acutely injured — by illness, dehydration, or a medication — do not always return fully to baseline.' },
    ],
  },
  {
    id: 'how-diagnosed',
    title: 'How it is actually established',
    summary:
      'Two ordinary tests: creatinine in the blood, and albumin in the urine. Repeated after three months to confirm.',
    body: [
      'No questionnaire and no model can establish chronic kidney disease. It takes two laboratory measurements, and confirmation that the finding has persisted.',
      'The blood test measures creatinine, a waste product of muscle metabolism that healthy kidneys clear steadily. From that number, with your age and sex, a laboratory calculates eGFR. The urine test measures the albumin-to-creatinine ratio, which detects protein that should not be leaving the body.',
      'A single abnormal result is not a diagnosis. Both tests are repeated — conventionally after about three months — because acute illness, dehydration, intense exercise, and some medications all move these numbers temporarily. Persistence is what makes it chronic.',
      'Both tests are routine, inexpensive, and available at most clinics and laboratories. That is the point worth taking away from this page: the definitive test is not exotic, and the barrier to getting it is usually that nobody thought to ask.',
    ],
  },
  {
    id: 'reading-a-band',
    title: 'How to read a screening result',
    summary:
      'A band sorts records into groups by how much they resemble past cases. It does not measure anything about you.',
    body: [
      'A screening tool takes measurements it was given, compares them against patterns in the data it was trained on, and sorts the record into a band. That is the whole of what it does. It has not examined anyone, it has no access to a history, and it cannot see anything that was not entered.',
      'This matters most in the two directions people are tempted to over-read. A lower band is not a clean bill of health: screening tools miss cases, and this one only saw the values it was given. A higher band is not a diagnosis and not confirmation — it is a reason to have the two real tests done.',
      'A score is not a probability unless whoever built it says it is calibrated, and this service states plainly that its score is not. A number like 0.94 says the record sits far along the model’s own scale. It does not say there is a 94% chance of anything.',
      'Anything left blank makes the result weaker in a specific way: the model substitutes a typical value from its training data, so that part of the answer is about the average person in that dataset rather than about you. A result with most values estimated should be read as a prompt to gather the real numbers.',
    ],
  },
];

/** Lookup by id, for cross-linking from elsewhere in the app. */
export function article(id: string): Article | undefined {
  return ARTICLES.find((entry) => entry.id === id);
}
