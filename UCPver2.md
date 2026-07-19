# DETAILED USE CASE SPECIFICATIONS (Tài liệu đặc tả yêu cầu sử dụng (UCP) VERSION 2) - INVENTORY & WAREHOUSE MODULE

This document contains the detailed Use Case Specifications (Tài liệu đặc tả yêu cầu sử dụng (UCP)) for the Kho ảo trực tuyến của công trình, Nhập kho (Goods Receipt), Xuất kho (Material Issuance), Hoàn trả vật tư (Material Return), and Thẻ kho (Lịch sử giao dịch vật tư) modules. 

All roles, workflows, business constraints, and error scenarios are fully aligned with the actual system logic. The specifications are written in English, but user interface elements and error messages are represented in Vietnamese to match the actual screens. No code or technical terms are used in descriptions to ensure it is readable for non-technical clients.

---

### UC-028 - View Site Inventory

UC ID - Name
UC-028 - View Site Inventory

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows project members and authorized management roles to view the real-time kho ảo trực tuyến của công trình of a selected project, showcasing material information, actual stock levels, frozen stock, available capacity, and safety threshold status.

Trigger
The user requests to view the project's current stock list.

Pre-condition
PRE-1. The user is logged into the system.
PRE-2. The user holds an authorized role.
PRE-3. An active project workspace is selected by the user.

Post-Condition
POST-1. The system displays the list of current materials in the kho ảo trực tuyến của công trình for the selected project.
POST-2. Low-stock warnings and Định mức thiết kế (BOQ) status warnings are highlighted on any material items whose available stock falls below safety levels or exceeds the Định mức thiết kế (BOQ) threshold.

Normal flow
1. The user opens the current stock list page. (See A1.1)
2. The system verifies the user's role authorization to access the selected project's inventory. (See E2.1)
3. The system requests the project's current inventory data. (See E3.1)
4. The system retrieves the latest inventory records, including material details, units, and Định mức thiết kế (BOQ) items, filtering out deleted items.
5. The system displays the inventory list, including material code, material name, specification, supplier details, actual stock quantity, reserved quantity, available stock quantity, last updated time, and inventory status. (See A6.1, A6.2)
6. The system updates and displays summary metrics including total material types, low stock types, active in-stock types, and over Định mức thiết kế (BOQ) types.

Alternative flow
A1.1: Search and Filter Inventory (Step 1)
1. The user enters a keyword in the text search box or selects a warning status from the filter dropdown.
2. The system dynamically filters the displayed list to show only matching items.
3. The use case resumes at Step 2 of the Normal Flow.

A6.1: Expand Row for Phase Usages Details (Step 5)
1. The user requests to view the phase details of a specific material.
2. The system displays a detailed breakdown of usage per phase, showing phase name, Định mức thiết kế (BOQ) limit, issued quantity, percentage, and warning status.
3. The use case resumes at Step 6 of the Normal Flow.

A6.2: Export Site Inventory (Step 5)
1. The user requests to download the inventory report.
2. The system processes the currently filtered inventory list and structures it into a Tệp Excel (dạng CSV) report with a Định dạng font tiếng Việt chuẩn có dấu prefix.
3. The system triggers an automatic file download named Bao_cao_ton_kho_du_an.csv.
4. The use case resumes at Step 6 of the Normal Flow.

Exceptions
E2.1: Access Bypassed (Step 2)
1. The system detects that the user does not belong to the project and does not have an office role.
2. The system blocks the request and redirects the user to the default Dashboard.
3. The use case ends.

E3.1: Data Loading Failed (Step 3)
1. The system fails to retrieve inventory data due to a lỗi kết nối hoặc mất tín hiệu máy chủ.
2. The system displays the error message: "Không thể tải dữ liệu kho." and shows an empty state.
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
BR-INV-01: Available stock is calculated dynamically as: Actual Stock - Reserved Stock. This value cannot be manually edited.
BR-INV-02: A low-stock status is triggered if Available Stock <= Safety Threshold configured for the material.

Assumptions
Phase and task information is loaded once and reused throughout the session.

Other Information
None

---

### UC-020 - Receive Goods

UC ID - Name
UC-020 - Receive Goods

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Project Leader, Technical Manager

Secondary Actor
None

Description
Allows authorized users to record incoming material deliveries at the construction site against a pending Đơn mua hàng (PO), updating actual stock, purchase order status, and writing thẻ kho (lịch sử giao dịch vật tư) card logs.

Trigger
The user requests to create a new nhập kho (goods receipt) from the Site Inventory workspace, or clicks the "Nhập kho" action button next to a pending Đơn mua hàng (PO) on the Purchase Orders list tab.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The selected project is in "Đang thực hiện (InProgress)" status.
PRE-3. There is at least one Đơn mua hàng (PO) in "Đã gửi (Sent)" or "Đã nhận một phần (PartiallyReceived)" status associated with the project.

Post-Condition
POST-1. The nhập kho (goods receipt) is saved in approved status (immediate stock booking).
POST-2. Actual stock quantities of the received materials are increased in kho ảo trực tuyến của công trình.
POST-3. The associated Đơn mua hàng (PO) status is updated to "Đã nhận một phần (PartiallyReceived)" or "Đã nhận đủ (FullyReceived)".
POST-4. Inventory thẻ kho (lịch sử giao dịch vật tư) logs are written.

Normal flow
1. The user opens the nhập kho (goods receipt) creation wizard. (See A1.1, A1.2)
2. The system verifies user privileges and displays Đơn mua hàng (PO) in "Đã gửi (Sent)" or "Đã nhận một phần (PartiallyReceived)" status.
3. The user selects a Đơn mua hàng (PO).
4. The system displays purchase order items, including material information, ordered quantity, received quantity, and remaining quantity.
5. The user enters the actual received quantity for each material. (See A5.1)
6. The user enters deliverer details, delivery document number, and uploads proof images.
7. The user confirms the receipt.
8. The system validates the inputs, verifying that quantities are positive, do not exceed remaining Đơn mua hàng (PO) limits, and the materials exist in the Đơn mua hàng (PO). (See E8.1, E8.2, E8.3)
9. The system starts a hệ thống tự động lưu trữ đồng bộ dữ liệu, generates a unique receipt code, saves the nhập kho (goods receipt) details, increases stock in kho ảo trực tuyến của công trình, logs transaction thẻ kho (lịch sử giao dịch vật tư) records, and commits the changes. (See E9.1)
10. The system closes the view, refreshes the inventory workspace, and displays a success notification message: "Tạo phiếu nhập kho thành công."

Alternative flow
A1.1: Discard Changes (Step 1)
1. The user cancels the receipt creation before saving.
2. The system discards all entered inputs and exits.

A1.2: Trigger from Purchase Order List (Step 1)
1. The user clicks "Nhập kho" next to a specific Đơn mua hàng (PO) on the Purchase Orders list tab.
2. The system redirects the user to the Site Inventory workspace under the Nhập kho (Goods Receipt) tab with that specific Đơn mua hàng (PO) automatically searched/filtered.
3. The system automatically opens the goods receipt creation wizard and pre-selects the corresponding Đơn mua hàng (PO) with all its remaining material quantities auto-filled.
4. The use case resumes at Step 4 of the Normal Flow.

A5.1: Partial Shipment Receipt (Step 5)
1. The user enters quantities for some items, leaving others blank or as 0.
2. The system only registers stock and thẻ kho (lịch sử giao dịch vật tư) transactions for items with quantity > 0.
3. After saving, the system marks the Đơn mua hàng (PO) status as "Đã nhận một phần (PartiallyReceived)" since remaining items are outstanding.
4. The use case resumes at Step 6 of the Normal Flow.

Exceptions
E8.1: Received Quantity Exceeds Remaining Limits (Step 8)
1. The user enters a quantity greater than the remaining Đơn mua hàng (PO) capacity for any material.
2. The system halts the confirmation and displays: "Số lượng nhận thực tế vượt quá giới hạn đơn hàng."
3. The user must correct the quantities to proceed.

E8.2: Empty Items List (Step 8)
1. The user submits the form with no material items or all quantities set to 0.
2. The system rejects the submission and displays: "Danh sách vật tư nhận thực tế không được để trống."
3. The use case ends.

E8.3: Material Not in Đơn mua hàng (PO) (Step 8)
1. A submitted material is not part of the selected Đơn mua hàng (PO).
2. The system rejects the transaction and displays: "Vật tư không tồn tại trong đơn hàng Đơn mua hàng (PO) này."
3. The use case ends.

E9.1: Database Transaction Failure (Step 9)
1. A database connection error or deadlock occurs.
2. The system automatically rolls back all changes, aborts the operation, and displays: "Lỗi hệ thống khi tạo phiếu nhập kho."
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
BR-GR-01: The received quantity for each item must satisfy: 0 < Received Quantity <= Ordered Quantity - Previously Received Quantity.
BR-GR-02: Approved goods receipts automatically increase the tồn kho ảo trực tuyến: Stock Quantity += Received Quantity / Conversion Rate.
BR-GR-03: Every stock update must write a matching record to the inventory transaction thẻ kho (lịch sử giao dịch vật tư).

Assumptions
Receipt codes are auto-generated based on date and a unique suffix, using the format GR-YYYYMMDD-[6-character suffix].

Other Information
None

---

### UC-088 - View Nhập kho (Goods Receipt) List

UC ID - Name
UC-088 - View Nhập kho (Goods Receipt) List

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows authorized users to view a list of all goods receipts generated for the project, supporting phân trang hiển thị and keyword search.

Trigger
User navigates to the inventory workspace and requests to view the goods receipts history.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The user is authorized to access the project's inventory data.

Post-Condition
POST-1. The system displays a danh sách phân trang list of goods receipts.

Normal flow
1. The user requests to view the nhập kho (goods receipt) list.
2. The system checks the user's role privileges. (See E2.1)
3. The system requests the danh sách phân trang list of goods receipts for the project, ordered by creation date descending. (See E3.1)
4. The system displays a list of goods receipts, including receipt details, purchase order reference, delivery details, creation details, and status. (See A4.1)
5. The system displays page status text and navigation controls.

Alternative flow
A4.1: Filter List via Search Bar (Step 4)
1. The user types a query in the search box.
2. The system dynamically retrieves and displays matching goods receipts (matching receipt code, Đơn mua hàng (PO) number, or deliverer name), resetting page navigation to page 1.
3. The use case resumes at Step 5 of the Normal Flow.

Exceptions
E2.1: Access Bypassed (Step 2)
1. The user does not belong to the project and does not have an office role.
2. The system blocks the request and redirects the user to the default Dashboard.
3. The use case ends.

E3.1: Data Loading Failed (Step 3)
1. The system fails to retrieve the list due to mất kết nối mạng.
2. The system displays: "Không thể tải danh sách phiếu nhập kho." and displays an empty state.
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
None

Assumptions
Uses phân trang hiển thị (default is 10 records per page).

Other Information
None

---

### UC-089 - View Nhập kho (Goods Receipt) Detail

UC ID - Name
UC-089 - View Nhập kho (Goods Receipt) Detail

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Displays details of a selected nhập kho (goods receipt), listing the received materials, quantities, delivery documents, deliverer info, creator name, and evidence attachments.

Trigger
The user requests to view details of a specific nhập kho (goods receipt).

Pre-condition
PRE-1. The user is currently viewing the Goods Receipts list, and the selected Nhập kho (Goods Receipt) exists.

Post-Condition
POST-1. The system displays the nhập kho (goods receipt) detail view.

Normal flow
1. The user requests to view details of a nhập kho (goods receipt).
2. The system requests detail data from the backend. (See E2.1)
3. The system retrieves the nhập kho (goods receipt) record, including items, material catalogs, purchase order, and creator information.
4. The system displays the nhập kho (goods receipt) details, including purchase order reference, supplier information, receive date, deliverer details, creator, status, and received items details. (See A4.1)
5. The system displays thumbnails of proof images. (See A5.1)

Alternative flow
A4.1: Close Detail View (Step 4)
1. The user closes the detail view.
2. The system returns the user to the list page.
3. The use case ends.

A5.1: View Full-Size Image (Step 5)
1. The user selects a proof image thumbnail.
2. The system displays the selected image in high resolution overlaying the screen.
3. The user closes the image overlay.
4. The use case resumes at Step 5 of the Normal Flow.

Exceptions
E2.1: Data Not Found (Step 2)
1. The selected nhập kho (goods receipt) record does not exist.
2. The system displays: "Không thể tải chi tiết phiếu nhập kho."
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
None

Assumptions
None

Other Information
None

---

### UC-122 - Cancel Nhập kho (Goods Receipt)

UC ID - Name
UC-122 - Cancel Nhập kho (Goods Receipt)

Created By
DucHVHE181827

Date Created
30/06/2026 (Updated: 19/07/2026)

Primary Actor
Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows authorized office roles to reverse and cancel a previously approved nhập kho (goods receipt). The system subtracts quantities from the kho ảo trực tuyến của công trình, updates the thẻ kho (lịch sử giao dịch vật tư) with a reversal log, and restores the Đơn mua hàng (PO) status.

Trigger
User requests to cancel an approved nhập kho (goods receipt).

Pre-condition
PRE-1. The user is logged in.
PRE-2. The user holds an authorized role: Technical Manager, Accountant, or Director.
PRE-3. The selected nhập kho (goods receipt) is in "Đã duyệt (Approved)" status and has not already been cancelled.
PRE-4. The project is in "Đang thực hiện (InProgress)" status.
PRE-5. The linked Đơn mua hàng (PO) is not closed.

Post-Condition
POST-1. The nhập kho (goods receipt) status changes to "Đã hủy (Cancelled)".
POST-2. Actual stock in kho ảo trực tuyến của công trình is reduced by the receipt's amounts.
POST-3. The Đơn mua hàng (Đơn mua hàng (PO)) status is restored.
POST-4. A reversal entry (negative value change) is written to the inventory transaction thẻ kho (lịch sử giao dịch vật tư).

Normal flow
1. The user opens the detail view of an approved receipt.
2. The system checks the user's role. If authorized, it renders the option to cancel the receipt. (See E2.1)
3. The user requests to cancel the receipt.
4. The system prompts a confirmation dialog detailing the consequences of stock reversal. (See A4.1)
5. The user confirms the cancellation.
6. The system checks if the available stock (Quantity - ReservedQuantity) is sufficient to cover the reversal amount. (See E6.1)
7. The system starts a hệ thống tự động lưu trữ đồng bộ dữ liệu, updates the nhập kho (goods receipt) status to "Đã hủy (Cancelled)", reduces actual stock levels, logs a negative reversal record in the transaction thẻ kho (lịch sử giao dịch vật tư), and updates the Đơn mua hàng (PO) status. (See E7.1)
8. The system closes the dialog, reloads the receipt detail view, updates inventory stock numbers, and displays a success notification message: "Hủy phiếu nhập kho thành công."

Alternative flow
A4.1: Abort Cancellation (Step 4)
1. The user cancels the confirmation dialog.
2. The system closes the dialog without executing any updates, leaving the receipt status as "Đã duyệt (Approved)".
3. The use case ends.

Exceptions
E2.1: Unauthorized Role (Step 2)
1. A user without proper authorization attempts to trigger the cancel action.
2. The system blocks the request and displays: "Bạn không có quyền hủy phiếu nhập kho đã được ghi nhận. Chỉ Quản lý Kỹ thuật, Kế toán hoặc Giám đốc mới có thể thực hiện thao tác này."
3. The use case ends.

E6.1: Insufficient Stock (Step 6)
1. Part of the received stock has been issued, so the available stock is less than the quantity to reverse.
2. The system aborts the cancellation and displays: "Không thể hủy phiếu nhập kho. Vật tư đã được xuất dùng hoặc đóng băng cho kế hoạch thi công."
3. The use case ends.

E7.1: Database Write Error (Step 7)
1. A database connection error or deadlock occurs.
2. The system rolls back the transaction, keeps the receipt as "Đã duyệt (Approved)", and displays: "Lỗi hệ thống khi hủy phiếu nhập kho."
3. The use case ends.

Priority
High

Frequency of use
Medium

Business rules
BR-GRC-01: Access is strictly limited to Technical Manager, Accountant, and Director roles.
BR-GRC-02: Reversals are blocked if available stock is less than the receipt item quantity.
BR-GRC-03: Reversals must append a transaction log in the inventory thẻ kho (lịch sử giao dịch vật tư) with negative quantities.

Assumptions
None

Other Information
Cancelling a nhập kho (goods receipt) is irreversible.

---

### UC-123 - Edit Nhập kho (Goods Receipt) Thông tin chứng từ (Người giao, số phiếu, ảnh chụp hóa đơn)

UC ID - Name
UC-123 - Edit Nhập kho (Goods Receipt) Thông tin chứng từ (Người giao, số phiếu, ảnh chụp hóa đơn)

Created By
DucHVHE181827

Date Created
30/06/2026 (Updated: 19/07/2026)

Primary Actor
Project Leader, Accountant, Technical Manager, Director

Secondary Actor
None

Description
Allows authorized users to edit non-quantity details of an approved nhập kho (goods receipt), such as the deliverer's name, the delivery document number, and proof images, without altering inventory stock.

Trigger
User requests to edit thông tin chứng từ (người giao, số phiếu, ảnh chụp hóa đơn) in the Nhập kho (Goods Receipt) Detail view.

Pre-condition
PRE-1. The user has access permission for the project.
PRE-2. The selected Nhập kho (Goods Receipt) is in "Đã duyệt (Approved)" status and has not been cancelled.
PRE-3. The linked project is in "Đang thực hiện (InProgress)" status.

Post-Condition
POST-1. Thông tin chứng từ (Người giao, số phiếu, ảnh chụp hóa đơn) fields are updated in the database.
POST-2. New images are saved, and old attachments are completely replaced in the database.

Normal flow
1. The user opens the detail view and initiates editing.
2. The system checks the user's role privileges. (See E2.1)
3. The system displays inputs for deliverer details and delivery document reference and opens the photo upload zone.
4. The user updates details and adds or removes photos. (See A4.1)
5. The user confirms saving changes.
6. The system uploads new photos and calls the update API.
7. The system updates Deliverer Info and Delivery Doc No, removes all old image attachments, saves the new image list, commits the changes, and displays a success notification: "Cập nhật thông tin phiếu nhập kho thành công." (See E7.1, E7.2)

Alternative flow
A4.1: Discard Changes (Step 4)
1. The user decides to discard modifications.
2. The system exits edit mode and restores original details.
3. The use case ends.

Exceptions
E2.1: Unauthorized Role (Step 2)
1. The user does not have permission to edit thông tin chứng từ (người giao, số phiếu, ảnh chụp hóa đơn).
2. The system blocks the save action and displays: "Chỉ Kế toán, Quản lý Kỹ thuật, Giám đốc hoặc Trưởng dự án mới có quyền chỉnh sửa thông tin chứng từ."
3. The use case ends.

E7.1: Inactive Project (Step 7)
1. The project status has changed from InProgress to Completed or Paused.
2. The system aborts the edit and displays: "Dự án liên kết không còn hoạt động, không thể chỉnh sửa thông tin."
3. The use case ends.

E7.2: Database Write Error (Step 7)
1. An error occurs while writing new text fields or image links to the database.
2. The system rolls back transaction changes and displays: "Có lỗi xảy ra khi chỉnh sửa thông tin."
3. The use case ends.

Priority
Medium

Frequency of use
Medium

Business rules
BR-GRE-01: The list of received items and their quantities are strictly read-only and cannot be altered in edit mode.
BR-GRE-02: Only Accountant, Technical Manager, Director, or Project Leader (IsLeader = true) are permitted to edit thông tin chứng từ (người giao, số phiếu, ảnh chụp hóa đơn).

Assumptions
None

Other Information
Deleting an image attachment from the database does not delete it from external storage to allow backup logs.

---

### UC-034 - Create Xuất kho (Material Issuance)

UC ID - Name
UC-034 - Create Xuất kho (Material Issuance)

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Project Leader, Technical Manager

Secondary Actor
None

Description
Allows authorized project leaders or technical managers to record xuất kho (material issuance) from the project's kho ảo trực tuyến của công trình for a specific construction task, reducing available stock.

Trigger
The user requests to record a new xuất kho (material issuance).

Pre-condition
PRE-1. The user is logged in.
PRE-2. The selected project is in "Đang thực hiện (InProgress)" status.
PRE-3. The project Cây danh mục công việc (WBS) has at least one active, unlocked task.

Post-Condition
POST-1. The xuất kho (material issuance) record is successfully saved in the database.
POST-2. Virtual stock quantities of the materials are reduced by the issued amounts.
POST-3. An issuance transaction is logged in the inventory thẻ kho (lịch sử giao dịch vật tư).

Normal flow
1. The user initiates a xuất kho (material issuance) request.
2. The system verifies user privileges and opens the creation form. (See E2.1)
3. The system displays active, unlocked tasks.
4. The user selects a Task.
5. The user selects materials from stock, enters the issued quantities, specifies the units and the purpose of issuance. (See A5.1, A5.2)
6. The user confirms the issuance.
7. The system validates that quantities are positive, the task is unlocked, and available stock is sufficient. (See E7.1, E7.2, E7.3)
8. The system starts a hệ thống tự động lưu trữ đồng bộ dữ liệu, generates a unique issuance code, reduces stock levels, writes thẻ kho (lịch sử giao dịch vật tư) logs, and commits changes. (See E8.1)
9. The system closes the view, refreshes the inventory workspace, and displays a success toast message: "Tạo phiếu xuất kho thành công."

Alternative flow
A5.1: Material Unit Conversion (Step 5)
1. The user selects a unit other than the base unit of the material.
2. The system retrieves conversion rates and updates the display of maximum available quantities.
3. The use case resumes at Step 6 of the Normal Flow.

A5.2: Close View without Saving (Step 5)
1. The user cancels the creation.
2. The system resets all states and closes the view without registering any transaction.
3. The use case ends.

Exceptions
E2.1: Unauthorized Role (Step 2)
1. A user without proper authorization attempts to create the issuance.
2. The system blocks the request and displays: "Chỉ Quản lý Kỹ thuật hoặc Trưởng dự án mới có quyền tạo yêu cầu xuất dùng vật tư."
3. The use case ends.

E7.1: Task Locked (Step 7)
1. The selected task is locked (completed or accepted).
2. The system aborts the transaction and displays: "Công việc này đã bị khóa (đã nghiệm thu hoặc hoàn thành). Không thể xuất thêm vật tư."
3. The use case ends.

E7.2: Insufficient Stock (Step 7)
1. The requested quantity exceeds available stock levels.
2. The system aborts the transaction and displays: "Không đủ tồn kho khả dụng cho vật tư."
3. The use case ends.

E7.3: Empty Items List (Step 7)
1. The user submits the form with no materials or all quantities set to 0.
2. The system rejects the submission and displays: "Danh sách vật tư xuất dùng không được để trống."
3. The use case ends.

E8.1: Database Rollback on Error (Step 8)
1. A database failure occurs when reducing stock or creating the transaction log.
2. The transaction rolls back to preserve stock integrity, and the client displays: "Có lỗi xảy ra khi tạo phiếu xuất kho."
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
BR-MI-01: Material issuance is blocked if available stock is less than the requested amount. Negative stock is forbidden.
BR-MI-02: Materials can only be issued for active, unlocked tasks within the project Cây danh mục công việc (WBS).
BR-MI-03: Xuất kho (Material Issuance) records are strictly Immutable. No edits or deletions are allowed once saved. Errors must be corrected via inventory return records.
BR-MI-04: Only Technical Manager or Project Leader (IsLeader = true) are permitted to create material issuances.

Assumptions
Issuance codes are auto-generated based on date and a unique suffix, using the format PXK-YYYYMMDD-[6-character suffix].

Other Information
None

---

### UC-032 - View Xuất kho (Material Issuance) List

UC ID - Name
UC-032 - View Xuất kho (Material Issuance) List

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows authorized users to view a danh sách phân trang list of material issues created for the current project, with search and filtering support.

Trigger
The user accesses the material issuances history view.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The user has access permission for the project.

Post-Condition
POST-1. Displays danh sách phân trang xuất kho (material issuance) records in a table format.

Normal flow
1. The user requests to view the material issues list.
2. The system checks the user's role privileges. (See E2.1)
3. The system retrieves and displays a list of material issuances, including issuance details, associated task, purpose, item count, creation date, creator, and status. (See A3.1) (See E3.1)
4. The system renders page navigation controls.

Alternative flow
A3.1: Search and Filter (Step 3)
1. The user searches for specific records using keywords.
2. The system filters the list dynamically.
3. The use case resumes at Step 4 of the Normal Flow.

Exceptions
E2.1: Access Bypassed (Step 2)
1. The user does not belong to the project and does not have an office role.
2. The system blocks the request and redirects the user to the default Dashboard.
3. The use case ends.

E3.1: Data Loading Failed (Step 3)
1. The system fails to load the list due to network issues.
2. The system displays: "Không thể tải danh sách phiếu xuất kho." and displays an empty state.
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
None

Assumptions
Uses phân trang hiển thị (default is 10 records per page).

Other Information
None

---

### UC-033 - View Xuất kho (Material Issuance) Detail

UC ID - Name
UC-033 - View Xuất kho (Material Issuance) Detail

Created By
DucHVHE181827

Date Created
25/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Displays full details of a selected xuất kho (material issuance) ticket, showing task details, creator name, purpose, and list of issued items.

Trigger
The user selects a xuất kho (material issuance) record to view details.

Pre-condition
PRE-1. The user is viewing the xuất kho (material issuance) list.

Post-Condition
POST-1. Displays the detailed view of the xuất kho (material issuance).

Normal flow
1. The user selects a xuất kho (material issuance) ticket.
2. The system requests detailed records. (See E2.1)
3. The system retrieves the xuất kho (material issuance) record, including items, material catalog details, base unit, task, and creator information.
4. The system displays the xuất kho (material issuance) details, including issuance identification, task information, purpose, creation date, creator, and list of issued items. (See A4.1)

Alternative flow
A4.1: Close Detail View (Step 4)
1. The user closes the detail view.
2. The system returns the user to the list page.
3. The use case ends.

Exceptions
E2.1: Record Not Found (Step 2)
1. The selected xuất kho (material issuance) does not exist.
2. The system displays: "Không tìm thấy thông tin chi tiết phiếu xuất kho."
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
None

Assumptions
None

Other Information
None

---

### UC-096 - View Inventory Transaction List (Thẻ kho (Lịch sử giao dịch vật tư))

UC ID - Name
UC-096 - View Inventory Transaction List

Created By
DucHVHE181827

Date Created
30/06/2026 (Updated: 19/07/2026)

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows users to view a danh sách phân trang, filterable thẻ kho (lịch sử giao dịch vật tư) history of all material stock changes (Nhập kho (Goods Receipt), Issuance, Reversal, Returns) in a project.

Trigger
The user requests to view the transaction history.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The user has access permission for the project.

Post-Condition
POST-1. Displays the danh sách phân trang thẻ kho (lịch sử giao dịch vật tư) history.

Normal flow
1. The user navigates to the transaction history view.
2. The system validates the user's role. (See E2.1)
3. The system requests danh sách phân trang thẻ kho (lịch sử giao dịch vật tư) transaction history records for the project, ordered by creation date descending. (See E3.1)
4. The system displays the transaction history thẻ kho (lịch sử giao dịch vật tư), including transaction date, material details, type of transaction, quantity change, balance after transaction, and the user who performed the change. (See A4.1)
5. The system formats positive quantity changes in green (+) and negative changes in red (-).
6. The system renders page navigation controls.

Alternative flow
A4.1: Filter Thẻ kho (Lịch sử giao dịch vật tư) (Step 4)
1. The user selects a specific material, transaction type, or enters search text.
2. The system dynamically updates the thẻ kho (lịch sử giao dịch vật tư) table.
3. The use case resumes at Step 5 of the Normal Flow.

Exceptions
E2.1: Access Bypassed (Step 2)
1. The user does not belong to the project and does not have an office role.
2. The system blocks the request and redirects the user to the Dashboard.
3. The use case ends.

E3.1: Connection Failure (Step 3)
1. The API request fails due to quá hạn kết nối cơ sở dữ liệu.
2. The system displays: "Không thể tải lịch sử thẻ kho." and displays an empty state.
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
BR-LED-01: Thẻ kho (Lịch sử giao dịch vật tư) transactions are Append-only. The system provides no feature to insert, update, or delete records from this thẻ kho (lịch sử giao dịch vật tư) outside of automated stock updates, guaranteeing audit security.

Assumptions
None

Other Information
None

---

### UC-124 - Create Hoàn trả vật tư (Material Return)

UC ID - Name
UC-124 - Create Hoàn trả vật tư (Material Return)

Created By
DucHVHE181827

Date Created
19/07/2026

Primary Actor
Project Leader, Technical Manager

Secondary Actor
None

Description
Allows authorized users to return unused or excess materials from a previous xuất kho (material issuance) back into the project's kho ảo trực tuyến của công trình.

Trigger
The user initiates a hoàn trả vật tư (material return) from an existing xuất kho (material issuance) ticket.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The selected project is in "Đang thực hiện (InProgress)" status.
PRE-3. The xuất kho (material issuance) has outstanding quantities that can be returned.

Post-Condition
POST-1. The hoàn trả vật tư (material return) ticket is saved.
POST-2. Virtual stock quantities of the returned materials are increased.
POST-3. A return transaction is logged in the thẻ kho (lịch sử giao dịch vật tư).

Normal flow
1. The user selects a xuất kho (material issuance) and initiates the return action.
2. The system checks user role authorization. (See E2.1)
3. The system displays the issued materials, original quantities, and any previously returned amounts.
4. The user inputs return quantities and enters the reason for returning. (See A4.1)
5. The user confirms the return.
6. The system validates that quantities are positive, the items belong to the original issuance, and return quantities do not exceed the remaining returnable quantity (Issued Quantity - Previously Returned Quantity). (See E6.1, E6.2, E6.3)
7. The system starts a hệ thống tự động lưu trữ đồng bộ dữ liệu, generates a return code, saves the return details, increases stock in kho ảo trực tuyến của công trình, logs transaction thẻ kho (lịch sử giao dịch vật tư) records, and commits changes. (See E7.1)
8. The system closes the view and displays a success notification: "Tạo phiếu hoàn trả thành công."

Alternative flow
A4.1: Cancel Return (Step 4)
1. The user decides to cancel the return creation.
2. The system closes the view without committing changes.
3. The use case ends.

Exceptions
E2.1: Unauthorized Role (Step 2)
1. A user without proper authorization attempts to create the return.
2. The system blocks the request and displays: "Chỉ Quản lý Kỹ thuật hoặc Trưởng dự án mới có quyền tạo yêu cầu xuất dùng vật tư."
3. The use case ends.

E6.1: Return Quantity Exceeds Limit (Step 6)
1. The entered return quantity is greater than the remaining returnable capacity.
2. The system blocks confirmation and displays a validation error.
3. The user must correct the quantities to proceed.

E6.2: Material Not In Original Issuance (Step 6)
1. A returned material was not part of the original issuance ticket.
2. The system rejects the action and displays: "Vật tư không tồn tại trong phiếu xuất gốc."
3. The use case ends.

E6.3: Empty Items List (Step 6)
1. The user submits the form with no materials or all quantities set to 0.
2. The system rejects the submission and displays: "Danh sách vật tư hoàn trả không được để trống."
3. The use case ends.

E7.1: Database Write Error (Step 7)
1. A database failure occurs during transaction commit.
2. The system rolls back all database changes, aborts the operation, and displays an error message.
3. The use case ends.

Priority
High

Frequency of use
Medium

Business rules
BR-RET-01: Access is strictly limited to Technical Manager and Project Leader (IsLeader = true) roles.
BR-RET-02: Returned quantity must satisfy: 0 < Return Quantity <= Issued Quantity - Previously Returned Quantity.
BR-RET-03: Stock is updated using: Stock Quantity += Returned Quantity / Conversion Rate.
BR-RET-04: Every return transaction must log a record to the inventory transaction thẻ kho (lịch sử giao dịch vật tư).

Assumptions
Return codes are auto-generated based on date and a unique suffix, using the format PTra-YYYYMMDD-[6-character suffix].

Other Information
None

---

### UC-125 - View Hoàn trả vật tư (Material Return) List

UC ID - Name
UC-125 - View Hoàn trả vật tư (Material Return) List

Created By
DucHVHE181827

Date Created
19/07/2026

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Allows authorized users to view a danh sách phân trang list of all hoàn trả vật tư (material return) tickets recorded for a project.

Trigger
The user requests to view the material returns list in the inventory workspace.

Pre-condition
PRE-1. The user is logged in.
PRE-2. The user has access permission for the project.

Post-Condition
POST-1. The system displays a danh sách phân trang list of material returns.

Normal flow
1. The user navigates to the hoàn trả vật tư (material return) list view.
2. The system verifies user privileges. (See E2.1)
3. The system requests the danh sách phân trang list of material returns for the project, ordered by creation date descending. (See E3.1)
4. The system retrieves and displays a list of material returns, including return identification, original issuance reference, associated task, reason, item count, creation date, and creator. (See A4.1)
5. The system renders page navigation controls.

Alternative flow
A4.1: Search and Filter (Step 4)
1. The user searches using keywords (such as return code or reason) or filters by a specific xuất kho (material issuance) reference.
2. The system dynamically updates the list.
3. The use case resumes at Step 5 of the Normal Flow.

Exceptions
E2.1: Access Bypassed (Step 2)
1. The user does not belong to the project and does not have an office role.
2. The system blocks the request and redirects the user to the Dashboard.
3. The use case ends.

E3.1: Data Loading Failed (Step 3)
1. The system fails to load return records.
2. The system displays a failure notification and displays an empty state.
3. The use case ends.

Priority
Medium

Frequency of use
Medium

Business rules
None

Assumptions
Uses phân trang hiển thị (default is 10 records per page).

Other Information
None

---

### UC-126 - View Hoàn trả vật tư (Material Return) Detail

UC ID - Name
UC-126 - View Hoàn trả vật tư (Material Return) Detail

Created By
DucHVHE181827

Date Created
19/07/2026

Primary Actor
Site Engineer, Project Leader, Technical Manager, Accountant, Director

Secondary Actor
None

Description
Displays the full details of a selected hoàn trả vật tư (material return) ticket, detailing returned materials, quantities, original issuance reference, task name, creator, and reason.

Trigger
The user requests to view the details of a specific hoàn trả vật tư (material return) ticket.

Pre-condition
PRE-1. The user is viewing the hoàn trả vật tư (material return) list.

Post-Condition
POST-1. The system displays the detailed view of the hoàn trả vật tư (material return).

Normal flow
1. The user selects a hoàn trả vật tư (material return) ticket to view.
2. The system fetches detailed records. (See E2.1)
3. The system retrieves the hoàn trả vật tư (material return) record, including items, material catalogs, units, original issuance, task, and creator information.
4. The system displays the hoàn trả vật tư (material return) details, including return identification, original issuance reference, task information, reason, creation details, and list of returned items. (See A4.1)

Alternative flow
A4.1: Close Detail View (Step 4)
1. The user closes the detail view.
2. The system returns the user to the list page.
3. The use case ends.

Exceptions
E2.1: Record Not Found (Step 2)
1. The selected hoàn trả vật tư (material return) record does not exist.
2. The system displays: "Không tìm thấy thông tin chi tiết phiếu hoàn trả."
3. The use case ends.

Priority
High

Frequency of use
High

Business rules
None

Assumptions
None

Other Information
None
