import { Badge } from '../../components/ui/Badge';
import { BAND_TONE } from './bands';
import type { RiskBand } from '../../types/api.types';

/**
 * The band name as a chip.
 *
 * The word is always spelled out — `LOW`, `MODERATE`, `HIGH` — because in a table of
 * results the colour is doing the scanning and the word is doing the telling, and a
 * reader who cannot separate the tones must still be able to read the column.
 */
export function BandChip({ band }: { band: RiskBand }) {
  return <Badge tone={BAND_TONE[band]}>{band}</Badge>;
}
