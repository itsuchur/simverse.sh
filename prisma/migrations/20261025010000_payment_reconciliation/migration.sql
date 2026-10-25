ALTER TABLE orders
  ADD COLUMN payment_invoice_id TEXT,
  ADD COLUMN payment_next_check_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX idx_orders_payment_recovery ON orders(payment_status, payment_next_check_at);
