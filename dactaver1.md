# ĐẶC TẢ USE CASE - MODULE QUẢN LÝ DỰ ÁN (PROJECT PORTFOLIO MODULE)

> **Current authorization terminology (synchronized 08/08/2026):** `Project Leader` is not a standalone login role; it is a project member (normally a Site Engineer) whose `ProjectMember.IsLeader` flag is true. `Admin` is limited by the current frontend to User Management and System Configuration and is therefore not listed as an actor for project/business screens.

## 2.8 Project Portfolio Module

### 2.8.1. UC-064 - View executive dashboard

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-064 - View executive dashboard** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Project Leader, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows users to view their role-specific statistics, charts, and shortcuts (e.g. Director/TM view overall progress & WBS warnings, Accountant views PO/Material requests, Project Leader/Site Engineer view assigned work progress & incident logs). |
| **Trigger:** | Users access the system homepage (Dashboard) after a successful login. |
| **Preconditions:** | **PRE-1.** The user has a valid login session with a designated role (Director, Technical Manager, Accountant, Project Leader, or Site Engineer). |
| **Postconditions:** | **POST-1.** The system displays the executive dashboard interface and statistics widgets tailored to the user's role. |
| **Normal Flow:** | **UC083.0 View Dashboard Success (For Director / TM / Accountant)**<br>1. The user selects the "Dashboard" menu or successfully logs in.<br>2. The system retrieves dashboard statistics, active warnings, total user count, and pending material requests. (See E2.1)<br>3. The system displays general stats (Active projects, pending material requests, closed/paused projects, total users).<br>4. (For Director/TM): Displays active projects progress, project status ratio chart, and a risk warning list.<br>5. (For Accountant): Displays financial/logistics shortcuts and pending material requests counts.<br><br>**UC083.1 View Dashboard Success (For Project Leader / Site Engineer)**<br>1. The user selects a project from the dropdown list.<br>2. The system retrieves the project overview statistics. (See E2.1)<br>3. The system displays: completed/total task progress, delayed tasks count, at-risk tasks count, and BOQ-exceeding material count.<br>4. (For Project Leader): Displays phase progress bar chart, WBS task status pie chart, and a detailed list of delayed/at-risk tasks.<br>5. (For Site Engineer): Displays site tasks check-list (highlighting those assigned to them) and quick action shortcuts (Daily logs, incident reports, WBS/BOQ view, designs). |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 No data available (Step 2):** If the system finds no active projects or warnings<br>1. The system displays an empty state placeholder (e.g., "Hiện không có dự án nào đang chạy hoặc tạm dừng", "Tất cả các dự án hoạt động ổn định, không có cảnh báo"). |
| **Priority:** | High |
| **Frequency of use:** | High |
| **Business rules:** | **BR-DASH-01:** Project progress displayed on the Dashboard is calculated based on the progress of WBS Tasks.<br>**BR-DASH-02:** Dashboard layouts and metrics widgets are strictly scoped by the user's active role. |
| **Assumptions:** | The dashboard reloads and updates progress metrics dynamically when the project scope of work changes. |
| **Other Information:** | Critical warnings will be prominently highlighted in red. The Dashboard UI is designed to be responsive for both desktop and mobile/tablet screens. |

*Table 2.8.1: View executive dashboard*

---

### 2.8.2. UC-009 - View project list

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-009 - View project list** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Director, Accountant, Project Leader, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows users to view the project list. The Director/Technical Manager/Accountant can view all projects. Project Leader/Site Engineer can only view projects they are assigned to. |
| **Trigger:** | User clicks on the "Danh sách dự án" menu. |
| **Preconditions:** | **PRE-1.** The user has a valid login session. |
| **Postconditions:** | **POST-1.** The system displays the paginated project list with search and status filter capabilities.<br>**POST-2.** Project status badges, progress bars, and design indicators are rendered for each project card. |
| **Normal Flow:** | **UC009.0 View List Success**<br>1. The user selects the "Dự án" menu.<br>2. The system checks the user's role to retrieve the authorized project list. (See E2.1)<br>3. The system displays a paginated project list (max 8 projects/page). Each card shows: name, status badge, address, expected dates, overall progress bar (%), design file indicator, and detailed link.<br>4. For TPKT, the card displays a Delete icon only when status is Draft.<br>5. User can type a keyword into the search bar or select a status from the status dropdown. (See A5.1) |
| **Alternative Flows:** | **A5.1 Search and filter project (Step 5)**<br>1. The user enters a keyword (Name or Address) into the search bar or selects a status filter (Draft, Inprogress, Paused, Done).<br>2. System immediately queries and returns the matching projects, resetting current page to 1. |
| **Exceptions:** | **E2.1 No projects found (Step 2):** If the current filter matches no projects, or the user is not assigned to any project<br>1. The system displays an Empty state interface with the message "Không tìm thấy dự án nào trùng khớp". |
| **Priority:** | High |
| **Frequency of use:** | High |
| **Business rules:** | **BR-PRJ-01:** Project data viewing permissions strictly follow the user's Role (Data Scoping).<br>**BR-PRJ-02:** Soft-deleted projects are completely filtered out and hidden from this list for all roles.<br>**BR-PRJ-03:** The Delete action on a card is only available for projects at "Draft" status. |
| **Assumptions:** | Database contains paginated records, and pagination works correctly on the frontend (8 items/page). |
| **Other Information:** | The list supports search by name and address. The UI is fully responsive. |

*Table 2.8.2: View project list*

---

### 2.8.3. UC-039 - Create project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-039 - Create project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager |
| **Secondary Actors:** | File Storage System |
| **Description:** | Allows Technical Manager to create a new project in the system, enter general information, and upload design drawings. |
| **Trigger:** | Technical Manager clicks the "Khởi tạo Dự Án" button on the Project List screen. |
| **Preconditions:** | **PRE-1.** The user has the Technical Manager role. |
| **Postconditions:** | **POST-1.** The new project is created and saved to the database with the default status "Bản nháp" (Draft).<br>**POST-2.** Uploaded design drawing files are stored and linked to the project. |
| **Normal Flow:** | **UC052.0 Create Project Success**<br>1. TM clicks "Khởi tạo dự án".<br>2. The system displays the Create Project Modal.<br>3. TM enters Name, Site Address, Expected Start Date, and Expected End Date.<br>4. TM selects or drags and drops drawing files (PDF, PNG, JPG, JPEG) up to 20MB in total size. (See A4.1)<br>5. TM clicks "Xác nhận tạo mới".<br>6. The system validates the data. (See E6.1) (See E6.2) (See E6.3)<br>7. The system uploads drawing files to storage and links them to the project.<br>8. The system saves the project details and stores the drawings.<br>9. The system displays a success Toast, closes the modal, and refreshes the project list. |
| **Alternative Flows:** | **A4.1 Cancel project creation (Step 4)**<br>1. TM fills in information but decides not to proceed.<br>2. TM clicks "Hủy bỏ" or the "X" button on the Modal.<br>3. The system closes the Modal, discards input data, and makes no database changes. |
| **Exceptions:** | **E6.1 Validation fails (Step 6):** If TM leaves Name, Address, or Dates empty or invalid<br>1. System validation fails, highlights the invalid fields in red, and shows error messages.<br><br>**E6.2 End date before start date or in past (Step 6):** If TM selects an end date that occurs before the start date, or dates in the past<br>1. The system displays a validation error "Ngày kết thúc phải lớn hơn ngày bắt đầu" or "Ngày bắt đầu không được trong quá khứ".<br><br>**E6.3 Total file size exceeds 20MB (Step 6):** If TM uploads drawing files exceeding 20MB in total size<br>1. System alerts "Tổng dung lượng các file không được vượt quá 20MB" and blocks form submission. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-PRJ-04:** A newly initialized project must default to the Draft status.<br>**BR-PRJ-05:** Expected End Date must be greater than Expected Start Date. Dates cannot be in the past at the time of creation. |
| **Assumptions:** | The file storage system is operating stably and has sufficient capacity to receive uploaded files. |
| **Other Information:** | Supports uploading PDF, PNG, JPG, JPEG files (size < 20MB). The file upload process shows previews of the uploaded files. |

*Table 2.8.3: Create project*

---

### 2.8.4. UC-042 - Update project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-042 - Update project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager |
| **Secondary Actors:** | File Storage System |
| **Description:** | Allows updating project info (Name, Address, Expected Dates, drawings). If the project is running (Inprogress or Paused), only drawings can be updated. |
| **Trigger:** | TM clicks the "Sửa" button on the Project Details screen. |
| **Preconditions:** | **PRE-1.** The project must exist.<br>**PRE-2.** The user has the Technical Manager role. |
| **Postconditions:** | **POST-1.** The project details and design drawing files are updated in the database.<br>**POST-2.** The system updates and displays the refreshed project information on the interface. |
| **Normal Flow:** | **UC055.0 Update Project Success**<br>1. TM clicks the "Sửa" button on the Project Layout Hub header.<br>2. The system displays the Edit Project Modal containing current project details.<br>3. TM modifies details and/or uploads/removes drawing files (max 5 drawing files, total new files size <= 20MB). (See A3.1)<br>4. TM clicks "Cập nhật".<br>5. The system uploads new files, combines them with existing files, and saves the updates. (See E5.1)<br>6. The system updates the project information, displays a success message, and refreshes the page. |
| **Alternative Flows:** | **A3.1 Cancel update (Step 3)**<br>1. TM clicks the "Hủy bỏ" or "X" button on the update form.<br>2. The system closes the modal and saves no changes. |
| **Exceptions:** | **E5.1 Project is not in Draft status (Step 5):** If the project status has changed to Inprogress or Paused<br>1. The system disables inputs for Name, Address, Start Date, and End Date (read-only). Only the drawing files upload container remains editable to allow drawing updates for running projects. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-06:** Updating the framework info (Name, Address, Dates) of the project is strictly prohibited once it leaves Draft status. |
| **Assumptions:** | Existing files that are kept are not re-uploaded. |
| **Other Information:** | The system supports up to 5 drawing files in total. File previews are displayed dynamically. |

*Table 2.8.4: Update project*

---

### 2.8.5. UC-043 - Delete project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-043 - Delete project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager |
| **Secondary Actors:** | None |
| **Description:** | Soft-delete a project. Only allowed when the project is in Draft status. |
| **Trigger:** | TM clicks the Delete (Trash icon) on a Draft project card. |
| **Preconditions:** | **PRE-1.** The project must be in Draft status.<br>**PRE-2.** The user has the Technical Manager role. |
| **Postconditions:** | **POST-1.** The project is soft-deleted in the system.<br>**POST-2.** The project is hidden from the active project list. |
| **Normal Flow:** | **UC056.0 Delete Project Success**<br>1. TM clicks the Trash icon on the Draft project card.<br>2. The system displays a confirmation dialog: "Bạn có chắc chắn muốn xóa dự án bản nháp [Tên dự án] không? Hành động này không thể hoàn tác." (See A2.1)<br>3. TM clicks "Xóa dự án".<br>4. The system performs a deletion of the project. (See E4.1)<br>5. System displays a success Toast and reloads the project list. |
| **Alternative Flows:** | **A2.1 Cancel deletion (Step 2)**<br>1. TM clicks "Hủy" or the "X" button on the confirmation dialog.<br>2. The system closes the popup and takes no action. |
| **Exceptions:** | **E4.1 Project is not in Draft status (Step 4):** If the project status has transitioned to Inprogress or Paused<br>1. The system hides the Trash icon from the card. If the delete request is invoked directly, it returns a bad request error, and the system displays the error. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-07:** A project can only be deleted before execution (Draft) to protect data integrity for projects that have generated operations (WBS, logs, materials). |
| **Assumptions:** | Soft Delete preserves relational/audit data while filtering the project from active queries. No restoration screen is currently specified. |
| **Other Information:** | None. |

*Table 2.8.5: Delete project*

---

### 2.8.6. UC-041 - View project details

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-041 - View project details** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | View detailed project info, construction progress, and navigate to various functional tabs (WBS, Logs, Members, Materials, Inventory, Incidents, Excess Handling, Purchase Orders, Direct Purchases). |
| **Trigger:** | The user clicks a Project Card on the list screen or a dashboard project link. |
| **Preconditions:** | **PRE-1.** The user has permission to view the project (based on Role). |
| **Postconditions:** | **POST-1.** The system displays the project detail layout (ProjectLayoutHub) including overall progress, project metadata, and accessible functional tabs. |
| **Normal Flow:** | **UC054.0 View Detail Success**<br>1. The user clicks a project from the list.<br>2. The system queries detailed information and project members to determine the user's role. (See E2.1)<br>3. The system displays the Details screen including: Name, status, address, dates, overall progress bar (%), and action buttons (e.g. Sửa, Báo cáo BOQ, Báo cáo chi phí).<br>4. The system renders the functional tab headers. (See A4.1) |
| **Alternative Flows:** | **A4.1 Switch between Sub-menus (Step 4)**<br>1. The user clicks auxiliary tabs (Kế hoạch thi công, Nhật ký thi công, Thành viên dự án, Kiểm soát Vật tư, Kiểm kê vật tư, Sự cố, Xử lý Vật tư thừa, Đơn hàng, Mua khẩn cấp).<br>2. The system switches to and renders content for the selected tab without reloading the page. |
| **Exceptions:** | **E2.1 Project deleted or access denied (Step 2):** If the user accesses a non-existent URL or an unauthorized project<br>1. The system displays an error message indicating that the project was not found or access was denied. |
| **Priority:** | High |
| **Frequency of use:** | High |
| **Business rules:** | **BR-PRJ-08:** The "Mua khẩn cấp" (Direct Purchases) tab is only visible to the Accountant and the project's assigned Project Leader.<br>**BR-PRJ-09:** If the project status is Paused, all interactive features across tabs (except "Sự cố thi công" and specific exception in UC-040) are locked under Read-only mode. |
| **Assumptions:** | For new projects, WBS and members are empty; the system displays guidance placeholders. |
| **Other Information:** | This is the core workspace layout to execute all project-specific use cases. |

*Table 2.8.6: View project details*

---

### 2.8.7. UC-040 - Change project execution status

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-040 - Change project execution status** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Director |
| **Secondary Actors:** | None |
| **Description:** | Change project operational status (from Draft to In Progress, In Progress to Paused, Paused to In Progress, or In Progress to Done). |
| **Trigger:** | PL or TM clicks Status Action buttons on the project details header. |
| **Preconditions:** | **PRE-1.** The user has the Technical Manager or Director role.<br>**PRE-2.** The requested transition is valid for the project's current status. |
| **Postconditions:** | **POST-1.** The project status and pause/resume history are saved and synchronized in real time.<br>**POST-2.** Interactive features are locked while the project is Paused and enabled again after a valid resume.<br>**POST-3.** All project members and the Director, Technical Manager, and Accountant receive the corresponding pause/resume notification. |
| **Normal Flow:** | **UC053.0 Change Status Success**<br>1. (Draft to In Progress): An authorized user activates the project; the system verifies that at least one WBS task exists and updates the status to In Progress. (See E1.1)<br>2. (In Progress to Paused): The authorized user enters a pause reason. The system records a pause-history item (reason, user, timestamp), updates the status to Paused, locks create/edit/approve actions, broadcasts the update, and notifies all project members and key roles. (See A2.1)<br>3. (Paused to In Progress): The authorized user requests to resume. The system checks for active emergency incidents, records a resume-history item, updates the status to In Progress, unlocks actions, broadcasts the update, and notifies all project members and key roles. (See E3.1)<br>4. Project completion remains available only when the implemented completion conditions are satisfied. (See E4.1) |
| **Alternative Flows:** | **A2.1 Cancel status change (Step 2)**<br>1. On the pause confirmation modal, PL selects "Hủy bỏ".<br>2. The system closes the modal and preserves current status. |
| **Exceptions:** | **E1.1 Activate with empty WBS (Step 1):** The system blocks activation and reports that the project has no tasks.<br><br>**E3.1 Active emergency workflow (Step 3):** If any emergency incident is still in WaitingStopApproval, WaitingRecoveryPlan, or WaitingDirectorApproval, the system blocks manual resume. After the Director approves the recovery plan, TPKT prepares the required recovery Phase/Task in WBS and then explicitly resumes the project.<br><br>**E4.1 Completion conditions not met (Step 4):** The system keeps the completion action unavailable and preserves the current status. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-10:** At least one WBS task is required before activation.<br>**BR-PRJ-11:** A paused project is read-only for creation, editing, approval, inventory, and execution actions.<br>**BR-PRJ-12:** A project cannot be resumed while an emergency incident is still awaiting stop approval, recovery plan, or Director approval.<br>**BR-PRJ-13:** Rejecting an emergency incident while its project is Paused resumes the project only when no other active emergency incident remains.<br>**BR-PRJ-14:** Pause/resume events are appended to status history rather than overwriting the previous reason. |
| **Assumptions:** | Changing status to Paused immediately locks editing features globally for all members. |
| **Other Information:** | Status changes are synchronized in real time. Notifications are sent to project members and to Director, Technical Manager, and Accountant. |

*Table 2.8.7: Change project execution status*

---

### 2.8.8. UC-027 - Add member to project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-027 - Add member to project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, assigned Project Leader |
| **Secondary Actors:** | None |
| **Description:** | Add active Site Engineers to the project. TPKT can manage members globally; the assigned Project Leader can manage members of their own project. |
| **Trigger:** | TM clicks "Thêm kỹ sư" in the "Thành viên dự án" tab. |
| **Preconditions:** | **PRE-1.** The user is TPKT or the current project's assigned Leader.<br>**PRE-2.** The target account is an active Site Engineer not already in the project. |
| **Postconditions:** | **POST-1.** Selected site engineers are assigned to the project and stored in the project members list.<br>**POST-2.** Assigned members gain access to view and operate within the project workspace. |
| **Normal Flow:** | **UC037.0 Add Member Success**<br>1. TPKT or the assigned Project Leader clicks "Thêm kỹ sư".<br>2. The system opens "Thêm Kỹ sư vào Dự án".<br>3. It loads active Site Engineers not already assigned to this project.<br>4. It displays a "Trưởng nhóm - [Dự án]" badge for engineers leading another project.<br>5. The actor selects engineers and clicks "Gán".<br>6. The system validates role, active account, role type, and duplicates, then assigns the selected engineers. (See E6.1)<br>7. The modal closes, a success toast appears, the list refreshes in real time, and new members are notified. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E6.1 Duplicate member assignment (Step 6):** If selected engineer already added concurrently<br>1. The system displays an error indicating that some members are already assigned. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-PRJ-13:** Only active `siteengineer` accounts can be added.<br>**BR-PRJ-14:** A user can be assigned to a project only once.<br>**BR-PRJ-14b:** TPKT or the project's assigned Leader may add/remove Site Engineers; Leader assignment itself remains a management action for TPKT/Director. |
| **Assumptions:** | The personnel dropdown only lists active user accounts with correct roles. |
| **Other Information:** | Added members immediately see the project in their personal project list. |

*Table 2.8.8: Add member to project*

---

### 2.8.9. UC-087 - Remove member from project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-087 - Remove member from project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, assigned Project Leader |
| **Secondary Actors:** | None |
| **Description:** | Remove a Site Engineer from the project and revoke project access. TPKT may manage project members; the assigned Project Leader may remove Site Engineers from their own project. |
| **Trigger:** | TM clicks the "Xóa" button on the member card in the "Thành viên dự án" tab. |
| **Preconditions:** | **PRE-1.** The member is currently in the project.<br>**PRE-2.** The user is TPKT or the current Project Leader; a Project Leader may remove Site Engineers only. |
| **Postconditions:** | **POST-1.** The member is removed from the active project membership.<br>**POST-2.** Tasks assigned to the removed member are reset to unassigned, and project access is revoked. |
| **Normal Flow:** | **UC112.0 Remove Member Success**<br>1. TM clicks "Xóa" on the engineer's member card.<br>2. System displays a confirmation dialog: "Bạn có chắc chắn muốn xóa kỹ sư [Tên] khỏi dự án này?" (See A2.1)<br>3. TM clicks "Xóa" on the confirmation modal.<br>4. The system removes the member from the project. (See E4.1)<br>5. System closes the modal, displays success toast "Đã xóa kỹ sư [Tên] khỏi dự án.", and reloads the member list. |
| **Alternative Flows:** | **A2.1 Cancel member removal (Step 2)**<br>1. On the confirmation dialog, TM selects "Hủy".<br>2. System closes modal and the member retains their position. |
| **Exceptions:** | **E4.1 Delete Project Leader (Step 4):** If member being removed is currently the Project Leader<br>1. The system removes their Project Leader status before removing them from the project. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-15:** Removed members are archived to preserve historical daily reports and incident records.<br>**BR-PRJ-16:** Tasks assigned to the removed member are automatically reset to "Unassigned" status. |
| **Assumptions:** | Project access is revoked immediately, and the user cannot view or modify project data anymore. |
| **Other Information:** | None |

*Table 2.8.9: Remove member from project*

---

### 2.8.10. UC-044 - Assign Project Leader

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-044 - Assign Project Leader** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Director |
| **Secondary Actors:** | None |
| **Description:** | Assign or remove the Project Leader designation for an existing project member. Only one Leader can be active per project. |
| **Trigger:** | TM clicks the "Gán trưởng nhóm" or "Hủy trưởng nhóm" button on the member card. |
| **Preconditions:** | **PRE-1.** The member is currently in the project.<br>**PRE-2.** The user has the Technical Manager or Director role. |
| **Postconditions:** | **POST-1.** The selected member is designated as the Project Leader in the system.<br>**POST-2.** The user interface updates to display the Project Leader badge and grants management permissions. |
| **Normal Flow:** | **UC057.0 Assign Leader Success**<br>1. TM clicks "Gán trưởng nhóm" on a member's card (only visible if the project has no leader). (See A1.1)<br>2. The system designates the member as the Project Leader. (See E2.1)<br>3. The UI reloads displaying a golden Crown and "TRƯỞNG NHÓM" tag.<br>4. The "Gán trưởng nhóm" button is hidden on cards of all other members. |
| **Alternative Flows:** | **A1.1 Remove Leader (Step 1)**<br>1. TM clicks "Hủy trưởng nhóm" on the current leader's card.<br>2. The system removes the Project Leader designation from the member.<br>3. Crown tag is removed, and the project temporarily has no leader. |
| **Exceptions:** | **E2.1 Member does not exist (Step 2):** If TM tries to assign leader status to a member who was concurrently deleted<br>1. The system displays an error and refreshes the member list. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-17:** Maximum of one member can hold the active Project Leader role in a project at any time.<br>**BR-PRJ-18:** The Project Leader automatically obtains project management permissions (WBS subtask delegation, logs, and material workflow approvals). |
| **Assumptions:** | Appointing a new Project Leader sends updates to their dashboard workspace and updates user permissions on the fly. |
| **Other Information:** | Any leader assignment or removal logs an event to the project audit logs. |

*Table 2.8.10: Assign Project Leader*

---

### 2.8.11. UC-045 - View and interact with design drawings

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-045 - View and interact with design drawings** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows project members to view, zoom, and select from multiple design drawings or download blueprints of the project. |
| **Trigger:** | User accesses the project drawings from the WBS workspace or project details. |
| **Preconditions:** | **PRE-1.** The user is logged in and has access to the project details. |
| **Postconditions:** | **POST-1.** The system displays the interactive design drawing viewport with controls for zooming, switching drawings, and downloading. |
| **Normal Flow:** | **UC045.0 View Drawing Success**<br>1. The user accesses the project drawings.<br>2. The system retrieves the project details, including the drawings and attachments. (See E2.1)<br>3. If the active drawing is a document, the system retrieves and displays it in a document viewer. (See E3.1)<br>4. If the active drawing is an image (PNG/JPG): the system renders the image inside the responsive canvas.<br>5. The user can interact with the viewer using top control buttons: zoom in (+25%), zoom out (-25%), reset zoom (100%), or click "Tải bản vẽ" to download the file. (See A5.1) |
| **Alternative Flows:** | **A5.1 Select alternative drawing (Step 5)**<br>1. The project has multiple drawing files uploaded.<br>2. The user clicks the "Chọn bản vẽ khác" button.<br>3. The system opens a modal containing a list of all drawings with file thumbnail/icon, filename, and file size.<br>4. The user clicks on a drawing from the list.<br>5. The system closes the selection window and loads the new drawing in the viewer. |
| **Exceptions:** | **E2.1 Drawing not available (Step 2):** If the project has no design drawing URLs uploaded<br>1. The system displays a dashed box placeholder with "Chưa có bản vẽ thiết kế" and instructions.<br><br>**E3.1 PDF Loading fails (Step 3):** If the PDF document is blocked or corrupted<br>1. The system displays a warning indicating that the document failed to load and suggests uploading a new file. |
| **Priority:** | Medium |
| **Frequency of use:** | High |
| **Business rules:** | None |
| **Assumptions:** | None |
| **Other Information:** | Only Technical Managers can upload or update drawings through the current project creation and update functions. |

*Table 2.8.11: View and interact with design drawings*

---

### 2.8.12. UC-046 - View project work chart (Gantt Chart)

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-046 - View project work chart (Gantt Chart)** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Project Leader, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows users to view a visual Gantt chart of project phases, tasks, progress status, and dependencies, and update task progress directly by clicking on tasks. |
| **Trigger:** | User accesses the work chart from the workspace. |
| **Preconditions:** | **PRE-1.** The user is logged in and has access to the project details. |
| **Postconditions:** | **POST-1.** The system renders the Gantt chart displaying project phases, scheduled tasks, status color-coded task bars, dependency links, and progress metrics. |
| **Normal Flow:** | **UC046.0 View Gantt Chart Success**<br>1. The user accesses the work chart.<br>2. The system retrieves project details, phases, tasks, and members. (See E2.1)<br>3. The system parses the tasks and phases into a visual schedule format:<br>&nbsp;&nbsp;&nbsp;&nbsp;- Phases act as parent project nodes (with start/end dates derived from children and progress calculated as the average of active child tasks).<br>&nbsp;&nbsp;&nbsp;&nbsp;- Tasks act as child nodes. If start date equals deadline, it renders as a milestone.<br>&nbsp;&nbsp;&nbsp;&nbsp;- Task dependencies are rendered as sequence links.<br>4. The system colors task bars according to status (Done: green, InProgress: orange, Overdue: red, Unstarted: blue/grey). (See A4.1)<br>5. The system displays a statistics strip showing: overall project progress and count of tasks by status (Completed, In Progress, Unstarted, Paused/Obsolete). (See A5.1) (See A5.2) |
| **Alternative Flows:** | **A5.1 Switch timescale view (Step 5)**<br>1. The user clicks "Ngày", "Tuần", or "Tháng" on the scale switcher.<br>2. The system dynamically updates the unit scales and column widths, then re-renders the chart.<br><br>**A5.2 Toggle task list grid (Step 5)**<br>1. The user clicks "Thu gọn danh sách" or "Mở rộng danh sách" to control column visibility.<br>2. The system hides or shows the left grid column (Task Name, Start Date, Progress) and updates layout width.<br><br>**A4.1 Quick progress update from Gantt (Step 4)**<br>1. The user clicks a leaf task bar.<br>2. The system verifies assigned Engineer, Project Leader, or TPKT permission and confirms the project is active.<br>3. The system opens the progress input.<br>4. The user enters progress and description, then saves.<br>5. The system saves, updates task state, closes the modal, and refreshes the chart. |
| **Exceptions:** | **E2.1 WBS is empty (Step 2):** If there are no phases or tasks defined in the WBS<br>1. The system overlays a placeholder stating "Chưa có dữ liệu WBS. Hãy tạo Phase và Task trước." |
| **Priority:** | Medium |
| **Frequency of use:** | High |
| **Business rules:** | **BR-GANTT-01:** Phase progress is calculated as the average progress of its active child tasks.<br>**BR-GANTT-02:** Quick progress updates are blocked for parent tasks or obsolete/paused tasks. |
| **Assumptions:** | None |
| **Other Information:** | Task progress logs and daily logs are created automatically when progress is updated via the Gantt chart popup. |

*Table 2.8.12: View project work chart (Gantt Chart)*

---

## 2.9 Warehouse and Inventory Module   (Kiểm kê và Điều chỉnh vật tư)

### 2.9.1. UC-101 - View inventory adjustments list

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-101 - View inventory adjustments list** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Project Leader, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows users to view the list of inventory adjustments (increases and decreases) within a project, apply search query, type filters, and status filters. |
| **Trigger:** | User navigates to the "Kiểm kê vật tư" tab inside the Project Layout Hub. |
| **Preconditions:** | **PRE-1.** The user has logged in and has access to the project workspace. |
| **Postconditions:** | **POST-1.** The system displays the list of inventory adjustment slips matching the applied search and status filters. |
| **Normal Flow:** | **UC101.0 View Adjustments List Success**<br>1. The user selects the "Kiểm kê vật tư" tab within the project detail workspace.<br>2. The system retrieves the list of inventory adjustments based on the specified filters. (See E2.1)<br>3. The system displays the adjustment table containing: Adjustment Code (e.g. ADJ-00001), Type (Increase/Decrease), Reason, Status (Pending, Approved, Rejected), Created Date, Approver Name, and a "Xem chi tiết" (or "Chi tiết") action button.<br>4. Users can type a search term to filter by code or reason, or select adjustment type (Tất cả, Tăng tồn kho, Giảm tồn kho) or status (Tất cả, Chờ duyệt, Đã duyệt, Từ chối). (See A4.1) |
| **Alternative Flows:** | **A4.1 Search and filter adjustments (Step 4)**<br>1. The user enters a keyword in the search box or chooses a filter option (type/status).<br>2. The system applies the filters and displays the matching records. |
| **Exceptions:** | **E2.1 No data available (Step 2):** If there are no adjustment slips matching the filters<br>1. The system displays an empty table state with the text "Không có dữ liệu phiếu kiểm kê". |
| **Priority:** | Medium |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-INV-01:** Project viewers are Director, Technical Manager, Accountant, and Site Engineer. Site Engineers are scoped to assigned projects; global authorities can view the projects allowed by the project-access service.<br>**BR-INV-01A:** Pending Increase slips display "Chờ phê duyệt" and are actionable by TPKT; pending Decrease slips display "Chờ Giám đốc duyệt" and are actionable by Director.<br>**BR-INV-01B:** While the project is Paused, records remain viewable but creation and review actions are read-only. |
| **Assumptions:** | None |
| **Other Information:** | The list reloads automatically when adjustments are updated by other users. |

*Table 2.9.1: View inventory adjustments list*

---

### 2.9.2. UC-102 - Create inventory increase adjustment

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-102 - Create inventory increase adjustment** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Project Leader (a project member marked `IsLeader`) |
| **Secondary Actors:** | None |
| **Description:** | Allows the assigned Project Leader to create an inventory increase adjustment slip for an active phase. Materials are selected from that phase's BOQ. The slip starts in "Pending" and requires Technical Manager approval before stock changes. |
| **Trigger:** | PL clicks the "Phiếu Tăng" button in the "Kiểm kê vật tư" tab. |
| **Preconditions:** | **PRE-1.** The project is InProgress.<br>**PRE-2.** The current user is the assigned Project Leader.<br>**PRE-3.** At least one non-completed phase has BOQ material data. |
| **Postconditions:** | **POST-1.** An Increase adjustment is saved as Pending and TPKT is notified.<br>**POST-2.** No stock changes occur until TPKT approves the slip. |
| **Normal Flow:** | **UC102.0 Create Increase Adjustment Success**<br>1. PL clicks "Phiếu Tăng".<br>2. The system opens "Tạo Phiếu Tăng Tồn Kho" and lists only phases that are not frozen/completed/approved and whose progress is below 100%.<br>3. PL selects a phase; the system loads that phase's BOQ materials.<br>4. PL enters a mandatory reason and optional note.<br>5. PL selects a BOQ material, enters a positive quantity, and clicks "Thêm". The system prevents duplicate materials and enforces integer quantities for discrete units. (See E5.1)<br>6. PL submits the slip.<br>7. The system verifies that the project is still InProgress and that the phase belongs to the project, saves a Pending Increase slip, notifies TPKT, broadcasts the new record, and refreshes the list. |
| **Alternative Flows:** | **A3.1 Cancel creation (Step 3)**<br>1. PL clicks the "Hủy" or "X" button on the modal.<br>2. The system closes the modal without making any changes. |
| **Exceptions:** | **E5.1 Validation fails (Step 5):** The system blocks an empty phase/reason/item list, non-positive quantity, duplicate material, or fractional quantity for a discrete unit.<br><br>**E7.1 Project no longer active (Step 7):** If the project was paused, closed, or not started before submission, the system rejects the request and changes no stock. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-02:** Only the assigned Project Leader may create an Increase slip.<br>**BR-INV-02A:** Only materials in the selected phase BOQ are selectable.<br>**BR-INV-02B:** Completed/frozen/approved or 100%-progress phases are excluded.<br>**BR-INV-02C:** Only TPKT may approve/reject a Pending Increase slip; approval credits stock and creates positive inventory transactions. |
| **Assumptions:** | Stock balance modification takes effect immediately upon approval. |
| **Other Information:** | The system sends a notification to TPKT indicating a new inventory increase adjustment is pending review. |

*Table 2.9.2: Create inventory increase adjustment*

---

### 2.9.3. UC-103 - Create inventory decrease adjustment

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-103 - Create inventory decrease adjustment** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Accountant |
| **Secondary Actors:** | None |
| **Description:** | Allows the Accountant to create an inventory decrease adjustment slip to deduct materials from the virtual stock (loss, damage, site audit shortage). This slip requires Director approval. |
| **Trigger:** | Accountant clicks the "Phiếu Giảm (Giai đoạn)" button in the "Kiểm kê vật tư" tab, or accesses it from an unresolved inventory incident. |
| **Preconditions:** | **PRE-1.** The project is InProgress.<br>**PRE-2.** The user has the Accountant role.<br>**PRE-3.** The selected phase is active and belongs to the project. |
| **Postconditions:** | **POST-1.** An inventory decrease adjustment record is created and saved with status "Pending" awaiting Director approval. |
| **Normal Flow:** | **UC103.0 Create Decrease Adjustment Success**<br>1. Accountant clicks "Phiếu Giảm (Giai đoạn)". (See A1.1)<br>2. The system opens "Tạo Phiếu Giảm Tồn Kho (Theo Giai đoạn)" and lists only non-completed phases.<br>3. Accountant selects a predefined reason (periodic balance, allowed shrinkage, disposal of expired/damaged stock) or chooses "Khác" and enters a custom reason; then selects a phase and optional note.<br>4. Accountant selects only materials currently in stock, enters a positive quantity, and clicks "Thêm".<br>5. The system prevents duplicates, quantity above current stock, and fractional quantity for discrete units. (See E5.1) (See E5.2)<br>6. Accountant clicks "Tạo Phiếu Trình Duyệt".<br>7. The system saves a Pending Decrease slip without changing stock, notifies the Director, broadcasts the new record, and refreshes the list. |
| **Alternative Flows:** | **A1.1 Linked to an inventory incident (Step 1)**<br>1. Accountant opens a WaitingAccountant inventory incident and chooses to create the decrease slip.<br>2. The system locks reason to "Xử lý sự cố", locks the incident phase, parses materials from both description and damage-description tables, and shows the original report/images.<br>3. Accountant verifies the extracted items and submits.<br>4. The adjustment stores the exact `IncidentId`; the incident moves to WaitingDirector and the Director is notified. No stock is deducted yet. |
| **Exceptions:** | **E5.1 Validation fails (Step 5):** Missing reason, phase, or items; duplicate material; non-positive quantity; or a fractional quantity for a discrete unit blocks submission.<br><br>**E5.2 Insufficient stock (Step 5):** A quantity above current stock is rejected.<br><br>**E7.1 Project no longer active (Step 7):** A paused/closed/not-started project rejects creation and leaves the incident and stock unchanged. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-03:** Decrease slips target a phase, start Pending, and require Director approval before stock deduction.<br>**BR-INV-03A:** A linked slip persists the exact `IncidentId`; legacy text/phase matching is only a fallback.<br>**BR-INV-03B:** Creating a linked slip moves WaitingAccountant to WaitingDirector.<br>**BR-INV-03C:** Creation is blocked unless the project is InProgress. |
| **Assumptions:** | The current inventory cache is up-to-date. |
| **Other Information:** | For linked incidents, the system tracks and updates the incident status upon approval or rejection. |

*Table 2.9.3: Create inventory decrease adjustment*

---

### 2.9.4. UC-104 - Approve/Reject inventory adjustment

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-104 - Approve/Reject inventory adjustment** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager (Increase), Director (Decrease) |
| **Secondary Actors:** | None |
| **Description:** | Allows the Technical Manager (TPKT) to approve/reject pending inventory increase adjustments, and the Director to review, approve, or reject pending inventory decrease adjustments. |
| **Trigger:** | TPKT or Director clicks the "Chi tiết" or "Xem chi tiết" button on a Pending adjustment slip. |
| **Preconditions:** | **PRE-1.** The slip is Pending.<br>**PRE-2.** The user is TPKT for Increase or Director for Decrease.<br>**PRE-3.** The project is still InProgress. |
| **Postconditions:** | **POST-1.** The inventory adjustment status is updated to "Approved" or "Rejected".<br>**POST-2.** Upon approval of an Increase slip, material quantities are added to project stock. Upon approval of a Decrease slip, material quantities are deducted.<br>**POST-3.** Inventory transaction records are logged for auditing purposes. |
| **Normal Flow:** | **UC104.0 Approve Adjustment Success**<br>1. Authorized user (TPKT for Increase, Director for Decrease) clicks "Chi tiết" on a Pending adjustment slip.<br>2. The system opens the "Chi tiết Phiếu Kiểm Kê" Modal rendering general info, notes, items list, and linked incident details (if any).<br>3. User evaluates the information and clicks "Duyệt phiếu". (See A3.1)<br>4. System displays confirmation. User clicks confirm.<br>5. The system processes the approval.<br>6. The system sets the status to approved, updates material quantities in stock (+ for Increase, - for Decrease), logs inventory transactions, and marks any linked incidents as approved. (See E6.1)<br>7. System sends a notification to the creator, closes the modal, and refreshes the list. |
| **Alternative Flows:** | **A3.1 Reject adjustment (Step 3)**<br>1. In the details modal, user clicks "Từ chối".<br>2. The system prompts for a "Lý do từ chối".<br>3. User enters the reason and clicks "Xác nhận từ chối".<br>4. The system updates status to rejected, logs the reason, notifies creator, and refreshes list. |
| **Exceptions:** | **E6.1 Insufficient stock at approval time (Decrease only):** The transaction is rejected atomically; the slip remains Pending and neither stock nor linked incident is changed.<br><br>**E5.1 Project Paused/closed/not started:** Approval and rejection are blocked and the modal remains read-only. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-04:** TPKT alone reviews Increase; Director alone reviews Decrease.<br>**BR-INV-05:** Rejecting a linked Decrease slip rejects the exact linked incident and stores the reason in its handling instruction.<br>**BR-INV-06:** Approving a linked Decrease slip marks that incident Approved and records transaction type IncidentLoss; ordinary slips use Adjustment.<br>**BR-INV-07:** Approval creates positive transactions for Increase and negative transactions for Decrease, and notifies the slip creator. |
| **Assumptions:** | None |
| **Other Information:** | The system updates inventory views in real time for active users. |

*Table 2.9.4: Approve/Reject inventory adjustment*

---

## 2.10 Incident Management Module (Quản lý Sự cố thi công và Vật tư)

### 2.10.1. UC-201 - View incidents list

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-201 - View incidents list** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Project Leader, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows users to view construction and inventory incidents either inside an authorized project or in the global incident views. Director, Accountant, and TPKT can load the cross-project list; Site Engineers are limited to projects to which they have access. |
| **Trigger:** | User clicks on the "Sự cố thi công" tab in project detail, or "Sự cố vật tư" tab in inventory workspace, or "Global Incidents" menu. |
| **Preconditions:** | **PRE-1.** The user has a valid login session with appropriate access permissions. |
| **Postconditions:** | **POST-1.** The system displays the list of construction and inventory incidents matching the user's role and filter options. |
| **Normal Flow:** | **UC201.0 View Incidents List Success**<br>1. The user opens the project "Sự cố thi công" tab or a global incident view.<br>2. The system checks role/project access and retrieves the permitted records. (See E2.1)<br>3. The project board displays Total, Pending, and Resolved metrics, type and date-range filters, and paginated incident rows.<br>4. Each row shows date, type/emergency indicator, affected task or phase, reporter, status badge, and View action.<br>5. Selecting a record opens the status-aware detail modal. Real-time create/update events refresh both project and global views. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 No incidents found (Step 2):** If the system queries and finds no incidents matching criteria<br>1. The system displays an empty state placeholder. |
| **Priority:** | Medium |
| **Frequency of use:** | High |
| **Business rules:** | **BR-INC-01:** The cross-project incident view is limited to Director, Technical Manager, and Accountant. Site Engineers use project-scoped views only.<br>**BR-INC-01A:** Active emergency incidents are WaitingStopApproval, WaitingRecoveryPlan, or WaitingDirectorApproval and are highlighted separately. |
| **Assumptions:** | None |
| **Other Information:** | The list synchronizes in real time. |

*Table 2.10.1: View incidents list*

---

### 2.10.2. UC-202 - Report construction incident

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-202 - Report construction incident** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Site Engineer (including an assigned Project Leader), Technical Manager |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Site Engineer or Project Leader to report a construction incident on a specific task (damage, rework needed due to errors or force majeure). |
| **Trigger:** | User clicks "Báo cáo sự cố" button inside the Task Detail modal. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user must be a member of the project with reporting rights. |
| **Postconditions:** | **POST-1.** A new construction incident report is created with pending review status.<br>**POST-2.** Uploaded scene images and incident details are saved and attached to the report. |
| **Normal Flow:** | **UC202.0 Report Construction Incident Success**<br>1. User clicks "Báo cáo sự cố" in Task Detail.<br>2. The modal displays an orange "Sự cố Thi công" classification banner and fixes IncidentType to Construction.<br>3. User enters a description (minimum 5 characters), occurrence date/time, optional responsible project member/team, canceled volume, estimated damage, labor days, and delay days.<br>4. User selects "Tạo Rework Task", "Giảm tiến độ task", or "Khác"; custom text is mandatory for "Khác".<br>5. User uploads up to 5 images, each no larger than 10 MB. Submission is enabled only after every image is uploaded successfully; failed or invalid upload results are rejected.<br>6. The system saves the incident as WaitingReview, notifies TPKT, broadcasts the record, and shows a success toast. |
| **Alternative Flows:** | **A3.1 Cancel reporting (Step 3)**<br>1. User clicks the "Hủy" or "X" button on the modal.<br>2. The system closes the modal without saving data. |
| **Exceptions:** | **E7.1 Validation fails (Step 7):** If user submits with missing mandatory fields or invalid dates<br>1. The system blocks the submission and highlights errors. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-INC-02:** A normal construction incident requires a TaskId and cannot have a future occurrence time.<br>**BR-INC-02A:** The reporter must be a project member or a Technical Manager/Director with management access; creation is available to Technical Manager or Site Engineer accounts. |
| **Assumptions:** | None |
| **Other Information:** | Images are compressed and uploaded when reporting the incident. |

*Table 2.10.2: Report construction incident*

---

### 2.10.3. UC-203 - Report emergency stop incident

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-203 - Report emergency stop incident** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Project Leader (a Site Engineer marked `IsLeader`) |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Project Leader to report a severe emergency incident (force majeure, site collapse, severe weather disaster) and formally request an immediate project halt. |
| **Trigger:** | PL clicks "Báo cáo khẩn cấp & Yêu cầu dừng dự án" button in the Incidents tab. |
| **Preconditions:** | **PRE-1.** The project is InProgress.<br>**PRE-2.** The user is the assigned Project Leader. |
| **Postconditions:** | **POST-1.** An emergency incident is submitted as WaitingStopApproval; the project remains InProgress until TPKT approves the stop.<br>**POST-2.** TPKT, Director, Accountant, and project members receive notifications. |
| **Normal Flow:** | **UC203.0 Report Emergency Stop Success**<br>1. PL clicks "Báo cáo khẩn cấp & Yêu cầu dừng dự án" button.<br>2. The system opens the "Báo cáo Sự cố khẩn cấp & Yêu cầu Dừng dự án" Modal.<br>3. PL inputs emergency details: Affected Work Item (Hạng mục thi công), Occurrence Date/Time (Thời gian xảy ra), Severity Level (Mức độ sự cố), Location (Địa điểm), Classification (Loại sự cố), Event Sequence Description (Mô tả chi tiết diễn biến), Casualty Damage (Thiệt hại con người), Schedule Impact (Thiệt hại tiến độ), Property/Material Loss (Thiệt hại tài sản/vật tư), Root Cause (Nguyên nhân ban đầu), and Containment Measures (Biện pháp khẩn cấp). PL uploads up to 5 scene images. (See A3.1)<br>4. PL clicks "Gửi biên bản báo cáo dừng dự án".<br>5. The system validates mandatory inputs, uploads scene images, and submits the emergency incident in WaitingStopApproval status. (See E5.1)<br>6. System closes modal and shows success toast "Yêu cầu ngừng thi công khẩn cấp đã được gửi thành công lên TPKT." |
| **Alternative Flows:** | **A3.1 Cancel reporting (Step 3)**<br>1. PL clicks "Hủy" or "X" button.<br>2. The system closes the modal and discards changes. |
| **Exceptions:** | **E5.1 Mandatory fields empty (Step 5):** If PL submits without filling required text fields<br>1. System displays validation alerts on missing mandatory fields and blocks submission. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-03:** An emergency request starts WaitingStopApproval and pauses the project only after TPKT confirms it.<br>**BR-INC-03A:** Rejecting requires a non-empty reason. If the project had already been paused and no other active emergency remains, rejection restores InProgress and records a resume-history event. |
| **Assumptions:** | None |
| **Other Information:** | None |

*Table 2.10.3: Report emergency stop incident*

---

### 2.10.4. UC-204 - Resolve construction incident

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-204 - Resolve construction incident** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager (assessment/stop/recovery plan), Director (recovery-plan decision) |
| **Secondary Actors:** | None |
| **Description:** | Allows the Technical Manager (for normal/emergency incidents) or Director (for emergency plan approval) to assess and resolve construction incidents by creating a rework task, penalizing task progress, or approving a multi-phase emergency recovery plan. |
| **Trigger:** | TPKT clicks "Phê duyệt" / "Chi tiết" on a pending construction incident, or Director reviews a pending recovery plan. |
| **Preconditions:** | **PRE-1.** The incident is WaitingReview, WaitingStopApproval, WaitingRecoveryPlan, or WaitingDirectorApproval.<br>**PRE-2.** The current role matches the current workflow step. |
| **Postconditions:** | **POST-1.** The incident status is updated to "Approved" or "Rejected".<br>**POST-2.** Corresponding resolution actions (rework task creation, progress deduction, or project status change) are processed and saved in the system. |
| **Normal Flow:** | **Option A: Normal incident (WaitingReview)**<br>1. TPKT opens the detail and chooses to assess/approve.<br>2. For Rework, TPKT provides task name, deadline, and assignee; the original task becomes Obsolete and a zero-progress Rework task is created.<br>3. For progress correction, TPKT provides a new progress value lower than or equal to the current value and a reason; the system writes both progress history and a Daily Log.<br>4. The incident becomes Approved and real-time views refresh. (See A4.1)<br><br>**Option B: Emergency lifecycle**<br>1. **WaitingStopApproval:** TPKT approves the stop. The project becomes Paused, pause history is appended, incident becomes WaitingRecoveryPlan, and project members plus key roles are notified.<br>2. **WaitingRecoveryPlan:** TPKT submits non-empty recovery-plan content, optional estimate, instruction, and uploaded plan files. The incident becomes WaitingDirectorApproval.<br>3. **WaitingDirectorApproval:** Director either requests resubmission (back to WaitingRecoveryPlan with instruction) or approves. On approval, every unfinished non-Obsolete task in the project is marked Obsolete with progress-history entries, and the incident becomes Approved.<br>4. Approval does **not** automatically resume the project or automatically create recovery WBS when the emergency report has no TaskId. TPKT prepares the recovery Phase/Task in WBS and then uses "Tiếp tục dự án"; only then does the project return to InProgress. |
| **Alternative Flows:** | **A4.1 Reject normal/stop incident:** The authorized reviewer enters a mandatory reason; the system sets Rejected and notifies the reporter. If an emergency rejection occurs while the project is Paused, it resumes only when no other active emergency remains.<br><br>**A3.1 Director requests revision:** Director enters mandatory revision instructions; the incident returns to WaitingRecoveryPlan and TPKT is notified. |
| **Exceptions:** | **E5.1 New progress value exceeds current progress (Step 5):** If the new progress is greater than current progress<br>1. The system blocks the submission and displays an error. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-INC-04:** Rework dates and assignee are mandatory when Rework is chosen; corrected progress cannot exceed current progress.<br>**BR-INC-05:** Obsolete tasks reject future execution updates and retain audit history.<br>**BR-INC-05A:** Director approval closes the emergency workflow but manual project resume is a separate, guarded action.<br>**BR-INC-05B:** All active emergency statuses block manual resume. |
| **Assumptions:** | None |
| **Other Information:** | None |

*Table 2.10.4: Resolve construction incident*

---

### 2.10.5. UC-205 - Report inventory incident

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-205 - Report inventory incident** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Project Leader (a Site Engineer marked `IsLeader`) |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Project Leader to report an inventory loss or damage incident on site (materials lost due to theft, weather damage, etc.). |
| **Trigger:** | PL clicks "Báo cáo sự cố vật tư" in WBS Phase context menu. |
| **Preconditions:** | **PRE-1.** The project is InProgress.<br>**PRE-2.** The user is the assigned Project Leader. |
| **Postconditions:** | **POST-1.** An inventory incident report is submitted with status "WaitingAccountant" awaiting accountant verification.<br>**POST-2.** Details of damaged/lost materials and scene photos are attached to the report. |
| **Normal Flow:** | **UC205.0 Report Inventory Incident Success**<br>1. PL selects "Báo cáo sự cố vật tư" on a Phase.<br>2. The system opens the "Lập Báo cáo Sự cố Vật tư Kho (Trưởng nhóm)" Modal.<br>3. PL selects incident type (InventoryLoss or InventoryDamage) and enters description (at least 5 characters) and discovery date.<br>4. PL clicks "Thêm vật tư" to select materials from the current project inventory. For each material, PL inputs the "Số lượng lỗi/mất" and clicks add. (See E4.1)<br>5. PL uploads up to 5 images.<br>6. PL clicks "Gửi báo cáo".<br>7. The system formats the list of items, uploads images, and saves the incident with a status awaiting accountant verification, notifying relevant users. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E4.1 Material quantity exceeds stock (Step 4):** If PL enters a quantity lost higher than current stock<br>1. System displays a warning and blocks item addition. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-06:** An inventory incident requires a PhaseId and quantities cannot exceed current stock.<br>**BR-INC-06A:** New inventory incidents are saved directly as WaitingAccountant and notify Accountant, TPKT, and Director.<br>**BR-INC-06B:** The selected damaged-material table is preserved for later exact-item extraction into the linked Decrease slip. |
| **Assumptions:** | None |
| **Other Information:** | The damage description table formatted as markdown is used by accountants later to generate decrease adjustment slips. |

*Table 2.10.5: Report inventory incident*

---

### 2.10.6. UC-206 - Verify and Approve inventory incident

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-206 - Verify and Approve inventory incident** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Accountant, Director |
| **Secondary Actors:** | None |
| **Description:** | Allows the Accountant to verify an inventory incident and the Director to approve it. The stock is deducted upon Director approval of the linked decrease adjustment slip. |
| **Trigger:** | Accountant selects a "WaitingAccountant" incident, or Director reviews a "WaitingDirector" incident. |
| **Preconditions:** | **PRE-1.** The incident status is "WaitingAccountant" (for Accountant) or "WaitingDirector" (for Director). |
| **Postconditions:** | **POST-1.** The inventory incident is verified by the Accountant and linked to a decrease adjustment slip.<br>**POST-2.** Upon Director approval of the linked slip, inventory stock is deducted and the incident status is updated to "Approved". |
| **Normal Flow:** | **UC206.0 Verify and Approve Incident Success**<br>**Step 1: Accountant verification**<br>1. Accountant opens a WaitingAccountant incident and starts the linked Decrease slip.<br>2. The modal fixes the incident phase and reason, loads report/images, extracts damaged items, and displays stock before/after values.<br>3. Accountant submits. The system saves the exact IncidentId on the Pending slip and moves the incident to WaitingDirector without deducting stock.<br><br>**Step 2: Director approval**<br>1. Director opens the linked Pending Decrease slip and confirms approval.<br>2. In one transaction, the system rechecks stock, approves the slip, deducts each item, writes IncidentLoss transactions, marks the exact linked incident Approved, records reviewer data, and notifies the creator. |
| **Alternative Flows:** | **A2.1 Rejection:** Director enters a mandatory reason and rejects the linked slip. The slip and exact linked incident become Rejected; stock stays unchanged and the creator is notified. |
| **Exceptions:** | **E1.1 Verification by non-accountant (Step 1):** If a user without Accountant role tries to verify incident<br>1. The system blocks the request and displays an access error. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-07:** Stock deduction occurs only after Director approval, never during report or Accountant verification.<br>**BR-INC-07A:** `InventoryAdjustment.IncidentId` is the authoritative link used to synchronize status; description/phase matching exists only for legacy records.<br>**BR-INC-07B:** Approval/rejection is blocked while the project is not InProgress. |
| **Assumptions:** | None |
| **Other Information:** | None |

*Table 2.10.6: Verify and Approve inventory incident*

---

## 2.11 Reports Module (Trung tâm Báo cáo)

### 2.11.1. UC-301 - View executive dashboard report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-301 - View executive dashboard report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows authorized report users to view project-level or accessible-project aggregate metrics: task totals, completion counts, delayed and at-risk tasks, BOQ warnings, phase progress, period comparison, cross-project matrix, and monthly progress trends. |
| **Trigger:** | User opens Reports Hub and selects the "Tổng quan" tab. |
| **Preconditions:** | **PRE-1.** User is authenticated as Director, Technical Manager, Accountant, or Site Engineer.<br>**PRE-2.** User has access to the selected project; Site Engineers are project-scoped. |
| **Postconditions:** | **POST-1.** The system returns executive dashboard data filtered by selected project and optional date range. |
| **Normal Flow:** | **UC301.0 View Executive Dashboard Success**<br>1. User selects one project or all accessible projects (`projectId = 0`).<br>2. User optionally sets `fromDate` and `toDate`.<br>3. The system requests executive dashboard report data.<br>4. The system validates Reports role permission and project access.<br>5. The system loads phases, active tasks, BOQ-overrun material requests, incidents, purchase orders, and related project data.<br>6. The system displays task metrics, phase breakdown, delayed/at-risk task list, over-BOQ material count, over-BOQ request count, period comparison, cross-project matrix, and monthly progress trend. |
| **Alternative Flows:** | **A2.1 Date range filter**<br>1. If `fromDate`/`toDate` are provided, active task metrics include tasks overlapping the range, and material request/incident/procurement comparisons use the selected period. |
| **Exceptions:** | **E4.1 Forbidden project**<br>1. If selected project is outside the user's accessible project set, the system returns `ERR_FORBIDDEN`.<br><br>**E4.2 No data**<br>1. The system returns zero-valued metrics and empty lists. |
| **Priority:** | High |
| **Frequency of use:** | High |
| **Business rules:** | **BR-REP-01:** Obsolete tasks are excluded from active totals and progress calculations.<br>**BR-REP-02:** Delayed task = task end date has passed and task is not completed/approved.<br>**BR-REP-03:** At-risk task = task is not completed, has started, has 3 days or fewer remaining, and progress is at least 20% behind expected schedule.<br>**BR-REP-04:** `MaterialsExceedingBOQ` counts distinct material IDs from over-BOQ request items; `OverBoqMaterialRequests` counts requests containing at least one over-BOQ item.<br>**BR-REP-05:** Monthly actual progress uses `TaskProgressLog` snapshots at month end when available. |
| **Assumptions:** | BOQ monetary value is estimated from average purchase prices because `BOQItem` currently stores quantity and conversion rate but not official BOQ unit price. |
| **Other Information:** | This service is exposed by `ReportsController` under the Reports role policy. |

*Table 2.11.1: View executive dashboard report*

---

### 2.11.2. UC-302 - View consolidated executive report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-302 - View consolidated executive report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Combines executive dashboard, construction progress, BOQ vs actual, incident, procurement, cross-project matrix, and generated executive insights into one management report. |
| **Trigger:** | User opens the consolidated executive report view or export flow. |
| **Preconditions:** | **PRE-1.** User has Reports role permission.<br>**PRE-2.** User can access the selected project or selected all accessible projects. |
| **Postconditions:** | **POST-1.** The system returns a consolidated report DTO with project name, generated time, selected date range, component reports, and insight text. |
| **Normal Flow:** | **UC302.0 View Consolidated Report Success**<br>1. User selects project scope and optional date range.<br>2. The system requests consolidated executive report data.<br>3. The handler sequentially requests dashboard, construction progress, BOQ, incident, and procurement reports.<br>4. The system resolves selected project name or uses "Tất cả dự án (Tổng hợp toàn hệ thống)" for aggregate scope.<br>5. The system generates executive insights from progress, delayed task count, procurement cost, BOQ variance, and incident loss. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E3.1 Empty child report data**<br>1. If a child report returns no DTO, the system raises `ERR_REPORT_DATA_EMPTY`.<br><br>**E3.2 Forbidden project**<br>1. Child report access checks return `ERR_FORBIDDEN`. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-06:** Child reports are invoked sequentially to avoid concurrent EF Core operations on the same scoped DbContext.<br>**BR-REP-07:** Consolidated insight text is derived from report DTOs and does not write back to the database. |
| **Assumptions:** | This use case is read-only and intended for management review. |
| **Other Information:** | Generated time is UTC. |

*Table 2.11.2: View consolidated executive report*

---

### 2.11.3. UC-303 - View construction progress report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-303 - View construction progress report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Provides WBS progress analytics by phase, task status totals, expected progress, schedule variance, forecasted end date, phase acceptance history, assignee performance, progress insights, and monthly progress trends. |
| **Trigger:** | User clicks the "Tiến độ thi công" tab. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access. |
| **Postconditions:** | **POST-1.** The system displays construction progress data for the selected project or accessible aggregate scope. |
| **Normal Flow:** | **UC303.0 View Construction Progress Success**<br>1. User selects project scope and optional date range.<br>2. The system requests construction progress report data.<br>3. The system loads phases, tasks, assignees, task progress logs, and phase acceptances.<br>4. The system calculates task totals by status, weighted actual progress, weighted expected progress, schedule variance days, forecasted end date, delayed tasks, assignee performance, and insight messages.<br>5. The system displays phase cards, task summaries, delayed task lists, acceptance records, assignee performance, insights, and monthly trend data. |
| **Alternative Flows:** | **A2.1 Date range filter**<br>1. Active task metrics include tasks whose baseline date range overlaps the selected date range; phase acceptance records use acceptance date filtering. |
| **Exceptions:** | **E3.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-08:** Obsolete tasks are excluded from active progress and active task totals; obsolete count remains as audit metric.<br>**BR-REP-09:** Weighted progress uses task `Weight` when present and falls back to 1.<br>**BR-REP-10:** Monthly actual progress is reconstructed from the latest `TaskProgressLog` at each month-end. |
| **Assumptions:** | Forecasted end date is an estimate based on elapsed time and current weighted progress. |
| **Other Information:** | Insight text is generated server-side. |

*Table 2.11.3: View construction progress report*

---

### 2.11.4. UC-304 - View BOQ vs actual report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-304 - View BOQ vs actual report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Compares BOQ material limits with issued quantity, returned quantity, net consumption, current stock, pending PO quantity, pending MR quantity, earned BOQ limit, and estimated monetary variance. |
| **Trigger:** | User clicks the "Định mức BOQ" tab. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access.<br>**PRE-2.** BOQ items exist for project phases. |
| **Postconditions:** | **POST-1.** The system displays BOQ usage by material and monthly consumption trend. |
| **Normal Flow:** | **UC304.0 View BOQ vs Actual Success**<br>1. User selects project scope and optional date range.<br>2. The system requests BOQ vs actual report data.<br>3. The system groups BOQ items by material and normalizes quantities by conversion rate.<br>4. The system loads current inventory, issuances, returns, pending POs, pending MRs, average purchase price, and task progress.<br>5. The system displays each material with BOQ limit, earned BOQ limit, issued, returned, net consumption, stock remaining, pending PO/MR quantities, usage percentages, and value variance. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied.<br><br>**E3.1 No BOQ items**<br>1. The system returns zero counts and empty lists. |
| **Priority:** | High |
| **Frequency of use:** | High |
| **Business rules:** | **BR-REP-11:** `NetConsumption = max(0, TotalIssued - TotalReturned)`.<br>**BR-REP-12:** A material is over BOQ when `NetConsumption > BoqLimit`.<br>**BR-REP-13:** Earned BOQ limit = `BoqLimit * OverallProgressPercent / 100`.<br>**BR-REP-14:** Monetary values use project-scoped average PO unit price normalized by conversion rate. |
| **Assumptions:** | Monetary BOQ values are estimates because official BOQ unit price is not stored in `BOQItem`. |
| **Other Information:** | `TotalExpectedUsage` currently means `NetConsumption + StockRemaining`; pending PO/MR quantities are reported separately. |

*Table 2.11.4: View BOQ vs actual report*

---

### 2.11.5. UC-305 - View incident report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-305 - View incident report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Summarizes incidents by status and displays incident records including type, description, reporter, reviewer, phase/task, damage, estimated delay, rework task, and monthly incident trend. |
| **Trigger:** | User clicks the "Sự cố & Rework" tab. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access. |
| **Postconditions:** | **POST-1.** The system displays incident totals, open/resolved counts, rework count, incident list, and monthly trend. |
| **Normal Flow:** | **UC305.0 View Incident Report Success**<br>1. User selects project scope and optional date range.<br>2. The system requests incident report data.<br>3. The system loads incidents with reporter, reviewer, task, phase, and rework task.<br>4. The system classifies resolved incidents by status `Approved`, `Resolved`, `Closed`, or `Completed`.<br>5. The system displays summary cards, incident table, and monthly trend. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied. |
| **Priority:** | Medium |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-15:** Open incident count is total incidents minus resolved-status incidents.<br>**BR-REP-16:** Monthly loss trend sums `EstimatedMaterialLoss` only when present. |
| **Assumptions:** | Incident description is returned as stored by the incident feature; no markdown cleanup is performed by the report handler. |
| **Other Information:** | `HasReworkTask` is true when `ReworkTaskId` exists. |

*Table 2.11.5: View incident report*

---

### 2.11.6. UC-306 - View inventory movement and ledger reports

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-306 - View inventory movement and ledger reports** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Allows authorized report users to view inventory movement balances by material and a current inventory ledger with recent inventory transactions. |
| **Trigger:** | User clicks the "Nhập xuất tồn" tab or opens the inventory ledger view. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access. |
| **Postconditions:** | **POST-1.** The system displays movement totals by material and/or current stock plus recent transaction ledger. |
| **Normal Flow:** | **UC306.0 View Inventory Movement Success**<br>1. User selects project scope and optional date range.<br>2. The system requests inventory movement report data.<br>3. The system loads inventory transactions and current inventory for selected scope.<br>4. The system calculates opening balance before `fromDate`, period receipts, issuances, returns, transfers in/out, adjustments, and closing balance.<br><br>**UC306.1 View Inventory Ledger Success**<br>1. User opens ledger view for a specific project.<br>2. The system requests inventory ledger report data.<br>3. The system returns current stock summary, zero-stock count, and latest 500 inventory transactions with creator names when available. |
| **Alternative Flows:** | **A2.1 No date range for movement**<br>1. If no date range is supplied, closing balance falls back to `CurrentInventory.Quantity`. |
| **Exceptions:** | **E2.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-17:** Movement categories are derived from `InventoryTransaction.ReferenceType` values such as `GoodsReceipt`, `MaterialIssuance`, `MaterialReturn`, `SurplusTransferReceive`, `SurplusTransferDispatch`, and `InventoryAdjustment`.<br>**BR-REP-18:** Ledger service is project-specific and returns the latest 500 transactions ordered by creation time descending. |
| **Assumptions:** | Inventory transactions are the source of truth for historical movement; current inventory is the source of truth for current balance when no period filter is applied. |
| **Other Information:** | The system provides both movement and ledger report views. |

*Table 2.11.6: View inventory movement and ledger reports*

---

### 2.11.7. UC-307 - View procurement report

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-307 - View procurement report** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Director, Technical Manager, Accountant, Site Engineer |
| **Secondary Actors:** | None |
| **Description:** | Consolidates purchase order cost, approved direct purchase cost, estimated material issuance value, purchase order list, direct purchase list, and monthly procurement trends. |
| **Trigger:** | User clicks the "Mua sắm & Chi phí" tab. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access. |
| **Postconditions:** | **POST-1.** The system displays procurement cost totals, details, and monthly trend for the selected scope and date range. |
| **Normal Flow:** | **UC307.0 View Procurement Report Success**<br>1. User selects project scope and optional date range.<br>2. The system requests procurement report data.<br>3. The system loads non-draft, non-cancelled purchase orders by `PurchaseOrder.ProjectId` and filters by `OrderDate`.<br>4. The system loads approved direct purchases by `ProjectId` and filters by `PurchaseDate`.<br>5. The system calculates PO cost, direct purchase cost, total cost, monthly PO/direct-purchase trend, and estimated material issuance value using project-scoped average PO unit prices normalized by conversion rate.<br>6. The system displays purchase order and direct purchase summaries. A generated PO whose number begins `DP-PO-` and has no supplier is labeled "Mua ngoài (không qua NCC)" instead of a missing-value placeholder. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-19:** `TotalCost = TotalPoCost + TotalDirectPurchaseCost`.<br>**BR-REP-20:** Purchase orders with `Draft` or `Cancelled` status are excluded; `Closed` purchase orders are included.<br>**BR-REP-21:** Direct purchase report includes only `Approved` direct purchases.<br>**BR-REP-22:** Direct purchase date filtering uses `PurchaseDate`, not creation date.<br>**BR-REP-23:** `SupplierName` may be null for auto-generated direct-purchase POs. `DP-PO-*` rows must display "Mua ngoài (không qua NCC)". |
| **Assumptions:** | `TotalProcurementSavings` currently returns 0 because no savings formula is implemented. |
| **Other Information:** | Direct purchase DTO field `CreatedAt` is populated with `PurchaseDate` for report display compatibility. |

*Table 2.11.7: View procurement report*
