/**
 * Display meaning of the raw PIM status. The API stores status as exported, with
 * spelling variants (`Active` / `ACTIVE`, `Phase-out` / `Phase out`), so the UI
 * maps them in this one place (DECISIONS §4).
 */
export type StatusKind = 'active' | 'phase-out' | 'discontinued' | 'unknown';

/** Maps a raw PIM status to one of the known kinds, ignoring case, spaces and hyphens vs. spaces. */
export function statusKind(raw: string): StatusKind {
  const normalised = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  switch (normalised) {
    case 'active':
    case 'phase-out':
    case 'discontinued':
      return normalised;
    default:
      return 'unknown';
  }
}

/** Label and tag colour per status kind; `null` label means "show the raw value". */
export const STATUS_DISPLAY: Record<
  StatusKind,
  { label: string | null; severity: 'success' | 'warn' | 'danger' | 'secondary' }
> = {
  active: { label: 'Active', severity: 'success' },
  'phase-out': { label: 'Phase-out', severity: 'warn' },
  discontinued: { label: 'Discontinued', severity: 'danger' },
  unknown: { label: null, severity: 'secondary' }, // show the raw value
};
