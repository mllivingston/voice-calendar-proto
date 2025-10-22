import dynamic from "next/dynamic";

const HistoryDrawer = dynamic(
  () => import("../../../lib/components/HistoryDrawer"),
  { ssr: false }
);

const SHOW =
  String(process.env.NEXT_PUBLIC_SHOW_HISTORY || "").toLowerCase() === "true";

export default function Page() {
  if (!SHOW) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">History (Disabled)</h1>
        <p className="text-sm text-gray-600 mt-2">
          Set NEXT_PUBLIC_SHOW_HISTORY=true to enable the hidden History drawer.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">History</h1>
      <p className="text-sm text-gray-600 mt-2">
        Use the “Open History” button at the bottom-right.
      </p>
      <HistoryDrawer />
    </div>
  );
}
