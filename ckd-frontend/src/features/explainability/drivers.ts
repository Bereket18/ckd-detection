/**
 * Driver ordering.
 *
 * One function, in its own module for a mundane reason: `DriverList.tsx` holds a
 * component, and `eslint-plugin-react-refresh` restricts what such a module may
 * export. Three files need this ordering — the driver list, the explainability
 * route's own summary, and the printed report — and each has to sort the same way
 * or the same result would rank its drivers differently on three surfaces.
 */

import type { ShapDriver } from '../../types/api.types';

/**
 * Descending absolute impact (R4.1). A copy — the response array is not mutated,
 * because the prediction in context is shared and sorting in place would reorder
 * what every other consumer sees.
 *
 * Absolute value, not signed: the question this ordering answers is "which values
 * mattered most", and a driver that strongly lowered the score matters as much as
 * one that raised it. Direction is rendered separately, from the backend's own
 * `direction` field.
 */
export function orderDrivers(drivers: readonly ShapDriver[]): ShapDriver[] {
  return [...drivers].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
