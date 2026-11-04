import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RatingModule } from 'primeng/rating';
import { TagModule } from 'primeng/tag';
import { Product } from '../../core/api.models';
import { StatusTag } from '../../shared/status-tag';

/** One product in the result list; the whole card links to the detail page. */
@Component({
  selector: 'app-product-card',
  imports: [FormsModule, RouterLink, RatingModule, StatusTag, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let p = product();
    <a class="card" [routerLink]="['/products', p.sku]">
      <div class="head">
        <h2>{{ p.name }}</h2>
        <app-status-tag [status]="p.status" />
      </div>
      <div class="muted">{{ p.sku }} · {{ p.chemicalName }}</div>
      <div>{{ p.function }} · {{ p.applicationArea }} · {{ p.region }}</div>
      <div class="muted">Launched {{ p.launchYear ?? '–' }}</div>
      <p class="description">{{ p.description }}</p>
      @if (p.certifications.length) {
        <div class="tags">
          @for (c of p.certifications; track c) {
            <p-tag [value]="c" severity="info" />
          }
        </div>
      }
      <div class="rating">
        @if (p.rating.count) {
          <p-rating [ngModel]="p.rating.average" [readonly]="true" [allowHalf]="true" />
          <span class="muted">{{ p.rating.average }} ({{ p.rating.count }})</span>
        } @else {
          <span class="muted">No reviews yet</span>
        }
      </div>
    </a>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      height: 100%;
      box-sizing: border-box;
      padding: 1rem;
      border-radius: var(--p-border-radius-lg, 8px);
      background: var(--p-content-background);
      border: 1px solid var(--p-content-border-color);
      color: inherit;
      text-decoration: none;
    }
    .card:hover,
    .card:focus-visible {
      border-color: var(--p-primary-color);
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 0.5rem;
    }
    h2 {
      font-size: 1.0625rem;
      margin: 0;
    }
    /* First two lines only; the full text is on the detail page. */
    .description {
      margin: 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem;
    }
    .rating {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: auto;
    }
  `,
})
export class ProductCard {
  /** The product to show. */
  readonly product = input.required<Product>();
}
