/**
 * The result, for the person who took it.
 *
 * This is the plain-language half of the split the Results page makes: the same
 * response, addressed to a reader rather than to an analyst. It contains no score,
 * no SHAP value, and no model identifier — those are real and they are one tab
 * away, but leading with them answers a question nobody asked.
 *
 * The five blocks are fixed and always in this order, because it is the order the
 * questions arrive in: what does this mean, why did it say that, how did it decide,
 * when should I act, and what can it not tell me. `when` carries the only urgency
 * wording anywhere in the app, and `limits` is last so nothing follows the caveat.
 *
 * Language is component state on purpose. Remembering the choice would mean writing
 * to `localStorage`, which ADR-10 forbids on a page that holds a health result, and
 * a language switch that is two taps from anywhere does not need to be remembered.
 */

import { useState } from 'react';
import { Activity, CircleHelp, Clock, Info, Languages, ShieldQuestion } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { cn } from '../../lib/cn';
import {
  LANGUAGE_NAMES,
  LANGUAGE_ORDER,
  REVIEW_NOTE,
  REVIEW_PENDING,
  patientCopy,
  type Language,
} from '../../content/patient-summary';
import type { RiskBand } from '../../types/api.types';

interface PatientSummaryProps {
  band: RiskBand;
  /** Drives the "some answers were estimated" note. Never the band wording. */
  imputationCount: number;
}

/** Band tone for the headline panel only. The band itself is never re-derived. */
const BAND_PANEL: Record<RiskBand, string> = {
  LOW: 'border-band-low/30 bg-band-low-soft',
  MODERATE: 'border-band-moderate/30 bg-band-moderate-soft',
  HIGH: 'border-band-high/30 bg-band-high-soft',
};

export function PatientSummary({ band, imputationCount }: PatientSummaryProps) {
  const [language, setLanguage] = useState<Language>('en');
  const copy = patientCopy(language);
  const answers = copy.bands[band];
  const underReview = REVIEW_PENDING.includes(language);

  const blocks = [
    { key: 'what', icon: Info, label: copy.labels.what, body: answers.what, emphasis: false },
    { key: 'why', icon: CircleHelp, label: copy.labels.why, body: answers.why, emphasis: false },
    { key: 'how', icon: Activity, label: copy.labels.how, body: answers.how, emphasis: false },
    { key: 'when', icon: Clock, label: copy.labels.when, body: answers.when, emphasis: true },
    {
      key: 'limits',
      icon: ShieldQuestion,
      label: copy.labels.limits,
      body: answers.limits,
      emphasis: false,
    },
  ];

  return (
    /*
      `lang` is set on the wrapper, not on the page: only this subtree changes
      language, and a screen reader needs to switch voice for exactly this much of
      the document.
    */
    <section aria-labelledby="patient-summary-heading" lang={language} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="patient-summary-heading" className="text-2xl font-semibold tracking-tight text-ink">
          {language === 'am' ? 'ውጤትዎ በቀላል አማርኛ' : 'Your result, in plain language'}
        </h2>

        <div
          role="group"
          aria-label={copy.labels.languageSwitch}
          className="flex items-center gap-1 rounded-md border border-border bg-surface p-1"
        >
          <Languages aria-hidden className="ms-1 size-4 shrink-0 text-ink-subtle" />
          {LANGUAGE_ORDER.map((code) => {
            const active = code === language;
            return (
              <button
                key={code}
                type="button"
                lang={code}
                aria-pressed={active}
                onClick={() => setLanguage(code)}
                className={cn(
                  'min-h-11 rounded-sm px-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-white'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink'
                )}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            );
          })}
        </div>
      </div>

      {/*
        The headline is a statement about the screening, never about the person. It
        repeats the band in words rather than showing the band name again, because
        "HIGH" on its own is the thing people misread as a diagnosis.
      */}
      <div className={cn('rounded-lg border px-4 py-4 sm:px-5', BAND_PANEL[band])}>
        <p className="text-lg font-semibold text-ink">{answers.headline}</p>
      </div>

      {imputationCount > 0 && (
        <Alert tone="warn" title={language === 'am' ? 'የጎደሉ መልሶች' : 'Some answers were left blank'}>
          {copy.labels.estimatedNote}
        </Alert>
      )}

      <dl className="space-y-3">
        {blocks.map((block) => {
          const Icon = block.icon;
          return (
            <div key={block.key}>
              <Card
                padding="md"
                className={cn(
                  'h-full',
                  // `when` is the only actionable block, so it is the only one given
                  // visual weight. Emphasising all five would emphasise none.
                  block.emphasis && 'border-accent/40 bg-accent-soft/40'
                )}
              >
                <dt className="flex items-center gap-2">
                  <Icon aria-hidden className="size-4 shrink-0 text-accent" />
                  <span className="text-base font-semibold text-ink">{block.label}</span>
                </dt>
                <dd className="mt-1.5 max-w-(--container-prose) text-base text-ink-muted">
                  {block.body}
                </dd>
              </Card>
            </div>
          );
        })}
      </dl>

      {underReview && (
        <p className="max-w-(--container-prose) text-sm text-ink-subtle">
          <span lang={language}>{REVIEW_NOTE[language]}</span>{' '}
          {language !== 'en' && <span lang="en">{REVIEW_NOTE.en}</span>}
        </p>
      )}
    </section>
  );
}
