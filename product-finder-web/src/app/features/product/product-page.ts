import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe, Location } from '@angular/common';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RatingModule } from 'primeng/rating';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { NewReview } from '../../core/api.models';
import { ProductsApi } from '../../core/products.api';
import { ReviewsApi } from '../../core/reviews.api';
import { statusKind } from '../../shared/product-status';
import { ShareButton } from '../../shared/share-button';
import { StatusTag } from '../../shared/status-tag';
import { ReviewForm } from './review-form';
import { ReviewList } from './review-list';

/** Reviews loaded at first, and added per "Show more". */
const REVIEWS_STEP = 5;
/** The API's maximum page size. "Show more" stops here (YAGNI: no cursor paging for v1). */
const REVIEWS_MAX = 100;

/** Product detail: all product information, rating summary, reviews and the review form. */
@Component({
  selector: 'app-product-page',
  imports: [
    DatePipe,
    FormsModule,
    ButtonModule,
    MessageModule,
    RatingModule,
    SkeletonModule,
    TagModule,
    ReviewForm,
    ReviewList,
    ShareButton,
    StatusTag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-page.html',
  styleUrl: './product-page.scss',
})
export class ProductPage {
  private readonly reviewsApi = inject(ReviewsApi);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  /** From the route `products/:sku` (component input binding). */
  readonly sku = input.required<string>();

  /** How many reviews to load; "Show more" raises it. */
  private readonly reviewLimit = signal(REVIEWS_STEP);
  /** The product; reloaded after a review is published, to refresh its rating. */
  protected readonly product = inject(ProductsApi).product(this.sku);
  /** The newest `reviewLimit` reviews; refetches when the limit changes. */
  protected readonly reviews = this.reviewsApi.list(this.sku, this.reviewLimit);

  /** Unknown SKU (e.g. an old shared link): shown as "not found" instead of an error. */
  protected readonly notFound = computed(
    () => (this.product.error() as HttpErrorResponse | undefined)?.status === 404,
  );
  /** Normalised status, used to choose the discontinued or phase-out banner. */
  protected readonly status = computed(() =>
    this.product.hasValue() ? statusKind(this.product.value().status) : 'unknown',
  );
  /** True while more reviews exist and the API limit isn't reached. */
  protected readonly canShowMore = computed(
    () =>
      this.reviews.hasValue() &&
      this.reviews.value().total > this.reviews.value().items.length &&
      this.reviewLimit() < REVIEWS_MAX,
  );

  /** Used to reset the form after a successful submit. */
  private readonly reviewForm = viewChild(ReviewForm);
  /** True while a review is being sent; disables the submit button. */
  protected readonly submitting = signal(false);
  /** Feedback shown above the form after a submit attempt. */
  protected readonly submitResult = signal<{ severity: 'success' | 'error'; text: string } | null>(
    null,
  );

  /** Loads the next few reviews, up to the API's maximum. */
  protected showMoreReviews(): void {
    this.reviewLimit.update((n) => Math.min(n + REVIEWS_STEP, REVIEWS_MAX));
  }

  /**
   * Publishes a review. On success it resets the form and reloads the reviews and
   * rating; on failure it explains the error.
   */
  protected submitReview(review: NewReview): void {
    this.submitting.set(true);
    this.submitResult.set(null);
    this.reviewsApi.create(this.sku(), review).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitResult.set({
          severity: 'success',
          text: 'Thank you! Your review is published.',
        });
        this.reviewForm()?.reset();
        this.product.reload(); // rating summary
        this.reviews.reload();
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        this.submitResult.set({ severity: 'error', text: submitErrorText(error) });
      },
    });
  }

  /** Back to the results with their filters (they're in the previous URL). */
  protected back(): void {
    if (history.length > 1) this.location.back();
    else void this.router.navigate(['/products']);
  }
}

/** User-facing explanation of a failed review submission. */
function submitErrorText(error: HttpErrorResponse): string {
  switch (error.status) {
    case 400:
      return 'Please check your review and try again.';
    case 404:
      return 'This product no longer exists.';
    case 429:
      return "You've posted several reviews recently. Please try again in a minute.";
    default:
      return 'Your review could not be saved. Please try again later.';
  }
}
