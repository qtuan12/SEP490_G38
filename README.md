# 🏗️ BPG-CMS (BPG Construction Management System)

[![Status](https://img.shields.io/badge/Status-Active-success.svg)]()
[![Backend](https://img.shields.io/badge/Backend-.NET_8.0-blue.svg)]()
[![Frontend](https://img.shields.io/badge/Frontend-React_19_|_TypeScript-cyan.svg)]()
[![Database](https://img.shields.io/badge/Database-SQL_Server-red.svg)]()
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-orange.svg)]()

An internal web-based construction management platform designed for **BPG Investment and Construction Company Limited** (Bùi Phú Gia Co., Ltd) — a small-to-medium general contractor in Northern Vietnam. This system serves as a graduation project for course **SEP490 at FPT University**.

---

## 📝 1. Project Overview

BPG-CMS addresses critical operational inefficiencies in small-to-medium construction businesses. Currently, BPG manages multiple distributed job sites using fragmented communication channels (like Zalo group chats), static Excel spreadsheets, and physical paper logs. This fragmentation typically causes:
* ⚠️ **Material wastage** estimated at **5% per project** due to undocumented losses or uncontrolled surplus.
* ⚠️ **Up to 1-week delays** in approving and purchasing materials.
* ⚠️ **Zero real-time visibility** into site inventory levels or BOQ (Bill of Quantities) consumption.
* ⚠️ Cost calculations and profit/loss reports that are delayed until long after a project ends.

### 🎯 The Solution: BPG-CMS
BPG-CMS provides a **single source of truth** linking daily on-site progress to material control and purchase workflows. It coordinates tasks, tracks material quotas, prevents excess ordering, and provides management with a real-time analytics dashboard.

---

## 📌 2. Core Modules & Features

### 📅 A. Progress & Site Work Management (WBS & Daily Logs)
* **Work Breakdown Structure (WBS):** Phased project decomposition into sequential phases, milestones, and granular tasks.
* **Daily Logging:** Site engineers record progress updates (increase-only metrics) and upload up to 5 on-site photographs as proof of work.
* **Phase Acceptance:** Structured review process leading to formal stage approvals, featuring automatic PDF document generation and a strict 7-day cancellation window.
* **Incident Reports:** Two-stage reporting (Site Engineer $\rightarrow$ Project Leader $\rightarrow$ Technical Manager) for site delays or damage, automatically trigger rework tasks and adjust contingency buffers.

### 📋 B. Project Estimation & Master Data (BOQ)
* **Master Material Catalog:** Unified registration of system-wide materials, conversion units, and dimensions.
* **Bill of Quantities (BOQ):** Upload and manage structural design quantities and itemized material limits for each construction stage.

### 🛒 C. Procurement & Request Workflows (Material Request & PO)
* **Quota-Checked Requests:** Site teams issue Material Requests (MR) which automatically validate against the remaining BOQ quota.
* **Direct Purchases:** Quick-approval workflows for urgent local cash purchases during emergencies, requiring digital receipt uploads.
* **Purchase Orders (PO):** Automatic PO generation for approved material requests, tracking delivery schedules from suppliers.

### 📦 D. Smart Site Inventory & Surplus Management
* **Virtual Site Stock:** No centralized physical warehouse. Inventory is tracked dynamically per project site.
* **Stock Security:** Hard database constraints to prevent negative stock. Every material transaction (receipt, issuance, transfer) is immutable.
* **Surplus Resolution:** End-of-project surplus materials are processed in batches through three optional channels:
  1. *Supplier Return* (with credit invoice tracking)
  2. *Cross-Project Transfer* (site-to-site transit logs)
  3. *Liquidation* (resell for salvage value)

---

## 🚀 3. Technology Stack

### ⚙️ Backend
* **Runtime:** .NET 8.0 (ASP.NET Core Web API)
* **Database ORM:** Entity Framework Core 8 (SQL Server)
* **Architecture:** Clean Architecture + CQRS Pattern (implemented via MediatR)
* **Validation:** FluentValidation integrated directly into the MediatR request pipeline.
* **Exception Handling:** Global Exception Middleware mapping exceptions to standard response types.
* **Interceptors:** Auditable Entity Interceptor for automatic metadata tracking (CreatedAt, CreatedBy, etc.) and Soft Delete handling.

### 🎨 Frontend
* **Runtime:** React 19, TypeScript, Vite
* **Routing:** React Router 7
* **Icons:** Lucide React
* **API Client:** Centered fetch-based `apiClient` mapping JWT Bearer tokens and unwrapping response wrappers.
* **Styling:** Custom Vanilla CSS utilizing systematic HSL variables defined in `index.css` (No Tailwind CSS dependencies to preserve styling control and bundle performance).

---

## 📂 4. Project Structure

```text
SEP490_G38/
├── BPG_CMS_BE/                    # .NET 8.0 Backend
│   ├── BPG-CMS.sln                # Solution File
│   └── src/
│       ├── BPG.Domain/            # Core Domain Entities, Enums, BaseEntity
│       ├── BPG.Application/       # Handlers, Commands/Queries, DTOs, Validators, Wrappers
│       ├── BPG.Infrastructure/    # DbContext, Repositories, Migrations, External Services
│       └── BPG.Api/               # Controllers, Middleware, Configuration (Program.cs)
├── BPG_CMS_FE/                    # React Vite Frontend
│   ├── src/
│   │   ├── components/            # Reusable components (Layout, Modal, Widgets...)
│   │   ├── context/               # AuthContext (JWT Authentication & Roles)
│   │   ├── pages/                 # Page components (Folder-per-Page structure)
│   │   ├── services/              # API Clients (api.ts, authService, etc.)
│   │   ├── styles/                # CSS Stylesheets (index.css with HSL Tokens)
│   │   ├── types/                 # Shared TypeScript interfaces
│   │   ├── App.tsx                # Main entry routing wrapper
│   │   └── main.tsx               # Frontend startup entry point
└── .github/                       # GitHub configurations & CI/CD workflows
```

---

## ⚙️ 5. Installation & Local Setup

### 🗄️ Prerequisites
* **.NET 8.0 SDK** or higher
* **Node.js 18.0** or higher
* **SQL Server 2019+** (Developer/Express Edition)
* **Git**

---

### 🖥️ Step 1: Backend Setup
1. Clone the project and navigate to the backend folder:
   ```bash
   git clone https://github.com/qtuan12/SEP490_G38.git
   cd SEP490_G38/BPG_CMS_BE
   ```
2. Restore all NuGet packages:
   ```bash
   dotnet restore BPG-CMS.sln
   ```
3. Update the Connection String inside `src/BPG.Api/appsettings.json`:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=YOUR_SERVER_NAME;Database=BPG_CMS_DB;Trusted_Connection=True;TrustServerCertificate=True"
   }
   ```
4. Apply migrations to initialize the SQL Server database:
   ```bash
   dotnet ef database update --project src/BPG.Infrastructure --startup-project src/BPG.Api
   ```
5. Run the API project:
   ```bash
   dotnet run --project src/BPG.Api
   ```
   * The API runs locally on: `http://localhost:5160` (HTTP) and `https://localhost:7111` (HTTPS).
   * Swagger documentation is accessible at: `https://localhost:7111/swagger/index.html`.

---

### 💻 Step 2: Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../BPG_CMS_FE
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root of `BPG_CMS_FE` (or duplicate `.env.example`):
   ```env
   VITE_API_URL=http://localhost:5160/api
   VITE_USE_MOCK_API=false
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   * The web application opens locally at: `http://localhost:5173`.

---

## 🔑 6. Seeded Test Accounts

The database is automatically pre-seeded with test accounts representing key operational roles:

| Role | Email | Password | Primary Functions |
|------|-------|----------|-------------------|
| **Admin** | `admin@bpg.com` | `Admin@123` | User accounts, roles, system audits |
| **Technical Manager (TPKT)** | `tpkt@bpg.com` | `Tpkt@123` | Project configuration, WBS, BOQ upload, final incident sign-off |
| **Project Leader (PL)** | `pl@bpg.com` | `Pl@123` | Site-level management, Material Requests, PO reviews, incident routing |
| **Site Engineer (SE)** | `engineer@bpg.com` | `Engineer@123` | Daily Logs, incident reporting, goods receipts, material usage logs |
| **Accountant** | `ketoan@bpg.com` | `Ketoan@123` | BOQ budget compliance checks, Purchase Orders creation |
| **Director** | `giamdoc@bpg.com` | `Giamdoc@123` | System overview, over-quota approvals, surplus disposition authorization |

---

## 🌿 7. Branch Strategy & Git Workflow

All contributors must adhere to the following Git flow guidelines:
1. **Branch Nomenclature:**
   * `main` — Production-ready release code.
   * `develop` — Shared development integration branch.
   * `feature/name-of-feature` — Isolated branches for new features.
   * `fix/name-of-bug` — Isolated bug fix branches.
2. **Branch Merging:**
   * Create a Pull Request (PR) targeting `develop`.
   * PRs must pass the automated GitHub Actions CI Build & Test workflow.
   * Direct pushes to `main` and `develop` branches are strictly prohibited.
3. **Commit Messages:** Use Conventional Commits formatting:
   * *Example:* `feat(wbs): implement interactive gantt chart editing`
   * *Example:* `fix(api): correct negative stock check logic in handler`

---

## 👥 8. Contributors

Developed and maintained by the **SEP490_G38** project team at FPT University:
* **Nguyễn Hoàng Sơn** (Project Leader) – [sonnhhe186392@fpt.edu.vn](mailto:sonnhhe186392@fpt.edu.vn)
* **Team Members** – SEP490 Graduation Group 38

---

## 📄 9. License

This project is proprietary and confidential.  
© 2025 BPG Investment and Construction Company Limited & SEP490_G38 Team. All rights reserved.
