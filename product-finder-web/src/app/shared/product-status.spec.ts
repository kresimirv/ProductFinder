import { statusKind } from './product-status';

describe('statusKind', () => {
  it.each([
    ['Active', 'active'],
    ['active', 'active'],
    ['ACTIVE', 'active'],
    ['Phase-out', 'phase-out'],
    ['Phase out', 'phase-out'],
    [' Discontinued ', 'discontinued'],
    ['Pending', 'unknown'],
  ])('maps the PIM spelling %j to %s', (raw, kind) => {
    expect(statusKind(raw)).toBe(kind);
  });
});
