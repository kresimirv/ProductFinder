import { Routes } from '@angular/router';

/** Application routes. Pages are lazy-loaded so the first download stays small. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'products' },
  {
    path: 'products',
    title: 'Product Finder',
    loadComponent: () => import('./features/catalog/catalog-page').then((m) => m.CatalogPage),
  },
  {
    path: 'products/:sku',
    title: 'Product details · Product Finder',
    loadComponent: () => import('./features/product/product-page').then((m) => m.ProductPage),
  },
  {
    path: '**',
    title: 'Page not found · Product Finder',
    loadComponent: () => import('./shared/not-found-page').then((m) => m.NotFoundPage),
  },
];
