import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Trim } from '../common/transforms';

/**
 * Body of `POST /products/:sku/reviews`. Reviews are public and unauthenticated,
 * so every field is validated and length-limited. The same limits are enforced by
 * the DB schema.
 */
export class CreateReviewDto {
  /**
   * Star rating from 1 (poor) to 5 (excellent).
   * @example 4
   */
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  /** @example "Easy to formulate with" */
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(120)
  title?: string;

  /** @example "Stable emulsions even at low use levels." */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  body: string;

  /** Display name shown with the review; there are no user accounts. @example "Formulation chemist, Lyon" */
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  authorName: string;
}
