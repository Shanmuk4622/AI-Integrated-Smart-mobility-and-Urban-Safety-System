# Smart Mobility & Urban Safety System 🚦

> **AI-Powered Traffic Management & Safety Platform**

Detailed project documentation is available in [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md).

## 📂 Directory Structure

| Directory | Description |
| :--- | :--- |
| **[`frontend/`](./frontend)** | React Dashboard (Public Map + Admin Panel). |
| **[`worker/`](./worker)** | Python Edge AI Nodes (YOLOv8 + Supabase). |
| **[`database/`](./database)** | SQL Schemas and Migration Scripts. |
| **[`scripts/`](./scripts)** | Utility batch scripts for installation/setup. |
| **[`docs/`](./docs)** | detailed documentation and guides. |
| **[`legacy/`](./legacy)** | Archive of old backend/server code. |

## 🚀 Quick Start

### 1. Start a Worker (Edge Node)
```powershell
.\run_worker.bat
```

### 2. Start the Dashboard
```powershell
cd frontend
npm run dev
```

### 3. Setup / Admin Access
See [database/README.md](./database/README.md) for initializing the database and creating admin users.
