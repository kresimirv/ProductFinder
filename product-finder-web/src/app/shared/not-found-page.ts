import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown for unknown URLs, with a link back to the catalogue. */
@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Page not found</h1>
    <p><a routerLink="/products">Browse the catalogue</a></p>
  `,
})
export class NotFoundPage {}
