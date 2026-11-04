import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { STATUS_DISPLAY, statusKind } from './product-status';

/** Colour-coded product lifecycle status (green / orange / red). */
@Component({
  selector: 'app-status-tag',
  imports: [TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p-tag [value]="display().label" [severity]="display().severity" />`,
})
export class StatusTag {
  /** Status as exported by the PIM (any spelling). */
  readonly status = input.required<string>();

  /** Label and colour; unknown statuses show their raw text in grey. */
  protected readonly display = computed(() => {
    const { label, severity } = STATUS_DISPLAY[statusKind(this.status())];
    return { label: label ?? this.status(), severity };
  });
}
