import DevFeatureBanner from "@/components/DevFeatureBanner";
import Web3Provider from "@/components/Web3Provider";

// Web3 (wagmi) is scoped to this route only — it was removed from the root
// layout so no other page loads or initialises it.
export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Web3Provider>
      <DevFeatureBanner />
      {children}
    </Web3Provider>
  );
}
