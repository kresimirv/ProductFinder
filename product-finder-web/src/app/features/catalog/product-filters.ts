import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { FilterOptions } from '../../core/api.models';
import { FilterKey, ProductSearch, YearKey } from '../../core/product-search';

const VALUE_FILTERS: { key: FilterKey; label: string; placeholder?: string }[] = [
  { key: 'chemicalName', label: 'Chemical name' },
  { key: 'function', label: 'Function' },
  { key: 'applicationArea', label: 'Application area' },
  { key: 'region', label: 'Region' },
  { key: 'certification', label: 'Certifications (all of)' },
  // The API hides discontinued products unless a status is selected.
  { key: 'status', label: 'Status', placeholder: 'Active and phase-out' },
];

/**
 * Filter controls for every product column except SKU. Presentational: the current
 * search and the options come in, changes go out. Text and year inputs emit raw
 * input; the page debounces it.
 */
@Component({
  selector: 'app-product-filters',
  imports: [FormsModule, MultiSelectModule, ButtonModule, InputTextModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-filters.html',
  styleUrl: './product-filters.scss',
})
export class ProductFilters {
  /** Values for the selects and the year placeholders; undefined while loading. */
  readonly options = input<FilterOptions>();
  /** Current search, used to show the selected values and typed text. */
  readonly search = input.required<ProductSearch>();
  /** Shows the "Clear filters" button. */
  readonly hasActiveFilters = input(false);

  /** A value filter's selection changed. */
  readonly filterChange = output<{ key: FilterKey; values: string[] }>();
  /** Raw text typed into a text or year filter (the page debounces and validates it). */
  readonly textChange = output<{ key: 'name' | 'description' | YearKey; value: string }>();
  /** "Clear filters" was clicked. */
  readonly clear = output<void>();

  protected readonly valueFilters = VALUE_FILTERS;
}
