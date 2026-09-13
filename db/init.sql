-- Runs automatically the first time the Postgres container starts
CREATE TABLE customers (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    phone         VARCHAR(15) NOT NULL UNIQUE,
    email         VARCHAR(150),
    address       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE services (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL,
    default_amount NUMERIC(10,2),
    billing_cycle  VARCHAR(20) DEFAULT 'monthly',
    is_active      BOOLEAN DEFAULT true
);

CREATE TABLE subscriptions (
    id           SERIAL PRIMARY KEY,
    customer_id  INT REFERENCES customers(id) ON DELETE CASCADE,
    service_id   INT REFERENCES services(id),
    amount       NUMERIC(10,2) NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE,
    is_active    BOOLEAN DEFAULT true
);

CREATE TABLE transactions (
    id                 SERIAL PRIMARY KEY,
    customer_id        INT REFERENCES customers(id),
    service_id         INT REFERENCES services(id),
    subscription_id    INT REFERENCES subscriptions(id),
    amount             NUMERIC(10,2) NOT NULL,
    due_date           DATE NOT NULL,
    status             VARCHAR(20) DEFAULT 'pending',
    payment_mode       VARCHAR(20),
    gateway_payment_id VARCHAR(100),
    paid_at            TIMESTAMPTZ,
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_transactions_status_due ON transactions(status, due_date);
CREATE INDEX idx_transactions_customer ON transactions(customer_id);

CREATE TABLE notifications_log (
    id              SERIAL PRIMARY KEY,
    transaction_id  INT REFERENCES transactions(id),
    customer_id     INT REFERENCES customers(id),
    type            VARCHAR(20) NOT NULL,
    channel         VARCHAR(20) DEFAULT 'sms',
    status          VARCHAR(20),
    provider_ref_id VARCHAR(100),
    sent_at         TIMESTAMPTZ DEFAULT now()
);

-- Seed default services so the app has something to work with immediately
INSERT INTO services (name, default_amount, billing_cycle) VALUES
    ('Income Tax', 5000, 'monthly'),
    ('GST', 500, 'monthly'),
    ('Insurance', 5000, 'quarterly'),
    ('Other', 5000, 'yearly'),
    ('Service Name 5', 1000, 'monthly'),
    ('Service Name 6', 2000, 'monthly'),
    ('Service Name 7', 3000, 'quarterly'),
    ('Service Name 8', 4000, 'yearly'),
    ('Service Name 9', 5000, 'monthly');