import DevFeatureBanner from "@/components/DevFeatureBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DevFeatureBanner />
      {children}
    </>
  );
}
