import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Paginated } from '../common/pagination';
import { ProductQueryDto } from './product-query.dto';
import {
  ProductFilterOptions,
  ProductsService,
  ProductView,
} from './products.service';

/** Catalogue endpoints under `/api/v1/products`. DTOs validate input; ProductsService holds the logic. */
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  /** Search, filter, sort and paginate the catalogue. */
  @Get()
  list(@Query() query: ProductQueryDto): Promise<Paginated<ProductView>> {
    return this.products.list(query);
  }

  /** Available values for each filter (declared before `:sku` so it isn't matched as a SKU). */
  @Get('filters')
  filters(): Promise<ProductFilterOptions> {
    return this.products.filterOptions();
  }

  /** All product information plus its rating summary. */
  @Get(':sku')
  findOne(@Param('sku') sku: string): Promise<ProductView> {
    return this.products.findBySku(sku);
  }
}
