import { PLAN_LIMITS } from "@/lib/plans";

const rows: { label: string; key: keyof typeof PLAN_LIMITS.FREE }[] = [
  { label: "Custom slug", key: "customSlug" },
  { label: "QR logo", key: "qrLogo" },
  { label: "QR gradient", key: "qrGradient" },
  { label: "Desktop links", key: "desktopLinks" },
  { label: "Parameter forwarding", key: "parameterForwarding" },
  { label: "Full analytics", key: "fullAnalytics" },
];

function cell(v: boolean | number | null) {
  if (v === true) return "✓";
  if (v === false) return "—";
  return v === null ? "Unlimited" : String(v);
}

export default function Pricing() {
  return (
    <div className="grid gap-6">
      <h1 className="text-center text-3xl font-bold">Pricing</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th className="p-3 text-left">Feature</th>
            <th className="p-3">Free</th>
            <th className="p-3">Pro — $10/mo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="p-3">Links</td>
            <td className="p-3 text-center">{cell(PLAN_LIMITS.FREE.maxLinks)}</td>
            <td className="p-3 text-center">{cell(PLAN_LIMITS.PRO.maxLinks)}</td>
          </tr>
          {rows.map((r) => (
            <tr key={r.key} className="border-t">
              <td className="p-3">{r.label}</td>
              <td className="p-3 text-center">{cell(PLAN_LIMITS.FREE[r.key])}</td>
              <td className="p-3 text-center">{cell(PLAN_LIMITS.PRO[r.key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
