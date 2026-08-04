# Screen Descriptions

This document provides detailed screen descriptions for the application, mapping visual components and screens to their respective function types, triggers, descriptions, and detailed functional rules.

---

## 3.2. Common Components

### 3.2.1. Internal Header

**Function type:** Header component (global persistent layout)

**Function trigger:** Rendered automatically at the top of the viewport on all authenticated application routes.

**Function description:** Provides persistent application header navigation, system branding, global search, real-time unread notification drawer, and user profile management menu. Actors include all logged-in roles (Director, Technical Manager, Accountant, Project Leader, Site Engineer, Admin).

**Function Details**

**Interface and data**
- Displays BPG CMS system logo and title, linking back to main dashboard overview.
- Renders global search bar for searching projects, materials, and purchase orders.
- Shows dynamic breadcrumb trail reflecting active route hierarchy.
- Displays notification bell icon with real-time unread counter badge.
- Renders user profile card displaying user avatar, display name, and active role badge.

**Data processing**
- Fetches active user profile info and unread notification counts from backend services.
- Connects to Notification WebSocket/SignalR hub to push real-time alerts.
- Marks notifications as read upon clicking notification items.

**Validation and business rules**
- Profile avatar falls back to default initials icon if profile image is missing.
- Logout clears session tokens, resets query cache, and redirects to login page.

**Normal cases**
- Users view unread notifications, click notification items to navigate to target pages, search entities, or log out.

**Abnormal cases**
- Server connection drop displays notification connection warning icon and falls back to polling.

---

### 3.2.2. Navigation Sidebar

**Function type:** Sidebar component (global persistent navigation)

**Function trigger:** Rendered automatically on the left side of main workspace layouts upon login.

**Function description:** Provides main module navigation menu for switching between system features. Renders role-based menu options dynamically based on logged-in user permissions. Actors include all system roles.

**Function Details**

**Interface and data**
- Renders navigation links for Dashboard, Projects, Daily Logs, Inventory Adjustments, Incidents, Reports, Procurement, User Management, and System Settings.
- Displays collapse/expand toggle button at the bottom of the sidebar.
- Highlights active menu item based on current browser path.

**Data processing**
- Evaluates user role permissions against route access policies.
- Persists collapsed/expanded sidebar state in local browser storage.

**Validation and business rules**
- Admin and Technical Manager see management tools (User Management, System Config).
- Site Engineers see site execution menus (Projects, Daily Logs, Incidents).
- Direct access to unauthorized routes triggers redirect to Access Denied page.

**Normal cases**
- Users click sidebar items to navigate between main application modules smoothly.

**Abnormal cases**
- Network failure during navigation displays route fallback error boundary.

---

### 3.2.3. Project Detail Header

**Function type:** Contextual header component (embedded project workspace)

**Function trigger:** Projects → select a project. Rendered at top of project detail pages.

**Function description:** Contextual project header displaying project code, name, status, site location, timeline dates, overall progress bar %, and action buttons to change status or open reports. Actors include Project Leader, Technical Manager, Accountant, Director, Admin.

**Function Details**

**Interface and data**
- Back button navigates to project directory list.
- Displays project title, site address, start date, target end date, and status badge (Draft, In Progress, Paused, Completed).
- Displays pause reason alert box when project status is Paused.
- Displays action buttons for status transitions: Activate, Pause, Resume, Complete, Edit Project.
- Tab bar switches between WBS, Daily Logs, Members, Material Control, Stocktake, Incidents, Surplus, Orders.

**Data processing**
- Loads project detail data via backend project endpoints.
- Calculates overall project progress % from active WBS tasks.
- Listens to SignalR `ProjectUpdated` events to refresh header state automatically.

**Validation and business rules**
- Project Leader can activate Draft projects, pause active projects, or resume paused projects.
- "Complete" button is disabled if overall progress % < 100%.
- Paused project shows pause reason alert banner.

**Normal cases**
- Switching workspace tabs, pausing/resuming projects, opening project BOQ/cost reports.

**Abnormal cases**
- Invalid project ID returns Not Found error state.

---

## 3.10. Dashboard Module

### 3.10.1. Dashboard Screen (Dynamic by Role)

#### 3.10.1.1. Dashboard for Director & Admin

**Function type:** Screen (main overview page)

**Function trigger:** Navigation to Dashboard upon login as Director or Admin.

**Function description:** High-level executive dashboard showing total active projects, pending material requests, system stats, project progress list, status pie chart, and system-wide task risk warnings. Actors include Director, Admin.

**Function Details**

**Interface and data**
- Metric cards for Active Projects, Pending Over-BOQ Requests, Paused/Closed Projects, Total Staff.
- Progress list of active and paused projects with completion progress bars.
- Doughnut chart showing project status distribution.
- System-wide risk alert table listing delayed/critical tasks across all projects.

**Data processing**
- Calls aggregate endpoints for director stats and global risk alerts.
- Ranks project progress list by completion percentage.

**Validation and business rules**
- Restricted to Director and Admin roles.
- Over-BOQ requests card highlights count of requests exceeding design limits in red.

**Normal cases**
- Executive reviews system performance, clicks project rows to open WBS, or inspects critical risk alerts.

**Abnormal cases**
- Empty system data displays empty state illustration.

---

#### 3.10.1.2. Dashboard for Technical Manager

**Function type:** Screen (main overview page)

**Function trigger:** Navigation to Dashboard upon login as Technical Manager.

**Function description:** Focuses on technical WBS progress tracking, risk/delay warnings needing technical review, and quick links to BOQ limit settings. Actors include Technical Manager.

**Function Details**

**Interface and data**
- Metric cards for Active Projects, WBS Delay Warnings, Paused Projects, Technical Staff.
- Technical project progress list with progress bars.
- Detailed task risk warning table showing overdue tasks needing technical reassignment.
- Quick action panel with links to BOQ limits and project list.

**Data processing**
- Fetches technical metrics via backend APIs.
- Queries tasks with status Delayed or AtRisk.

**Validation and business rules**
- Clicking a risk warning row navigates directly to that task's location in the WBS workspace.

**Normal cases**
- Technical Manager monitors delay warnings, clicks task rows to open WBS workspace and reassign engineers.

**Abnormal cases**
- No assigned projects displays default guidance card.

---

#### 3.10.1.3. Dashboard for Accountant

**Function type:** Screen (main overview page)

**Function trigger:** Navigation to Dashboard upon login as Accountant.

**Function description:** Cost control dashboard displaying pending material requests queue, cost-monitored project list, status breakdown chart, and procurement shortcuts. Actors include Accountant.

**Function Details**

**Interface and data**
- Metric cards for Pending Material Requests (highlighting over-BOQ count), Active Projects, Paused Projects, System Staff.
- Progress list of projects under cost control.
- Project status distribution chart.
- Quick action shortcuts to Suppliers, Purchase Orders, Material Categories, and Material Catalog.

**Data processing**
- Queries pending material requests and accountant summary metrics.

**Validation and business rules**
- Over-BOQ material requests are flagged for accountant verification.

**Normal cases**
- Accountant reviews pending material requests queue and accesses purchasing shortcuts.

**Abnormal cases**
- Zero pending requests displays empty queue placeholder.

---

#### 3.10.1.4. Dashboard for Project Leader

**Function type:** Screen (main overview page)

**Function trigger:** Navigation to Dashboard upon login as Project Leader.

**Function description:** Operational dashboard for a selected project managed by PL, featuring project switcher dropdown, task completion stats, phase progress chart, status breakdown, and delayed task list. Actors include Project Leader.

**Function Details**

**Interface and data**
- Project selector dropdown listing assigned projects.
- Metric cards for Task Progress, Overdue Tasks (Red), At-Risk Tasks (Yellow), Over-BOQ Materials.
- Horizontal bar chart of progress per Phase (Green >=80%, Blue >=40%, Yellow <40%).
- Task status breakdown doughnut chart.
- Critical task attention table listing Task Name, Phase, Progress %, Deadline, Assignee.

**Data processing**
- Fetches PL project list and switches active project context dynamically.

**Validation and business rules**
- Clicking a task in the attention table opens its daily log timeline drawer.

**Normal cases**
- PL switches between managed projects, inspects phase progress bars, and addresses overdue tasks.

**Abnormal cases**
- PL with no assigned projects displays assignment request message.

---

#### 3.10.1.5. Dashboard for Site Engineer

**Function type:** Screen (main overview page)

**Function trigger:** Navigation to Dashboard upon login as Site Engineer.

**Function description:** Site execution dashboard highlighting assigned tasks, delayed items, material overrun alerts, and quick links for daily logging and incident reporting. Actors include Site Engineer.

**Function Details**

**Interface and data**
- Project selector dropdown for assigned projects.
- Metric cards for Project Progress %, Overdue Tasks, At-Risk Tasks, Over-BOQ Materials.
- Task attention list with assigned tasks highlighted in glowing primary style.
- Quick action panel buttons: Daily Logs, Incidents Board, WBS Workspace, Drawings.

**Data processing**
- Filters tasks assigned specifically to the current logged-in engineer.

**Validation and business rules**
- Tasks assigned to current engineer render with a prominent "Assigned to You" badge.

**Normal cases**
- Engineer spots assigned tasks, opens daily log form, or submits incident report.

**Abnormal cases**
- No active task assignments displays empty state card.

---

## 3.11. Project Portfolio Module

### 3.11.1. Project List Screen

**Function type:** Screen (standalone page)

**Function trigger:** Sidebar → Projects menu.

**Function description:** Comprehensive directory of all construction projects displayed as grid cards, with search bar, status tab filters, and new project creation button. Actors include Technical Manager, Admin, Director, Accountant, PL, Site Engineer.

**Function Details**

**Interface and data**
- Primary action button "Tạo dự án mới" (visible to Technical Manager & Admin).
- Search input for project name, code, or address.
- Status tab filters: All, Draft, In Progress, Paused, Completed, Closed.
- Project cards displaying Code, Title, Address, Status Badge, Progress Bar %, and Target End Date.

**Data processing**
- Queries project list with debounced search string and selected status filter parameter.
- Calculates completion progress % for each project card.

**Validation and business rules**
- Project creation form requires unique Project Code, Name, Address, Start Date, and Target End Date.
- Only Technical Manager and Admin can create or update project master details.

**Normal cases**
- User filters project grid, searches keywords, or clicks a project card to open WBS workspace.

**Abnormal cases**
- Search yields zero results displays "No projects found" state.

---

### 3.11.2. Modal Create / Update Project

**Function type:** Modal dialog

**Function trigger:** Click "Tạo dự án mới" button on Project List screen, or click "Sửa" button on Project Detail Header.

**Function description:** A modal dialog that appears when a user wants to create a new project or edit an existing one. The interface prompts for basic project details, site location address, start/end dates timeline, and overall design document files. Actors include Technical Manager, Admin.

**Function Details**

**Interface and data**
- Dynamic modal header title ("Khởi tạo Dự án mới" or "Sửa thông tin Dự án").
- Mandatory Text input "Tên dự án *" (Project Name).
- Mandatory Text input "Địa chỉ công trường *" (Site Location Address).
- Mandatory Date pickers "Ngày dự kiến bắt đầu *" and "Ngày dự kiến kết thúc *".
- Informational notice banner ("Dự án mới sẽ được lưu ở trạng thái Bản nháp...").
- Drag-and-drop file upload zone "Bản vẽ thiết kế tổng thể" accepting PDF, PNG, JPG files up to 20MB.
- Action buttons: "Hủy bỏ" (Secondary) and "Xác nhận tạo mới" / "Cập nhật" (Primary Blue).

**Data processing**
- Validates form input fields and posts payload to project backend endpoints.
- Uploads design blueprint file attachments to file storage service and links metadata to project record.

**Validation and business rules**
- Restricted exclusively to Technical Manager and Admin roles.
- Mandatory text fields (Name, Address, Start Date, Target End Date) cannot be empty.
- Target End Date must be strictly after Start Date.
- Uploaded design blueprint file must be PDF, PNG, or JPG under 20MB limit.
- Newly created projects start in Draft status.

**Normal cases**
- Manager fills out project details, uploads overall design drawing file, and submits form to register or update project.

**Abnormal cases**
- Submitting with End Date earlier than Start Date displays date validation error alert.
- Uploading file exceeding 20MB size limit displays file size error message.

---

### 3.11.3. Project Details Screen (WBS Workspace)

**Function type:** Screen (embedded project tab)

**Function trigger:** Projects → select a project → WBS tab. It may also be opened by Dashboard links or by a URL containing tab=wbs and taskId.

**Function description:** Central project planning and monitoring screen. It presents the hierarchy Phase → Task → Subtask and provides role- and status-sensitive operations. Actors include Technical Manager, Project Leader, Site Engineer, Director, Accountant and Admin.

**Function Details**

**Interface and data**
- Header actions open Project Drawings and Gantt Chart.
- The tree shows phase dates, phase progress, acceptance/frozen state and task hierarchy.
- Task rows show progress, assignees, outsourced status, dependency information and overdue/at-risk/days-left badges.
- Phase/task context menus display only actions allowed by current role, project status, phase state and task state.

**Data processing**
- Loads project, members, WBS, material requests and supporting project data.
- Builds nested tasks using ParentTaskId and orders records using OrderIndex.
- Calculates phase progress from active root tasks using task duration and optional weight; obsolete tasks are excluded.
- Joins SignalR group Project_{projectId}; WbsTreeUpdated invalidates cached WBS data.

**Validation and business rules**
- Project Leader, Technical Manager and Admin receive WBS editing capability under the current authorization conditions.
- Accepted/frozen phases are read-only.
- A paused project is normally read-only; Technical Manager editing may be enabled by an approved emergency incident.
- Task warning: overdue when deadline passed and progress < 100%; at-risk when close to deadline and progress remains below the configured threshold.

**Normal cases**
- Expand/collapse phases, open details, invoke allowed actions, reorder eligible root phases/tasks and observe realtime refresh.

**Abnormal cases**
- Missing project returns Not Found. API errors display an error state. Unauthorized operations are hidden and independently rejected by the backend authorization pipeline. Empty WBS shows guidance to create the first phase.

---

### 3.11.4. Project Members Screen

**Function type:** Screen (embedded project tab)

**Function trigger:** Projects → select a project → "Thành viên dự án" tab (`/projects/:projectId/members`).

**Function description:** Displays the list of Project Leaders and Site Engineers assigned to the current project. Allows authorized users (Technical Manager & Admin) to assign new members, designate or revoke the Project Leader role, and remove members from the project. Non-manager roles are restricted to read-only view. Actors include Technical Manager, Admin.

**Function Details**

**Interface and data**
- Sub-tab menu item "Thành viên dự án" highlighted under project workspace header.
- Primary action button "+ Thêm kỹ sư" (visible to Technical Manager & Admin) to open member assignment modal.
- Grid layout of member cards displaying avatar, member name, email, phone number, and role badge ("TRƯỞNG NHÓM").
- Member card action buttons (visible to TPKT & Admin): "Gán/Hủy trưởng nhóm" (Toggle Leader role) and "Xóa" (Remove member from project).

**Data processing**
- Queries project member list via project member endpoints.
- Updates member role assignments via leader designation and member removal endpoints.

**Validation and business rules**
- Exclusively restricted to Technical Manager (TPKT) and Admin roles for adding members, designating/revoking Project Leader role, or removing members.
- Each project can have one active Project Leader designated among project members.
- Removing a Project Leader prompts for confirmation and revokes leader status before member removal.

**Normal cases**
- Technical Manager views assigned team members, appoints/revokes Project Leader role, or removes staff members.

**Abnormal cases**
- Non-manager roles viewing page see read-only cards without management buttons. Removing an engineer actively assigned to ongoing incomplete tasks prompts a warning confirmation dialog.

---

### 3.11.5. Modal: Add Engineers to the Project

**Function type:** Modal dialog

**Function trigger:** Projects → select a project → "Thành viên dự án" tab → click "+ Thêm kỹ sư" button.

**Function description:** A search and selection modal used to assign engineers/personnel from the system to the current project. It allows Technical Manager or Admin to select multiple engineers simultaneously using checkboxes. Actors include Technical Manager, Admin.

**Function Details**

**Interface and data**
- Modal header titled "Thêm Kỹ sư vào Dự án".
- Search input field "Tìm kiếm tên hoặc email...".
- Scrollable list of system users with checkboxes, avatars, names, emails, and active project badges (e.g. "Trưởng nhóm - Trường quốc tế Á Châu").
- Action buttons: "Hủy" (Secondary) and "Gán (N)" (Primary Blue, displaying count N of selected users).

**Data processing**
- Fetches all available system technical users via user management endpoints (`/api/users`, authorized for Admin and Technical Manager).
- Filters user list locally based on search input text.
- Submits selected user IDs payload to project member assignment endpoint.

**Validation and business rules**
- Restricted to Technical Manager (TPKT) and Admin roles.
- System users already assigned to the project are excluded from the available engineers list.
- Submit button "Gán (N)" updates count N dynamically based on checked checkboxes.
- Requires at least 1 user checked to enable submission.

**Normal cases**
- Manager searches engineers by name or email, checks multiple engineers using checkboxes, and clicks "Gán (N)" to batch-assign them to the project.

**Abnormal cases**
- Searching for non-existent name displays empty engineers search list state.

---

### 3.11.6. Project Drawing Screen (Design Drawings Viewer)

**Function type:** Screen (standalone page / tab view)

**Function trigger:** Projects → WBS Workspace → click "Xem bản vẽ" button.

**Function description:** Interactive design blueprint viewer for displaying architectural PDFs or image files with zoom, scaling reset, drawing selection modal, and file download. Actors include Site Engineer, PL, Technical Manager.

**Function Details**

**Interface and data**
- Top navigation button "Quay lại WBS".
- Toolbar buttons: Zoom In (+25%), Zoom Out (-25%), Reset (100%), Select Drawing, Download.
- Viewer viewport container embedding PDF canvas or image renderer.

**Data processing**
- Fetches project attachments list via project drawing service endpoints.
- Creates secure blob URL for PDF rendering.

**Validation and business rules**
- Zoom scale bounded between 50% minimum and 300% maximum.

**Normal cases**
- User zooms into blueprint details, switches floor plan files, or downloads PDF to tablet.

**Abnormal cases**
- Missing drawing attachment renders empty drawing upload prompt.

---

### 3.11.7. Project Gantt Chart Screen

**Function type:** Screen (standalone page / tab view)

**Function trigger:** Projects → WBS Workspace → click "Biểu đồ công việc" button.

**Function description:** Time-based horizontal bar chart illustrating WBS phases and tasks, completion progress, finish-to-start dependency arrows, and scale switcher (Day/Week/Month). Actors include PL, Technical Manager, Site Engineer.

**Function Details**

**Interface and data**
- Back button to return to WBS Workspace.
- Toggle button to expand/collapse left-hand task attribute grid table.
- Time scale switcher buttons: Day, Week, Month.
- Overall project progress bar % and task status summary badges.
- SVG chart canvas displaying horizontal task bars (Purple for Phase, Green for Done, Orange for In-Progress, Red for Overdue).

**Data processing**
- Formats WBS tasks into timeline bar items with start/end coordinates.
- Renders dependency lines linking predecessor tasks to successor tasks.

**Validation and business rules**
- Clicking any task bar opens Daily Log Modal for quick progress reporting.

**Normal cases**
- User inspects schedule timeline, switches between day/month scales, and reports progress.

**Abnormal cases**
- Tasks with invalid dates render with red error border indicator.

---


---

## 3.12. Inventory Adjustments Module

### 3.12.1. Inventory Adjustments List Screen

**Function type:** Screen (embedded project tab / page)

**Function trigger:** Projects → Stocktake/Adjustments tab.

**Function description:** Warehouse stock adjustment slip directory displaying historical increase/decrease slips, search bar, slip type filters, status filters, and slip creation buttons. Actors include PL, Accountant, Director, Admin, Technical Manager.

**Function Details**

**Interface and data**
- Search input for slip reference code or reason keywords.
- Slip type filter dropdown: All, Increase Slips, Decrease Slips.
- Status filter dropdown: All, Pending, Approved, Rejected.
- Action buttons: "Tạo Phiếu Tăng" (PL/Admin), "Phiếu Giảm (Giai đoạn)" (Accountant/Admin).
- Data table showing Code, Type, Phase, Reason, Status Badge (Chờ duyệt, Đã duyệt, Từ chối), Date, Creator, Action.

**Data processing**
- Queries inventory adjustments endpoint filtered by projectId, type, and status.

**Validation and business rules**
- "Tạo Phiếu Tăng" restricted to PL and Admin.
- "Phiếu Giảm" restricted to Accountant and Admin.
- Both Increase and Decrease slips start in "Pending" status requiring appropriate approval.

**Normal cases**
- User filters slips table, inspects slip details, or creates a new adjustment slip request.

**Abnormal cases**
- Empty table displays no adjustment records placeholder.

---

### 3.12.2. Create Increase Adjustment Modal

**Function type:** Modal dialog

**Function trigger:** Click "Tạo Phiếu Tăng" button on Inventory Adjustments List screen.

**Function description:** Form modal for PL to request warehouse stock increases (surplus/recovery). Slips are created in Pending status and require approval from Technical Manager (TPKT) or Admin before inventory is updated. Actors include Project Leader, Admin.

**Function Details**

**Interface and data**
- Mandatory Adjustment Reason text input (e.g. Audit surplus).
- Optional Notes textarea.
- Searchable Material select dropdown.
- Increase Quantity number input (> 0).
- "Thêm" button to append material item to preview table.
- Preview data table listing Code, Name, Unit, Quantity, Remove button.

**Data processing**
- Posts payload to inventory adjustment increase endpoint.
- Saves slip in Pending status awaiting Technical Manager (TPKT) approval.

**Validation and business rules**
- Increase quantity must be strictly greater than zero.
- Table must contain at least one valid material row before submission.
- Created slips start in Pending status and must be approved by Technical Manager (TPKT) or Admin before inventory is credited.

**Normal cases**
- PL adds surplus items, reviews draft table, and submits slip request for TPKT approval.

**Abnormal cases**
- Submitting empty table displays validation error alert.

---

### 3.12.3. Create Decrease Adjustment Modal

**Function type:** Modal dialog

**Function trigger:** Click "Phiếu Giảm (Giai đoạn)" button or click "Tạo phiếu giảm" from verified inventory incident.

**Function description:** Form modal for Accountant to request stock deductions due to damage/loss, creating a pending slip requiring Director approval. Pre-fills items if linked to an incident. Actors include Accountant, Admin.

**Function Details**

**Interface and data**
- Mandatory Reason text input (pre-filled if linked to incident).
- Mandatory Phase select dropdown.
- Material search dropdown listing items currently in site stock.
- Decrease Quantity number input (> 0 and <= stock balance).
- Draft items table showing Code, Name, Unit, Quantity, Remove.

**Data processing**
- Parses damaged materials markdown from linked incident payload if applicable.
- Posts payload to inventory adjustment decrease endpoint.

**Validation and business rules**
- Decrease quantity cannot exceed current available warehouse stock balance.
- Creates slip in Pending status awaiting Director approval.

**Normal cases**
- Accountant selects phase, inputs deduction quantities, and submits request for Director approval.

**Abnormal cases**
- Entering quantity > current stock displays "Quantity exceeds stock balance" error.

---

### 3.12.4. Review Adjustment Modal (Details / Approval)

**Function type:** Modal dialog

**Function trigger:** Click "Xem chi tiết" on an adjustment slip in Inventory Adjustments list table.

**Function description:** Detail view modal presenting metadata and items of an adjustment slip, allowing Technical Managers (for Increase slips) and Directors (for Decrease slips) to approve or reject pending slips with inline rejection justification input. Actors include Technical Manager, Director, Admin, Accountant, PL.

**Function Details**

**Interface and data**
- General info card: Slip Code, Creator, Creation Date, Target Phase, Reason Description, Linked Incident ID.
- Materials data table: Material Code, Name, Unit, Adjustment Quantity, Stock Balance Before.
- Action buttons: "Duyệt phiếu" (Primary Success Green button), "Hủy" (Secondary button), and "Từ chối" / "Xác nhận Từ chối" (Primary Red danger button).
- Rejection Input Block: Textarea field "Lý do từ chối *" with placeholder "Nhập lý do từ chối chi tiết..." (rendered inline upon clicking rejection mode).

**Data processing**
- Calls approval or rejection endpoints for adjustment slips.
- Upon TPKT/Admin approval of Increase slip: credits material quantities to warehouse stock, sets status to Approved, and logs transaction.
- Upon Director/Admin approval of Decrease slip: deducts material quantities from warehouse stock, sets status to Approved, updates linked incident, and logs transaction.
- Upon rejection: requires mandatory rejection reason text, updates slip status to Rejected, keeps warehouse stock balance unchanged, and updates linked incident status if applicable.

**Validation and business rules**
- Approval of Increase slips restricted to Technical Manager (TPKT) and Admin roles.
- Approval of Decrease slips restricted to Director and Admin roles.
- Rejection requires entering mandatory non-empty text in "Lý do từ chối *".
- Approved or Rejected slips become read-only and disable approval/rejection action buttons.

**Normal cases**
- Technical Manager (for Increase) or Director (for Decrease) reviews slip items and clicks "Duyệt phiếu" to process warehouse stock update. Alternatively, if request is unjustified, manager fills out "Lý do từ chối *", clicks "Xác nhận Từ chối", and slip is marked Rejected without altering warehouse stock.

**Abnormal cases**
- Approving decrease slip when warehouse stock was depleted by a concurrent operation displays stock underflow error alert. Submitting rejection with empty reason highlights red validation border.

---

## 3.13. Incidents Module

#### 3.13.1. Incidents Board Screen

**Function type:** Screen (embedded project tab / page)

**Function trigger:** Projects → Incidents tab.

**Function description:** Centralized board for tracking construction quality issues, rework events, material losses, and emergency stop requests. Features metric cards, filters, emergency stop button, and incidents data table. Actors include PL, Site Engineer, Technical Manager, Accountant, Director, Admin.

**Function Details**

**Interface and data**
- Emergency Stop button "Báo cáo khẩn cấp & Yêu cầu dừng dự án" (PL/Admin).
- Summary metric cards: Total Incidents, Pending Incidents, Resolved Incidents.
- Filter controls: Type select (All, Construction, Inventory), Date Range pickers, Clear Filters button.
- Data table listing Date, Type, Affected Task/Phase, Reporter, Status Badge, Action.

**Data processing**
- Queries incidents list filtered by projectId, incidentType, and date range parameters.

**Validation and business rules**
- Site Engineers and PLs see project-specific incidents. Technical Manager, Accountant, Director, Admin see all incidents.

**Normal cases**
- User filters incident log, views incident details, or initiates emergency stop report.

**Abnormal cases**
- Empty table displays no incidents recorded placeholder.

---

#### 3.13.2. Report Construction Incident Modal

**Function type:** Modal dialog

**Function trigger:** Click "Báo cáo sự cố" button inside Task Details modal in WBS workspace.

**Function description:** Form modal for Site Engineers or PLs to report physical construction execution failures or defects for Technical Manager review. Actors include Site Engineer, Project Leader, Admin.

**Function Details**

**Interface and data**
- Mandatory Cause Description textarea (min 5 characters).
- Mandatory Occurrence DateTime picker (cannot be set in future).
- Optional fields: Responsible Party, Cancelled Volume, Estimated Cost, Labor Days, Delay Days.
- Proposed Action radio group: Create Rework Task, Reduce Task Progress, Custom Action.
- Scene photos uploader (up to 5 images, max 10MB each).

**Data processing**
- Posts incident payload with type Construction.
- Saves incident in WaitingReview status.

**Validation and business rules**
- Occurrence timestamp cannot be in the future.
- Selecting custom action requires entering custom description text.

**Normal cases**
- Engineer describes site defect, uploads photos, and submits report to TPKT.

**Abnormal cases**
- Selecting future occurrence date displays date validation error.

---

#### 3.13.3. Report Inventory Incident Modal

**Function type:** Modal dialog

**Function trigger:** Click "Báo cáo sự cố vật tư" in Phase context menu or inventory workspace.

**Function description:** Form modal for PLs to report material loss/theft/damage in site storage, compiling damaged items for Accountant verification. Actors include Project Leader, Admin.

**Function Details**

**Interface and data**
- Read-only Category box (Inventory Loss / Damage).
- Mandatory Cause Description textarea (min 5 characters).
- Mandatory Discovery DateTime picker.
- Material selector tool to add stock items with "Số lượng lỗi/mất".
- Damaged items table showing Code, Name, Unit, Quantity Lost.
- Evidence photos uploader (up to 5 images).

**Data processing**
- Formats selected items into markdown table string inside damage description field.
- Posts payload to incidents endpoint with status WaitingAccountant.

**Validation and business rules**
- Quantity lost cannot exceed current warehouse stock balance.

**Normal cases**
- PL selects damaged materials, attaches photos, and submits report to Accountant.

**Abnormal cases**
- Entering quantity > available stock blocks item addition with warning banner.

---

#### 3.13.4. Resolve Incident Modal

**Function type:** Modal dialog

**Function trigger:** Click "Phê duyệt" / "Chi tiết" on an open construction incident as Technical Manager.

**Function description:** Decision modal for Technical Manager to evaluate a construction incident and execute a recovery action (creating a rework task or reducing progress %). Actors include Technical Manager, Admin, Director.

**Function Details**

**Interface and data**
- Mandatory Technical Handling Instructions textarea.
- Resolution Action radio group: Create Rework Task, Reduce Progress %.
- If Rework: Rework Task Name (pre-filled), Deadline Date, Assigned Engineer dropdown.
- If Reduce Progress: Progress Reduction % (1-100%), Reduction Reason textarea.
- Action buttons: "Xác nhận" (Success), "Từ chối sự cố" (Danger).

**Data processing**
- Calls incident confirmation or rejection endpoints.
- Upon creating rework task: marks original task Obsolete, creates new Rework Task, sets incident to Approved.
- Upon reducing progress: deducts task progress %, records log entry, sets incident to Approved.

**Validation and business rules**
- Rework deadline cannot exceed phase end date.
- Progress reduction must be between 1% and 100%.

**Normal cases**
- TPKT reviews incident, enters technical instructions, creates rework task, and resolves incident.

**Abnormal cases**
- Setting deadline in the past displays validation error alert.

---

#### 3.13.5. Report Emergency Stop Modal

**Function type:** Modal dialog

**Function trigger:** Click "Báo cáo khẩn cấp & Yêu cầu dừng dự án" button on Incidents Board.

**Function description:** Formal emergency form modal to document major site force majeure events or disasters and request an immediate project halt. Starts 3-phase emergency lifecycle. Actors include Project Leader, Admin.

**Function Details**

**Interface and data**
- Read-only Project Name input.
- Mandatory fields: Affected Work Item, Occurrence Time, Severity Level, Site Location, Incident Type, Event Chronicle Description, Casualty Report, Schedule Impact, Property Loss, Root Cause, Emergency Containment Measures.
- Scene photos uploader (up to 5 images).
- Primary red button "Gửi biên bản báo cáo dừng dự án".

**Data processing**
- Posts payload to incidents endpoint with isEmergency = true.
- Saves incident in WaitingStopApproval status.

**Validation and business rules**
- All 11 emergency text fields are mandatory.
- Phase 1: TPKT/Admin confirms stop -> project status becomes Paused, incident status becomes WaitingRecoveryPlan.
- Phase 2: TPKT submits Recovery Plan -> incident status becomes WaitingDirectorApproval.
- Phase 3: Director approves Recovery Plan -> project status resumes Inprogress, affected tasks marked Obsolete, Rework Task created, incident status becomes Approved.

**Normal cases**
- PL submits emergency stop report during site disaster, triggering management alert workflow.

**Abnormal cases**
- Leaving mandatory field blank highlights red validation border.

---

#### 3.13.6. Incident Detail Modal

**Function type:** Modal dialog

**Function trigger:** Click "Nút Chi tiết" or "Phê duyệt" on an incident card/row in Incidents Board or Global Incidents table.

**Function description:** Stepper-based detail modal providing step-by-step progress tracking (1. PL Báo cáo -> 2. TPKT Thẩm định -> 3. Hoàn tất) for construction incidents. Displays reported site info, damage estimates, proposed actions, attached scene photos, inline rejection reason input, and evaluation controls for Technical Manager approval or rejection. Actors include Technical Manager, Project Leader, Site Engineer, Admin.

**Function Details**

**Interface and data**
- 3-Step horizontal progress stepper header: "1. PL Báo cáo" -> "2. TPKT Thẩm định" -> "3. Hoàn tất".
- Step 1 Card: Project Name, Task/Phase Name, Occurrence DateTime, Responsible Person, Event Description (displays clean incident description text), and Attached Scene Photos gallery.
- Step 2 Card: Cancelled Volume ("Khối lượng nghiệm thu bị hủy"), Estimated Monetary/Material Damage ("Ước tính thiệt hại"), Proposed Action ("Tạo Rework Task" / "Giảm tiến độ"), Additional Damage Notes ("Ghi chú thiệt hại bổ sung"), and Technical Handling Instructions textarea ("Hướng dẫn xử lý").
- Rejection Input Block: Mandatory textarea field "Lý do từ chối *" with placeholder "Nhập lý do từ chối chi tiết...".
- Action buttons: "Thẩm định & Phê duyệt (TPKT)" / "Xác nhận" (Primary Blue button), "Hủy" (Secondary button), and "Xác nhận Từ chối" (Primary Red danger button).
- Step 3 Card: Resolution Banner ("ĐÃ XỬ LÝ BỞI [Tên người duyệt]" / "ĐÃ TỪ CHỐI BỞI [Tên người duyệt]"), Resolution Status Message, Rejection Reason Notes, and Technical Handling Instructions.

**Data processing**
- Loads complete incident record, task metadata, and attached scene images.
- Renders stepper status active index based on incident status (WaitingReview -> step 2 active, Approved / Rejected -> step 3 active).
- Upon approval: calls incident resolution endpoint, executes proposed rework task creation or progress reduction, and sets incident status to Approved.
- Upon rejection: calls incident rejection endpoint with mandatory rejection reason text, updates incident status to Rejected, and notifies the reporter.

**Validation and business rules**
- Approval and rejection controls are visible only to Technical Manager, Admin, and Director roles.
- Rejection requires entering mandatory rejection reason text in "Lý do từ chối *". "Xác nhận Từ chối" button is disabled or triggers validation error if reason is empty.
- Approved or Rejected incidents render read-only completion/rejection status banner and disable further evaluation edits.

**Normal cases**
- Manager reviews reported site photos and damage estimates, inspects proposed action, enters technical handling instructions, and approves the incident. Alternatively, if information is invalid, manager fills out "Lý do từ chối *", clicks "Xác nhận Từ chối", and incident status becomes Rejected.

**Abnormal cases**
- Submitting rejection without entering text in "Lý do từ chối *" highlights red validation border. Missing scene images display default placeholder. Network errors during approval/rejection trigger toast notification.

---

#### 3.13.7. Detail Report Emergency Stop Modal

**Function type:** Modal dialog

**Function trigger:** Click "Xem chi tiết" on an emergency stop incident record.

**Function description:** Official emergency incident report viewer modal rendering a formatted formal document ("BIÊN BẢN BÁO CÁO SỰ CỐ CÔNG TRÌNH") with print/export capabilities, alongside attached recovery plan documents ("HỒ SƠ BÁO CÁO & KẾ HOẠCH KHẮC PHỤC THIỆT HẠI"), inline rejection/revision request controls, and director approval status. Actors include Technical Manager, Director, Project Leader, Admin.

**Function Details**

**Interface and data**
- Document header buttons: "In Báo cáo" (Print) and "Xuất Word" (Export to Word).
- Formal Report Document View: Section I. THÔNG TIN CHUNG (Project, Site, Work item, Reporter), Section II. THÔNG TIN SỰ CỐ (Time, Location, Type, Severity), Section III. MÔ TẢ SỰ CỐ, Section IV. THIỆT HẠI (Casualties, Schedule, Assets/Materials).
- Recovery Plan Panel: "HỒ SƠ BÁO CÁO & KẾ HOẠCH KHẮC PHỤC THIỆT HẠI", Total Estimated Recovery Cost (e.g. 10.000.000 VND), and Downloadable Attachment Buttons (Word/PDF/Excel recovery plan files).
- Rejection / Revision Request Input Block: Mandatory textarea field "Lý do từ chối / Yêu cầu chỉnh sửa *" with placeholder "Nhập lý do từ chối hoặc yêu cầu điều chỉnh kế hoạch khắc phục...".
- Step 3 Decision Action Buttons: "Phê duyệt Kế hoạch" (Primary Blue button), "Hủy" (Secondary button), and "Từ chối / Yêu cầu lập lại Kế hoạch" (Primary Red danger button).
- Step 3 Resolution Status Card: Reviewer Name, Status message ("Sự cố đã được Giám đốc phê duyệt..." / "Kế hoạch khắc phục đã bị từ chối..."), Rejection/Revision Reason Notes, and Director Handling Instructions.

**Data processing**
- Fetches emergency stop incident document metadata and attached recovery plan files.
- Generates downloadable Word document blob and triggers browser print layout on command.
- Upon Director approval: updates emergency incident status to Approved, resumes project status from Paused to In Progress, marks affected tasks Obsolete, and creates new Rework Task.
- Upon Director rejection/revision request: requires mandatory rejection reason text, updates emergency incident status back to WaitingRecoveryPlan, logs Director revision instructions, and alerts Technical Manager to submit an updated recovery plan.

**Validation and business rules**
- Approval and rejection controls are visible exclusively to Director and Admin roles when incident status is WaitingDirectorApproval.
- Rejection or revision request requires entering mandatory non-empty text in "Lý do từ chối / Yêu cầu chỉnh sửa *".
- Formatted report view follows official construction incident reporting document standards.

**Normal cases**
- Director reviews formal emergency report document, inspects attached recovery plan files, enters handling instructions, and clicks "Phê duyệt Kế hoạch" to resume project execution. Alternatively, if recovery plan budget or actions are unsatisfied, Director enters revision notes in "Lý do từ chối / Yêu cầu chỉnh sửa *", clicks "Từ chối / Yêu cầu lập lại Kế hoạch", and status reverts to WaitingRecoveryPlan for Technical Manager update.

**Abnormal cases**
- Submitting rejection without entering text in "Lý do từ chối / Yêu cầu chỉnh sửa *" highlights red validation border. Failed document generation triggers fallback notification alert.

---

#### 3.13.8. Modal: Create Recovery Plan via Word Document

**Function type:** Modal dialog

**Function trigger:** Click "Lập kế hoạch khắc phục" button on an emergency stop incident in WaitingRecoveryPlan status.

**Function description:** Modal form enabling Technical Manager or Project Leader to create and submit an emergency recovery plan by downloading a standardized Word template (.doc), editing recovery budget/actions offline, and uploading the completed files for Director review. Actors include Technical Manager, Project Leader, Admin.

**Function Details**

**Interface and data**
- Informational guidance banner ("LẬP KẾ HOẠCH KHẮC PHỤC QUẢ TỆP WORD: Bạn có thể tải tệp mẫu về điều chỉnh trực tiếp trên Word, sau đó tải tệp đã hoàn thành lên đây để trình duyệt.").
- Template Download Button: "Tải xuống Mẫu Kế hoạch (.doc)".
- Upload dropzone: "Các tệp tài liệu kế hoạch khắc phục sự cố (*)" supporting drag-and-drop file upload for Word (.doc/.docx), Excel (.xls/.xlsx), PDF, zip archives, or photos.
- Action buttons: "Hủy" (Secondary) and "Trình kế hoạch lên Giám đốc" (Primary Blue).

**Data processing**
- Downloads standard .doc template file from server assets.
- Uploads recovery plan documents to storage service and submits plan payload to update incident status to WaitingDirectorApproval.

**Validation and business rules**
- Uploading at least 1 valid recovery plan document is mandatory before submission.
- Accepts Word, Excel, PDF, zip, and image files.
- Successful submission transitions emergency incident status from WaitingRecoveryPlan to WaitingDirectorApproval.

**Normal cases**
- Manager downloads template, prepares recovery cost/action document, uploads file, and submits plan for Director approval.

**Abnormal cases**
- Submitting without attaching any recovery file blocks submission with a validation alert.

---

## 3.14. Reports Module (Reports Hub)

### 3.14.1. Reports Hub Screen

**Function type:** Screen (standalone portal page)

**Function trigger:** Sidebar → Reports Hub menu.

**Function description:** Master analytical portal featuring top searchable project selector dropdown (`FolderKanban` dropdown) and top global date range filter bar for viewing cross-referenced project KPIs. Actors include Director, Technical Manager, Accountant, Admin, PL, Site Engineer.

**Function Details**

**Interface and data**
- Top searchable project selector dropdown (`FolderKanban` dropdown) to choose "Tất cả dự án" or a specific project.
- Top Global Date Range Filter ("Từ ngày", "Đến ngày", or preset buttons "30 ngày qua", "Quý này").
- Segmented pill tab navigation bar: Executive Overview ("Tổng quan"), Construction Progress ("Tiến độ thi công"), BOQ Limits ("Định mức BOQ"), Incidents ("Sự cố & Rework"), Inventory Ledger ("Nhập xuất tồn"), Procurement & Costs ("Mua sắm & Chi phí").
- Content viewport area dynamically rendering selected report component wrapped in an error boundary.

**Data processing**
- Stores selected project context selectedProjectId and date range filters (fromDate, toDate) in search parameters.
- Passes filter parameters to backend LINQ query handlers across all 6 report views.

**Validation and business rules**
- Non-manager roles (e.g. Site Engineer) are blocked from selecting "All Projects" view.
- Global date range filter propagates parameters across all 6 report query handlers.

**Normal cases**
- User selects a project from top dropdown, sets date range filter, switches between report tabs, and inspects KPI charts.

**Abnormal cases**
- Selecting project with no data renders empty report state.

---

### 3.14.2. Portfolio Dashboard (All Projects View)

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → select "Tất cả dự án" → "Tổng quan" tab.

**Function description:** High-level portfolio dashboard displaying aggregate KPIs, status distribution pie chart, comparative progress ranking list, and cross-project alert list. Actors include Director, Admin, Technical Manager, Accountant.

**Function Details**

**Interface and data**
- Aggregate KPI cards: Total Projects, Average Progress %, Active, Paused, Completed.
- Portfolio Status Distribution pie chart.
- Comparative project progress list ranked by completion percentage %.
- System-wide alert table listing delayed/critical tasks across all projects.

**Data processing**
- Calls portfolio overview report endpoints.
- Ranks project progress list descending by completion %.

**Validation and business rules**
- Clicking a project row in the progress list switches Reports Hub to that specific project view.

**Normal cases**
- Director monitors portfolio progress ranking, checks status pie chart, and reviews cross-project alerts.

**Abnormal cases**
- Zero system projects displays empty portfolio state graphic.

---

### 3.14.3. Executive Dashboard Tab (Single Project Overview)

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → select specific project → "Tổng quan" tab.

**Function description:** Single-project executive summary showing task metrics, material BOQ overrun cards, phase completion table, and delayed task list filtered by date range. Actors include Director, Technical Manager, Accountant, PL.

**Function Details**

**Interface and data**
- Task status metric cards: Total, Completed, In Progress, Delayed, At Risk.
- Material overrun cards: Over-BOQ Materials count, Over-BOQ Pending Requests.
- Phase completion table: Phase Name, Status, Task Counts, Progress Bar %.
- Delayed tasks data table: Task Name, Phase, End Date, Assignee, Progress %, Warning Badge.

**Data processing**
- Queries project overview report endpoints filtered by FromDate and ToDate.

**Validation and business rules**
- Delayed tasks with 0% progress render with critical Red Alert badge.

**Normal cases**
- Manager reviews single project health, checks phase completion bars, and audits delayed tasks.

**Abnormal cases**
- Project with zero tasks displays empty task breakdown table.

---

### 3.14.4. Construction Progress Report Tab

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → "Tiến độ Thi công" tab.

**Function description:** Detailed progress report featuring aggregate task cards, phase breakdown, and phase acceptance audit history table filtered by date range. Actors include Technical Manager, PL, Site Engineer.

**Function Details**

**Interface and data**
- Task aggregate status cards (Completed, In Progress, Assigned, New, Obsolete, Overall Progress %).
- Phase breakdown panels with task status badges and progress bars.
- Phase acceptance audit log table: Phase Name, Acceptance Date, Acceptor, Status, Cancellation Reason.

**Data processing**
- Queries construction progress report endpoints filtered by FromDate and ToDate.

**Validation and business rules**
- Phase acceptances show cancellation reasons if acceptance was revoked or rejected.

**Normal cases**
- User filters phase tasks and reviews acceptance history log.

**Abnormal cases**
- Project with no phases renders timeline setup prompt.

---

### 3.14.5. Incident Report Tab

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → "Sự cố & Rework" tab.

**Function description:** Consolidated incident analysis report providing summary metric cards and a full incident audit log table with clean incident description text, estimated delay days, and rework task links filtered by date range. Actors include Technical Manager, Director, Accountant, PL.

**Function Details**

**Interface and data**
- Metric cards: Total Incidents, Open Incidents, Resolved Incidents, Incidents with Rework.
- Incident audit log data table: Date, Type, Description (clean description text without markdown date/time tags), Status, Reporter, Reviewer, Estimated Delay Days, Rework Task Link.

**Data processing**
- Queries incident report endpoints filtered by FromDate and ToDate.
- Automatically parses and displays clean description text.

**Validation and business rules**
- Clicking a Rework Task link opens that task's details in the WBS workspace.

**Normal cases**
- User audits site incident history, checks delay days, and tracks created rework tasks.

**Abnormal cases**
- Zero reported incidents displays clean status banner.

---

### 3.14.6. BOQ vs Actual Report Tab

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → "Định mức BOQ" tab.

**Function description:** Financial and material control report comparing baseline BOQ design limits against actual warehouse issuances, returns, net consumption, pending POs, and pending MRs filtered by date range. Actors include Accountant, Director, Technical Manager.

**Function Details**

**Interface and data**
- Comparative data table: Material Code, Name, Unit, BOQ Limit, Actual Issued, Returns, Net Consumption, Stock Remaining, Pending PO Quantity, Pending MR Quantity, Total Expected Usage, Exceeded Amount, Usage Ratio %.
- Red row highlight for items where Total Expected Usage > BOQ Limit.

**Data processing**
- Queries issuances and returns filtered by FromDate and ToDate.
- Calculates Total Expected Usage = Net Consumption + Pending PO + Pending MR.
- Calculates Exceeded Amount = Total Expected Usage - BOQ Limit.

**Validation and business rules**
- Rows with Total Expected Usage > BOQ Limit render with red background highlighting and overrun alert badge.

**Normal cases**
- Accountant audits material usage ratios, identifies budget overruns, and reviews pending MR impact.

**Abnormal cases**
- Materials with zero baseline limit display infinite ratio warning indicator.

---

### 3.14.7. Inventory Ledger Report Tab

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → "Nhập xuất tồn" tab.

**Function description:** Virtual warehouse stock ledger displaying summary cards, current stock & period movement balance table (opening balance, receipts, issuances, returns, closing balance), and full transaction audit log filtered by date range. Actors include Accountant, Director, PL.

**Function Details**

**Interface and data**
- Summary cards: Total Material Types count, Zero Stock Count.
- Stock & Period Movement data table: Material Code, Name, Unit, Opening Balance, Period Receipts, Period Issuances, Period Returns, Closing Balance.
- Warehouse Transaction Log data table: Date, Code, Name, Reference Type, Quantity Change (+/-), Balance After, Operator.

**Data processing**
- Queries inventory ledger report endpoints filtered by FromDate and ToDate.
- Calculates opening balance before FromDate and period movements within [FromDate, ToDate].

**Validation and business rules**
- Zero stock items highlight in red text alert.

**Normal cases**
- Accountant verifies current warehouse quantities and audits historical transaction logs within selected date range.

**Abnormal cases**
- Empty transaction history renders clean ledger prompt.

---

### 3.14.8. Procurement Report Tab

**Function type:** Screen (embedded report tab view)

**Function trigger:** Reports Hub → "Mua sắm & Chi phí" tab.

**Function description:** Expenditure report compiling total cost summary cards, Purchase Orders data table, and Direct Purchases data table with invoice attachment previews filtered by date range. Actors include Accountant, Director.

**Function Details**

**Interface and data**
- Cost summary cards: Total PO Cost, Total Direct Purchase Cost, Sum Total Cost (VND).
- Purchase Orders data table: PO Number, Status, Supplier, Total Amount, Order Date, Delivery Date.
- Direct Purchases data table: Requester, Status, Total Amount, Invoice Link, Created Date.

**Data processing**
- Queries Purchase Orders (`OrderDate`) and Direct Purchases (`CreatedAt`) filtered by FromDate and ToDate.
- Sums monetary totals formatted in VND currency string.

**Validation and business rules**
- Direct purchases without invoice attachment display "No invoice attached" label.

**Normal cases**
- Accountant reviews project expenditure totals, checks PO delivery status, and inspects invoice photos.

**Abnormal cases**
- Zero procurement transactions displays empty cost report placeholder.
