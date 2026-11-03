import type { PublicTenantMenuCategory, PublicTenantMenuProduct } from '../services/api.service';
import { orderBeratzadeMenuCategories } from '../shared/public-menu-categories';
import { categoryForProduct, categoryProducts, menuProducts, publicImageUrl, publicProductKey } from './public-menu-presentation';

function product(id: number, source: 'product' | 'tenant_product', name = 'Isolated dish'): PublicTenantMenuProduct {
  return { id, source, name, price_cents: 1500, price_formatted: '15.00', description: null, category: null, subcategory: null, image_url: null, available: true };
}

describe('restaurant public menu presentation', () => {
  it('keeps equal ids from different product sources distinct', () => {
    expect(publicProductKey(product(7, 'product'))).not.toBe(publicProductKey(product(7, 'tenant_product')));
  });
  it('finds the product category using its source as well as its id', () => {
    const legacy = product(7, 'product'), tenant = product(7, 'tenant_product');
    const categories = [{ id: 'one', name: 'One', products: [legacy] }, { id: 'two', name: 'Two', products: [tenant] }];
    expect(categoryForProduct(categories, tenant)?.id).toBe('two');
  });
  it('includes direct and nested dishes once without losing dishes in categories with children', () => {
    const direct = product(1, 'product'), child = product(2, 'tenant_product');
    const category = { id: 'main', name: 'Main', products: [direct], subcategories: [{ id: 'child', name: 'Child', products: [child, direct] }] };
    expect(categoryProducts(category)).toEqual([direct, child]);
    expect(menuProducts([category, { id: 'duplicate', name: 'Duplicate', products: [direct] }])).toEqual([direct, child]);
  });
  it('does not silently hide published salad, meat, chicken or side categories', () => {
    const ids = ['mezeler-ve-salatalar', 'et-yemekleri', 'tavuk-yemekleri', 'yan-urunler'];
    const categories: PublicTenantMenuCategory[] = ids.map(id => ({ id, name: id, products: [product(1, 'product')] }));
    expect(orderBeratzadeMenuCategories(categories).map(category => category.id).sort()).toEqual(ids.sort());
  });
  it('keeps differently named products distinct when reading older responses without source', () => {
    const a = { ...product(1, 'product', 'One'), source: undefined }, b = { ...product(1, 'product', 'Two'), source: undefined };
    expect(publicProductKey(a)).not.toBe(publicProductKey(b));
  });
  it('uses the actual API image or a neutral empty placeholder', () => {
    expect(publicImageUrl(null, '/api')).toBe('');
    expect(publicImageUrl('/uploads/89/products/food.webp', '/api')).toBe('/api/uploads/89/products/food.webp');
    expect(publicImageUrl('https://images.invalid/food.webp', '/api')).toBe('https://images.invalid/food.webp');
    for (const value of ['javascript:alert(1)', 'data:text/html,test', '//images.invalid/photo.jpg']) expect(publicImageUrl(value, '/api')).toBe('');
  });
});
