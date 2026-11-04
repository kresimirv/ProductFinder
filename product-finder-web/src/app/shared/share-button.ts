import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';

/**
 * Shares the current page URL, which always holds the full view state. Uses the
 * native share sheet where available (phones at trade fairs), otherwise copies the
 * link to the clipboard.
 */
@Component({
  selector: 'app-share-button',
  imports: [ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p-button
      [label]="copied() ? 'Link copied' : 'Share'"
      [icon]="copied() ? 'pi pi-check' : 'pi pi-share-alt'"
      severity="secondary"
      [outlined]="true"
      (onClick)="share()"
    />
  `,
})
export class ShareButton {
  /** Title passed to the native share sheet. */
  readonly title = input('Product Finder');

  /** Briefly true after copying, to show "Link copied". */
  protected readonly copied = signal(false);

  /** Opens the native share sheet, or copies the current URL as a fallback. */
  async share(): Promise<void> {
    const url = location.href;
    if (navigator.share) {
      // Rejects if the user closes the sheet, which isn't an error.
      await navigator.share({ title: this.title(), url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }
}
