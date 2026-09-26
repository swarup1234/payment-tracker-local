const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'paytracker_jwt_secret_key_2026';

const allowedOrigins = process.env.CLIENT_URL
  ? [process.env.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000']
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());

// Helper to prevent exposing internal DB error details or stack traces to clients
const sendError = (res, err, status = 500, fallbackMessage = 'An error occurred while processing your request') => {
  console.error('[API Error]:', err);
  const message = (process.env.NODE_ENV === 'development' || status < 500)
    ? (err.message || fallbackMessage)
    : fallbackMessage;
  res.status(status).json({ error: message });
};

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'db',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'payment_tracker',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// ---- Automatic Database Schema & Multi-Tenant Migration ----
async function initDbSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
          id            SERIAL PRIMARY KEY,
          name          VARCHAR(150) NOT NULL,
          email         VARCHAR(150) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          created_at    TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      INSERT INTO users (id, name, email, password_hash)
      VALUES (1, 'Demo User', 'demo@paytracker.com', '$2b$10$NIZPWy/VJTLccRULFFNEYeVnqBGNNSbdEOzxUJco8jF/W7scCa.xK')
      ON CONFLICT (email) DO NOTHING;

      ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE services ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;
      ALTER TABLE notifications_log ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE;

      UPDATE customers SET user_id = 1 WHERE user_id IS NULL;
      UPDATE services SET user_id = 1 WHERE user_id IS NULL;
      UPDATE subscriptions SET user_id = 1 WHERE user_id IS NULL;
      UPDATE transactions SET user_id = 1 WHERE user_id IS NULL;
      UPDATE notifications_log SET user_id = 1 WHERE user_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
      CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_id);
      CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_status_due ON transactions(user_id, status, due_date);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_customer ON transactions(user_id, customer_id);
    `);
    console.log('Database schema & multi-tenant migrations applied successfully.');
  } catch (err) {
    console.error('Error applying database migrations:', err);
  } finally {
    client.release();
  }
}
initDbSchema();

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Authentication Middleware ----
const authenticateToken = (req, res, next) => {
  let token = req.cookies?.token;
  if (!token && req.headers['authorization']) {
    const authHeader = req.headers['authorization'];
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

// ---- Quota Middlewares ----
const checkServiceQuota = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int FROM services WHERE user_id = $1', [req.user.id]);
    if (result.rows[0].count >= 10) {
      return res.status(403).json({
        error: 'Service limit reached. Maximum 10 services allowed per user. Please upgrade to the full version for unlimited services.'
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkCustomerQuota = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int FROM customers WHERE user_id = $1', [req.user.id]);
    if (result.rows[0].count >= 5000) {
      return res.status(403).json({
        error: 'Customer limit reached. Maximum 5,000 customers allowed per user. Please upgrade to the full version for unlimited customers.'
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const checkTransactionQuota = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT COUNT(*)::int FROM transactions WHERE user_id = $1', [req.user.id]);
    if (result.rows[0].count >= 100000) {
      return res.status(403).json({
        error: 'Transaction quota reached (100,000 limit). Please upgrade to the full version to record more transactions.'
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Seed default services helper for new users
async function seedDefaultServices(userId, client = pool) {
  const defaultServices = [
    ['Income Tax', 5000, 'monthly'],
    ['GST', 500, 'monthly'],
    ['Insurance', 5000, 'quarterly'],
    ['Other', 5000, 'yearly'],
  ];
  for (const [name, amount, cycle] of defaultServices) {
    await client.query(
      'INSERT INTO services (user_id, name, default_amount, billing_cycle) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
      [userId, name, amount, cycle]
    );
  }
}

// ---- Authentication Routes ----

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const lowerEmail = email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1', [lowerEmail]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email',
      [name.trim(), lowerEmail, passwordHash]
    );
    const user = result.rows[0];

    // Seed default services for new user
    await seedDefaultServices(user.id);

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const lowerEmail = email.toLowerCase().trim();
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1', [lowerEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ status: 'ok' });
});

app.get('/auth/me', authenticateToken, async (req, res) => {
  try {
    const servicesCount = await pool.query('SELECT COUNT(*)::int FROM services WHERE user_id = $1', [req.user.id]);
    const customersCount = await pool.query('SELECT COUNT(*)::int FROM customers WHERE user_id = $1', [req.user.id]);
    const transactionsCount = await pool.query('SELECT COUNT(*)::int FROM transactions WHERE user_id = $1', [req.user.id]);

    res.json({
      user: req.user,
      quotas: {
        services: { current: servicesCount.rows[0].count, limit: 10 },
        customers: { current: customersCount.rows[0].count, limit: 5000 },
        transactions: { current: transactionsCount.rows[0].count, limit: 100000 },
      }
    });
  } catch (err) {
    sendError(res, err, 500, 'Failed to fetch user profile');
  }
});

app.put('/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, req.user.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    sendError(res, err, 500, 'Failed to update password');
  }
});

// ---- Customers Routes ----

app.get('/customers', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(SUM(CASE WHEN t.status IN ('pending','overdue') THEN t.amount ELSE 0 END), 0) AS pending_amount,
        COUNT(CASE WHEN t.status IN ('pending','overdue') THEN 1 END)::int AS pending_count
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.id AND t.user_id = $1
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.id DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/customers', authenticateToken, checkCustomerQuota, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      'INSERT INTO customers (user_id, name, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, name, phone, email, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4 WHERE id=$5 AND user_id=$6 RETURNING *`,
      [name, phone, email, address, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/customers/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await pool.query('SELECT * FROM customers WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const transactions = await pool.query(`
      SELECT t.*, s.name AS service_name
      FROM transactions t
      LEFT JOIN services s ON s.id = t.service_id AND s.user_id = $2
      WHERE t.customer_id = $1 AND t.user_id = $2
      ORDER BY t.due_date DESC
    `, [req.params.id, req.user.id]);
    res.json({ ...customer.rows[0], transactions: transactions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Services Routes ----

app.get('/services', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE user_id = $1 ORDER BY id', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/services', authenticateToken, checkServiceQuota, async (req, res) => {
  try {
    const { name, default_amount, billing_cycle } = req.body;
    if (!name) return res.status(400).json({ error: 'Service name is required' });
    const result = await pool.query(
      `INSERT INTO services (user_id, name, default_amount, billing_cycle) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, name, default_amount || 0, billing_cycle || 'monthly']
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/services/:id', authenticateToken, async (req, res) => {
  try {
    const { name, default_amount, billing_cycle, is_active } = req.body;
    const result = await pool.query(
      `UPDATE services SET name=$1, default_amount=$2, billing_cycle=$3, is_active=$4 WHERE id=$5 AND user_id=$6 RETURNING *`,
      [name, default_amount, billing_cycle, is_active, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Transactions Routes ----

app.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const { status, customer_id } = req.query;
    let query = `
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = $1
      LEFT JOIN services s ON s.id = t.service_id AND s.user_id = $1
      WHERE t.user_id = $1
    `;
    const params = [req.user.id];
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND t.status=$${params.length}`;
    }
    if (customer_id) {
      params.push(customer_id);
      query += ` AND t.customer_id=$${params.length}`;
    }
    query += ' ORDER BY t.due_date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/transactions', authenticateToken, checkTransactionQuota, async (req, res) => {
  try {
    const { customer_id, service_id, amount, due_date } = req.body;
    const result = await pool.query(
      'INSERT INTO transactions (user_id, customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.user.id, customer_id, service_id, amount, due_date]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    const { service_id, amount, due_date, status } = req.body;
    const result = await pool.query(
      `UPDATE transactions SET service_id=$1, amount=$2, due_date=$3, status=$4 WHERE id=$5 AND user_id=$6 RETURNING *`,
      [service_id, amount, due_date, status, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/transactions/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/transactions/:id/mark-paid', authenticateToken, async (req, res) => {
  try {
    const { payment_mode } = req.body;
    const result = await pool.query(
      `UPDATE transactions SET status='paid', payment_mode=$1, paid_at=now() WHERE id=$2 AND user_id=$3 RETURNING *`,
      [payment_mode, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Bulk Import ----

app.post('/transactions/bulk-import', authenticateToken, checkTransactionQuota, async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows must be a non-empty array' });
  }

  const client = await pool.connect();
  try {
    const customers = await client.query('SELECT id, LOWER(name) AS lname FROM customers WHERE user_id = $1', [req.user.id]);
    const services  = await client.query('SELECT id, LOWER(name) AS lname FROM services WHERE user_id = $1', [req.user.id]);
    const custMap   = Object.fromEntries(customers.rows.map((r) => [r.lname, r.id]));
    const svcMap    = Object.fromEntries(services.rows.map((r) => [r.lname, r.id]));

    const created = [];
    const errors  = [];

    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const custId = custMap[(row.customer_name || '').toLowerCase().trim()];
      const svcId  = svcMap[(row.service_name  || '').toLowerCase().trim()];
      const amount = parseFloat(row.amount);
      const due    = row.due_date ? row.due_date.trim() : '';

      if (!custId) { errors.push({ row: rowNum, reason: `Customer "${row.customer_name}" not found` }); continue; }
      if (!svcId)  { errors.push({ row: rowNum, reason: `Service "${row.service_name}" not found` });  continue; }
      if (isNaN(amount) || amount <= 0) { errors.push({ row: rowNum, reason: `Invalid amount "${row.amount}"` }); continue; }
      if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) { errors.push({ row: rowNum, reason: `Invalid due_date "${row.due_date}" — use YYYY-MM-DD` }); continue; }

      const result = await client.query(
        'INSERT INTO transactions (user_id, customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.user.id, custId, svcId, amount, due]
      );
      created.push(result.rows[0].id);
    }
    await client.query('COMMIT');
    res.json({ created: created.length, errors });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- Bulk Charge ----

app.post('/bulk-charge', authenticateToken, checkTransactionQuota, async (req, res) => {
  const { customer_ids, service_id, amount, due_date } = req.body;
  if (!Array.isArray(customer_ids) || customer_ids.length === 0) {
    return res.status(400).json({ error: 'customer_ids must be a non-empty array' });
  }
  if (!service_id || !amount || !due_date) {
    return res.status(400).json({ error: 'service_id, amount, and due_date are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = [];
    for (const cid of customer_ids) {
      const result = await client.query(
        'INSERT INTO transactions (user_id, customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *',
        [req.user.id, cid, service_id, amount, due_date]
      );
      created.push(result.rows[0]);
    }
    await client.query('COMMIT');
    res.json({ created: created.length, transactions: created });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- Export / Backup ----

app.get('/export', authenticateToken, async (req, res) => {
  try {
    const customers = await pool.query('SELECT * FROM customers WHERE user_id = $1 ORDER BY id', [req.user.id]);
    const transactions = await pool.query(`
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = $1
      LEFT JOIN services s ON s.id = t.service_id AND s.user_id = $1
      WHERE t.user_id = $1
      ORDER BY t.due_date DESC
    `, [req.user.id]);
    const services = await pool.query('SELECT * FROM services WHERE user_id = $1 ORDER BY id', [req.user.id]);
    res.json({
      exported_at: new Date().toISOString(),
      user: { id: req.user.id, email: req.user.email },
      customers: customers.rows,
      services: services.rows,
      transactions: transactions.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Reports ----

app.get('/reports/overdue', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE transactions SET status='overdue' WHERE status='pending' AND due_date < CURRENT_DATE AND user_id = $1`,
      [req.user.id]
    );
    const overdue = await pool.query(`
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id AND c.user_id = $1
      LEFT JOIN services s ON s.id = t.service_id AND s.user_id = $1
      WHERE t.status='overdue' AND t.user_id = $1
      ORDER BY t.due_date
    `, [req.user.id]);
    res.json(overdue.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
