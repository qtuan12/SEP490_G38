# ĐẶC TẢ USE CASE - MODULE QUẢN LÝ DỰ ÁN (PROJECT PORTFOLIO MODULE)

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
| **Normal Flow:** | **UC009.0 View List Success**<br>1. The user selects the "Dự án" menu.<br>2. The system checks the user's role to retrieve the authorized project list. (See E2.1)<br>3. The system displays a paginated project list (max 8 projects/page). Each card shows: name, status badge, address, expected dates, overall progress bar (%), design file indicator, and detailed link.<br>4. (For TM/Admin): The card displays a "Delete" icon if the project status is "draft".<br>5. User can type a keyword into the search bar or select a status from the status dropdown. (See A5.1) |
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
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | File Storage System |
| **Description:** | Allows Technical Manager to create a new project in the system, enter general information, and upload design drawings. |
| **Trigger:** | Technical Manager clicks the "Khởi tạo Dự Án" button on the Project List screen. |
| **Preconditions:** | **PRE-1.** The user has the Technical Manager or Admin role. |
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
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | File Storage System |
| **Description:** | Allows updating project info (Name, Address, Expected Dates, drawings). If the project is running (Inprogress or Paused), only drawings can be updated. |
| **Trigger:** | TM clicks the "Sửa" button on the Project Details screen. |
| **Preconditions:** | **PRE-1.** The project must exist.<br>**PRE-2.** The user has the Technical Manager or Admin role. |
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
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | None |
| **Description:** | Soft-delete a project. Only allowed when the project is in Draft status. |
| **Trigger:** | TM clicks the Delete (Trash icon) on a Draft project card. |
| **Preconditions:** | **PRE-1.** The project must be in Draft status.<br>**PRE-2.** The user has the Technical Manager or Admin role. |
| **Postconditions:** | **POST-1.** The project is soft-deleted in the system.<br>**POST-2.** The project is hidden from the active project list. |
| **Normal Flow:** | **UC056.0 Delete Project Success**<br>1. TM clicks the Trash icon on the Draft project card.<br>2. The system displays a confirmation dialog: "Bạn có chắc chắn muốn xóa dự án bản nháp [Tên dự án] không? Hành động này không thể hoàn tác." (See A2.1)<br>3. TM clicks "Xóa dự án".<br>4. The system performs a deletion of the project. (See E4.1)<br>5. System displays a success Toast and reloads the project list. |
| **Alternative Flows:** | **A2.1 Cancel deletion (Step 2)**<br>1. TM clicks "Hủy" or the "X" button on the confirmation dialog.<br>2. The system closes the popup and takes no action. |
| **Exceptions:** | **E4.1 Project is not in Draft status (Step 4):** If the project status has transitioned to Inprogress or Paused<br>1. The system hides the Trash icon from the card. If the delete request is invoked directly, it returns a bad request error, and the system displays the error. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-07:** A project can only be deleted before execution (Draft) to protect data integrity for projects that have generated operations (WBS, logs, materials). |
| **Assumptions:** | Soft Delete preserves actual data in the Database (setting IsDeleted = true) to support restoration by the Admin if necessary. |
| **Other Information:** | None. |

*Table 2.8.5: Delete project*

---

### 2.8.6. UC-041 - View project details

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-041 - View project details** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Accountant, Director, Project Leader, Site Engineer |
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
| **Primary Actor:** | Project Leader, Technical Manager, Admin |
| **Secondary Actors:** | None |
| **Description:** | Change project operational status (from Draft to In Progress, In Progress to Paused, Paused to In Progress, or In Progress to Done). |
| **Trigger:** | PL or TM clicks Status Action buttons on the project details header. |
| **Preconditions:** | **PRE-1.** The user is the assigned Project Leader, or a Technical Manager / Admin. |
| **Postconditions:** | **POST-1.** The project status is updated in the database and updated across the user interface.<br>**POST-2.** Interactive features and tabs are enabled or locked according to the new project execution status. |
| **Normal Flow:** | **UC053.0 Change Status Success**<br>1. (To Activate Draft): Project Leader activates the project. The system updates the status to In Progress. (See E1.1)<br>2. (To Pause In Progress): Project Leader pauses the project. The system opens a prompt to enter a reason, updates the status to Paused, and locks further inputs. (See A2.1)<br>3. (To Resume Paused): Project Leader resumes the project. The system updates the status to In Progress and unlocks inputs. (See E3.1)<br>4. (To Complete In Progress): Project Leader completes the project. The system updates the status to Done. (See E4.1) |
| **Alternative Flows:** | **A2.1 Cancel status change (Step 2)**<br>1. On the pause confirmation modal, PL selects "Hủy bỏ".<br>2. The system closes the modal and preserves current status. |
| **Exceptions:** | **E1.1 Activate with empty WBS (Step 1):** If PL activates but WBS has no phases/tasks<br>1. The system blocks activation and displays an error message.<br><br>**E4.1 Done with progress < 100% (Step 4):** If PL tries to complete but overall progress is < 100%<br>1. The system disables the "Hoàn thành" button and shows a tooltip: "Tiến độ dự án chưa đạt 100%".<br><br>**E3.1 WBS Edit during Pause (Step 3):** If project is paused but emergency incident approved<br>1. The system unlocks the "Kế hoạch thi công" (WBS) tab specifically for the Technical Manager / Admin to add emergency rework tasks. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-PRJ-10:** A WBS structure with at least one task is required before activating project execution.<br>**BR-PRJ-11:** A project can only transition to Done status if its overall progress is 100%.<br>**BR-PRJ-12:** Tab locking and unlocking logic is verified and enforced by the system. |
| **Assumptions:** | Changing status to Paused immediately locks editing features globally for all members. |
| **Other Information:** | Status changes are synchronized in real-time to active users. |

*Table 2.8.7: Change project execution status*

---

### 2.8.8. UC-027 - Add member to project

| Field | Description |
| :--- | :--- |
| **ID and Name:** | **UC-027 - Add member to project** |
| **Created By:** | CuongDDHE187082 |
| **Date Created:** | 16/06/2026 |
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | None |
| **Description:** | Add personnel (Site Engineers) to the project member list. Exclusively restricted to Technical Manager (TPKT) and Admin. |
| **Trigger:** | TM clicks "Thêm kỹ sư" in the "Thành viên dự án" tab. |
| **Preconditions:** | **PRE-1.** The user has the Technical Manager or Admin role. Non-manager roles (Site Engineer, Accountant, Director) are restricted to read-only view. |
| **Postconditions:** | **POST-1.** Selected site engineers are assigned to the project and stored in the project members list.<br>**POST-2.** Assigned members gain access to view and operate within the project workspace. |
| **Normal Flow:** | **UC037.0 Add Member Success**<br>1. TM clicks "Thêm kỹ sư".<br>2. System opens "Thêm Kỹ sư vào Dự án" Modal.<br>3. The system retrieves the list of users through the user management service authorized for Admin and Technical Manager and filters for active site engineers who are not currently assigned to this project.<br>4. System queries active projects to check if any engineer is currently acting as a leader elsewhere, displaying a "Trưởng nhóm - [Dự án]" badge beside their name.<br>5. TM uses the search bar, ticks checkboxes for target engineers, and clicks "Gán".<br>6. The system assigns the selected engineers to the project. (See E6.1)<br>7. System closes the modal, displays success toast "Đã thêm X kỹ sư vào dự án.", and reloads the member list. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E6.1 Duplicate member assignment (Step 6):** If selected engineer already added concurrently<br>1. The system displays an error indicating that some members are already assigned. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-PRJ-13:** Only users with the role "siteengineer" can be added as project members.<br>**BR-PRJ-14:** A user can only be assigned to a project once.<br>**BR-PRJ-14b:** Only the Technical Manager (TPKT) and Admin can perform member management actions (Add engineer, Assign/Remove leader, Remove member). |
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
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | None |
| **Description:** | Remove personnel from the project member list (revoke project access). Exclusively restricted to Technical Manager (TPKT) and Admin. |
| **Trigger:** | TM clicks the "Xóa" button on the member card in the "Thành viên dự án" tab. |
| **Preconditions:** | **PRE-1.** The member is currently in the project.<br>**PRE-2.** The user has the Technical Manager or Admin role. |
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
| **Primary Actor:** | Technical Manager, Admin |
| **Secondary Actors:** | None |
| **Description:** | Assign or Remove the Project Leader role for a member. Only 1 Leader is allowed per project at a time. Restricted to Technical Manager (TPKT) and Admin. |
| **Trigger:** | TM clicks the "Gán trưởng nhóm" or "Hủy trưởng nhóm" button on the member card. |
| **Preconditions:** | **PRE-1.** The member is currently in the project.<br>**PRE-2.** The user has the Technical Manager or Admin role. |
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
| **Primary Actor:** | Technical Manager, Accountant, Director, Project Leader, Site Engineer |
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
| **Other Information:** | Only Technical Managers and Admins can upload or update these drawings via the create/update project forms. |

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
| **Alternative Flows:** | **A5.1 Switch timescale view (Step 5)**<br>1. The user clicks "Ngày", "Tuần", or "Tháng" on the scale switcher.<br>2. The system dynamically updates the unit scales and column widths, then re-renders the chart.<br><br>**A5.2 Toggle task list grid (Step 5)**<br>1. The user clicks "Thu gọn danh sách" or "Mở rộng danh sách" to control column visibility.<br>2. The system hides or shows the left grid column (Task Name, Start Date, Progress) and updates layout width.<br><br>**A4.1 Quick progress update from Gantt (Step 4)**<br>1. The user clicks on a leaf task bar in the chart.<br>2. The system verifies if the user is the assigned Engineer, PL, TPKT, or Admin, and checks if the project is active.<br>3. The system opens the progress report input.<br>4. The user fills the new progress percentage, description, and clicks save.<br>5. The system saves progress, updates task state, closes modal, and refreshes the chart. |
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
| **Business rules:** | **BR-INV-01:** Access permissions to view adjustments list are scoped by the project memberships (except for Director, Accountant, and Admin who can view all projects). |
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
| **Primary Actor:** | Project Leader, Admin |
| **Secondary Actors:** | None |
| **Description:** | Allows the Project Leader to create an inventory increase adjustment slip to request adding materials into project stock (surplus collection, site audit excess). This slip starts in "Pending" status and requires approval from Technical Manager (TPKT) or Admin before inventory is updated. |
| **Trigger:** | PL clicks the "Phiếu Tăng" button in the "Kiểm kê vật tư" tab. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user has the Project Leader or Admin role. |
| **Postconditions:** | **POST-1.** An inventory increase adjustment record is created with status "Pending" awaiting TPKT / Admin approval.<br>**POST-2.** Upon TPKT / Admin approval, the quantities of the selected materials are added to the project inventory stock balance and transaction records are logged. |
| **Normal Flow:** | **UC102.0 Create Increase Adjustment Success**<br>1. PL clicks the "Phiếu Tăng" button.<br>2. The system opens the "Tạo Phiếu Tăng Tồn Kho (Chờ TPKT Duyệt)" Modal.<br>3. PL enters the "Lý do điều chỉnh" (mandatory) and optional description/note. (See A3.1)<br>4. PL selects a material from the catalog dropdown, enters the quantity to increase, and clicks "Thêm".<br>5. The system validates that the quantity is positive, checks for duplicates, and adds it to the items table. (See E5.1)<br>6. PL repeats steps 4-5 to add multiple items, then clicks "Tạo Phiếu Tăng".<br>7. The system submits the increase request.<br>8. The system saves the adjustment in "Pending" status, notifies the Technical Manager (TPKT) for approval, and logs the pending action.<br>9. System displays a success Toast, closes the modal, and refreshes the adjustment list. |
| **Alternative Flows:** | **A3.1 Cancel creation (Step 3)**<br>1. PL clicks the "Hủy" or "X" button on the modal.<br>2. The system closes the modal without making any changes. |
| **Exceptions:** | **E5.1 Validation fails (Step 5):** If PL submits with an empty reason or no materials selected<br>1. The system blocks the submission and displays an error message. |
| **Priority:** | Medium |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-02:** Inventory increase adjustments are submitted in "Pending" status and must be reviewed and approved by the Technical Manager (TPKT) or Admin before materials are credited to the inventory balance. |
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
| **Primary Actor:** | Accountant, Admin |
| **Secondary Actors:** | None |
| **Description:** | Allows the Accountant to create an inventory decrease adjustment slip to deduct materials from the virtual stock (loss, damage, site audit shortage). This slip requires Director approval. |
| **Trigger:** | Accountant clicks the "Phiếu Giảm (Giai đoạn)" button in the "Kiểm kê vật tư" tab, or accesses it from an unresolved inventory incident. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user has the Accountant or Admin role. |
| **Postconditions:** | **POST-1.** An inventory decrease adjustment record is created and saved with status "Pending" awaiting Director approval. |
| **Normal Flow:** | **UC103.0 Create Decrease Adjustment Success**<br>1. Accountant clicks the "Phiếu Giảm (Giai đoạn)" button. (See A1.1)<br>2. The system opens the "Tạo Phiếu Giảm Tồn Kho (Theo Giai đoạn)" Modal.<br>3. Accountant enters the "Lý do điều chỉnh" (mandatory), selects the related project phase (mandatory), and enters description/note.<br>4. Accountant selects a material from the project's current inventory, enters the quantity to decrease, and clicks "Thêm".<br>5. The system validates that the quantity is positive, is less than or equal to current stock, and adds it to the items table. (See E5.1) (See E5.2)<br>6. Accountant clicks "Tạo Phiếu Giảm".<br>7. The system submits the decrease request.<br>8. The system saves the adjustment in a pending state and logs it.<br>9. System displays a success Toast, closes the modal, and refreshes the list. |
| **Alternative Flows:** | **A1.1 Linked to an inventory incident (Step 1)**<br>1. Accountant processes an unresolved inventory incident and clicks to create a decrease slip.<br>2. The system pre-fills the reason = "Xử lý sự cố", pre-selects the phase linked to the incident, and automatically parses the damaged items and quantities from the incident's damage description markdown table.<br>3. Accountant reviews the parsed items, adjusts notes, and clicks "Tạo Phiếu Giảm".<br>4. The system submits the decrease request and updates the incident status to pending review. |
| **Exceptions:** | **E5.1 Validation fails (Step 5):** If Accountant leaves mandatory fields empty, or selects no items<br>1. The system blocks submission and highlights errors.<br><br>**E5.2 Insufficient stock (Step 5):** If Accountant inputs a quantity to decrease that exceeds current stock<br>1. The system alerts "Số lượng giảm không được vượt quá số lượng tồn kho hiện tại" and blocks addition of the item. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-03:** Inventory decrease adjustments must target a specific phase of the project and always start in "Pending" status, requiring Director or Admin approval before any stock is deducted. |
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
| **Primary Actor:** | Technical Manager (for Increase Adjustments), Director (for Decrease Adjustments), Admin |
| **Secondary Actors:** | None |
| **Description:** | Allows the Technical Manager (TPKT) to approve/reject pending inventory increase adjustments, and the Director to review, approve, or reject pending inventory decrease adjustments. |
| **Trigger:** | TPKT or Director clicks the "Chi tiết" or "Xem chi tiết" button on a Pending adjustment slip. |
| **Preconditions:** | **PRE-1.** The adjustment slip status is "Pending".<br>**PRE-2.** The user has the appropriate role (Technical Manager/Admin for Increase slips; Director/Admin for Decrease slips). |
| **Postconditions:** | **POST-1.** The inventory adjustment status is updated to "Approved" or "Rejected".<br>**POST-2.** Upon approval of an Increase slip, material quantities are added to project stock. Upon approval of a Decrease slip, material quantities are deducted.<br>**POST-3.** Inventory transaction records are logged for auditing purposes. |
| **Normal Flow:** | **UC104.0 Approve Adjustment Success**<br>1. Authorized user (TPKT for Increase, Director for Decrease) clicks "Chi tiết" on a Pending adjustment slip.<br>2. The system opens the "Chi tiết Phiếu Kiểm Kê" Modal rendering general info, notes, items list, and linked incident details (if any).<br>3. User evaluates the information and clicks "Duyệt phiếu". (See A3.1)<br>4. System displays confirmation. User clicks confirm.<br>5. The system processes the approval.<br>6. The system sets the status to approved, updates material quantities in stock (+ for Increase, - for Decrease), logs inventory transactions, and marks any linked incidents as approved. (See E6.1)<br>7. System sends a notification to the creator, closes the modal, and refreshes the list. |
| **Alternative Flows:** | **A3.1 Reject adjustment (Step 3)**<br>1. In the details modal, user clicks "Từ chối".<br>2. The system prompts for a "Lý do từ chối".<br>3. User enters the reason and clicks "Xác nhận từ chối".<br>4. The system updates status to rejected, logs the reason, notifies creator, and refreshes list. |
| **Exceptions:** | **E6.1 Insufficient stock at approval time (Step 6 - Decrease only):** If stock becomes insufficient before approval<br>1. The system blocks the update due to insufficient stock, saves no changes, and displays an error message. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INV-04:** Rejecting a linked decrease slip automatically rejects the corresponding inventory incident, appending Director's instructions to the incident's handling records.<br>**BR-INV-05:** Approving an adjustment logs an inventory transaction with positive (Increase) or negative (Decrease) quantity change. |
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
| **Description:** | Allows users to view a list of incidents. The project incidents tab displays construction incidents. The inventory adjustments module displays inventory loss/damage incidents. Director, Accountant, and TPKT can view global incidents across all projects. |
| **Trigger:** | User clicks on the "Sự cố thi công" tab in project detail, or "Sự cố vật tư" tab in inventory workspace, or "Global Incidents" menu. |
| **Preconditions:** | **PRE-1.** The user has a valid login session with appropriate access permissions. |
| **Postconditions:** | **POST-1.** The system displays the list of construction and inventory incidents matching the user's role and filter options. |
| **Normal Flow:** | **UC201.0 View Incidents List Success**<br>1. The user selects the incident-related menu/tab.<br>2. The system checks the user's role and retrieves incidents for the specific project or globally. (See E2.1)<br>3. The system maps task, phase, and member data to the incidents.<br>4. The system displays the incidents list. Each incident card/row shows: Project Name, Incident Date, Reporter, Incident Type, Description (clean description text), and Status Badge.<br>5. Users can click on an incident to view details. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 No incidents found (Step 2):** If the system queries and finds no incidents matching criteria<br>1. The system displays an empty state placeholder. |
| **Priority:** | Medium |
| **Frequency of use:** | High |
| **Business rules:** | **BR-INC-01:** Site Engineers and Project Leaders can only view incidents within the projects they are assigned to. TPKT, Accountant, Director, and Admin can view all incidents globally. |
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
| **Primary Actor:** | Site Engineer, Project Leader, Technical Manager, Admin |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Site Engineer or Project Leader to report a construction incident on a specific task (damage, rework needed due to errors or force majeure). |
| **Trigger:** | User clicks "Báo cáo sự cố" button inside the Task Detail modal. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user must be a member of the project with reporting rights. |
| **Postconditions:** | **POST-1.** A new construction incident report is created with pending review status.<br>**POST-2.** Uploaded scene images and incident details are saved and attached to the report. |
| **Normal Flow:** | **UC202.0 Report Construction Incident Success**<br>1. User clicks the "Báo cáo sự cố" button in the Task Detail modal.<br>2. The system displays the "Lập Báo cáo Sự cố Thi công" Modal.<br>3. User enters the incident description (at least 5 characters), selects occurrence date/time, responsible party (optional), canceled volume (optional), estimated damage cost (optional), estimated labor days, and estimated delay days. (See A3.1)<br>4. User selects a proposed action ("Tạo Rework Task", "Giảm tiến độ task", or "Khác" - which requires custom action text).<br>5. User uploads up to 5 scene images (size <= 10MB each).<br>6. User clicks "Gửi báo cáo".<br>7. The system validates inputs, uploads images, and saves the incident in a pending review status. (See E7.1)<br>8. System displays a success toast and refreshes the task details. |
| **Alternative Flows:** | **A3.1 Cancel reporting (Step 3)**<br>1. User clicks the "Hủy" or "X" button on the modal.<br>2. The system closes the modal without saving data. |
| **Exceptions:** | **E7.1 Validation fails (Step 7):** If user submits with missing mandatory fields or invalid dates<br>1. The system blocks the submission and highlights errors. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-INC-02:** Incident occurrence date/time cannot be in the future. |
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
| **Primary Actor:** | Project Leader, Admin |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Project Leader to report a severe emergency incident (force majeure, site collapse, severe weather disaster) and formally request an immediate project halt. |
| **Trigger:** | PL clicks "Báo cáo khẩn cấp & Yêu cầu dừng dự án" button in the Incidents tab. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user has Project Leader or Admin role. |
| **Postconditions:** | **POST-1.** An emergency incident report is submitted with status "WaitingStopApproval".<br>**POST-2.** Notification is dispatched to the Technical Manager for emergency review. |
| **Normal Flow:** | **UC203.0 Report Emergency Stop Success**<br>1. PL clicks "Báo cáo khẩn cấp & Yêu cầu dừng dự án" button.<br>2. The system opens the "Báo cáo Sự cố khẩn cấp & Yêu cầu Dừng dự án" Modal.<br>3. PL inputs emergency details: Affected Work Item (Hạng mục thi công), Occurrence Date/Time (Thời gian xảy ra), Severity Level (Mức độ sự cố), Location (Địa điểm), Classification (Loại sự cố), Event Sequence Description (Mô tả chi tiết diễn biến), Casualty Damage (Thiệt hại con người), Schedule Impact (Thiệt hại tiến độ), Property/Material Loss (Thiệt hại tài sản/vật tư), Root Cause (Nguyên nhân ban đầu), and Containment Measures (Biện pháp khẩn cấp). PL uploads up to 5 scene images. (See A3.1)<br>4. PL clicks "Gửi biên bản báo cáo dừng dự án".<br>5. The system validates mandatory inputs, uploads scene images, and submits the emergency incident in WaitingStopApproval status. (See E5.1)<br>6. System closes modal and shows success toast "Yêu cầu ngừng thi công khẩn cấp đã được gửi thành công lên TPKT." |
| **Alternative Flows:** | **A3.1 Cancel reporting (Step 3)**<br>1. PL clicks "Hủy" or "X" button.<br>2. The system closes the modal and discards changes. |
| **Exceptions:** | **E5.1 Mandatory fields empty (Step 5):** If PL submits without filling required text fields<br>1. System displays validation alerts on missing mandatory fields and blocks submission. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-03:** An emergency incident request always starts with "WaitingStopApproval" status and halts the project only after a Technical Manager or Admin confirms the pause. |
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
| **Primary Actor:** | Technical Manager, Admin, Director |
| **Secondary Actors:** | None |
| **Description:** | Allows the Technical Manager (for normal/emergency incidents) or Director (for emergency plan approval) to assess and resolve construction incidents by creating a rework task, penalizing task progress, or approving a multi-phase emergency recovery plan. |
| **Trigger:** | TPKT clicks "Phê duyệt" / "Chi tiết" on a pending construction incident, or Director reviews a pending recovery plan. |
| **Preconditions:** | **PRE-1.** The incident status is "WaitingReview" (normal) or "WaitingStopApproval" / "WaitingRecoveryPlan" / "WaitingDirectorApproval" (emergency).<br>**PRE-2.** The user has the appropriate role (Technical Manager, Admin, or Director). |
| **Postconditions:** | **POST-1.** The incident status is updated to "Approved" or "Rejected".<br>**POST-2.** Corresponding resolution actions (rework task creation, progress deduction, or project status change) are processed and saved in the system. |
| **Normal Flow:** | **Option A: Handling Normal Incident (WaitingReview)**<br>1. TPKT selects "Phê duyệt" on a WaitingReview incident.<br>2. The system opens the "Phê duyệt Sự cố" Modal.<br>3. TPKT enters handling instructions (mandatory) and selects a resolution action: (See A3.1)<br>&nbsp;&nbsp;&nbsp;&nbsp;- If "Tạo Rework Task mới": TPKT enters rework task name, deadline date (validated against phase deadline), and chooses the assigned engineer.<br>&nbsp;&nbsp;&nbsp;&nbsp;- If "Giảm % Tiến độ": TPKT enters progress deduction value (1-100%) and deduction reason.<br>4. TPKT clicks "Xác nhận".<br>5. The system validates inputs and processes the resolution. The system sets the original task status to Obsolete (if creating a rework task) or reduces task progress percentage and records progress logs (if decreasing progress), marks the incident as Approved, and updates views. (See E5.1)<br><br>**Option B: Handling Emergency Stop (3-Phase Lifecycle)**<br>1. **Phase 1 (Stop Approval & Pause Project - WaitingStopApproval):** TPKT or Admin reviews the emergency stop request. Upon confirmation, the system updates project status to Paused, records the pause reason, and sets incident status to WaitingRecoveryPlan. (If rejected by TPKT/Admin, status becomes Rejected and project remains Inprogress).<br>2. **Phase 2 (Submit Recovery Plan - WaitingRecoveryPlan):** TPKT or PL prepares and submits a detailed Recovery Plan (solution narrative, estimated recovery cost, timeline). The system updates incident status to WaitingDirectorApproval.<br>3. **Phase 3 (Director Approval & Project Resume - WaitingDirectorApproval):** The Director reviews the submitted Recovery Plan and estimated cost.<br>&nbsp;&nbsp;&nbsp;&nbsp;- If Director rejects or requests plan revision, status returns to WaitingRecoveryPlan.<br>&nbsp;&nbsp;&nbsp;&nbsp;- If Director approves, the system sets project status back to Inprogress (active), marks affected incomplete tasks as Obsolete, automatically creates the new Rework Task(s) with deadline and assigned engineer, sets incident status to Approved, and notifies project members. |
| **Alternative Flows:** | **A3.1 Reject incident (Step 3)**<br>1. TPKT or Director clicks "Từ chối" in the resolution screen, enters a rejection reason, and submits.<br>2. System updates incident status = Rejected and notifies the reporter. |
| **Exceptions:** | **E5.1 New progress value exceeds current progress (Step 5):** If the new progress is greater than current progress<br>1. The system blocks the submission and displays an error. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-INC-04:** Rework task deadline cannot be in the past.<br>**BR-INC-05:** Marking a task Obsolete blocks further progress updates and creates progress log records. |
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
| **Primary Actor:** | Project Leader, Admin |
| **Secondary Actors:** | File and Upload Service |
| **Description:** | Allows the Project Leader to report an inventory loss or damage incident on site (materials lost due to theft, weather damage, etc.). |
| **Trigger:** | PL clicks "Báo cáo sự cố vật tư" in WBS Phase context menu. |
| **Preconditions:** | **PRE-1.** The project must be active (Inprogress).<br>**PRE-2.** The user is a Project Leader or Admin. |
| **Postconditions:** | **POST-1.** An inventory incident report is submitted with status "WaitingAccountant" awaiting accountant verification.<br>**POST-2.** Details of damaged/lost materials and scene photos are attached to the report. |
| **Normal Flow:** | **UC205.0 Report Inventory Incident Success**<br>1. PL selects "Báo cáo sự cố vật tư" on a Phase.<br>2. The system opens the "Lập Báo cáo Sự cố Vật tư Kho (Trưởng nhóm)" Modal.<br>3. PL selects incident type (InventoryLoss or InventoryDamage) and enters description (at least 5 characters) and discovery date.<br>4. PL clicks "Thêm vật tư" to select materials from the current project inventory. For each material, PL inputs the "Số lượng lỗi/mất" and clicks add. (See E4.1)<br>5. PL uploads up to 5 images.<br>6. PL clicks "Gửi báo cáo".<br>7. The system formats the list of items, uploads images, and saves the incident with a status awaiting accountant verification, notifying relevant users. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E4.1 Material quantity exceeds stock (Step 4):** If PL enters a quantity lost higher than current stock<br>1. System displays a warning and blocks item addition. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-06:** An inventory incident must link to a specific project phase and current stock balance. |
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
| **Primary Actor:** | Accountant, Director, Admin |
| **Secondary Actors:** | None |
| **Description:** | Allows the Accountant to verify an inventory incident and the Director to approve it. The stock is deducted upon Director approval of the linked decrease adjustment slip. |
| **Trigger:** | Accountant selects a "WaitingAccountant" incident, or Director reviews a "WaitingDirector" incident. |
| **Preconditions:** | **PRE-1.** The incident status is "WaitingAccountant" (for Accountant) or "WaitingDirector" (for Director). |
| **Postconditions:** | **POST-1.** The inventory incident is verified by the Accountant and linked to a decrease adjustment slip.<br>**POST-2.** Upon Director approval of the linked slip, inventory stock is deducted and the incident status is updated to "Approved". |
| **Normal Flow:** | **UC206.0 Verify and Approve Incident Success**<br>**Step 1: Accountant verification**<br>1. Accountant clicks on a "WaitingAccountant" incident.<br>2. Accountant verifies details and clicks to create a linked decrease adjustment slip. (See E1.1)<br>3. System opens the decrease modal, pre-filled with incident info and parsed materials. Accountant submits the decrease slip.<br>4. The system updates the incident status to await director approval.<br><br>**Step 2: Director approval**<br>1. Director reviews the pending decrease adjustment slip linked to the incident.<br>2. Director clicks "Duyệt phiếu".<br>3. The system processes the approval: deducts quantities from inventory, updates the decrease slip status to approved, and updates the linked incident status to approved. |
| **Alternative Flows:** | **A2.1 Rejection (Step 2)**<br>1. Director rejects the linked decrease adjustment slip.<br>2. The system sets the linked incident status to rejected and logs the reason. |
| **Exceptions:** | **E1.1 Verification by non-accountant (Step 1):** If a user without Accountant role tries to verify incident<br>1. The system blocks the request and displays an access error. |
| **Priority:** | High |
| **Frequency of use:** | Low |
| **Business rules:** | **BR-INC-07:** Real stock deduction for inventory incidents only occurs after the Director approves the linked decrease adjustment slip, not during reporting or verification. |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
| **Secondary Actors:** | None |
| **Description:** | Allows authorized report users to view project-level or accessible-project aggregate metrics: task totals, completion counts, delayed and at-risk tasks, BOQ warnings, phase progress, period comparison, cross-project matrix, and monthly progress trends. |
| **Trigger:** | User opens Reports Hub and selects the "Tổng quan" tab. |
| **Preconditions:** | **PRE-1.** User is authenticated and belongs to the Reports role policy: Admin, Director, Technical Manager, or Accountant.<br>**PRE-2.** User has access to the selected project. Admin/Director/Technical Manager/Accountant can access all non-deleted projects through project access rules. |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
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
| **Primary Actor:** | Admin, Director, Technical Manager, Accountant |
| **Secondary Actors:** | None |
| **Description:** | Consolidates purchase order cost, approved direct purchase cost, estimated material issuance value, purchase order list, direct purchase list, and monthly procurement trends. |
| **Trigger:** | User clicks the "Mua sắm & Chi phí" tab. |
| **Preconditions:** | **PRE-1.** User has Reports role permission and project access. |
| **Postconditions:** | **POST-1.** The system displays procurement cost totals, details, and monthly trend for the selected scope and date range. |
| **Normal Flow:** | **UC307.0 View Procurement Report Success**<br>1. User selects project scope and optional date range.<br>2. The system requests procurement report data.<br>3. The system loads non-draft, non-cancelled purchase orders by `PurchaseOrder.ProjectId` and filters by `OrderDate`.<br>4. The system loads approved direct purchases by `ProjectId` and filters by `PurchaseDate`.<br>5. The system calculates PO cost, direct purchase cost, total cost, monthly PO/direct-purchase trend, and estimated material issuance value using project-scoped average PO unit prices normalized by conversion rate.<br>6. The system displays purchase order summaries and direct purchase summaries. |
| **Alternative Flows:** | None |
| **Exceptions:** | **E2.1 Forbidden project**<br>1. The system returns `ERR_FORBIDDEN` if access is denied. |
| **Priority:** | High |
| **Frequency of use:** | Medium |
| **Business rules:** | **BR-REP-19:** `TotalCost = TotalPoCost + TotalDirectPurchaseCost`.<br>**BR-REP-20:** Purchase orders with `Draft` or `Cancelled` status are excluded; `Closed` purchase orders are included.<br>**BR-REP-21:** Direct purchase report includes only `Approved` direct purchases.<br>**BR-REP-22:** Direct purchase date filtering uses `PurchaseDate`, not creation date. |
| **Assumptions:** | `TotalProcurementSavings` currently returns 0 because no savings formula is implemented. |
| **Other Information:** | Direct purchase DTO field `CreatedAt` is populated with `PurchaseDate` for report display compatibility. |

*Table 2.11.7: View procurement report*

