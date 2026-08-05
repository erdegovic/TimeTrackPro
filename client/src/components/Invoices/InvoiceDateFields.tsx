import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calculateDueDate, DueDateMode } from "@/lib/invoice-dates";

type InvoiceDateFieldsProps = {
  issueDate: string;
  dueDate: string;
  mode: DueDateMode;
  days: number;
  showDueDate?: boolean;
  onIssueDateChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onModeChange: (value: DueDateMode) => void;
  onDaysChange: (value: number) => void;
};

export function InvoiceDateFields({
  issueDate,
  dueDate,
  mode,
  days,
  showDueDate = true,
  onIssueDateChange,
  onDueDateChange,
  onModeChange,
  onDaysChange,
}: InvoiceDateFieldsProps) {
  const recalculate = (date: string, nextMode = mode, nextDays = days) => {
    if (nextMode !== "manual") onDueDateChange(calculateDueDate(date, nextMode, nextDays));
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="invoice-issue-date" className="text-xs text-gray-500">Invoice Date</Label>
        <Input
          id="invoice-issue-date"
          type="date"
          value={issueDate}
          onChange={(event) => {
            onIssueDateChange(event.target.value);
            recalculate(event.target.value);
          }}
          className="mt-1 h-9"
        />
      </div>
      {showDueDate && (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-gray-500">Payment Period</Label>
            <Select
              value={mode === "days" ? `days-${days}` : mode}
              onValueChange={(value) => {
                if (value.startsWith("days-")) {
                  const nextDays = Number(value.slice(5));
                  onDaysChange(nextDays);
                  onModeChange("days");
                  recalculate(issueDate, "days", nextDays);
                } else {
                  const nextMode = value as DueDateMode;
                  onModeChange(nextMode);
                  recalculate(issueDate, nextMode, days);
                }
              }}
            >
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="calendar_month">1 calendar month</SelectItem>
                {[7, 14, 30, 45, 60, 90].map((option) => (
                  <SelectItem key={option} value={`days-${option}`}>{option} days</SelectItem>
                ))}
                <SelectItem value="manual">Choose due date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "manual" && (
            <div>
              <Label htmlFor="invoice-due-date" className="text-xs text-gray-500">Due Date</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                min={issueDate}
                onChange={(event) => onDueDateChange(event.target.value)}
                className="mt-1 h-9"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
