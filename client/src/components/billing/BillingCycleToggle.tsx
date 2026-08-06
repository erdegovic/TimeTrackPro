import type { BillingInterval } from "@shared/subscriptions";

type BillingCycleToggleProps = {
  value: BillingInterval;
  onChange: (value: BillingInterval) => void;
  compact?: boolean;
};

export default function BillingCycleToggle({ value, onChange, compact = false }: BillingCycleToggleProps) {
  return (
    <div className={`flex justify-center ${compact ? "mb-6" : "mt-10"}`}>
      <div className="inline-flex rounded-md border border-[#d8e0ea] bg-white p-1 shadow-sm" role="group" aria-label="Billing period">
        <button
          type="button"
          onClick={() => onChange("monthly")}
          aria-pressed={value === "monthly"}
          className={`min-h-10 rounded px-4 text-sm font-semibold transition ${value === "monthly" ? "bg-[#071127] text-white" : "text-[#475467] hover:bg-[#f4f7fb]"}`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => onChange("annual")}
          aria-pressed={value === "annual"}
          className={`flex min-h-10 items-center gap-2 rounded px-4 text-sm font-semibold transition ${value === "annual" ? "bg-[#071127] text-white" : "text-[#475467] hover:bg-[#f4f7fb]"}`}
        >
          Yearly
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${value === "annual" ? "bg-emerald-400 text-[#071127]" : "bg-emerald-50 text-emerald-700"}`}>
            Save up to 30%
          </span>
        </button>
      </div>
    </div>
  );
}
