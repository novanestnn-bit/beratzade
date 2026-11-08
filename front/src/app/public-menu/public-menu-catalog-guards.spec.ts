import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';
import { filterCustomerMenuProducts, isNonSellableMenuHeading } from '../shared/menu-product-rules';
import { beratzadeProductGroup, categoryProducts, menuProducts } from './public-menu-presentation';

function product(id: number, name: string, category: string | null, subcategory: string | null = null): PublicTenantMenuProduct {
  return {
    id, source: 'product', name, price_cents: 45000, price_formatted: '450.00',
    description: null, category, subcategory, image_url: null, available: true,
  };
}

describe('Beratzade catalog safety presentation', () => {
  it('puts hamburger under burgers despite the broad Main Course label', () => {
    expect(beratzadeProductGroup(product(611, 'Hamburger', 'Main Course')))
      .toBe('hamburger-ozel-tabaklar');
  });

  it('puts chicken skewer, wings and chops under grill', () => {
    for (const [id, name] of [[615, 'Tavuk Sis Servis'], [616, 'Tavuk Kanat Servis'], [617, 'Tavuk Pirzola Servis']] as const) {
      expect(beratzadeProductGroup(product(id, name, 'Kebaplar ve Izgaralar', 'Tavuk')))
        .toBe('izgara-kebap');
    }
  });

  it('hides ID 620 by its semantic name and retains the owner-approved Urfa row', () => {
    const heading = product(620, 'Heading', 'Gunun Yemekleri');
    heading.name = String.fromCharCode(71, 252, 110, 108, 252, 107, 32, 83, 117, 108, 117, 32, 89, 101, 109, 101, 107, 108, 101, 114);
    const duplicate = product(612, 'Urfa kebap servis', 'Kebaplar ve Izgaralar', 'Et');
    const canonical = product(613, 'Urfa Kebap Servis', 'Kebaplar ve Izgaralar', 'Et');
    const category: PublicTenantMenuCategory = {
      id: 'grill', name: 'Kebaplar ve Izgaralar', products: [heading, duplicate, canonical],
    };

    expect(isNonSellableMenuHeading(heading.name, heading.category)).toBeTrue();
    expect(isNonSellableMenuHeading(heading.name, 'Tavuk Yemekleri')).toBeFalse();
    expect(categoryProducts(category)).toEqual([canonical]);
    expect(menuProducts([category])).toEqual([canonical]);
    expect(filterCustomerMenuProducts([heading, duplicate, canonical])).toEqual([canonical]);
    expect(canonical.price_cents).toBe(45000);
  });
});
