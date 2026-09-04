/**
 * Field constraints, read from the API rather than written here.
 *
 * Two sources, both live (architecture §6.1, ADR-7):
 *
 * - **Which fields exist, and in what order the model sees them** ←
 *   `GET /model` → `feature_schema`.
 * - **Numeric bounds and allowed values** ← `GET /openapi.json`, where FastAPI
 *   already publishes Pydantic's `ge`/`le` as `minimum`/`maximum` and `Literal`
 *   as `enum` for `PatientAssessment`.
 *
 * Nothing in this file states a bound. If the backend widens `sc` from 80 to 100,
 * the form follows on the next page load with no frontend change — and a field the
 * backend removes stops being asked, instead of being submitted and rejected with
 * `extra_forbidden`.
 *
 * Nullable fields are emitted as `anyOf: [<constrained>, { type: 'null' }]`, so the
 * reader below takes the non-null branch. Every field is nullable: a missing value
 * is imputed by the backend and disclosed in the response.
 */

import type { OpenApiDocument, OpenApiSchema } from '../../types/api.types';

export interface NumericField {
  name: string;
  kind: 'numeric';
  min: number | null;
  max: number | null;
}

export interface CategoricalField {
  name: string;
  kind: 'categorical';
  values: readonly string[];
}

export type FieldSchema = NumericField | CategoricalField;

/** The Pydantic model whose properties are the 24 questions. */
const SCHEMA_NAME = 'PatientAssessment';

/** Pick the branch of `anyOf` that is not `{ type: 'null' }`. */
function constrainedBranch(schema: OpenApiSchema): OpenApiSchema {
  if (!schema.anyOf) return schema;
  return schema.anyOf.find((branch) => branch.type !== 'null') ?? schema;
}

function readField(name: string, property: OpenApiSchema): FieldSchema {
  const branch = constrainedBranch(property);

  if (Array.isArray(branch.enum) && branch.enum.length > 0) {
    return { name, kind: 'categorical', values: branch.enum };
  }

  // `exclusiveMinimum`/`exclusiveMaximum` are read as well: FastAPI emits them for
  // `gt`/`lt`, and treating an exclusive bound as absent would let the form accept
  // a value the service then rejects.
  const min = branch.minimum ?? branch.exclusiveMinimum ?? null;
  const max = branch.maximum ?? branch.exclusiveMaximum ?? null;
  return { name, kind: 'numeric', min, max };
}

/**
 * Build the field list.
 *
 * `featureSchema` drives both membership and order — the OpenAPI document is
 * consulted only for the fields the model actually declares. A property that
 * exists in `PatientAssessment` but not in `feature_schema` is not asked about,
 * and a field in `feature_schema` with no OpenAPI property is skipped rather than
 * guessed at.
 */
export function deriveFieldSchema(
  featureSchema: readonly string[],
  openapi: OpenApiDocument | undefined
): FieldSchema[] {
  const properties = openapi?.components?.schemas?.[SCHEMA_NAME]?.properties;
  if (!properties) return [];

  const fields: FieldSchema[] = [];
  for (const name of featureSchema) {
    const property = properties[name];
    if (property) fields.push(readField(name, property));
  }
  return fields;
}

/** Index by name, for the form's per-field lookups. */
export function indexFields(fields: readonly FieldSchema[]): Map<string, FieldSchema> {
  return new Map(fields.map((field) => [field.name, field]));
}

/**
 * Validate one answer against the live bounds.
 *
 * Returns `null` for a valid value **and for an empty one**: blank means "not
 * provided", which the service accepts and imputes. Only genuinely invalid input
 * produces a message, which is what keeps submission from being blocked by
 * questions a user chose to skip (plan R6.6, restated).
 */
export function validateAnswer(field: FieldSchema, raw: string): string | null {
  if (raw === '') return null;

  if (field.kind === 'categorical') {
    return field.values.includes(raw) ? null : 'Choose one of the listed options.';
  }

  const value = Number(raw);
  if (!Number.isFinite(value)) return 'Enter a number.';
  if (field.min !== null && value < field.min) return `Must be ${field.min} or more.`;
  if (field.max !== null && value > field.max) return `Must be ${field.max} or less.`;
  return null;
}

/** The range sentence shown under a numeric field, built from the live bounds. */
export function rangeHint(field: FieldSchema): string | null {
  if (field.kind !== 'numeric') return null;
  if (field.min !== null && field.max !== null) return `Accepted range ${field.min}–${field.max}`;
  if (field.min !== null) return `${field.min} or more`;
  if (field.max !== null) return `${field.max} or less`;
  return null;
}
