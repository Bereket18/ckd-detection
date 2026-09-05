/**
 * The patient-readable result, in English and Amharic.
 *
 * Separate from `education.ts` because this copy is *about a specific result* and is
 * selected by risk band, and separate from the technical panel because the two
 * audiences need different things from the same response. A person who has just been
 * told "HIGH" needs four questions answered — what does this mean, why did it say
 * that, how did it decide, and when do I act — and none of those answers is a SHAP
 * value.
 *
 * Amharic is included for the same reason the assessment is mobile-first: this is
 * built for use in Ethiopia, and a result a person cannot read is a result that does
 * not exist. The Amharic is a translation of meaning, not word order — the English
 * "screening signal, not a diagnosis" distinction is preserved in both, because that
 * is the one sentence that must survive translation intact.
 *
 * Editorial rule, in both languages: describe, never prescribe. "A clinician may
 * order a blood test" is education. "You should take X" is not, and appears nowhere.
 */

import type { RiskBand } from '../types/api.types';

export type Language = 'en' | 'am';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  am: 'አማርኛ',
};

export const LANGUAGE_ORDER: readonly Language[] = ['en', 'am'];

/**
 * Which layer of the result is on screen.
 *
 * Declared here rather than in a component file because the words for both options
 * are language-dependent and live in `labels` below — the type and the copy that
 * names it belong together.
 */
export type ResultView = 'plain' | 'technical';

/**
 * The review caveat, in both languages.
 *
 * Shown in the UI rather than kept as a source comment: a reader of the Amharic is
 * exactly the person entitled to know that the Amharic has not been checked by a
 * clinician who speaks it.
 */
export const REVIEW_NOTE: Record<Language, string> = {
  en: 'This Amharic wording is a first translation and has not yet been reviewed by a native-speaking clinician. The English is the reference version.',
  am: 'ይህ የአማርኛ አጻጻፍ የመጀመሪያ ትርጉም ነው፤ አማርኛ በሚናገር የሕክምና ባለሙያ ገና አልተገመገመም። ዋናው መሠረት የእንግሊዝኛው ነው።',
};

/** The four questions, in the order a person actually asks them. */
export interface PatientAnswers {
  /** The headline: what this result is, in one short sentence. */
  headline: string;
  /** What this means — plain, no hedging into meaninglessness. */
  what: string;
  /** Why the tool produced this — what it looked at. */
  why: string;
  /** How it decided — the method, in one paragraph a non-technical reader can hold. */
  how: string;
  /** When to act, and how urgently. The only place urgency is expressed. */
  when: string;
  /** What this result cannot tell them. Stated, not buried. */
  limits: string;
}

export interface PatientCopy {
  /** Section headings, so the whole panel switches language together. */
  labels: {
    what: string;
    why: string;
    how: string;
    when: string;
    limits: string;
    languageSwitch: string;
    plainView: string;
    technicalView: string;
    viewSwitchLabel: string;
    estimatedNote: string;
  };
  bands: Record<RiskBand, PatientAnswers>;
}

const EN: PatientCopy = {
  labels: {
    what: 'What this means',
    why: 'Why it said this',
    how: 'How it decided',
    when: 'When to see a clinician',
    limits: 'What this cannot tell you',
    languageSwitch: 'Language',
    plainView: 'Plain language',
    technicalView: 'Technical detail',
    viewSwitchLabel: 'How much detail to show',
    estimatedNote:
      'Some of your answers were left blank, so the tool filled them in with typical values. That makes this result less specific to you. Filling them in and running it again gives a stronger answer.',
  },
  bands: {
    LOW: {
      headline: 'This screening did not find a pattern that looks like kidney disease.',
      what: 'The numbers you entered look more like the people in this tool’s training data who did not have chronic kidney disease. That is reassuring, but it is not the same as being told your kidneys are healthy — no test was done, and nothing was examined.',
      why: 'The tool compared each value you gave against patterns it learned from four hundred past records. Nothing you entered stood out strongly in the direction it associates with kidney disease.',
      how: 'It is a computer program that has seen many past cases, each one labelled as kidney disease or not. It learned which combinations of values tended to go with which label, and it sorted your set of values into the closer group. It did not examine you, it cannot see anything you did not type, and it has no access to your history.',
      when: 'There is nothing urgent here. If you have diabetes, high blood pressure, or a close relative with kidney disease, ask at your next ordinary visit whether a kidney check is due — those three raise risk regardless of what this screen said. See someone sooner if you notice swelling in your ankles or face, foam in your urine, or unusual tiredness that does not settle.',
      limits: 'It cannot rule kidney disease out. Screening tools miss cases, and early kidney disease is specifically the kind that hides. Only a creatinine blood test and a urine protein test can establish kidney function.',
    },
    MODERATE: {
      headline: 'This screening was not able to place you clearly in either group.',
      what: 'Your values sit between the two patterns this tool knows. It is not a warning and it is not an all-clear — it means the numbers you gave do not lean strongly either way, and the tool is telling you that rather than guessing.',
      why: 'Some of what you entered resembles the kidney disease records in its training data and some does not, so it landed in the middle band the service reserves for exactly this case.',
      how: 'It is a computer program that has seen many past cases, each one labelled as kidney disease or not. It learned which combinations of values tended to go with which label. Your combination did not sit clearly inside either group, which is a real answer and a common one.',
      when: 'Worth raising at a normal appointment rather than an urgent one — but do raise it. Ask for a creatinine blood test and a urine protein test. Both are routine and inexpensive, and together they answer the question this tool cannot.',
      limits: 'A middle band is not a mild case or an early stage. It carries no information about severity, because this tool does not measure severity — it only sorts. Stage and severity come from the two laboratory tests.',
    },
    HIGH: {
      headline: 'This screening found a pattern that resembles kidney disease. This is not a diagnosis.',
      what: 'The values you entered look like the records in this tool’s training data that were labelled as chronic kidney disease. That is a reason to get tested properly — and it is not a diagnosis, not a confirmation, and not a measurement of how much kidney function you have.',
      why: 'One or more of the values you gave sit in the range this tool associates most strongly with kidney disease. The explanation page names which ones and how much each mattered.',
      how: 'It is a computer program that has seen many past cases, each one labelled as kidney disease or not. It learned which combinations of values tended to go with which label, and yours resembles the labelled group. Resembling those records is a statistical statement about numbers, not a finding about your body.',
      when: 'Arrange to see a clinician — days or a couple of weeks, not months, and not the emergency room unless you are unwell. Ask specifically for a creatinine blood test and a urine albumin test. Go sooner if you are passing very little urine, are short of breath, have swelling that is getting worse, or feel confused or very unwell.',
      limits: 'It cannot tell you that you have kidney disease, what stage it would be, what caused it, or how fast it might change. It also cannot tell you that you do not — a high band from incomplete answers is weaker than it looks. Only the laboratory tests settle any of this.',
    },
  },
};

/**
 * Amharic.
 *
 * Translated for meaning rather than word order, and held to one rule above all: the
 * "this is not a diagnosis" distinction must be as unambiguous in Amharic as in
 * English. `ይህ የሕክምና ውሳኔ አይደለም` carries it directly.
 *
 * This is a first pass awaiting native-speaker clinical review, and the UI says so
 * rather than leaving the caveat in a file nobody reads. A translation good enough to
 * read is not automatically good enough to act on, and clinical wording is exactly
 * where that gap bites — the same standard the app applies to unverified data applies
 * to unverified language.
 */
const AM: PatientCopy = {
  labels: {
    what: 'ይህ ምን ማለት ነው',
    why: 'ለምን ይህን አለ',
    how: 'እንዴት ወሰነ',
    when: 'ሐኪም መቼ ማየት አለብኝ',
    limits: 'ይህ ሊነግርዎ የማይችለው',
    languageSwitch: 'ቋንቋ',
    plainView: 'ቀላል ማብራሪያ',
    technicalView: 'ዝርዝር ቴክኒካዊ',
    viewSwitchLabel: 'የዝርዝር መጠን',
    estimatedNote:
      'የተወሰኑ መልሶች ባዶ ቀርተዋል፤ በዚህም መሣሪያው የተለመዱ ግምታዊ ቁጥሮችን ተክቷል። ይህ ውጤቱ ለእርስዎ የተለየ እንዳይሆን ያደርጋል። እነዚህን ሞልተው በድጋሚ ቢሞክሩ ውጤቱ የበለጠ አስተማማኝ ይሆናል።',
  },
  bands: {
    LOW: {
      headline: 'ይህ ምልከታ የኩላሊት ሕመም የሚመስል ምልክት አላገኘም።',
      what: 'ያስገቡት ቁጥሮች መሣሪያው ከተማረባቸው መረጃዎች ውስጥ የኩላሊት ሕመም ከሌላቸው ሰዎች ጋር ይመሳሰላሉ። ይህ የሚያረጋጋ ነው፤ ግን ኩላሊትዎ ጤናማ ነው ማለት አይደለም — ምንም ምርመራ አልተደረገም።',
      why: 'መሣሪያው ያስገቡትን እያንዳንዱን ቁጥር ካለፉት መዝገቦች ከተማረው ንድፍ ጋር አነጻጽሮታል። ወደ ኩላሊት ሕመም አቅጣጫ ጎልቶ የወጣ ቁጥር አልነበረም።',
      how: 'ይህ ብዙ ያለፉ መዝገቦችን ያየ የኮምፒውተር ፕሮግራም ነው፤ እያንዳንዱ መዝገብ የኩላሊት ሕመም እንዳለው ወይም እንደሌለው ተለይቶ ተመዝግቦ ነበር። የቁጥሮች ጥምረት ከየትኛው ምድብ ጋር እንደሚሄድ ተምሮ የእርስዎን ወደ ቀረበው ምድብ መድቧል። እርስዎን አልመረመረም፤ ካልጻፉት ውጪ ምንም አያውቅም።',
      when: 'አስቸኳይ ነገር የለም። የስኳር ሕመም፣ የደም ግፊት ወይም በቤተሰብ ውስጥ የኩላሊት ሕመም ካለ በሚቀጥለው መደበኛ ጉብኝትዎ የኩላሊት ምርመራ ማድረግ ይገባዎት እንደሆነ ይጠይቁ። እግር ወይም ፊት ማበጥ፣ በሽንት ላይ አረፋ፣ ወይም የማይለቅ ድካም ካስተዋሉ ቶሎ ሐኪም ይመልከቱ።',
      limits: 'የኩላሊት ሕመም እንደሌለ ማረጋገጥ አይችልም። እንደዚህ ያሉ መሣሪያዎች አንዳንድ ጊዜ ያመልጣቸዋል፤ በተለይ ገና በጅምር ያለ የኩላሊት ሕመም ይደበቃል። የደም ክሬቲኒን እና የሽንት ፕሮቲን ምርመራ ብቻ ትክክለኛውን መልስ ይሰጣሉ።',
    },
    MODERATE: {
      headline: 'ይህ ምልከታ በሁለቱ ምድቦች መካከል በግልጽ ሊመድብዎ አልቻለም።',
      what: 'ቁጥሮችዎ መሣሪያው በሚያውቃቸው በሁለቱ ንድፎች መካከል ናቸው። ማስጠንቀቂያም አይደለም፣ ነጻ ማለትም አይደለም — ወደ አንዱ ጎን አያዘነብሉም ማለት ነው፤ መሣሪያውም ገምቶ ሳይሆን ይህንኑ እየነገረዎት ነው።',
      why: 'ያስገቡት የተወሰነው ከኩላሊት ሕመም መዝገቦች ጋር ይመሳሰላል፤ የተወሰነው አይመሳሰልም። በዚህ ምክንያት ለዚህ ሁኔታ በተዘጋጀው መካከለኛ ምድብ ውስጥ ወድቋል።',
      how: 'ይህ ብዙ ያለፉ መዝገቦችን ያየ የኮምፒውተር ፕሮግራም ነው፤ የቁጥሮች ጥምረት ከየትኛው ምድብ ጋር እንደሚሄድ ተምሯል። የእርስዎ ጥምረት በአንዱም ምድብ ውስጥ በግልጽ አልተቀመጠም። ይህ እውነተኛ መልስ ነው፤ የተለመደም ነው።',
      when: 'አስቸኳይ ባይሆንም በመደበኛ ቀጠሮዎ ላይ ማንሳት ተገቢ ነው። የደም ክሬቲኒን ምርመራ እና የሽንት ፕሮቲን ምርመራ ይጠይቁ። ሁለቱም መደበኛና ውድ ያልሆኑ ናቸው፤ አንድ ላይ ሆነው መሣሪያው ሊመልስ ያልቻለውን ይመልሱልዎታል።',
      limits: 'መካከለኛ ምድብ ማለት ቀላል ወይም በጅምር ያለ ሕመም ማለት አይደለም። መሣሪያው የሕመሙን ደረጃ አይለካም፤ ደረጃውና ክብደቱ የሚታወቁት በሁለቱ የላቦራቶሪ ምርመራዎች ብቻ ነው።',
    },
    HIGH: {
      headline: 'ይህ ምልከታ የኩላሊት ሕመም የሚመስል ንድፍ አግኝቷል። ይህ የሕክምና ውሳኔ አይደለም።',
      what: 'ያስገቡት ቁጥሮች መሣሪያው ከተማረባቸው መረጃዎች ውስጥ የኩላሊት ሕመም እንዳለባቸው ተለይተው ከተመዘገቡት ጋር ይመሳሰላሉ። ይህ በአግባቡ ምርመራ ለማድረግ ምክንያት ነው — ግን ምርመራ አይደለም፣ ማረጋገጫ አይደለም፣ የኩላሊትዎን የሥራ መጠንም አይለካም።',
      why: 'ካስገቡት ቁጥሮች አንድ ወይም ከዚያ በላይ መሣሪያው ከኩላሊት ሕመም ጋር በጥብቅ የሚያገናኘው ክልል ውስጥ ናቸው። የማብራሪያ ገጹ የትኞቹ እንደሆኑና ምን ያህል እንደተጫኑ ይዘረዝራል።',
      how: 'ይህ ብዙ ያለፉ መዝገቦችን ያየ የኮምፒውተር ፕሮግራም ነው፤ የቁጥሮች ጥምረት ከየትኛው ምድብ ጋር እንደሚሄድ ተምሮ የእርስዎን ከተለዩት መዝገቦች ጋር አመሳስሏል። መመሳሰል ስለ ቁጥሮች የተነገረ ስታቲስቲካዊ ንጽጽር ነው፤ ስለ ሰውነትዎ የተገኘ ውጤት አይደለም።',
      when: 'ሐኪም ለማየት ቀጠሮ ይያዙ — በቀናት ወይም በሁለት ሳምንት ውስጥ፤ በወራት አይደለም። በጣም ካልታመሙ በስተቀር ወደ አደጋ ጊዜ ክፍል መሄድ አያስፈልግም። በተለይ የደም ክሬቲኒን እና የሽንት አልቡሚን ምርመራ ይጠይቁ። ሽንት በጣም ከቀነሰ፣ መተንፈስ ካስቸገረ፣ እብጠቱ እየጨመረ ከሄደ ወይም ግራ መጋባት ከተሰማዎት ወዲያውኑ ይሂዱ።',
      limits: 'የኩላሊት ሕመም እንዳለብዎ፣ በምን ደረጃ እንደሚሆን፣ መንስኤው ምን እንደሆነ ወይም በምን ፍጥነት እንደሚለወጥ ሊነግርዎ አይችልም። እንደሌለብዎም ማረጋገጥ አይችልም — በጎደሉ መልሶች የተገኘ ከፍተኛ ምድብ ከሚመስለው ያነሰ ጥንካሬ አለው። እነዚህን የሚወስኑት የላቦራቶሪ ምርመራዎች ብቻ ናቸው።',
    },
  },
};

const COPY: Record<Language, PatientCopy> = { en: EN, am: AM };

export function patientCopy(language: Language): PatientCopy {
  return COPY[language];
}

/** Languages whose copy has not yet had a native-speaker clinical review. */
export const REVIEW_PENDING: readonly Language[] = ['am'];

