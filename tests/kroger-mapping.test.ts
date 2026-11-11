import { describe, it, expect } from 'vitest';

// Simulated raw item payload from Kroger Products API (GET /v1/products)
const MOCK_KROGER_API_ITEM = {
  upc: '0007047000300',
  description: 'Yoplait™ Original Low Fat Strawberry Yogurt Cup',
  brand: 'Yoplait',
  categories: ['Dairy'],
  items: [
    {
      itemId: '0007047000300',
      size: '6 oz',
      price: {
        regular: 0.80,
        promo: 0.70,
      },
      inventory: {
        stockLevel: 'HIGH',
      },
    },
  ],
  images: [
    {
      perspective: 'front',
      sizes: [
        { size: 'small', url: 'https://images.kroger.com/small.jpg' },
        { size: 'medium', url: 'https://images.kroger.com/medium.jpg' },
        { size: 'large', url: 'https://images.kroger.com/large.jpg' },
      ],
    },
  ],
};

function parseKrogerProduct(raw: any) {
  const itemDetail = raw.items?.[0] || {};
  const priceDetail = itemDetail.price || {};
  const frontImage = raw.images?.find((img: any) => img.perspective === 'front') || raw.images?.[0];
  const mediumImage = frontImage?.sizes?.find((s: any) => s.size === 'medium' || s.size === 'large') || frontImage?.sizes?.[0];

  return {
    upc: raw.upc.padStart(13, '0'),
    description: raw.description,
    brand: raw.brand || 'Kroger',
    size: itemDetail.size || '',
    price: priceDetail.promo || priceDetail.regular,
    imageUrl: mediumImage?.url,
    inStock: itemDetail.inventory?.stockLevel !== 'TEMPORARILY_OUT_OF_STOCK',
  };
}

describe('Kroger Product Data Parsing', () => {
  it('correctly normalizes nested Kroger JSON into a clean KrogerProduct', () => {
    const product = parseKrogerProduct(MOCK_KROGER_API_ITEM);

    expect(product.upc).toBe('0007047000300');
    expect(product.description).toBe('Yoplait™ Original Low Fat Strawberry Yogurt Cup');
    expect(product.brand).toBe('Yoplait');
    expect(product.size).toBe('6 oz');
    expect(product.price).toBe(0.70); // Prefers promo price
    expect(product.imageUrl).toBe('https://images.kroger.com/medium.jpg');
    expect(product.inStock).toBe(true);
  });

  it('guarantees 13-digit zero-padded UPC format required by Kroger Cart API', () => {
    const shortUpcItem = { ...MOCK_KROGER_API_ITEM, upc: '1111041600' };
    const parsed = parseKrogerProduct(shortUpcItem);
    expect(parsed.upc).toBe('0001111041600');
    expect(parsed.upc.length).toBe(13);
  });
});
