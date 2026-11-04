import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { RatingModule } from 'primeng/rating';
import { TextareaModule } from 'primeng/textarea';
import { NewReview } from '../../core/api.models';

/** Rejects whitespace-only text, which the API would reject too. */
const notBlank = Validators.pattern(/\S/);

/**
 * Form for writing a review. The rules mirror the API (rating 1–5, required body
 * ≤ 2000, required name ≤ 60, optional title ≤ 120), so users get feedback before
 * submitting. The API still validates everything.
 */
@Component({
  selector: 'app-review-form',
  imports: [
    ReactiveFormsModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    RatingModule,
    TextareaModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review-form.html',
  styleUrl: './review-form.scss',
})
export class ReviewForm {
  /** Shows a spinner on the button and blocks double submits. */
  readonly submitting = input(false);
  /** A valid review, trimmed and ready to send. */
  readonly submitted = output<NewReview>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    rating: [0, [Validators.required, Validators.min(1), Validators.max(5)]],
    title: ['', Validators.maxLength(120)],
    body: ['', [Validators.required, notBlank, Validators.maxLength(2000)]],
    authorName: ['', [Validators.required, notBlank, Validators.maxLength(60)]],
  });

  /** Shows a field's error only after the user has interacted with it (or tried to submit). */
  protected invalid(field: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[field];
    return control.invalid && control.touched;
  }

  /** Validates the form, then emits the trimmed review; an empty title is omitted. */
  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { rating, title, body, authorName } = this.form.getRawValue();
    this.submitted.emit({
      rating,
      title: title.trim() || undefined,
      body: body.trim(),
      authorName: authorName.trim(),
    });
  }

  /** Called by the page after the review was saved. */
  reset(): void {
    this.form.reset();
  }
}
