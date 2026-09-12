# PayTracker

A self-hosted payment tracking system for managing customers, subscriptions, and transactions across multiple services. Runs entirely in Docker — no local installs needed beyond Docker Desktop.

---

## Repository

```bash
gh repo clone swarup1234/payment-tracker-local
```

Or with plain git:
```bash
git clone https://github.com/swarup1234/payment-tracker-local.git
```

---

## What's included

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React + Vite + Tailwind CSS | Web UI served by nginx |
| Backend API | Node.js + Express | REST API on port 4000 (internal) |
| Database | PostgreSQL 16 | Stores all data |
| Adminer | Web UI | Browse/edit database directly |

> **Note:** the backend API is not exposed directly to your machine — it's only reachable through the frontend's nginx proxy (e.g. `http://localhost:3000/api/health`), not `http://localhost:4000/health` directly. If you need to hit port 4000 from your host machine (e.g. for testing with `curl` or Postman), add a `ports: - "4000:4000"` mapping to the `backend` service in `docker-compose.yml`.

---

## Prerequisites

**Only one thing is required on any machine (Mac, Windows, Linux):**

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — free for personal and small business use

Nothing else. No Node.js, no PostgreSQL, no npm — Docker handles all of it.

---

## First-time setup — Mac

### Step 1 — Install Docker Desktop

1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Click **"Download for Mac"**
   - Choose **Apple Silicon** if your Mac has an M1/M2/M3/M4 chip
   - Choose **Intel Chip** if your Mac is from 2019 or earlier
3. Open the downloaded `.dmg` file
4. Drag the Docker icon into your **Applications** folder
5. Open Docker from Applications
6. Click **Accept** on the license agreement
7. Wait for the menu bar icon to stop animating — when it shows a steady whale icon, Docker is ready

> **Check it worked:** Open Terminal and run `docker --version` — you should see a version number.

### Step 2 — Get the project

If you received a zip file:
```bash
# Unzip and navigate into the folder
cd ~/Downloads/payment-tracker
```

If you're cloning from git:
```bash
git clone https://github.com/swarup1234/payment-tracker-local.git
cd payment-tracker-local
```

### Step 3 — Configure your password

```bash
cp .env.example .env
open -e .env          # opens in TextEdit
```

Change `changeme` to a real password:
```env
DB_USER=postgres
DB_PASSWORD=your_strong_password_here
DB_NAME=payment_tracker
```

Save and close the file.

### Step 4 — Start the app

```bash
docker-compose up -d
```

First run takes **1–2 minutes** — Docker downloads base images, builds the app, and sets up the database. You'll see a lot of output. When it finishes and returns to the prompt, open your browser to **http://localhost:3000**.

Subsequent starts take only a few seconds.

---

## First-time setup — Windows

### Step 1 — Install Docker Desktop

1. Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
2. Click **"Download for Windows"**
3. Run the downloaded installer (`Docker Desktop Installer.exe`)
4. On the install options screen:
   - ✅ Keep **"Use WSL 2 instead of Hyper-V"** checked (recommended)
   - ✅ Keep **"Add shortcut to desktop"** checked
5. Click **OK** and wait for installation to complete
6. Click **Close and restart** — your PC will reboot
7. After reboot, Docker Desktop launches automatically
8. Click **Accept** on the license agreement
9. Wait for the taskbar icon to show a steady whale — when the status says **"Engine running"**, Docker is ready

> **Check it worked:** Open Command Prompt and run `docker --version` — you should see a version number.

> **WSL 2 prompt:** If Windows asks you to install a WSL 2 kernel update, click the link, download and run the update, then restart Docker Desktop.

### Step 2 — Get the project

If you received a zip file:
- Right-click the zip → **Extract All**
- Choose a location like `C:\Projects\payment-tracker`
- Open **Command Prompt** or **PowerShell** and navigate there:

```powershell
cd C:\Projects\payment-tracker
```

If you're cloning from git:
```powershell
git clone https://github.com/swarup1234/payment-tracker-local.git
cd payment-tracker-local
```

### Step 3 — Configure your password

```powershell
copy .env.example .env
notepad .env
```

Change `changeme` to a real password:
```env
DB_USER=postgres
DB_PASSWORD=your_strong_password_here
DB_NAME=payment_tracker
```

Save (`Ctrl+S`) and close Notepad.

### Step 4 — Start the app

```powershell
docker-compose up -d
```

First run takes **1–2 minutes** — Docker downloads base images, builds the app, and sets up the database. When it finishes and returns to the prompt, open your browser to **http://localhost:3000**.

Subsequent starts take only a few seconds.

---

## Check it's running

Once started, open these URLs in your browser:

| URL | What it is |
|---|---|
| http://localhost:3000 | The PayTracker app |
| http://localhost:8080 | Adminer — database browser |

**Adminer login details:**
- System: `PostgreSQL`
- Server: `db`
- Username: value of `DB_USER` in your `.env` (default: `postgres`)
- Password: value of `DB_PASSWORD` in your `.env`
- Database: `payment_tracker`

**Prefer a desktop DB client instead of Adminer?** Connect tools like TablePlus, DBeaver, or pgAdmin to `localhost:5432` using the same `DB_USER`/`DB_PASSWORD`/`DB_NAME` values from your `.env` — `docker-compose.yml` publishes Postgres's port to your host machine, so any Postgres client works.

---

## Daily usage

### Start the app
```bash
docker-compose up -d
```

### Stop the app (keeps all your data)
```bash
docker-compose down
```

### Restart a single service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### View logs
```bash
docker-compose logs -f            # all services
docker-compose logs -f backend    # backend only
docker-compose logs -f frontend   # nginx/frontend only
```

### Check container status
```bash
docker-compose ps
```

---

## App features

### Dashboard
Overview of payment activity — pending dues, overdue transactions, and amount collected this month.

### Customers (`/customers`)
- Add, edit, delete customers
- See total pending amount per customer at a glance
- Click any row to open the customer's full transaction history

### Customer Detail (`/customers/:id`)
- View and manage all transactions for a single customer
- Add, edit, delete individual transactions
- Mark transactions as paid (choose cash / bank transfer / online)
- Edit or delete the customer record

### Transactions (`/transactions`)
- View all transactions across all customers
- **Filter by:** status, customer name, service, payment mode, amount range, due date range, paid date range
- **Download CSV** — exports the currently filtered rows
- Edit or delete any transaction

### Bulk Charge (`/bulk-charge`)
- Select multiple customers using checkboxes
- Pick a service, set amount and due date
- Creates one transaction per selected customer in one click
- Shows a live summary (total customers × amount) before you submit

### Services (`/services`)
- Edit service names, default amounts, and billing cycles
- Toggle a service active/inactive (inactive services are hidden when adding transactions)

### Download Backup (sidebar, bottom)
- Downloads **two CSV files** in one click:
  - `paytracker_customers_<date>.csv`
  - `paytracker_transactions_<date>.csv`

**Restoring from a backup:** there's no one-click restore yet — to bring data back from these CSVs, open Adminer (http://localhost:8080), select the `customers` or `transactions` table, and use its **Import** function to load the CSV back in. Restore `customers` before `transactions`, since transactions reference customer IDs.

---

## Updating to a new version

If you received an updated project folder (or pulled from git):

```bash
# Pull latest changes (if using git)
git pull

# Rebuild and restart with new code
docker-compose up -d --build
```

This rebuilds the frontend and backend images with your changes. The database and all your data are untouched.

---

## Privacy note

This app stores real customer names, phone numbers, and payment amounts. Even though `.env` (with your DB password) is excluded from git, the codebase itself may end up describing your customer data model closely. **Keep this repository set to Private on GitHub** — double check under repo Settings → General → Danger Zone if you're ever unsure.

---

## Data safety

Your data lives in a Docker **named volume** (`postgres_data`). This means:

| Action | Data safe? |
|---|---|
| `docker-compose down` | ✅ Yes — data preserved |
| `docker-compose restart` | ✅ Yes |
| Rebooting your computer | ✅ Yes |
| `docker-compose down -v` | ❌ **Deletes all data** — avoid unless intentional |
| Deleting the volume manually | ❌ Deletes all data |

**Recommendation:** use the **Download Backup** button in the sidebar regularly to keep CSV copies of your data.

---

## Schema changes (adding new columns / tables)

The `db/init.sql` file only runs on a **brand new** database (first-ever start). If you need to add columns or tables to an existing running database:

1. Open Adminer at http://localhost:8080
2. Log in (see credentials above)
3. Click **SQL command** and run your `ALTER TABLE` or `CREATE TABLE` statement manually

For a full migration tool, consider `node-pg-migrate` once you're past the prototype stage.

---

## Troubleshooting

### App won't open at localhost:3000
```bash
# Check if containers are running
docker-compose ps

# If any are stopped, check why
docker-compose logs backend
docker-compose logs frontend
```

### "Port already in use" error
Another app is using port 3000 or 8080. Either stop that app, or change the ports in `docker-compose.yml`:
```yaml
frontend:
  ports:
    - "3001:80"   # change 3000 to something else
```

### Database connection error in backend logs
The backend starts before Postgres is fully ready. Docker will auto-restart it — wait 10 seconds and check again:
```bash
docker-compose logs backend
```
If it persists, restart manually:
```bash
docker-compose restart backend
```

### Changes to code not showing up
Rebuild the images:
```bash
docker-compose up -d --build
```

### Want to wipe everything and start fresh
```bash
# WARNING: deletes all data
docker-compose down -v
docker-compose up -d
```

---

## Project structure

```
payment-tracker/
├── docker-compose.yml        # Defines all 4 services
├── .env.example              # Copy to .env and set your password
├── .env                      # Your local config (never commit this)
│
├── db/
│   └── init.sql              # Schema + seed data (runs on first start)
│
├── backend/
│   ├── Dockerfile            # Node 20 Alpine image
│   ├── package.json
│   └── index.js              # Express API — all routes
│
└── frontend/
    ├── Dockerfile            # Multi-stage: Node build → nginx serve
    ├── nginx.conf            # Serves static files, proxies /api to backend
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx           # Routes
        ├── api.js            # All API call functions
        ├── utils.js          # formatCurrency, formatDate, helpers
        ├── components/       # Shared UI components
        └── pages/            # One file per page/route
```

---

## What's not in this version (planned for later)

- **Authentication** — no login/password yet; fine for local network use, not safe to expose to the internet as-is
- **Razorpay / online payment gateway** — parked for later
- **SMS reminders** (MSG91/Gupshup) — parked for later
- **Automated migration tool** — use Adminer for manual schema changes for now

---

## License

Private/internal use only — not licensed for redistribution.
