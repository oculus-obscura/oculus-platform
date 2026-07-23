// Oculus Obscura — Store Catalog (single source of truth)
// Merged from the manual in-store price audit (Oculus_Business_Survey.xlsx) and the
// game design reference (design-reference/Oculus Obscura Commuter.dc.html), which
// contributed the corrected brand spellings plus `size` and `bullets`.
// This is STATIC reference data bundled with the app. It is NOT stored in Supabase.
//
// IMPORTANT:
//   - `slug` is a STABLE, FROZEN identifier — the database key. Session `interactions`
//     rows in Supabase reference stores by slug. Never rename a slug once real sessions
//     exist, or old data will point at a store that no longer exists.
//   - `name` is display-only and may be edited freely at any time (e.g. to fix brand
//     spellings). It is not a key and nothing in the database references it.
//   - `prices` is ordered HIGH → MID → LOW, exactly as the store card renders its
//     three price tags. `value` is the audited USD number; `display` is the formatted
//     string shown on the card; `label` is an optional descriptor (only Rebag has them).
//   - `size` drives the scatter-layout footprint; `bullets` are the store-card copy.
//   - Apple lives on both floors, so it appears as two entries (apple-1st, apple-2nd)
//     with identical prices and bullets — this keeps each interaction unambiguous
//     about floor.
//
// Counts: 50 entries = 45 shop + 5 food.
//   Floor 1: 23 shop + 3 food.  Floor 2: 22 shop + 2 food.

export type Floor = 1 | 2;
export type StoreCategory = "shop" | "food"; // DB values — the game DISPLAYS food as "GRAB A BITE"
export type StoreSize = "big" | "medium" | "small";
export type PriceTier = "high" | "mid" | "low";

export interface StorePrice {
  tier: PriceTier;
  value: number; // audited USD
  display: string; // formatted as rendered on the card (e.g. "$10,000+", "$39.75")
  label?: string; // optional descriptor rendered with the tag (e.g. Rebag's "Hermes")
}

export interface CatalogStore {
  slug: string; // FROZEN database key — see header
  name: string; // display-only, editable
  floor: Floor;
  category: StoreCategory;
  size: StoreSize; // scatter-layout footprint
  bullets: string[]; // store-card copy
  prices: StorePrice[]; // ordered high → mid → low, as the card renders
}

// price shorthand — keeps 150 entries transcribable and diffable
const P = (tier: PriceTier, value: number, display: string, label?: string): StorePrice =>
  label === undefined ? { tier, value, display } : { tier, value, display, label };

export const STORE_CATALOG: CatalogStore[] = [
  // ---------- FLOOR 1 — SHOP ----------
  { slug: "goldenbear", name: "Goldenbear", floor: 1, category: "shop", size: "small",
    bullets: ["Apparel", "Footwear", "Accessories"],
    prices: [P("high", 270, "$270"), P("mid", 79, "$79"), P("low", 20, "$20")] },
  { slug: "cos", name: "COS", floor: 1, category: "shop", size: "big",
    bullets: ["Minimalist clothing", "Accessories", "Footwear"],
    prices: [P("high", 1200, "$1,200"), P("mid", 600, "$600"), P("low", 25, "$25")] },
  { slug: "world-cup-essentials", name: "World Cup Essentials", floor: 1, category: "shop", size: "small",
    bullets: ["Soccer jerseys", "Fan merchandise", "Accessories"],
    prices: [P("high", 80, "$80"), P("mid", 40, "$40"), P("low", 15, "$15")] },
  { slug: "aesop", name: "Aesop", floor: 1, category: "shop", size: "small",
    bullets: ["Skincare", "Haircare", "Fragrance"],
    prices: [P("high", 250, "$250"), P("mid", 75, "$75"), P("low", 30, "$30")] },
  { slug: "mac", name: "MAC", floor: 1, category: "shop", size: "medium",
    bullets: ["Makeup", "Skincare", "Beauty tools"],
    prices: [P("high", 56, "$56"), P("mid", 30, "$30"), P("low", 25, "$25")] },
  { slug: "nyc-gifts", name: "NYC Gifts", floor: 1, category: "shop", size: "small",
    bullets: ["Souvenirs", "NYC merch", "Postcards"],
    prices: [P("high", 65, "$65"), P("mid", 35, "$35"), P("low", 15, "$15")] },
  { slug: "moonworld", name: "Moonworld", floor: 1, category: "shop", size: "medium",
    bullets: ["Streetwear", "Hoodies", "Graphic tees"],
    prices: [P("high", 2700, "$2,700"), P("mid", 350, "$350"), P("low", 75, "$75")] },
  { slug: "tumi", name: "TUMI", floor: 1, category: "shop", size: "medium",
    bullets: ["Luggage", "Backpacks", "Travel accessories"],
    prices: [P("high", 1300, "$1,300"), P("mid", 1050, "$1,050"), P("low", 950, "$950")] },
  { slug: "kate-spade", name: "Kate Spade", floor: 1, category: "shop", size: "medium",
    bullets: ["Handbags", "Jewelry", "Accessories"],
    prices: [P("high", 548, "$548"), P("mid", 180, "$180"), P("low", 58, "$58")] },
  { slug: "charles-tyrwhitt", name: "Charles Tyrwhitt", floor: 1, category: "shop", size: "medium",
    bullets: ["Dress shirts", "Suits", "Menswear"],
    prices: [P("high", 299, "$299"), P("mid", 65, "$65"), P("low", 39.75, "$39.75")] },
  { slug: "french-embassy", name: "French Embassy", floor: 1, category: "shop", size: "small",
    bullets: ["Apparel", "Jewelry", "Eyewear"],
    prices: [P("high", 168, "$168"), P("mid", 118, "$118"), P("low", 40, "$40")] },
  { slug: "breitling", name: "Breitling", floor: 1, category: "shop", size: "small",
    bullets: ["Luxury watches", "Chronographs", "Accessories"],
    prices: [P("high", 10000, "$10,000+"), P("mid", 6000, "$6,000"), P("low", 3500, "$3,500")] },
  { slug: "pandora", name: "Pandora", floor: 1, category: "shop", size: "small",
    bullets: ["Charms", "Bracelets", "Jewelry"],
    prices: [P("high", 1650, "$1,650"), P("mid", 140, "$140"), P("low", 35, "$35")] },
  { slug: "longines", name: "Longines", floor: 1, category: "shop", size: "small",
    bullets: ["Luxury watches", "Chronographs", "Accessories"],
    prices: [P("high", 6000, "$6,000"), P("mid", 2500, "$2,500"), P("low", 2000, "$2,000")] },
  { slug: "asphalt", name: "Asphalt", floor: 1, category: "shop", size: "medium",
    bullets: ["Shoes", "Jerseys", "Sports gear"],
    prices: [P("high", 800, "$800"), P("mid", 129, "$129"), P("low", 55, "$55")] },
  { slug: "boss", name: "Boss", floor: 1, category: "shop", size: "medium",
    bullets: ["Suits", "Menswear", "Accessories"],
    prices: [P("high", 799, "$799"), P("mid", 199, "$199"), P("low", 85, "$85")] },
  { slug: "twenty-four", name: "Twenty Four", floor: 1, category: "shop", size: "small",
    bullets: ["Jewelry", "Accessories", "Gifts"],
    prices: [P("high", 125, "$125"), P("mid", 60, "$60"), P("low", 40, "$40")] },
  { slug: "stuart-weitzman", name: "Stuart Weitzman", floor: 1, category: "shop", size: "small",
    bullets: ["Shoes", "Boots", "Sandals"],
    prices: [P("high", 850, "$850"), P("mid", 500, "$500"), P("low", 270, "$270")] },
  { slug: "swarovski", name: "Swarovski", floor: 1, category: "shop", size: "small",
    bullets: ["Crystal jewelry", "Accessories", "Gifts"],
    prices: [P("high", 580, "$580"), P("mid", 219, "$219"), P("low", 79, "$79")] },
  { slug: "sephora", name: "Sephora", floor: 1, category: "shop", size: "big",
    bullets: ["Makeup", "Skincare", "Fragrance"],
    prices: [P("high", 199, "$199"), P("mid", 35, "$35"), P("low", 16, "$16")] },
  { slug: "under-armour", name: "Under Armour", floor: 1, category: "shop", size: "medium",
    bullets: ["Activewear", "Sneakers", "Sportswear"],
    prices: [P("high", 140, "$140"), P("mid", 55, "$55"), P("low", 25, "$25")] },
  { slug: "repair-shop", name: "Repair&shop", floor: 1, category: "shop", size: "small",
    bullets: ["Electronics repair"],
    prices: [P("high", 40, "$40"), P("mid", 25, "$25"), P("low", 20, "$20")] },
  { slug: "apple-1st", name: "Apple", floor: 1, category: "shop", size: "big",
    bullets: ["iPhone & iPad", "Mac", "Accessories"],
    prices: [P("high", 6000, "$6,000"), P("mid", 899, "$899"), P("low", 19, "$19")] },

  // ---------- FLOOR 1 — FOOD (displayed as "GRAB A BITE") ----------
  { slug: "sugar-bear", name: "Sugar Bear", floor: 1, category: "food", size: "medium",
    bullets: ["Candy", "Chocolate", "Gift boxes"],
    prices: [P("high", 60, "$60"), P("mid", 14.99, "$14.99"), P("low", 3.99, "$3.99")] },
  { slug: "le-cafe-coffee", name: "Le Cafe Coffee", floor: 1, category: "food", size: "medium",
    bullets: ["Coffee", "Pastries", "Snacks"],
    prices: [P("high", 48, "$48"), P("mid", 7.25, "$7.25"), P("low", 3.75, "$3.75")] },
  { slug: "pure-liquid", name: "Pure Liquid", floor: 1, category: "food", size: "small",
    bullets: ["Wine", "Spirits", "Gift sets"],
    prices: [P("high", 1099, "$1,099"), P("mid", 29, "$29"), P("low", 16.99, "$16.99")] },

  // ---------- FLOOR 2 — SHOP ----------
  { slug: "cole-haan", name: "Cole Haan", floor: 2, category: "shop", size: "medium",
    bullets: ["Shoes", "Bags", "Leather accessories"],
    prices: [P("high", 400, "$400"), P("mid", 170, "$170"), P("low", 10, "$10")] },
  { slug: "rebag", name: "Rebag", floor: 2, category: "shop", size: "small",
    bullets: ["Designer handbags", "Luxury resale", "Accessories"],
    prices: [P("high", 35000, "$35,000", "Hermes"), P("mid", 1800, "$1,800", "LV"), P("low", 400, "$400", "bag straps")] },
  { slug: "popmart", name: "Popmart", floor: 2, category: "shop", size: "medium",
    bullets: ["Blind box toys", "Collectible figures", "Plush toys"],
    prices: [P("high", 1479, "$1,479"), P("mid", 350, "$350"), P("low", 25, "$25")] },
  { slug: "variazioni-italy", name: "Variazioni Italy", floor: 2, category: "shop", size: "small",
    bullets: ["Clothing", "Jewelry"],
    prices: [P("high", 385, "$385"), P("mid", 185, "$185"), P("low", 99, "$99")] },
  { slug: "nahauli-gallery", name: "Nahauli Gallery", floor: 2, category: "shop", size: "medium",
    bullets: ["Artwork", "Paintings", "Sculptures"],
    prices: [P("high", 15000, "$15,000"), P("mid", 6000, "$6,000"), P("low", 700, "$700")] },
  { slug: "michele-lopeiore-milano", name: "Michele Lopeiore Milano", floor: 2, category: "shop", size: "small",
    bullets: ["Branded footwear", "Boutique shoes"],
    prices: [P("high", 325, "$325"), P("mid", 265, "$265"), P("low", 195, "$195")] },
  { slug: "beautiful-amore", name: "Beautiful Amore", floor: 2, category: "shop", size: "small",
    bullets: ["Skincare", "Handcrafted jewelry", "Lifestyle accessories"],
    prices: [P("high", 48, "$48"), P("mid", 20, "$20"), P("low", 12, "$12")] },
  { slug: "portables", name: "Portables", floor: 2, category: "shop", size: "medium",
    bullets: ["Menswear", "Clothing", "Accessories"],
    prices: [P("high", 399, "$399"), P("mid", 199, "$199"), P("low", 49, "$49")] },
  { slug: "atelier", name: "Atelier", floor: 2, category: "shop", size: "medium",
    bullets: ["Unisex clothing", "Jewelry", "Accessories"],
    prices: [P("high", 139, "$139"), P("mid", 99, "$99"), P("low", 39, "$39")] },
  { slug: "sam-edelman", name: "Sam Edelman", floor: 2, category: "shop", size: "medium",
    bullets: ["Shoes", "Sandals", "Accessories"],
    prices: [P("high", 188, "$188"), P("mid", 128, "$128"), P("low", 98, "$98")] },
  { slug: "calzedonia", name: "Calzedonia", floor: 2, category: "shop", size: "medium",
    bullets: ["Hosiery", "Swimwear", "Legwear"],
    prices: [P("high", 99, "$99"), P("mid", 65, "$65"), P("low", 35, "$35")] },
  { slug: "fragrance-com", name: "Fragrance.com", floor: 2, category: "shop", size: "small",
    bullets: ["Perfume", "Cologne", "Fragrance sets"],
    prices: [P("high", 616, "$616"), P("mid", 85, "$85"), P("low", 27, "$27")] },
  { slug: "moleskin", name: "Moleskin", floor: 2, category: "shop", size: "small",
    bullets: ["Notebooks", "Planners", "Pens"],
    prices: [P("high", 37, "$37"), P("mid", 21, "$21"), P("low", 13, "$13")] },
  { slug: "tissot", name: "Tissot", floor: 2, category: "shop", size: "small",
    bullets: ["Watches", "Watch bands", "Accessories"],
    prices: [P("high", 2450, "$2,450"), P("mid", 850, "$850"), P("low", 400, "$400")] },
  { slug: "pretty-well-beauty", name: "Pretty Well Beauty", floor: 2, category: "shop", size: "small",
    bullets: ["Skincare", "Beauty products", "Cosmetics"],
    prices: [P("high", 24, "$24"), P("mid", 18, "$18"), P("low", 8, "$8")] },
  { slug: "lola-soap", name: "Lola Soap", floor: 2, category: "shop", size: "small",
    bullets: ["Soap", "Bath products", "Gifts"],
    prices: [P("high", 1500, "$1,500"), P("mid", 200, "$200"), P("low", 15, "$15")] },
  { slug: "kiehls", name: "Kiehl's", floor: 2, category: "shop", size: "medium",
    bullets: ["Skincare", "Haircare", "Body care"],
    prices: [P("high", 150, "$150"), P("mid", 35, "$35"), P("low", 19, "$19")] },
  { slug: "loccitane", name: "L'Occitane", floor: 2, category: "shop", size: "medium",
    bullets: ["Skincare", "Body care", "Fragrance"],
    prices: [P("high", 120, "$120"), P("mid", 62, "$62"), P("low", 14, "$14")] },
  { slug: "eye-origin", name: "Eye Origin", floor: 2, category: "shop", size: "small",
    bullets: ["Sunglasses", "Eyeglasses", "Accessories"],
    prices: [P("high", 4190, "$4,190"), P("mid", 599, "$599"), P("low", 99, "$99")] },
  { slug: "eye-world-optical", name: "Eye World Optical", floor: 2, category: "shop", size: "medium",
    bullets: ["Prescription glasses", "Sunglasses", "Eye exams"],
    prices: [P("high", 2790, "$2,790"), P("mid", 875, "$875"), P("low", 475, "$475")] },
  { slug: "ethan-jordan-jewelers", name: "Ethan Jordan Jewelers", floor: 2, category: "shop", size: "small",
    bullets: ["Fine jewelry", "Engagement rings", "Diamonds"],
    prices: [P("high", 5450, "$5,450"), P("mid", 2950, "$2,950"), P("low", 499, "$499")] },
  { slug: "apple-2nd", name: "Apple", floor: 2, category: "shop", size: "big",
    bullets: ["iPhone & iPad", "Mac", "Accessories"],
    prices: [P("high", 6000, "$6,000"), P("mid", 899, "$899"), P("low", 19, "$19")] },

  // ---------- FLOOR 2 — FOOD (displayed as "GRAB A BITE") ----------
  { slug: "dunkin", name: "Dunkin'", floor: 2, category: "food", size: "medium",
    bullets: ["Coffee", "Donuts", "Breakfast food"],
    prices: [P("high", 12.99, "$12.99"), P("mid", 6, "$6"), P("low", 1.79, "$1.79")] },
  { slug: "la-maison-du-chocolat", name: "La Maison du Chocolat", floor: 2, category: "food", size: "small",
    bullets: ["Chocolate", "Truffles", "Gift boxes"],
    prices: [P("high", 165, "$165"), P("mid", 30, "$30"), P("low", 11, "$11")] },
];

// --- selectors ---

/** All stores on one floor in one category, in catalog order. */
export const storesByFloorAndCategory = (floor: Floor, category: StoreCategory): CatalogStore[] =>
  STORE_CATALOG.filter((s) => s.floor === floor && s.category === category);

/**
 * Map a game visit back to its frozen slug. The game's scatter layout keys stores
 * by (floor, display name) — this resolves that pair to the database identifier.
 */
export const storeSlug = (floor: Floor, name: string): string | undefined =>
  STORE_CATALOG.find((s) => s.floor === floor && s.name === name)?.slug;
