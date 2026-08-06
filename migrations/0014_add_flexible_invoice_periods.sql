ALTER TABLE recurring_invoice_schedules
  ADD COLUMN IF NOT EXISTS period_start text,
  ADD COLUMN IF NOT EXISTS period_end text;
