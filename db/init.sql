-- Runs automatically the first time the Postgres container starts

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Seed default demo user (password: Demo@123456)
INSERT INTO users (id, name, email, password_hash)
VALUES (1, 'Demo User', 'demo@paytracker.com', '$2b$10$NIZPWy/VJTLccRULFFNEYeVnqBGNNSbdEOzxUJco8jF/W7scCa.xK')
ON CONFLICT (email) DO NOTHING;

-- Reset sequence for users table if needed
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

CREATE TABLE IF NOT EXISTS customers (
    id            SERIAL PRIMARY KEY,
    user_id       INT REFERENCES users(id) ON DELETE CASCADE,
    name          VARCHAR(150) NOT NULL,
    phone         VARCHAR(15) NOT NULL,
    email         VARCHAR(150),
    address       TEXT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_phone UNIQUE (user_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

CREATE TABLE IF NOT EXISTS services (
    id             SERIAL PRIMARY KEY,
    user_id        INT REFERENCES users(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    default_amount NUMERIC(10,2),
    billing_cycle  VARCHAR(20) DEFAULT 'monthly',
    is_active      BOOLEAN DEFAULT true,
    CONSTRAINT unique_user_service_name UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_id);

CREATE TABLE IF NOT EXISTS subscriptions (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users(id) ON DELETE CASCADE,
    customer_id  INT REFERENCES customers(id) ON DELETE CASCADE,
    service_id   INT REFERENCES services(id),
    amount       NUMERIC(10,2) NOT NULL,
    start_date   DATE NOT NULL,
    end_date     DATE,
    is_active    BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS transactions (
    id                 SERIAL PRIMARY KEY,
    user_id            INT REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_transactions_user_status_due ON transactions(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_customer ON transactions(user_id, customer_id);

CREATE TABLE IF NOT EXISTS notifications_log (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE CASCADE,
    transaction_id  INT REFERENCES transactions(id),
    customer_id     INT REFERENCES customers(id),
    type            VARCHAR(20) NOT NULL,
    channel         VARCHAR(20) DEFAULT 'sms',
    status          VARCHAR(20),
    provider_ref_id VARCHAR(100),
    sent_at         TIMESTAMPTZ DEFAULT now()
);

-- Seed default services for demo user (user_id = 1)
INSERT INTO services (user_id, name, default_amount, billing_cycle) VALUES
    (1, 'Income Tax', 5000, 'monthly'),
    (1, 'GST', 500, 'monthly'),
    (1, 'Insurance', 5000, 'quarterly'),
    (1, 'Other', 5000, 'yearly'),
    (1, 'Service Name 5', 1000, 'monthly'),
    (1, 'Service Name 6', 2000, 'monthly'),
    (1, 'Service Name 7', 3000, 'quarterly'),
    (1, 'Service Name 8', 4000, 'yearly'),
    (1, 'Service Name 9', 5000, 'monthly')
ON CONFLICT (user_id, name) DO NOTHING;