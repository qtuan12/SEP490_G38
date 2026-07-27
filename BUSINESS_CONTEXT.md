# BPG-CMS Business Context

> Purpose: this file describes the business scope, actors, workflows, and rules of BPG-CMS.  
> It is written from a business perspective only, not from a technical/code perspective.

---

## 1. Business Overview

BPG-CMS is an internal construction management system for a small or medium construction company. The system helps the company manage construction projects from planning to execution, site progress tracking, material control, procurement coordination, incident handling, phase acceptance, and management reporting.

The system is designed for internal staff such as Admin, Director, Technical Manager, Project Leader, Site Engineer, and Accountant. It does not serve customers, subcontractor portals, public users, or external suppliers directly.

The business goal is to reduce scattered manual tracking through spreadsheets, messaging apps, paper delivery notes, and separated progress reports. BPG-CMS centralizes project execution information, evidence photos, daily progress, material usage, inventory movement, and approval status in one internal system.

---

## 2. Business Scope

### 2.1 Included Business Areas

BPG-CMS covers the following business areas:

- User account and role management.
- Company/system configuration and branding information.
- Project creation, project member management, and project status tracking.
- Work Breakdown Structure management, including phases, tasks, task assignments, dependencies, and progress.
- Daily construction logs with progress updates, evidence photos, and comments.
- Phase acceptance and acceptance record generation.
- Construction and inventory incident management.
- Material master data, including categories, materials, units, conversions, and suppliers.
- Bill of Quantity management by project phase.
- Material request workflow.
- Purchase order workflow.
- Goods receipt workflow.
- Material issuance workflow.
- Material return workflow.
- Current project inventory and inventory transaction history.
- Inventory adjustment workflow.
- Direct purchase request workflow.
- Surplus material handling, including return to supplier, transfer, and liquidation.
- Notifications and project activity updates.
- Executive dashboards and project reports.

### 2.2 Excluded Business Areas

BPG-CMS does not cover:

- Customer portal or customer quotation management.
- Customer payment, receivables, debt collection, VAT declaration, or formal accounting books.
- Payroll, labor attendance, subcontractor payroll, or detailed labor cost calculation.
- Full supplier contract lifecycle or supplier payment settlement.
- Central physical warehouse operation with barcode, RFID, IoT, or automatic stock counting.
- Native mobile application.
- Offline field operation and automatic background synchronization.
- AI forecasting or automatic decision-making.
- Legal responsibility for matching physical stock and system stock.

---

## 3. Business Actors

| Actor | Business Responsibility |
|------|--------------------------|
| **Admin** | Manages internal users, roles, account status, master data, and system-level setup. |
| **Director** | Oversees all projects, reviews executive dashboards/reports, and approves high-impact requests or exceptions. |
| **Technical Manager** | Manages technical planning, projects, WBS, phase/task structure, phase acceptance, drawings, progress control, and technical decisions. |
| **Project Leader** | Manages day-to-day project execution, project members, task assignment, material requests, goods receipt, material issuance, returns, and site inventory. |
| **Site Engineer** | Performs field reporting, creates Daily Logs, updates assigned task progress, uploads progress evidence, and discusses work through comments. |
| **Accountant** | Handles procurement-related checking, purchase orders, material request review, supplier/procurement records, direct purchase audit, and inventory financial references. |

---

## 4. Project Management Business

### 4.1 Project Lifecycle

A project represents one construction work package managed by the company. It contains project information, members, drawings, phases, tasks, material planning, inventory records, incidents, and reports.

Typical project lifecycle:

```text
Draft -> In Progress -> Paused -> Completed -> Closed
```

Business rules:

- A draft project can be prepared before execution starts.
- An active project allows work tracking, Daily Logs, material transactions, and reporting.
- A paused project restricts normal execution activities.
- A completed or closed project should no longer accept normal new execution records unless a specific business process allows correction or archival action.
- Project members determine who can view or act on project-level data.
- Each project should have a responsible Project Leader at a time.

### 4.2 Project Member Management

Project members are internal users assigned to a project. Their project role affects what they can see and do inside that project.

Business rules:

- Users outside a project should not perform project-specific actions unless they have a global management role.
- Removing a member should not delete historical records created by that member.
- Task assignment and Daily Log ownership must remain traceable even if a member is later removed.

### 4.3 Design Drawing Access

Project drawings are supporting documents used by project staff during execution.

Business rules:

- Drawings are attached to projects.
- Field and management users can view drawings according to project access rights.
- Drawing update is a controlled project management action, not a Daily Log action.

---

## 5. WBS, Phase, and Task Business

### 5.1 WBS Tree

The WBS tree breaks a project into phases and tasks. It is the main structure used to plan work, assign responsibility, track progress, and connect Daily Logs to actual site activities.

Business rules:

- A phase groups related tasks.
- A task may have child tasks.
- Leaf tasks are the normal execution units for Daily Logs and progress updates.
- Parent tasks mainly aggregate progress from child tasks.
- Obsolete tasks are excluded from normal progress calculation.
- Task ordering and hierarchy must remain consistent for project planning and reporting.

### 5.2 Phase Lifecycle

Typical phase lifecycle:

```text
Draft -> In Progress -> Completed -> Approved
```

Business rules:

- A phase can be accepted only when its active tasks are completed according to business requirements.
- An approved phase becomes frozen for normal editing.
- Phase acceptance creates a formal acceptance record for archive and review.
- Cancelling or reversing phase acceptance requires a controlled business reason.

### 5.3 Task Lifecycle

Typical task lifecycle:

```text
New -> Assigned -> In Progress -> Completed -> Approved
```

Special state:

```text
Obsolete
```

Business rules:

- A task should have a clear time range, responsible assignee, and progress value.
- Task progress is updated through Daily Logs or authorized progress adjustment.
- A task can be marked obsolete when it is no longer part of the valid execution plan.
- Dependencies show that one task depends on another task before it can be executed or completed.
- Parent task progress is recalculated from child tasks.

### 5.4 Task Assignment

Task assignment connects users to work items.

Business rules:

- Assigned users can follow work relevant to them.
- Site Engineers normally report progress for assigned or related tasks.
- Assignment history and task progress must remain understandable for later review.

---

## 6. Daily Log and Comment Business

### 6.1 Daily Log

Daily Logs are the main field reporting record. They capture what happened on site, progress changes, and evidence photos.

Business purpose:

- Record daily construction progress.
- Attach field evidence photos.
- Update task progress.
- Support later review of who reported what and when.
- Provide an activity stream for project stakeholders.

Business rules:

- A Daily Log should be linked to a project and normally to a specific executable task.
- Leaf task Daily Logs are the most detailed execution records.
- Parent task or project-level views may aggregate or filter Daily Logs.
- Daily Log progress updates must respect task and phase status.
- Accepted/frozen phases should not accept normal Daily Log progress updates.
- Evidence photos support, but do not replace, the text description and progress value.
- Daily Log updates should notify relevant project users.

### 6.2 Daily Log Comment

Comments allow project users to discuss a Daily Log.

Business rules:

- Only authorized project users can comment on a Daily Log.
- A user can update or delete their own comment under allowed conditions.
- Comments should keep the discussion tied to the related Daily Log.
- Relevant users may receive notifications when a new comment is added.

### 6.3 PWA Field Use for Daily Logs

The planned PWA field mode focuses on lightweight field reporting.

Included field activities:

- View basic project/task context.
- Create or edit Daily Logs.
- Capture or select progress photos.
- View Daily Log feed.
- Add/view comments.
- View in-app notifications.

Excluded from PWA field mode:

- Incident reporting.
- Material/procurement transactions.
- BOQ/material grids.
- WBS editing and Gantt editing.
- Dashboards and reports.

Business reason:

Daily Log reporting is lightweight and field-friendly, while material/procurement/incident workflows require many fields, review steps, and data grids that are safer on desktop.

---

## 7. Phase Acceptance Business

Phase acceptance records that a phase has been reviewed and accepted.

Business purpose:

- Confirm that phase work is completed.
- Create a formal acceptance record.
- Freeze the accepted phase from normal execution edits.
- Support management review and archival.

Business rules:

- A phase can be accepted only by authorized roles.
- All required active work under the phase must be completed before acceptance.
- Acceptance result and evidence must be stored for future reference.
- Once accepted, normal users should not freely edit the accepted phase or its completed execution records.

---

## 8. Incident Business

Incidents record abnormal events affecting construction progress, safety, quality, inventory, or project execution.

### 8.1 Construction Incident

Business purpose:

- Record site events that affect work quality, progress, safety, or rework.
- Support assessment and recovery planning.
- Provide traceability for decisions such as rework or progress adjustment.

Business rules:

- Incidents must include enough information for review.
- Incident resolution should be handled by authorized roles.
- Incident-related progress correction must be traceable.

### 8.2 Inventory Incident

Business purpose:

- Record stock loss, damage, mismatch, or material-related abnormal events.
- Support inventory adjustment decisions.

Business rules:

- Inventory loss should not silently change stock.
- Stock decrease due to incident must go through an authorized adjustment or equivalent controlled flow.
- Evidence and review status must be traceable.

---

## 9. Master Data Business

### 9.1 Material Category

Material categories group materials for easier searching, filtering, and reporting.

Business rules:

- Category names/codes should be unique enough for users to avoid confusion.
- Categories in use should not be physically removed in a way that breaks historical records.

### 9.2 Unit

Units define how material quantities are measured.

Business rules:

- Unit codes should be unique.
- Units may be discrete or non-discrete depending on whether fractional quantities are allowed.
- Unit setup affects material quantity input and conversion.

### 9.3 Material Catalog

The material catalog stores official materials used in BOQ, requests, procurement, and inventory.

Business rules:

- Material code must be unique.
- Each material has a base unit.
- Materials used in historical transactions must remain traceable.

### 9.4 Material Conversion

Material conversion defines how alternative units map to a material base unit.

Business rules:

- Conversion is material-specific.
- Conversion rate must be positive.
- Conversion affects request, procurement, receipt, issuance, and report quantities.

### 9.5 Supplier

Suppliers represent external vendors used for procurement.

Business rules:

- Supplier information supports purchase order and direct purchase workflows.
- Supplier relationship health is used as reference information, not as automatic supplier blocking.
- Suppliers used in procurement history should remain traceable.

---

## 10. BOQ and Material Request Business

### 10.1 BOQ

BOQ defines planned material quantity for a project phase.

Business purpose:

- Control planned material consumption.
- Compare requested/used material against planned quantity.
- Support over-BOQ review.

Business rules:

- BOQ items are tied to phases and materials.
- BOQ quantity is used as a business reference for material requests and reports.
- Updating BOQ should be controlled because it affects planning and over-BOQ evaluation.

### 10.2 Material Request

Material Request is the business process for requesting materials needed by the project.

Typical lifecycle:

```text
Draft -> Pending / Waiting Approval -> Approved / Rejected / Cancelled
```

Business rules:

- Requests should identify project, requester, needed materials, quantities, and reason/context.
- Requests may be classified as within BOQ or over BOQ.
- Within-BOQ and over-BOQ requests may require different review paths.
- Rejected or cancelled requests must not create purchase orders or stock changes.
- Approved requests can become procurement input.

---

## 11. Procurement Business

### 11.1 Purchase Order

Purchase Orders formalize purchasing from suppliers.

Typical lifecycle:

```text
Draft -> Sent -> Partially Received -> Fully Received -> Closed / Cancelled
```

Business rules:

- A Purchase Order contains one or more order items.
- A Purchase Order should reference supplier and project procurement context.
- Purchase quantity must remain traceable after goods are received.
- Received quantities affect PO status.
- A PO that already has received goods cannot be treated as a clean unused order.

### 11.2 Goods Receipt

Goods Receipt records actual materials received at the project site.

Typical lifecycle:

```text
Draft -> Approved -> Cancelled
```

Business rules:

- Goods Receipt increases project inventory.
- Received quantity must not exceed valid remaining PO quantity.
- Delivery/bill/evidence photos may be attached.
- Cancellation must reverse or compensate the inventory effect with traceability.
- Goods Receipt information is important for procurement, inventory, and reporting.

### 11.3 Direct Purchase

Direct Purchase supports urgent purchasing when waiting for the normal procurement workflow may delay field execution.

Typical lifecycle:

```text
Draft -> Approved / Rejected
```

Audit lifecycle:

```text
Pending Audit -> Audited / Rejected
```

Business rules:

- Direct Purchase should be used only for urgent or justified situations.
- Direct Purchase requires purchase item details and supporting evidence.
- Accountant audit provides post-check control.
- Any stock effect from direct purchase must remain traceable through inventory records.

---

## 12. Inventory Business

### 12.1 Current Inventory

Current Inventory shows current material stock for each project.

Business rules:

- Inventory is tracked by project, material, and unit.
- Current stock must not become negative.
- Inventory must reflect approved stock-changing operations.
- Current Inventory is a summary; the transaction history explains how the balance was formed.

### 12.2 Inventory Transaction History

Inventory Transaction History is the ledger of stock movements.

Business rules:

- Every stock-changing operation must create a history record.
- A history record must show material, project, transaction type, quantity change, reference document, and balance after.
- History records should not be edited as ordinary user data.
- Inventory reports must rely on this traceability.

### 12.3 Material Issuance

Material Issuance records materials taken from project inventory for construction work.

Business rules:

- Material Issuance decreases project inventory.
- Issuance must not exceed available stock.
- Issuance should reference project/task/business context.
- Issuance must create inventory transaction records.

### 12.4 Material Return

Material Return records unused or returned materials coming back to project inventory.

Business rules:

- Material Return increases project inventory.
- Returned quantity must be valid and traceable.
- Return reason/evidence may be recorded depending on business context.
- Material Return must create inventory transaction records.

### 12.5 Inventory Adjustment

Inventory Adjustment corrects inventory under controlled conditions.

Typical lifecycle:

```text
Draft -> Pending -> Approved / Rejected
```

Business rules:

- Increase and decrease adjustments have different business risk.
- Decrease adjustments require stricter review.
- Approved adjustments change inventory.
- Rejected adjustments must not change inventory.
- Adjustments must be traceable through inventory transaction history.

### 12.6 Surplus Material Handling

Surplus handling manages remaining materials that are no longer needed for the current project.

Main actions:

```text
Return to Supplier
Transfer to Another Project
Liquidate
```

Business rules:

- Surplus actions are based on current project inventory.
- Return to supplier decreases current project inventory.
- Transfer decreases source project inventory and increases target project inventory after receipt.
- Liquidation decreases current project inventory.
- Each completed surplus action must be traceable.

---

## 13. Notification Business

Notifications keep users aware of business events that require attention or are relevant to their work.

Examples:

- New Daily Log.
- New comment.
- Progress update.
- Material request update.
- Purchase/procurement update.
- Incident update.
- Inventory adjustment update.
- Surplus handling update.

Business rules:

- Notifications should target relevant users, not every user by default.
- Notifications should include enough context for users to navigate to the related business record.
- In-app realtime notification is supported while users are connected.
- OS-level push notifications are outside the current scope.

---

## 14. Reporting Business

BPG-CMS supports management reporting for project visibility.

Report groups:

- Executive dashboard.
- Project construction progress report.
- BOQ vs actual material report.
- Incident summary report.
- Inventory ledger report.
- Procurement and cost reference report.
- Portfolio dashboard across projects.

Business rules:

- Reports should be read-only.
- Reports should summarize existing business records rather than create new business actions.
- Report values are management references, not formal accounting books.

---

## 15. Critical Business Rules

These rules are especially important and must not be broken:

1. Users can only perform actions allowed by their role and project relationship.
2. Project-specific actions require project access unless the user has a valid global management role.
3. Daily Logs are execution evidence and should remain connected to project/task progress.
4. Leaf tasks are the normal target for Daily Log progress updates.
5. Parent task and phase progress must stay consistent with child task progress.
6. Accepted/frozen phases are read-only for normal execution updates.
7. Material request approval must happen before it becomes valid procurement input.
8. Goods Receipt increases inventory.
9. Material Issuance decreases inventory.
10. Material Return increases inventory.
11. Inventory decrease must not make stock negative.
12. Every stock-changing business operation must be traceable in inventory transaction history.
13. Goods received from a Purchase Order must not exceed remaining order quantity.
14. Cancelled/rejected business documents must not create final stock effects.
15. Inventory adjustment must be approved before it changes stock.
16. Surplus return/transfer/liquidation must be reflected in inventory history.
17. Historical business records must remain traceable even if master data or users are later deactivated/deleted.
18. Passwords and security details are not business data and must never be exposed to users.
19. Raw technical errors must not be shown to end users.
20. PWA field mode is limited to lightweight Daily Log, comments, notifications, and basic task information.

---

## 16. Business Writing Rules for Documentation

When writing system documentation:

- Use business terms such as project, phase, task, Daily Log, goods receipt, material issuance, material return, inventory ledger.
- Avoid code terms such as handler, repository, DTO, entity class, database context, service method, or API route unless the document is technical.
- Always mention the actor/role when describing who can perform an action.
- Always separate normal cases from abnormal or rejected cases.
- Do not claim unsupported business scope such as accounting, customer portal, native mobile app, offline sync, or OS-level push notification.
- For mobile/PWA descriptions, state clearly that only lightweight field reporting is included.

