// Oculus Obscura — Store Catalog
// Source of truth: manual in-store price audit (Oculus_Business_Survey.xlsx), cleaned.
// This is STATIC reference data bundled with the app. It is NOT stored in Supabase.
//
// IMPORTANT:
//   - `slug` is a STABLE, FROZEN identifier. Session `interactions` rows in Supabase
//     reference stores by slug. Never rename a slug once real sessions exist, or old
//     data will point at a store that no longer exists.
//   - `name` is display-only and may be edited freely at any time (e.g. to fix brand
//     spellings). It is not a key and nothing references it.
//   - Prices are the real audited dollar values (USD). Low / Mid / High map to the
//     three price tags shown on each store card.
//   - Apple lives on both floors, so it appears as two entries (apple-1st, apple-2nd)
//     with identical prices — this keeps each interaction unambiguous about floor.
//
// Counts: 51 entries = 46 shop + 5 food. Floor 1: 23 shop + 3 food. Floor 2: 23 shop + 2 food.

export type Floor = 1 | 2;
export type StoreCategory = "shop" | "food";

export interface CatalogStore {
  slug: string;          // FROZEN join key — referenced by Supabase interactions
  name: string;          // display-only, editable
  floor: Floor;
  category: StoreCategory;
  priceLow: number;      // USD
  priceMid: number;      // USD
  priceHigh: number;     // USD
}

export const STORE_CATALOG: CatalogStore[] = [
  // ---------- FLOOR 1 — SHOP ----------
  { slug: "goldenbear",            name: "Goldenbear",              floor: 1, category: "shop", priceLow: 20,   priceMid: 79,   priceHigh: 270 },
  { slug: "cos",                   name: "COS",                     floor: 1, category: "shop", priceLow: 25,   priceMid: 600,  priceHigh: 1200 },
  { slug: "world-cup-essentials",  name: "World Cup Essentials",    floor: 1, category: "shop", priceLow: 15,   priceMid: 40,   priceHigh: 80 },
  { slug: "aesop",                 name: "Aesop",                   floor: 1, category: "shop", priceLow: 30,   priceMid: 75,   priceHigh: 250 },
  { slug: "mac",                   name: "MAC",                     floor: 1, category: "shop", priceLow: 25,   priceMid: 30,   priceHigh: 56 },
  { slug: "nyc-gifts",             name: "NYC Gifts",               floor: 1, category: "shop", priceLow: 15,   priceMid: 35,   priceHigh: 65 },
  { slug: "moonworld",             name: "Moonworld",               floor: 1, category: "shop", priceLow: 75,   priceMid: 350,  priceHigh: 2700 },
  { slug: "tumi",                  name: "TUMI",                    floor: 1, category: "shop", priceLow: 950,  priceMid: 1050, priceHigh: 1300 },
  { slug: "kate-spade",            name: "Kate Spade",              floor: 1, category: "shop", priceLow: 58,   priceMid: 180,  priceHigh: 548 },
  { slug: "charles-tyrwitt",       name: "Charles Tyrwitt",         floor: 1, category: "shop", priceLow: 39.75, priceMid: 65,  priceHigh: 299 },
  { slug: "french-embassy",        name: "French Embassy",          floor: 1, category: "shop", priceLow: 40,   priceMid: 118,  priceHigh: 168 },
  { slug: "breitling",             name: "Breitling",               floor: 1, category: "shop", priceLow: 3500, priceMid: 6000, priceHigh: 10000 },
  { slug: "pandora",               name: "Pandora",                 floor: 1, category: "shop", priceLow: 35,   priceMid: 140,  priceHigh: 1650 },
  { slug: "longines",              name: "Longines",                floor: 1, category: "shop", priceLow: 2000, priceMid: 2500, priceHigh: 6000 },
  { slug: "asphalt",               name: "Asphalt",                 floor: 1, category: "shop", priceLow: 55,   priceMid: 129,  priceHigh: 800 },
  { slug: "boss",                  name: "Boss",                    floor: 1, category: "shop", priceLow: 85,   priceMid: 199,  priceHigh: 799 },
  { slug: "twenty-four",           name: "Twenty Four",             floor: 1, category: "shop", priceLow: 40,   priceMid: 60,   priceHigh: 125 },
  { slug: "stuart-weizman",        name: "Stuart Weizman",          floor: 1, category: "shop", priceLow: 270,  priceMid: 500,  priceHigh: 850 },
  { slug: "swarovski",             name: "Swarovski",               floor: 1, category: "shop", priceLow: 79,   priceMid: 219,  priceHigh: 580 },
  { slug: "sephora",               name: "Sephora",                 floor: 1, category: "shop", priceLow: 16,   priceMid: 35,   priceHigh: 199 },
  { slug: "under-armour",          name: "Under Armour",            floor: 1, category: "shop", priceLow: 25,   priceMid: 55,   priceHigh: 140 },
  { slug: "repair-shop",           name: "Repair & Shop",           floor: 1, category: "shop", priceLow: 20,   priceMid: 25,   priceHigh: 40 },
  { slug: "apple-1st",             name: "Apple",                   floor: 1, category: "shop", priceLow: 19,   priceMid: 899,  priceHigh: 6000 },

  // ---------- FLOOR 1 — FOOD ----------
  { slug: "sugar-bear",            name: "Sugar Bear",              floor: 1, category: "food", priceLow: 3.99, priceMid: 14.99, priceHigh: 60 },
  { slug: "le-cafe-coffee",        name: "Le Cafe Coffee",          floor: 1, category: "food", priceLow: 3.75, priceMid: 7.25,  priceHigh: 48 },
  { slug: "pure-liquid",           name: "Pure Liquid",             floor: 1, category: "food", priceLow: 16.99, priceMid: 29,   priceHigh: 1099 },

  // ---------- FLOOR 2 — SHOP ----------
  { slug: "cole-haan",             name: "Cole Haan",               floor: 2, category: "shop", priceLow: 10,   priceMid: 170,  priceHigh: 400 },
  { slug: "rebag",                 name: "Rebag",                   floor: 2, category: "shop", priceLow: 400,  priceMid: 1800, priceHigh: 35000 },
  { slug: "popmart",               name: "Popmart",                 floor: 2, category: "shop", priceLow: 25,   priceMid: 350,  priceHigh: 1479 },
  { slug: "variazioni-italy",      name: "Variazioni Italy",        floor: 2, category: "shop", priceLow: 99,   priceMid: 185,  priceHigh: 385 },
  { slug: "swatch",                name: "Swatch",                  floor: 2, category: "shop", priceLow: 65,   priceMid: 170,  priceHigh: 520 },
  { slug: "nahauli-gallery",       name: "Nahauli Gallery",         floor: 2, category: "shop", priceLow: 700,  priceMid: 6000, priceHigh: 15000 },
  { slug: "michele-lopeiore-milano", name: "Michele Lopeiore Milano", floor: 2, category: "shop", priceLow: 195, priceMid: 265, priceHigh: 325 },
  { slug: "beautiful-amore",       name: "Beautiful Amore",         floor: 2, category: "shop", priceLow: 12,   priceMid: 20,   priceHigh: 48 },
  { slug: "portables",             name: "Portables",               floor: 2, category: "shop", priceLow: 49,   priceMid: 199,  priceHigh: 399 },
  { slug: "atelier",               name: "Atelier",                 floor: 2, category: "shop", priceLow: 39,   priceMid: 99,   priceHigh: 139 },
  { slug: "sam-edelman",           name: "Sam Edelman",             floor: 2, category: "shop", priceLow: 98,   priceMid: 128,  priceHigh: 188 },
  { slug: "calzedonia",            name: "Calzedonia",              floor: 2, category: "shop", priceLow: 35,   priceMid: 65,   priceHigh: 99 },
  { slug: "fragrance-com",         name: "Fragrance.com",           floor: 2, category: "shop", priceLow: 27,   priceMid: 85,   priceHigh: 616 },
  { slug: "moleskin",              name: "Moleskin",                floor: 2, category: "shop", priceLow: 13,   priceMid: 21,   priceHigh: 37 },
  { slug: "tissot",                name: "Tissot",                  floor: 2, category: "shop", priceLow: 400,  priceMid: 850,  priceHigh: 2450 },
  { slug: "pretty-well-beauty",    name: "Pretty Well Beauty",      floor: 2, category: "shop", priceLow: 8,    priceMid: 18,   priceHigh: 24 },
  { slug: "lola-soap",             name: "Lola Soap",               floor: 2, category: "shop", priceLow: 15,   priceMid: 200,  priceHigh: 1500 },
  { slug: "kiehls",                name: "Kiehl's",                 floor: 2, category: "shop", priceLow: 19,   priceMid: 35,   priceHigh: 150 },
  { slug: "loccitane",             name: "Loccitane",               floor: 2, category: "shop", priceLow: 14,   priceMid: 62,   priceHigh: 120 },
  { slug: "eye-origin",            name: "Eye Origin",              floor: 2, category: "shop", priceLow: 99,   priceMid: 599,  priceHigh: 4190 },
  { slug: "eye-world-optical",     name: "Eye World Optical",       floor: 2, category: "shop", priceLow: 475,  priceMid: 875,  priceHigh: 2790 },
  { slug: "ethan-jordan-jewelers", name: "Ethan Jordan Jewelers",   floor: 2, category: "shop", priceLow: 499,  priceMid: 2950, priceHigh: 5450 },
  { slug: "apple-2nd",             name: "Apple",                   floor: 2, category: "shop", priceLow: 19,   priceMid: 899,  priceHigh: 6000 },

  // ---------- FLOOR 2 — FOOD ----------
  { slug: "dunkin",                name: "Dunkin",                  floor: 2, category: "food", priceLow: 1.79, priceMid: 6,    priceHigh: 12.99 },
  { slug: "la-madison-du-chocolat", name: "La Madison du Chocolat", floor: 2, category: "food", priceLow: 11,   priceMid: 30,   priceHigh: 165 },
];

// --- convenience selectors the game can use ---
export const storesByFloor = (floor: Floor, category: StoreCategory): CatalogStore[] =>
  STORE_CATALOG.filter((s) => s.floor === floor && s.category === category);

export const storeBySlug = (slug: string): CatalogStore | undefined =>
  STORE_CATALOG.find((s) => s.slug === slug);
