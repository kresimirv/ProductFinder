import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product } from '../../core/api.models';
import { ProductCard } from './product-card';

const product: Product = {
  sku: 'P-10002',
  name: 'Novarel EF 240',
  chemicalName: 'Polysorbate 80',
  function: 'Emulsifier',
  applicationArea: 'Agriculture',
  region: 'Global',
  certifications: ['Halal', 'Vegan'],
  status: 'active',
  launchYear: null,
  description: 'Emulsifier based on Polysorbate 80.',
  rating: { average: 4.5, count: 2 },
  delistedAt: null,
};

describe('ProductCard', () => {
  async function render(p: Product) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProductCard);
    fixture.componentRef.setInput('product', p);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the product facts, certifications, launch year, description and rating', async () => {
    const el = await render(product);
    const text = el.textContent!;
    for (const expected of [
      'Novarel EF 240',
      'Active', // status label, normalised from "active"
      'P-10002 · Polysorbate 80',
      'Emulsifier · Agriculture · Global',
      'Launched –', // unknown year
      'Emulsifier based on Polysorbate 80.',
      'Halal',
      'Vegan',
      '4.5 (2)',
    ]) {
      expect(text).toContain(expected);
    }
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/products/P-10002');
  });

  it('says when there are no reviews', async () => {
    const el = await render({ ...product, rating: { average: null, count: 0 } });
    expect(el.textContent).toContain('No reviews yet');
  });
});
