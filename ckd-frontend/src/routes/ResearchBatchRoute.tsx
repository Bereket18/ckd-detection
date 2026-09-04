import { useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, Download, FileUp, Play, RotateCcw, Trash2 } from 'lucide-react';
import { RouteShell } from '../components/layout/RouteShell';
import { StatusLabel } from '../components/provenance/StatusLabel';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { DataTable, type Column } from '../components/ui/DataTable';
import { ErrorState } from '../components/ui/ErrorState';
import { SectionHeader } from '../components/ui/SectionHeader';
import { buttonClasses, inputClasses } from '../components/ui/styles';
import { BandChip } from '../features/results/BandChip';
import { useModelMetadata } from '../lib/query/hooks';
import { usePredictBatch } from '../lib/query/mutations';
import type { BatchPredictionItem, RiskBand } from '../types/api.types';

/**
 * `/research/batch` — CSV and JSON batch scoring.
 *
 * Deliberately in the research area and not in the assessment path. The endpoint is
 * real and implemented, but scoring a file of records is a research activity; putting
 * it beside a patient's own single assessment would blur what the tool is for.
 *
 * Three decisions worth recording:
 *
 * - **The header row is checked here, before anything is sent.** A column the model
 *   does not expect is the single most common reason a batch fails, and the service
 *   answers that with a 422 keyed by row index. Naming the column locally turns a
 *   server error into a sentence the user can act on. The check *warns* — it never
 *   blocks — because a missing column is legitimate: the service imputes it and says
 *   so, which is the same contract the single assessment relies on.
 * - **Row errors are reported by file line, not by API row index.** The service counts
 *   data rows from zero; a person counts file lines from one and has a header at line
 *   one. `line = row + 2` is done in `normalizeError`, and the table shows the line.
 * - **Nothing is uploaded anywhere except the screening service, and nothing is
 *   written to disk.** The file is read in the browser, posted to the same API the
 *   rest of the product uses, and held in component state until the tab is closed.
 */

const SAMPLE_CSV = `age,bp,sc,hemo,htn,dm
62,90,3.4,9.1,yes,yes
41,80,0.9,14.2,no,no
55,70,1.6,11.8,yes,no`;

type Format = 'csv' | 'json';

interface HeaderCheck {
  unknown: string[];
  missing: string[];
  present: number;
}

/** Split a CSV header row. Quoted headers are not the common case, but they are cheap to allow. */
function parseHeader(text: string): string[] | null {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim() !== '');
  if (firstLine === undefined) return null;
  return firstLine
    .split(',')
    .map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))
    .filter((cell) => cell !== '');
}

function checkHeader(header: string[], schema: readonly string[]): HeaderCheck {
  const known = new Set(schema);
  const seen = new Set(header);
  return {
    unknown: header.filter((column) => !known.has(column)),
    missing: schema.filter((column) => !seen.has(column)),
    present: header.filter((column) => known.has(column)).length,
  };
}

function bandCounts(results: readonly BatchPredictionItem[]): Record<RiskBand, number> {
  const counts: Record<RiskBand, number> = { LOW: 0, MODERATE: 0, HIGH: 0 };
  for (const item of results) counts[item.risk_band] += 1;
  return counts;
}

/** A row of the results table, carrying the file line it came from. */
interface ResultRow extends BatchPredictionItem {
  index: number;
  line: number;
}

export default function ResearchBatchRoute() {
  const model = useModelMetadata();
  const batch = usePredictBatch();

  const [format, setFormat] = useState<Format>('csv');
  const [text, setText] = useState('');
  const [explain, setExplain] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const textareaId = useId();
  const explainId = useId();

  // Memoised so the header check below does not re-run on every keystroke against a
  // fresh empty array. `?? []` inline would produce a new identity each render.
  const featureSchema = model.data?.feature_schema;
  const schema = useMemo<readonly string[]>(() => featureSchema ?? [], [featureSchema]);

  const headerCheck = useMemo<HeaderCheck | null>(() => {
    if (format !== 'csv' || text.trim() === '' || schema.length === 0) return null;
    const header = parseHeader(text);
    return header === null ? null : checkHeader(header, schema);
  }, [format, text, schema]);

  const rowCount = useMemo(() => {
    if (format !== 'csv') return null;
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    return Math.max(lines.length - 1, 0);
  }, [format, text]);

  const rows: readonly ResultRow[] = useMemo(
    () =>
      (batch.data?.results ?? []).map((item, index) => ({
        ...item,
        index,
        // Only meaningful for CSV, where row 0 is the first record under a header.
        line: index + 2,
      })),
    [batch.data]
  );

  async function onFile(file: File) {
    setReadError(null);
    try {
      const content = await file.text();
      setText(content);
      setFileName(file.name);
      setFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv');
      batch.reset();
    } catch {
      setReadError('That file could not be read in this browser. Paste its contents below instead.');
    }
  }

  function run() {
    if (text.trim() === '') return;
    batch.mutate({
      body: text,
      contentType: format === 'json' ? 'application/json' : 'text/csv',
      explain,
    });
  }

  function clearAll() {
    setText('');
    setFileName(null);
    setReadError(null);
    batch.reset();
    if (fileInput.current) fileInput.current.value = '';
  }

  const columns: readonly Column<ResultRow>[] = [
    {
      key: 'row',
      header: format === 'csv' ? 'Line' : 'Item',
      numeric: true,
      cell: (row) => (format === 'csv' ? row.line : row.index + 1),
    },
    {
      key: 'verdict',
      header: 'Verdict',
      cell: (row) => (
        <span className="font-medium text-ink">{row.prediction === 'ckd' ? 'ckd' : 'notckd'}</span>
      ),
    },
    { key: 'band', header: 'Band', cell: (row) => <BandChip band={row.risk_band} /> },
    {
      key: 'score',
      header: 'Score',
      numeric: true,
      cell: (row) => row.ckd_score.toFixed(4),
    },
    {
      key: 'imputed',
      header: 'Imputed',
      numeric: true,
      cell: (row) =>
        row.imputation_count === 0 ? (
          <span className="text-ink-subtle">0</span>
        ) : (
          <span title={row.imputed_fields.join(', ')}>{row.imputation_count}</span>
        ),
    },
    {
      key: 'drivers',
      header: 'Top drivers',
      cell: (row) =>
        row.shap_drivers.length === 0 ? (
          <span className="text-ink-subtle">—</span>
        ) : (
          <span className="font-mono text-xs text-ink-muted">
            {row.shap_drivers
              .map(
                (driver) =>
                  `${driver.feature} ${driver.direction === 'raises_risk' ? '↑' : driver.direction === 'lowers_risk' ? '↓' : '·'}`
              )
              .join('  ')}
          </span>
        ),
    },
  ];

  const counts = batch.data ? bandCounts(batch.data.results) : null;

  return (
    <RouteShell
      eyebrow="Research Lab"
      title="Batch scoring"
      description="Score many de-identified records at once against the deployed model. Intended for research and evaluation, not for screening an individual."
    >
      <Alert tone="warn" title="Before you upload anything">
        Use de-identified records only. Names, medical record numbers, and phone numbers are not
        part of the field contract, are not needed for scoring, and should not be in the file.
        Whatever you paste or select is sent to the screening service and held in this tab; this
        application writes nothing to your device.
      </Alert>

      <section aria-labelledby="input-heading" className="space-y-4">
        <SectionHeader
          id="input-heading"
          title="Records to score"
          description="Select a file or paste its contents. CSV needs a header row naming the fields; JSON needs an array of objects."
          actions={
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={<FileUp aria-hidden className="size-4" />}
                onClick={() => fileInput.current?.click()}
              >
                Choose a file
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Download aria-hidden className="size-4" />}
                onClick={() => {
                  setFormat('csv');
                  setText(SAMPLE_CSV);
                  setFileName(null);
                  batch.reset();
                }}
              >
                Use a sample
              </Button>
            </>
          }
        />

        {/*
          A real file input, visually hidden rather than replaced: the native control
          is the only one that reaches the OS file picker from the keyboard, and
          `sr-only` keeps it focusable. The visible trigger above forwards the click.
        */}
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.json,text/csv,application/json"
          className="sr-only"
          aria-label="Choose a CSV or JSON file of records"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
          }}
        />

        <Card padding="lg">
          <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3">
            <fieldset className="flex items-center gap-3">
              <legend className="sr-only">Body format</legend>
              {(['csv', 'json'] as const).map((option) => (
                <label
                  key={option}
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink"
                >
                  <input
                    type="radio"
                    name="batch-format"
                    value={option}
                    checked={format === option}
                    onChange={() => setFormat(option)}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  {option === 'csv' ? 'CSV' : 'JSON array'}
                </label>
              ))}
            </fieldset>

            <label
              htmlFor={explainId}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink"
            >
              <input
                id={explainId}
                type="checkbox"
                checked={explain}
                onChange={(event) => setExplain(event.target.checked)}
                className="size-4 accent-[var(--color-accent)]"
              />
              Ask for per-row drivers
            </label>

            {fileName !== null && (
              <p className="text-sm text-ink-muted">
                Loaded <span className="font-mono text-xs">{fileName}</span>
              </p>
            )}
          </div>

          <label htmlFor={textareaId} className="text-sm font-medium text-ink">
            {format === 'csv' ? 'CSV, including the header row' : 'A JSON array of record objects'}
          </label>
          <textarea
            id={textareaId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            rows={10}
            placeholder={format === 'csv' ? SAMPLE_CSV : '[{"age": 62, "sc": 3.4}]'}
            className={inputClasses('mt-1.5 py-2 font-mono text-sm')}
          />

          {rowCount !== null && rowCount > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              {rowCount} data {rowCount === 1 ? 'row' : 'rows'} below the header.
            </p>
          )}

          {readError !== null && (
            <Alert tone="danger" title="The file could not be read" className="mt-3">
              {readError}
            </Alert>
          )}

          {headerCheck !== null && (
            <div className="mt-3 space-y-2">
              {headerCheck.unknown.length > 0 && (
                <Alert tone="warn" title="Columns the model does not expect">
                  <span className="font-mono text-xs">{headerCheck.unknown.join(', ')}</span>
                  <span className="block pt-1">
                    These are not in the field contract. Remove them before sending, or expect the
                    service to reject the rows that contain them.
                  </span>
                </Alert>
              )}
              {headerCheck.missing.length > 0 && (
                <Alert tone="info" title={`${headerCheck.missing.length} fields not in this file`}>
                  <span className="font-mono text-xs">{headerCheck.missing.join(', ')}</span>
                  <span className="block pt-1">
                    That is allowed. The service imputes each missing value from its training data
                    and reports the count per row, so you can see how much of each result rests on
                    a substituted value rather than on the record.
                  </span>
                </Alert>
              )}
              {headerCheck.unknown.length === 0 && headerCheck.missing.length === 0 && (
                <Alert tone="success" title="Every field in the contract is present">
                  All {headerCheck.present} columns are recognised and nothing will need to be
                  imputed.
                </Alert>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              icon={<Play aria-hidden className="size-4" />}
              loading={batch.isPending}
              loadingLabel="Scoring…"
              disabled={text.trim() === ''}
              onClick={run}
            >
              Score these records
            </Button>
            {batch.isSuccess && (
              <Button
                variant="secondary"
                size="md"
                icon={<RotateCcw aria-hidden className="size-4" />}
                onClick={run}
              >
                Score again
              </Button>
            )}
            <Button
              variant="ghost"
              size="md"
              icon={<Trash2 aria-hidden className="size-4" />}
              onClick={clearAll}
            >
              Clear
            </Button>
          </div>
        </Card>
      </section>

      {batch.isError && (
        <ErrorState
          error={batch.error}
          onRetry={batch.error.retryable ? run : undefined}
        >
          {batch.error.rowErrors !== undefined && batch.error.rowErrors.length > 0 && (
            <DataTable
              caption="Rows the service rejected, by line in your file"
              columns={[
                { key: 'line', header: 'Line', numeric: true, cell: (row) => row.line },
                {
                  key: 'field',
                  header: 'Column',
                  cell: (row) => <span className="font-mono text-xs">{row.field}</span>,
                },
                { key: 'message', header: 'Problem', cell: (row) => row.message },
              ]}
              rows={batch.error.rowErrors}
              rowKey={(row, index) => `${String(row.line)}-${row.field}-${String(index)}`}
            />
          )}
        </ErrorState>
      )}

      {batch.isSuccess && counts !== null && (
        <section aria-labelledby="results-heading" className="space-y-4">
          <SectionHeader
            id="results-heading"
            title="Results"
            description="One row per record, in the order the service returned them. Nothing here is recomputed — the band and the verdict are as received."
            aside={<StatusLabel provenance="verified" />}
          />

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Records scored', value: String(batch.data.count) },
              { label: 'Lower band', value: String(counts.LOW) },
              { label: 'Middle band', value: String(counts.MODERATE) },
              { label: 'Higher band', value: String(counts.HIGH) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-border bg-surface p-3">
                <dt className="text-sm text-ink-muted">{item.label}</dt>
                <dd className="mt-0.5 font-mono text-2xl tabular-nums text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>

          <DataTable
            caption={`Per-record results for ${String(batch.data.count)} records`}
            columns={columns}
            rows={rows}
            rowKey={(row) => String(row.index)}
            empty={
              <Alert tone="info" title="The service scored nothing">
                The request succeeded but returned no rows, which means the body contained no
                records the service recognised.
              </Alert>
            }
          />

          {!explain && (
            <p className="text-sm text-ink-muted">
              The drivers column is empty because per-row drivers were not requested. Tick{' '}
              <span className="font-medium text-ink">Ask for per-row drivers</span> and score
              again — the service returns three per record.
            </p>
          )}

          <Alert tone="warn" title="These are screening signals, not diagnoses">
            The same limits apply as to a single assessment: the score is not a calibrated
            probability, the bands come from the service, and a batch of results is not a cohort
            finding. A record in the higher band means the two laboratory tests are worth
            arranging for that person.
          </Alert>
        </section>
      )}

      <section aria-labelledby="contract-heading" className="space-y-4">
        <SectionHeader
          id="contract-heading"
          title="What the service accepts"
          description="Read from the model document at page load rather than documented here, so this cannot drift from what the endpoint actually validates."
          aside={<StatusLabel provenance="verified" />}
        />
        <Card padding="lg">
          <CardHeader
            level={3}
            title="Field names"
            description="Any subset, in any order. A column not on this list is not part of the contract."
            aside={<CircleCheck aria-hidden className="size-5 text-ink-subtle" />}
          />
          {schema.length === 0 ? (
            <p className="text-sm text-ink-muted">
              The field list could not be read from the service, so the header check above is
              inactive. The endpoint still validates what you send.
            </p>
          ) : (
            <p className="font-mono text-sm break-words text-ink-muted">{schema.join(', ')}</p>
          )}
          <p className="mt-3 text-sm text-ink-muted">
            Ranges and permitted categories are not restated here either — see{' '}
            <Link to="/research" className="text-accent-ink underline">
              the Research Lab index
            </Link>{' '}
            for where they come from, or{' '}
            <Link to="/model-card" className="text-accent-ink underline">
              the model card
            </Link>{' '}
            for what the model is.
          </p>
        </Card>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-border pt-6">
        <Link to="/research" className={buttonClasses('secondary', 'md')}>
          Back to the Research Lab
        </Link>
        <Link to="/assessment" className={buttonClasses('ghost', 'md')}>
          Score a single record instead
        </Link>
      </div>
    </RouteShell>
  );
}
