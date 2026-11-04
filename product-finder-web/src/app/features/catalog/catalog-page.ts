import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { SkeletonModule } from 'primeng/skeleton';
import { debounceTime, Subject } from 'rxjs';
import { ProductsApi } from '../../core/products.api';
import {
  countActiveFilters,
  emptyFilters,
  FilterKey,
  PAGE_SIZE,
  parseYear,
  ProductSearch,
  searchFromParams,
  searchToParams,
  SORT_FIELDS,
  SortField,
  TextKey,
  YearKey,
} from '../../core/product-search';
import { ProductCard } from './product-card';
import { ProductFilters } from './product-filters';

/** Typing pause before the URL (and so the search) is updated. */
const TYPING_DEBOUNCE_MS = 300;

/**
 * Catalogue: search, filter, sort and page through products.
 *
 * The URL query string is the only state. User input updates the URL, and the URL
 * drives the API request. That keeps every view shareable and makes browser
 * back/forward work.
 */
@Component({
  selector: 'app-catalog-page',
  imports: [
    FormsModule,
    ButtonModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    MessageModule,
    PaginatorModule,
    SelectModule,
    SkeletonModule,
    ProductCard,
    ProductFilters,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog-page.html',
  styleUrl: './catalog-page.scss',
})
export class CatalogPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly productsApi = inject(ProductsApi);

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  /** Current search state, parsed from the URL on every navigation. */
  protected readonly search = computed(() => searchFromParams(this.queryParams()));

  /** Results for the current URL; a new URL triggers a new request (stale ones are cancelled). */
  protected readonly results = this.productsApi.search(this.search);
  protected readonly filterOptions = this.productsApi.filterOptions();

  /** Shown on the mobile "Filters (n)" button. */
  protected readonly activeFilterCount = computed(() => countActiveFilters(this.search()));
  /** Whether the filter drawer (phones) is open. */
  protected readonly filtersOpen = signal(false);
  protected readonly sortFields = [...SORT_FIELDS]; // PrimeNG expects a mutable array
  protected readonly pageSize = PAGE_SIZE;
  protected readonly skeletons = Array.from({ length: 6 });

  /**
   * Typed input (search box, text and year filters) is collected here and applied in
   * one navigation after a pause, so the URL and the API aren't updated on every
   * keystroke. One shared change (not one per field) prevents a race in which a
   * second field's update overwrites the first before its navigation finished.
   */
  private pendingTyped: Partial<ProductSearch> = {};
  private readonly typed = new Subject<void>();

  constructor() {
    this.typed
      .pipe(debounceTime(TYPING_DEBOUNCE_MS), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        const change = this.pendingTyped;
        this.pendingTyped = {};
        this.navigate({ ...change, page: 1 }, { replaceUrl: true });
      });
  }

  /**
   * Queues typed input from the search box, text filters or year bounds.
   * Partial years ("20") are ignored until they form a valid year.
   */
  protected onTyped(key: TextKey | YearKey, value: string): void {
    if (key === 'launchYearFrom' || key === 'launchYearTo') {
      const year = parseYear(value);
      // Ignore partial input ("20"), but apply clearing the field.
      if (year === null && value.trim()) return;
      this.pendingTyped[key] = year;
    } else {
      this.pendingTyped[key] = value;
    }
    this.typed.next();
  }

  /** Applies a value filter immediately and goes back to page 1. */
  protected onFilterChange(key: FilterKey, values: string[]): void {
    this.navigate({ filters: { ...this.search().filters, [key]: values }, page: 1 });
  }

  /** Resets every filter (but not the quick search or the sort). */
  protected clearFilters(): void {
    this.navigate({
      filters: emptyFilters(),
      name: '',
      description: '',
      launchYearFrom: null,
      launchYearTo: null,
      page: 1,
    });
  }

  /** Sorts by another column, keeping the direction. */
  protected onSortFieldChange(sortField: SortField): void {
    this.navigate({ sortField, page: 1 });
  }

  /** Switches between ascending and descending. */
  protected toggleSortDirection(): void {
    this.navigate({
      sortDirection: this.search().sortDirection === 'asc' ? 'desc' : 'asc',
      page: 1,
    });
  }

  /** PrimeNG pages are 0-based, URL pages 1-based. Scrolls back to the top of the list. */
  protected onPageChange({ page = 0 }: PaginatorState): void {
    this.navigate({ page: page + 1 });
    window.scrollTo({ top: 0 });
  }

  /** Writes a new search state to the URL; the results follow from it. */
  private navigate(change: Partial<ProductSearch>, { replaceUrl = false } = {}): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: searchToParams({ ...this.search(), ...change }),
      replaceUrl,
    });
  }
}
