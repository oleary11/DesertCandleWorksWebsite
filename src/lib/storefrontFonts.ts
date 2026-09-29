import localFont from "next/font/local";
import { Young_Serif } from "next/font/google";

/** Display serif used for headings across the storefront (home, shop, product, cart). */
export const serif = Young_Serif({ weight: "400", subsets: ["latin"], display: "swap" });

/** Handwritten accent for small flourishes. Never used for anything a customer must read. */
export const script = localFont({
  src: [{ path: "../../public/fonts/Megastina.ttf", weight: "400", style: "normal" }],
  display: "swap",
});
