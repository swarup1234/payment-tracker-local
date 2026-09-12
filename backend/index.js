const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'payment_tracker',
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ---- Customers ----

app.get('/customers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(SUM(CASE WHEN t.status IN ('pending','overdue') THEN t.amount ELSE 0 END), 0) AS pending_amount,
        COUNT(CASE WHEN t.status IN ('pending','overdue') THEN 1 END)::int AS pending_count
      FROM customers c
      LEFT JOIN transactions t ON t.customer_id = c.id
      GROUP BY c.id
      ORDER BY c.id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/customers', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      'INSERT INTO customers (name, phone, email, address) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, phone, email, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/customers/:id', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      `UPDATE customers SET name=$1, phone=$2, email=$3, address=$4 WHERE id=$5 RETURNING *`,
      [name, phone, email, address, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE id=$1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/customers/:id', async (req, res) => {
  try {
    const customer = await pool.query('SELECT * FROM customers WHERE id=$1', [req.params.id]);
    if (customer.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    const transactions = await pool.query(`
      SELECT t.*, s.name AS service_name
      FROM transactions t
      LEFT JOIN services s ON s.id = t.service_id
      WHERE t.customer_id = $1
      ORDER BY t.due_date DESC
    `, [req.params.id]);
    res.json({ ...customer.rows[0], transactions: transactions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Services ----

app.get('/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/services/:id', async (req, res) => {
  try {
    const { name, default_amount, billing_cycle, is_active } = req.body;
    const result = await pool.query(
      `UPDATE services SET name=$1, default_amount=$2, billing_cycle=$3, is_active=$4 WHERE id=$5 RETURNING *`,
      [name, default_amount, billing_cycle, is_active, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Transactions ----

app.get('/transactions', async (req, res) => {
  try {
    const { status, customer_id } = req.query;
    let query = `
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN services s ON s.id = t.service_id
      WHERE 1=1
    `;
    const params = [];
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

app.post('/transactions', async (req, res) => {
  try {
    const { customer_id, service_id, amount, due_date } = req.body;
    const result = await pool.query(
      'INSERT INTO transactions (customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4) RETURNING *',
      [customer_id, service_id, amount, due_date]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/transactions/:id', async (req, res) => {
  try {
    const { service_id, amount, due_date, status } = req.body;
    const result = await pool.query(
      `UPDATE transactions SET service_id=$1, amount=$2, due_date=$3, status=$4 WHERE id=$5 RETURNING *`,
      [service_id, amount, due_date, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transaction not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/transactions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id=$1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/transactions/:id/mark-paid', async (req, res) => {
  try {
    const { payment_mode } = req.body;
    const result = await pool.query(
      `UPDATE transactions SET status='paid', payment_mode=$1, paid_at=now() WHERE id=$2 RETURNING *`,
      [payment_mode, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Bulk Import (CSV upload parsed client-side, rows sent as JSON) ----

// POST /transactions/bulk-import
// Body: { rows: [{ customer_name, service_name, amount, due_date }] }
// Matches customer_name → customer_id, service_name → service_id (case-insensitive)
// Returns { created, errors } where errors lists rows that couldn't be matched
app.post('/transactions/bulk-import', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows must be a non-empty array' });
  }

  const client = await pool.connect();
  try {
    // Load lookup maps
    const customers = await client.query('SELECT id, LOWER(name) AS lname FROM customers');
    const services  = await client.query('SELECT id, LOWER(name) AS lname FROM services');
    const custMap   = Object.fromEntries(customers.rows.map((r) => [r.lname, r.id]));
    const svcMap    = Object.fromEntries(services.rows.map((r) => [r.lname, r.id]));

    const created = [];
    const errors  = [];

    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // 1-indexed + header row

      const custId = custMap[(row.customer_name || '').toLowerCase().trim()];
      const svcId  = svcMap[(row.service_name  || '').toLowerCase().trim()];
      const amount = parseFloat(row.amount);
      const due    = row.due_date ? row.due_date.trim() : '';

      if (!custId) { errors.push({ row: rowNum, reason: `Customer "${row.customer_name}" not found` }); continue; }
      if (!svcId)  { errors.push({ row: rowNum, reason: `Service "${row.service_name}" not found` });  continue; }
      if (isNaN(amount) || amount <= 0) { errors.push({ row: rowNum, reason: `Invalid amount "${row.amount}"` }); continue; }
      if (!due || !/^\d{4}-\d{2}-\d{2}$/.test(due)) { errors.push({ row: rowNum, reason: `Invalid due_date "${row.due_date}" — use YYYY-MM-DD` }); continue; }

      const result = await client.query(
        'INSERT INTO transactions (customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4) RETURNING id',
        [custId, svcId, amount, due]
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

// POST /bulk-charge
// Body: { customer_ids: number[], service_id: number, amount: number, due_date: string }
// Creates one transaction per customer in a single DB transaction
app.post('/bulk-charge', async (req, res) => {
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
        'INSERT INTO transactions (customer_id, service_id, amount, due_date) VALUES ($1,$2,$3,$4) RETURNING *',
        [cid, service_id, amount, due_date]
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

// GET /export — full backup as JSON (customers + all transactions with names)
app.get('/export', async (req, res) => {
  try {
    const customers = await pool.query('SELECT * FROM customers ORDER BY id');
    const transactions = await pool.query(`
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN services s ON s.id = t.service_id
      ORDER BY t.due_date DESC
    `);
    const services = await pool.query('SELECT * FROM services ORDER BY id');
    res.json({
      exported_at: new Date().toISOString(),
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

app.get('/reports/overdue', async (req, res) => {
  try {
    await pool.query(
      `UPDATE transactions SET status='overdue' WHERE status='pending' AND due_date < CURRENT_DATE`
    );
    const overdue = await pool.query(`
      SELECT t.*, c.name AS customer_name, s.name AS service_name
      FROM transactions t
      LEFT JOIN customers c ON c.id = t.customer_id
      LEFT JOIN services s ON s.id = t.service_id
      WHERE t.status='overdue'
      ORDER BY t.due_date
    `);
    res.json(overdue.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
