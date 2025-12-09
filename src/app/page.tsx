import { listResolvedProducts } from "@/lib/resolvedProducts";
import { getTotalStockForProduct } from "@/lib/productsStore";
import HomeContent from "@/components/HomeContent";

export const revalidate = 3600;

export default async function Home() {
  const all = await listResolvedProducts();
  const bestSellerProducts = all.filter((p) => !!p.bestSeller);

  // Add computed stock to bestsellers
  const bestsellersWithStock = await Promise.all(
    bestSellerProducts.map(async (p) => {
      const computedStock = await getTotalStockForProduct(p);
      return { ...p, _computedStock: computedStock };
    })
  );

  // Sort by stock (in-stock first)
  const bestsellers = bestsellersWithStock.sort((a, b) => {
    const aInStock = a._computedStock > 0 ? 1 : 0;
    const bInStock = b._computedStock > 0 ? 1 : 0;
    return bInStock - aInStock;
  });

  return <HomeContent bestsellers={bestsellers} />;
}
