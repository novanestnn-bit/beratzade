import { publicMenuCategorySlug } from './public-menu-path';

export interface BeratzadeCategoryVisual {
  src: string;
  alt: string;
  objectPosition: string;
}

const categoryVisuals: Record<string, BeratzadeCategoryVisual> = {
  kahvalti: {
    src: '/menu-categories/kahvalti.webp',
    alt: 'Türk kahvaltı sofrası: simit, yumurta, peynir, zeytin, sebze ve çay',
    objectPosition: 'center 52%',
  },
  'kebaplar-ve-izgaralar': {
    src: '/menu-categories/kebaplar-ve-izgaralar.webp',
    alt: 'Karışık ızgara: kebap, tavuk şiş, köfte ve kuzu pirzola',
    objectPosition: 'center 55%',
  },
  'mezeler-ve-salatalar': {
    src: '/menu-categories/mezeler-ve-salatalar.webp',
    alt: 'Renkli Türk mezeleri ve taze salatalardan oluşan sofra',
    objectPosition: 'center 50%',
  },
  icecekler: {
    src: '/menu-categories/icecekler.webp',
    alt: 'Paketli soğuk içecekler, Türk çayı ve kahve sunumu',
    objectPosition: 'center 55%',
  },
  tatlilar: {
    src: '/menu-categories/tatlilar.webp',
    alt: 'Islak kek, sütlaç ve San Sebastian cheesecake sunumu',
    objectPosition: 'center 55%',
  },
  'gunun-corbalari': {
    src: '/menu-categories/gunun-corbalari.webp',
    alt: 'Mercimek, tavuk ve yayla çorbalarından oluşan sıcak sunum',
    objectPosition: 'center 55%',
  },
  'gunun-yemekleri': {
    src: '/menu-categories/ev-yemekleri.webp',
    alt: 'Kuru fasulye, pilav ve geleneksel ev yemekleri',
    objectPosition: 'center 52%',
  },
};

export function beratzadeCategoryVisual(categoryId: string): BeratzadeCategoryVisual | null {
  return categoryVisuals[publicMenuCategorySlug(categoryId)] ?? null;
}
