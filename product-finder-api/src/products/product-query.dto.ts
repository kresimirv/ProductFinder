import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../common/pagination.dto';
import { ToArray, Trim } from '../common/transforms';

/** Columns the catalogue can be sorted by (all except description and certifications). */
export const SORT_FIELDS = [
  'sku',
  'name',
  'chemicalName',
  'function',
  'applicationArea',
  'region',
  'status',
  'launchYear',
] as const;
/** A column name accepted by `sort`. */
export type SortField = (typeof SORT_FIELDS)[number];

/** Every sort field ascending (`name`) and descending (`-name`). */
export const PRODUCT_SORTS = SORT_FIELDS.flatMap((f) => [f, `-${f}`] as const);
/** Value of the `sort` parameter: a field, optionally prefixed with `-` for descending. */
export type ProductSort = (typeof PRODUCT_SORTS)[number];

/**
 * Query parameters of `GET /products`. Every parameter is optional and the whole
 * search state lives in the URL, so a link reproduces exactly the same result.
 *
 * Within one filter, values are OR'ed (`?region=EMEA&region=Global`); across filters
 * they're AND'ed. Text filters ignore case. Certifications require *all* selected values.
 */
export class ProductQueryDto extends PaginationQueryDto {
  /**
   * Free-text search in product name, SKU and chemical name (case-insensitive, partial match).
   * @example "polysorbate"
   */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Product name contains this text (case-insensitive). @example "quorin" */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  name?: string;

  /** @example ["Polysorbate 80"] */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  chemicalName?: string[];

  /** @example ["Surfactant"] */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  function?: string[];

  /** @example ["Personal Care"] */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  applicationArea?: string[];

  /** @example ["EMEA"] */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  region?: string[];

  /** Without this filter, discontinued products are excluded. */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  status?: string[];

  /** The product must hold every listed certification. @example ["Vegan", "Halal"] */
  @IsOptional()
  @ToArray()
  @IsString({ each: true })
  certification?: string[];

  /** Launched in or after this year. Products without a known year are excluded. @example 2015 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  launchYearFrom?: number;

  /** Launched in or before this year. Products without a known year are excluded. @example 2020 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1900)
  @Max(2100)
  launchYearTo?: number;

  /** Description contains this text (case-insensitive). @example "biodegradable" */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  description?: string;

  /** Sort order; a leading `-` means descending. Ties are broken by SKU. */
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'name';
}
