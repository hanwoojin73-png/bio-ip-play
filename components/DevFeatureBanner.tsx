/**
 * Top-of-page notice for routes that are reachable by direct URL but are
 * not part of the current MVP (hidden from NavBar).
 */
export default function DevFeatureBanner() {
  return (
    <div
      role="status"
      className="border-b border-amber-800/60 bg-amber-950/70 px-4 py-2.5 text-center text-sm font-medium text-amber-200"
    >
      개발 중인 기능입니다.
    </div>
  );
}
