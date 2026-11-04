import { TestBed } from '@angular/core/testing';
import { NewReview } from '../../core/api.models';
import { ReviewForm } from './review-form';

describe('ReviewForm', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ReviewForm);
    const emitted: NewReview[] = [];
    fixture.componentInstance.submitted.subscribe((r) => emitted.push(r));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const rate = (stars: number) =>
      el.querySelectorAll<HTMLElement>('.p-rating-option')[stars - 1].click();
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit'));
      await fixture.whenStable();
    };
    return { fixture, el, emitted, type, rate, submit };
  }

  it('emits a trimmed review, leaving out an empty title', async () => {
    const { emitted, type, rate, submit } = await setup();
    rate(4);
    type('#review-title', '   ');
    type('#review-body', '  Stable emulsions.  ');
    type('#review-author', ' Jane ');
    await submit();

    expect(emitted).toEqual([
      { rating: 4, title: undefined, body: 'Stable emulsions.', authorName: 'Jane' },
    ]);
  });

  it('shows errors and emits nothing when required fields are missing', async () => {
    const { el, emitted, type, submit } = await setup();
    type('#review-body', '   '); // whitespace only
    await submit();

    expect(emitted).toEqual([]);
    const errors = [...el.querySelectorAll('.error')].map((e) => e.textContent?.trim());
    expect(errors).toEqual([
      'Please choose 1 to 5 stars.',
      'Please describe your experience (max. 2000 characters).',
      'Please enter a name (max. 60 characters).',
    ]);
  });

  it('can be reset after a successful submit', async () => {
    const { fixture, type, el } = await setup();
    type('#review-body', 'Text');
    fixture.componentInstance.reset();
    await fixture.whenStable();
    expect(el.querySelector<HTMLTextAreaElement>('#review-body')!.value).toBe('');
  });
});
