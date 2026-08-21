# BPG-CMS

**Construction Progress and Site Material Control System for Bui Phu Gia Investment and Construction Company Limited**

[![Backend](https://img.shields.io/badge/backend-.NET%208-512BD4)](BPG_CMS_BE)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-149ECA)](BPG_CMS_FE)
[![Database](https://img.shields.io/badge/database-SQL%20Server-CC2927)](docker-compose.yml)
[![Architecture](https://img.shields.io/badge/architecture-Clean%20Architecture%20%2B%20CQRS-1F6FEB)](#architecture)
[![CI](https://img.shields.io/badge/CI-build%20%2B%20test-success)](.github/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-yellow)](LICENSE)

> SEP490 Capstone Project, FPT University, Group 38.

**Live application:** [https://buiphugia.io.vn](https://buiphugia.io.vn)

## 1. Project at a Glance

BPG-CMS is an internal web application built for a small Vietnamese construction contractor that operates multiple project sites without a central warehouse. Before digitization, project progress, photographs, material requests, approvals, delivery records, and stock balances were distributed across Zalo messages, Excel files, paper forms, and individual staff members.

The system provides one traceable operational flow from project planning to site execution:

```text
Project and BOQ
    -> Phases, WBS and assignments
    -> Daily Logs, progress and incidents
    -> Material requests and procurement
    -> Goods receipts and site inventory
    -> Task-specific issuance and unused-material return
    -> Reconciliation, surplus handling, reports and phase acceptance
```

The target company context used to shape the product is approximately 20-30 regular personnel, 6-12 projects per year, direct supplier delivery to project sites, and no centralized warehouse. These figures are customer-provided operating estimates for requirements analysis, not audited financial statements.

## 2. Product Objectives

BPG-CMS is designed to:

- create a single source of truth for project, progress, material, approval, and incident records;
- connect site evidence and Daily Logs to WBS task progress;
- control material planning and procurement against phase BOQ quantities;
- maintain current inventory together with an append-only operational movement history;
- preserve traceability from original documents to stock-changing operations;
- provide role-appropriate dashboards, notifications, and management reports;
- remain practical for a small company with non-technical office and site users.

### Review-Driven Refinement

Following the first product review, the team refined the capstone in four concrete ways: management workflows were modeled against the company's actual actor and approval responsibilities; the defense seed was rebuilt as a deterministic, end-to-end construction dataset; incident management was expanded to cover major events, emergency stopping, recovery planning, and inventory loss; and the MVP boundary was made explicit so the project remains focused on progress and site-material control rather than attempting to become a full ERP.

## 3. Main Business Workflows

### 3.1 Project Planning, Execution and Phase Acceptance

The Technical Manager creates a project, phases, WBS tasks, dependencies, assignments, and phase BOQ. Site Engineers record Daily Logs with progress and site evidence. Parent task and phase progress are rolled up from child work. Once all active tasks are complete, the Technical Manager can create an internal phase acceptance record and the system generates a PDF.

### 3.2 Material Request and Procurement

Project staff raise material requirements in the context of a project phase. The system checks requested quantities against the BOQ and routes the request through the applicable review path. Approved demand becomes procurement input; Purchase Orders require supplier, price, delivery, item, and quotation evidence before Director approval and supplier delivery.

Urgent purchases that have already occurred on site use the separate **Direct Purchase** workflow. Submission records the goods and inventory effect immediately, while Accountant audit and Director approval control reimbursement.

### 3.3 Site Inventory Fulfilment and Reconciliation

Goods Receipts increase project-site inventory against an approved Purchase Order. A Project Leader issues available material to a specific construction task. Unused quantities are returned against the original issuance, preserving item-level traceability and preventing over-return. Every stock change writes an Inventory Transaction containing the movement type, signed quantity, resulting balance, actor, and source reference.

Current Inventory provides stock, reserved and available quantities, BOQ usage by phase, safety warnings, latest supplier information, and Excel export. Approved inventory adjustments reconcile verified physical differences without rewriting transaction history.

### 3.4 Incident and Inventory Loss Handling

The system supports construction, weather, safety, schedule, and material-loss incidents. Review paths depend on severity and business impact. Approved solutions may pause work, create corrective tasks, adjust progress, or initiate a controlled inventory decrease. Emergency-stop and recovery-plan states keep major incidents visible to management.

### 3.5 Surplus Material Management

Remaining project material can be handled through cross-project transfer, return to supplier, or liquidation. Source and destination movements are recorded separately so both sites retain a verifiable stock history. A dedicated report summarizes material returns and surplus actions.

## 4. Roles and Access Model

| Role | Main responsibilities |
| --- | --- |
| Administrator | Accounts, master data, system configuration, and audit support |
| Director | Management visibility and high-risk financial or exception approvals |
| Technical Manager | Projects, WBS, BOQ, technical review, progress correction, incidents, and phase acceptance |
| Accountant | Supplier records, material-request checks, Purchase Orders, receipts, and financial document review |
| Site Engineer | Assigned tasks, Daily Logs, comments, field evidence, and incident reporting |
| Project Leader | Project-level business role for the Site Engineer marked as leader of a specific project |

Authorization is enforced twice:

- **System role authorization** uses JWT role claims and API policies.
- **Project authorization** uses active project membership, task assignment, and the `ProjectMember.IsLeader` business flag.

Frontend visibility improves usability, but backend authorization remains the security boundary.

## 5. Functional Coverage

- Project portfolio, project members, phases, WBS tree, dependencies, assignments, and Gantt chart
- Phase BOQ and material/unit conversion management
- Daily Logs, site images, comments, progress history, and realtime updates
- Incident reporting, review, emergency stop, recovery planning, and corrective work
- Material Requests, BOQ checks, Purchase Orders, quotation attachments, and Direct Purchases
- Goods Receipts with partial delivery support and delivery evidence
- Current Inventory, low-stock indicators, phase usage, reservations, and Excel export
- Material Issuance to tasks and Material Return against original issuance
- Inventory increase/decrease adjustments and complete stock movement ledger
- Supplier return, project transfer, liquidation, and surplus reporting
- Executive, progress, BOQ-versus-actual, procurement, incident, inventory, and cost-reference reports
- Database notifications, SignalR realtime refresh, deep links, SMTP email, and Cloudinary file storage
- Responsive field view and installable PWA support for lightweight site operations

## 6. Architecture

### Backend

The backend follows Clean Architecture with CQRS:

```text
HTTP Request
    -> API Controller
    -> MediatR Command or Query
    -> FluentValidation pipeline
    -> Application Handler
    -> IUnitOfWork / Repository
    -> EF Core / SQL Server
    -> ApiResponse<T>
```

```text
BPG.Domain          Entities, base models, domain constants and exceptions
BPG.Application     DTOs, commands, queries, handlers, validators and service contracts
BPG.Infrastructure  EF Core, repositories, seeding, storage, email, PDF and external services
BPG.Api             Controllers, policies, middleware, SignalR hub and application startup
```

Cross-cutting behavior includes global exception handling, correlation IDs, Serilog request logging, soft delete, audit metadata, rate limiting, JWT authentication, project access checks, and database transactions for critical stock operations.

### Frontend

```text
Page / Component
    -> React Query or local interaction state
    -> Typed frontend service
    -> Shared apiClient with JWT and refresh-token handling
    -> REST API
    -> Query invalidation or SignalR DataChanged refresh
```

The frontend uses React Router for navigation, TanStack Query for server state, React Hook Form and Zod for forms, SignalR for realtime events, and shared role/project-access helpers for action visibility.

## 7. Technology Stack

| Area | Technology |
| --- | --- |
| Backend | .NET 8, ASP.NET Core Web API, MediatR, FluentValidation, AutoMapper |
| Persistence | Entity Framework Core 8, SQL Server 2022, Unit of Work and repositories |
| Frontend | React 19, TypeScript 6, Vite 8, React Router 7 |
| State and forms | TanStack Query 5, React Hook Form 7, Zod 4 |
| UI and visualization | Tailwind CSS 4, Lucide React, Recharts, DHTMLX Gantt |
| Realtime | ASP.NET Core SignalR and `@microsoft/signalr` |
| Files and documents | Cloudinary, browser image compression, QuestPDF, ExcelJS, ClosedXML |
| Operations | Docker Compose, Nginx, Serilog, Seq, GitHub Actions |
| Security | JWT access/refresh tokens, BCrypt, role policies, project access checks, rate limiting |

## 8. Repository Structure

```text
SEP490_G38/
|-- BPG_CMS_BE/
|   |-- BPG-CMS.sln
|   |-- src/
|   |   |-- BPG.Domain/
|   |   |-- BPG.Application/
|   |   |-- BPG.Infrastructure/
|   |   `-- BPG.Api/
|   `-- test/BPG.Application.UnitTests/
|-- BPG_CMS_FE/
|   |-- src/
|   |   |-- auth/             Role definitions and route protection
|   |   |-- components/       Shared layout and UI components
|   |   |-- context/          Authentication and notification contexts
|   |   |-- hooks/            Project access and realtime hooks
|   |   |-- pages/            Business screens and workspaces
|   |   |-- services/         Typed API access
|   |   |-- types/            Frontend domain contracts
|   |   `-- utils/            Formatting and business UI helpers
|   `-- package.json
|-- documents/                UAT, defense, code-trace and presentation artifacts
|-- BUSINESS_CONTEXT.md       Authoritative business rules
|-- AI_RULES.md               Engineering conventions for contributors and AI agents
|-- DEPLOYMENT.md             Production deployment guide
|-- docker-compose.yml        Local full-stack environment
`-- docker-compose.prod.yml   Production-oriented deployment
```

## 9. Local Development

### Prerequisites

- .NET 8 SDK
- Node.js 24 and npm 11, matching CI
- SQL Server 2019 or later, or Docker Desktop
- Optional Cloudinary and SMTP credentials for file upload and email flows

### Option A: Infrastructure with Docker, applications locally

Start SQL Server and Seq:

```bash
docker compose up -d db seq
```

Point the locally running API at that SQL Server instance. In PowerShell:

```powershell
$env:ConnectionStrings__DefaultConnection = "Server=localhost,1433;Database=BPGDB;User ID=sa;Password=BPG_CMS_Password2026!;Encrypt=True;TrustServerCertificate=True;"
```

Run the backend:

```bash
cd BPG_CMS_BE
dotnet restore BPG-CMS.sln
dotnet run --project src/BPG.Api --launch-profile https
```

The API starts at `https://localhost:7111`, Swagger at `https://localhost:7111/swagger`, and the health endpoint at `https://localhost:7111/health`.

Create `BPG_CMS_FE/.env` from `.env.example`, then run the frontend:

```bash
cd BPG_CMS_FE
npm ci
npm run dev
```

Default frontend URL: `http://localhost:5173`.

```env
VITE_USE_MOCK_API=false
VITE_API_URL=https://localhost:7111/api
```

### Option B: Full stack with Docker Compose

```bash
docker compose up --build -d
docker compose ps
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5160`
- Seq: `http://localhost:5341`

The development Compose file contains local-only defaults. Use `.env.production.example` and `docker-compose.prod.yml` for deployment; never reuse development passwords in production.

## 10. Database Migration and Demo Seed

Apply migrations manually when running outside Docker:

```bash
cd BPG_CMS_BE
dotnet ef database update --project src/BPG.Infrastructure --startup-project src/BPG.Api
```

Seed a **clean database** and exit:

```bash
dotnet run --project src/BPG.Api -- --seed
```

The deterministic defense seed contains ten projects across Draft, In Progress, Paused, Completed, and Closed states. The main project, `CONG TRINH TAI DAO DUA 3 - VINHOMES OCEAN PARK 2`, contains a coherent lifecycle covering WBS, BOQ, Daily Logs, requests, PO, receipt, issuance, return, incidents, adjustments, Direct Purchase, and notifications.

Seed data is **representative demo data informed by customer workflows**. It is not an accounting export, legal record, real quotation, or audited company dataset.

### Seeded Accounts

All local demo accounts use password `123456`.

| Business use | Account |
| --- | --- |
| Administrator | `admin@bpg.com` |
| Director | `giamdoc@bpg.com` |
| Technical Manager | `tpkt@bpg.com` |
| Accountant | `ketoan@bpg.com` |
| Main-project Project Leader | `leader1@bpg.com` |
| Main-project Site Engineers | `kysu1@bpg.com`, `kysu2@bpg.com` |

Change seeded passwords immediately if a demo environment is publicly accessible.

## 11. Recommended Defense Demo Journey

```text
1. Technical Manager: open the main project, WBS, phase BOQ and task history.
2. Site Engineer: create a Daily Log with evidence and update task progress.
3. Project Leader: review Current Inventory and issue material to a task.
4. Project Leader: return unused material from the original issuance.
5. Project Leader: inspect Inventory Movement History and export Current Inventory.
6. Accountant: create or review procurement and Goods Receipt records.
7. Technical Manager: review an inventory increase adjustment or incident solution.
8. Director: inspect approval context and management reports.
```

Use separate browser profiles or private windows when demonstrating realtime notifications between roles.

## 12. Quality and Verification

Run the same build and test checks used by CI:

```bash
dotnet restore BPG_CMS_BE/BPG-CMS.sln
dotnet build BPG_CMS_BE/BPG-CMS.sln --configuration Release --no-restore
dotnet test BPG_CMS_BE/BPG-CMS.sln --configuration Release --no-build

cd BPG_CMS_FE
npm ci
npm run build
```

Run the frontend lint check separately when preparing a code change:

```bash
cd BPG_CMS_FE
npm run lint
```

The repository also contains project-level Integration Test, System Test, UAT, and usability artifacts prepared for the capstone assessment. Seeded happy-path data does not replace regression testing or production data validation.

## 13. Documentation Map

| Document | Purpose |
| --- | --- |
| [BUSINESS_CONTEXT.md](BUSINESS_CONTEXT.md) | Business actors, lifecycle rules, inventory effects, and scope boundaries |
| [AI_RULES.md](AI_RULES.md) | Coding conventions and change discipline |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment, health check, seed, and backup |
| [UNIT_TEST_GUIDE.md](UNIT_TEST_GUIDE.md) | Backend unit-test conventions |
| [MOBILE_PWA_TESTING_GUIDE.md](MOBILE_PWA_TESTING_GUIDE.md) | PWA and mobile-field verification |
| [Defense Code Trace Guide](documents/BPG_CMS_DEFENSE_CODE_TRACE_GUIDE_VI.md) | Feature-to-code navigation for defense questions |
| [Screen Trace Atlas](documents/BPG_CMS_SCREEN_TRACE_ATLAS_VI.md) | Screen, component, service, endpoint, and handler mapping |
| [End-to-End Demo Data](documents/BPG_CMS_END_TO_END_DEMO_DATA_VI.md) | Prepared business data for a complete demonstration |
| [UAT Content](documents/BPG_CMS_UAT_CONTENT.md) | Customer-oriented acceptance workflows |

## 14. Scope Boundaries

BPG-CMS is an operational construction-control system, not a complete ERP. The current capstone scope intentionally excludes:

- tendering, quotation preparation, and contract lifecycle management;
- formal accounting, VAT declaration, payroll, and payment execution;
- central warehouse logistics, barcode/RFID control, and fleet management;
- advanced supplier relationship scoring;
- AI forecasting and autonomous process decisions;
- native iOS/Android applications and offline data synchronization;
- subcontractor workforce attendance and customer self-service portals.

Reports are management references derived from operational records; they are not statutory accounting books or contractual payment certificates.

## 15. Engineering and Data Integrity Principles

- Controllers delegate business behavior through MediatR commands and queries.
- Backend policies and project membership are authoritative; hidden frontend buttons are not security controls.
- Material conversion rates are resolved from database configuration, not trusted from client payloads.
- Discrete units reject fractional quantities.
- Stock-changing operations must update Current Inventory and write an Inventory Transaction.
- Inventory cannot become negative, and returns cannot exceed their original business quantity.
- Accepted phases are frozen for normal execution changes.
- Soft delete and audit metadata preserve historical traceability.
- Notification and realtime delivery are secondary effects; committed business data remains authoritative.
- Secrets, production connection strings, JWT keys, SMTP passwords, and Cloudinary credentials must never be committed.

## 16. Team

Developed by **SEP490_G38**, FPT University:

- Nguyen Hoang Son, Project Leader
- Hoang Van Duc, Member
- Le Quoc Tuan, Member
- Duong Dinh Cuong, Member
- Nguyen Bao Long, Member
- Nguyen Thanh Tam, Supervisor

## 17. License

This repository is licensed under the [MIT License](LICENSE). Third-party products, libraries, trademarks, customer information, and uploaded content remain subject to their respective licenses and ownership terms.

---

**BPG-CMS: traceable construction progress, controlled site materials, and clearer management decisions in one system.**
