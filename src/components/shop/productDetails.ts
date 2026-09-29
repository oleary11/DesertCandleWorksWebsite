/**
 * Product-page detail sections. Wording mirrors the FAQ and policies pages;
 * keep them in step if either changes.
 */
export const CANDLE_DETAILS: { title: string; items: string[] }[] = [
  {
    title: "What it's made of",
    items: [
      "Hand-poured in Scottsdale, Arizona. The wax for this candle is listed in the description above.",
      "Poured into a real, upcycled liquor bottle.",
      "Burns for about 40–60+ hours, depending on the bottle size.",
    ],
  },
  {
    title: "Burning it well",
    items: [
      "Trim the wick to about ¼ inch before each lighting.",
      "On the first burn, let the wax melt all the way to the edges.",
      "Burn for no more than 4 hours at a time, on a heat-resistant surface.",
      "Keep it in a well-ventilated room, away from children and pets.",
    ],
  },
  {
    title: "Shipping & pickup",
    items: [
      "Ships within the United States and to Canada.",
      "Free shipping on orders over $100.",
      "Free local pickup in Scottsdale and the greater Phoenix area. Choose Local Pickup at checkout.",
    ],
  },
];

export const HOME_GOODS_DETAILS: { title: string; items: string[] }[] = [
  {
    title: "About the bottle",
    items: [
      "Each piece is made from a real, upcycled liquor bottle, finished by hand in Scottsdale, Arizona.",
      "Every bottle is one of a kind, so the one you pick is the one you get.",
    ],
  },
  CANDLE_DETAILS[2],
];
