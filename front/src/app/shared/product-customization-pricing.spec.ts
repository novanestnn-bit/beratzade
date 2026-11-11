import { customizationPriceDeltaCents } from './product-customization-pricing';

describe('customizationPriceDeltaCents', () => {
  it('calculates per-filling and premium sandwich surcharges', () => {
    expect(customizationPriceDeltaCents([
      {
        id: 3,
        options: {
          pricing: {
            type: 'item_count',
            included: 1,
            second_item_delta_cents: 3000,
            additional_item_delta_cents: 3000,
            choice_surcharges_cents: { Kavurma: 8000, 'Eski kaşar': 4000 },
          },
        },
      },
    ], { '3': ['Kaşar', 'Kavurma', 'Domates', 'Eski kaşar'] })).toBe(21000);
  });

  it('returns zero when answers do not use a server configured price policy', () => {
    expect(customizationPriceDeltaCents([
      { id: 3, options: { choices: ['Kavurma'], multi: true } },
    ], { '3': ['Kavurma'] })).toBe(0);
  });
});
