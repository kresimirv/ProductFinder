import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RatingModule } from 'primeng/rating';
import { Review } from '../../core/api.models';

/** Customer reviews, newest first. Presentational. */
@Component({
  selector: 'app-review-list',
  imports: [DatePipe, FormsModule, RatingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (review of reviews(); track review.id) {
      <article class="review">
        <div class="meta">
          <p-rating
            [ngModel]="review.rating"
            [readonly]="true"
            [ariaLabel]="review.rating + ' of 5 stars'"
          />
          <span class="muted"
            >{{ review.authorName }} · {{ review.createdAt | date: 'mediumDate' }}</span
          >
        </div>
        @if (review.title) {
          <h3>{{ review.title }}</h3>
        }
        <!-- Plain text: Angular interpolation escapes HTML, so user content can't inject markup. -->
        <p>{{ review.body }}</p>
      </article>
    } @empty {
      <p class="muted">No reviews yet. Be the first to share your experience.</p>
    }
  `,
  styles: `
    .review {
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--p-content-border-color);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    h3 {
      font-size: 1rem;
      margin: 0.5rem 0 0;
    }
    p {
      margin: 0.5rem 0 0;
      white-space: pre-line;
    }
  `,
})
export class ReviewList {
  /** Reviews to show, newest first. */
  readonly reviews = input.required<Review[]>();
}
