/**
 * Grouping the backend's field list into steps.
 *
 * The editorial `STEPS` in `content/fields.ts` say which questions belong together
 * and why; the backend says which questions exist. This joins the two, and the join
 * is deliberately one-directional: the backend's list is authoritative, and the
 * editorial grouping only orders it.
 *
 * The last part matters more than it looks. If the model gains a feature that no
 * step mentions, that field is collected into a final step rather than dropped —
 * because a dropped question is not a missing question, it is a question the
 * backend will impute silently while the user believes they answered everything.
 */

import { STEPS } from '../../content/fields';
import type { OpenApiDocument } from '../../types/api.types';
import { deriveFieldSchema, type FieldSchema } from './field-schema';

export interface BuiltStep {
  id: string;
  title: string;
  description: string;
  fields: readonly FieldSchema[];
}

const UNGROUPED: Omit<BuiltStep, 'fields'> = {
  id: 'other',
  title: 'Other measurements',
  description:
    'The service asks for these as well. They are grouped here because this version of the app has no plain-language description for them yet — they are still sent exactly as the model expects.',
};

export function buildSteps(
  featureSchema: readonly string[],
  openapi: OpenApiDocument | undefined
): BuiltStep[] {
  const fields = deriveFieldSchema(featureSchema, openapi);
  if (fields.length === 0) return [];

  const byName = new Map(fields.map((field) => [field.name, field]));
  const placed = new Set<string>();
  const steps: BuiltStep[] = [];

  for (const step of STEPS) {
    const stepFields: FieldSchema[] = [];
    for (const name of step.fields) {
      const field = byName.get(name);
      // A field the editorial layer knows about but the backend no longer declares
      // is simply not asked. No placeholder, no disabled input.
      if (field === undefined) continue;
      stepFields.push(field);
      placed.add(name);
    }
    if (stepFields.length > 0) {
      steps.push({ id: step.id, title: step.title, description: step.description, fields: stepFields });
    }
  }

  const leftover = fields.filter((field) => !placed.has(field.name));
  if (leftover.length > 0) steps.push({ ...UNGROUPED, fields: leftover });

  return steps;
}
