/**
 * Band vocabulary, in one place.
 *
 * These three maps were private to `ResultPanel` until a second surface needed
 * them — batch scoring shows a band per row, and the printed report shows the same
 * band as the screen. Copying a tone map is how a HIGH band ends up amber in one
 * view and red in another, so the maps moved here rather than being duplicated.
 *
 * Not a `.tsx` file on purpose: `eslint-plugin-react-refresh` restricts what a
 * module holding components may export, and CI lints with `--max-warnings=0`.
 */

import type { StatusTone } from '../../components/ui/styles';
import type { RiskBand } from '../../types/api.types';

/**
 * Tones are assigned to the band, never to the person. `LOW` is green because the
 * *screening signal* is low, and the copy beside it is what carries the caveat that
 * a low band is not a clean bill of health.
 */
export const BAND_TONE: Record<RiskBand, StatusTone> = {
  LOW: 'success',
  MODERATE: 'warn',
  HIGH: 'danger',
};

export const BAND_HEADLINE: Record<RiskBand, string> = {
  LOW: 'Lower risk indicated',
  MODERATE: 'Moderate risk indicated',
  HIGH: 'Higher risk indicated',
};

export const BAND_MEANING: Record<RiskBand, string> = {
  LOW: 'Based on the values you gave, this screening does not point towards chronic kidney disease. It is not a clean bill of health — screening tools miss cases, and this one has seen only what you entered.',
  MODERATE:
    'Based on the values you gave, this screening sits between its low and high bands. That is a reason to have a clinician look at it properly, not a reason to assume either outcome.',
  HIGH: 'Based on the values you gave, this screening points towards chronic kidney disease. This is not a diagnosis, and it is not confirmation — it is a strong reason to see a clinician and have a proper test.',
};
