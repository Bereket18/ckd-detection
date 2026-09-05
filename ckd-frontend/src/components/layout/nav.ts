/**
 * The navigation map — one declaration, consumed by the mobile drawer, the desktop
 * sidebar, and the footer.
 *
 * Kept as data rather than as three hand-written lists because they drifted apart
 * in every prototype: a route added to the desktop nav and forgotten in the mobile
 * one is unreachable on a phone, and 320 px is the *first* supported width here, not
 * an afterthought.
 *
 * `provenance` on an item is the label that route carries permanently. It is
 * declared here so the navigation itself is honest — a user can see that
 * `/federated` is a simulation before spending a click on it.
 */

import {
  Activity,
  BookOpen,
  ChartColumn,
  ClipboardList,
  FileText,
  FlaskConical,
  Gauge,
  Info,
  MapPin,
  Network,
  Scale,
  ScanLine,
  Table2,
} from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';
import type { Provenance } from '../provenance/provenance';

export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export interface NavItem {
  to: string;
  label: string;
  /** One line, shown in the mobile drawer and on the overview cards. */
  summary: string;
  icon: IconComponent;
  /** A permanent label for the route, when it needs one. */
  provenance?: Provenance;
  /**
   * `true` when the page is only meaningful with a prediction in memory. Those
   * routes stay navigable — they render an empty state that offers the assessment
   * rather than disappearing, because a hidden link is harder to explain than a
   * page that says why it is empty.
   */
  needsPrediction?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    id: 'screening',
    label: 'Screening',
    items: [
      { to: '/', label: 'Overview', summary: 'Where to start and what this tool does.', icon: Gauge },
      {
        to: '/assessment',
        label: 'Assessment',
        summary: 'Answer what you know; anything left blank is estimated and disclosed.',
        icon: ClipboardList,
      },
      {
        to: '/results',
        label: 'Your result',
        summary: 'The risk band the model returned, with its limitations stated.',
        icon: Activity,
        needsPrediction: true,
      },
      {
        to: '/explainability',
        label: 'Explainability',
        summary: 'Which of your values moved the score, and in which direction.',
        icon: ChartColumn,
        needsPrediction: true,
      },
      {
        to: '/report',
        label: 'Report',
        summary: 'A printable summary of the result, generated in your browser.',
        icon: FileText,
        needsPrediction: true,
      },
    ],
  },
  {
    id: 'understand',
    label: 'Understand',
    items: [
      {
        to: '/learn',
        label: 'Learn',
        summary: 'What chronic kidney disease is, and what each measurement means.',
        icon: BookOpen,
      },
      {
        to: '/facilities',
        label: 'Find care',
        summary: 'Nearby facilities for a proper clinical test.',
        icon: MapPin,
        provenance: 'planned',
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    items: [
      {
        to: '/research',
        label: 'Research Lab',
        summary: 'Dataset composition and evaluation metrics, as reported by the API.',
        icon: FlaskConical,
      },
      {
        to: '/research/batch',
        label: 'Batch scoring',
        summary: 'Score a CSV of records for research use.',
        icon: Table2,
      },
      {
        to: '/multimodal',
        label: 'Multimodal',
        summary: 'How imaging and tabular signals could be combined.',
        icon: ScanLine,
        provenance: 'simulation',
      },
      {
        to: '/federated',
        label: 'Federated learning',
        summary: 'How training across sites works without moving patient data.',
        icon: Network,
        provenance: 'simulation',
      },
    ],
  },
  {
    id: 'transparency',
    label: 'Transparency',
    items: [
      {
        to: '/model-card',
        label: 'Model card',
        summary: 'The deployed model, its metrics, and its stated limitations.',
        icon: Scale,
      },
      {
        to: '/about',
        label: 'About',
        summary: 'Scope, data handling, and who this is for.',
        icon: Info,
      },
    ],
  },
];

/** Flat list, for lookups and for the route-coverage test. */
export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.to === pathname);
}
