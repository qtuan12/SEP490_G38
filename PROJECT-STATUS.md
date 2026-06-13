# 📊 BPG-CMS: PROJECT STATUS DASHBOARD

**Cập nhật lần cuối:** 12-06-2026
**Quy ước:** ✅ Đã xong | 🚧 Đang code (Có khung nhưng chưa xong luồng) | ❌ Chưa làm | 📋 Mới tạo thư mục

## 1. Backend Modules (.NET 8)
| Module | Entity & DB | Application (CQRS) | API Endpoints | Ghi chú |
|--------|-------------|--------------------|---------------|---------|
| **Core Base** | ✅ | ✅ | ✅ | BaseController, ExceptionMiddleware, Interceptor |
| **Project & WBS** | ✅ | 🚧 | ❌ | Đang làm luồng Accept Phase |
| **Material Catalog**| ✅ | ✅ | ✅ | |
| **Procurement (MR, PO)** | ✅ | ❌ | ❌ | Luồng hold BOQ chưa làm |
| **Inventory & GR** | ✅ | ❌ | ❌ | Bảng CurrentInventory và Ledger đã có |
| **Surplus & Adjustment**| ✅ | ❌ | ❌ | |
| **Auth & Users** | ✅ | ✅ | ✅ | Login, Phân quyền cơ bản |
| **Daily Log & Comments** | ✅ | ✅ | ✅ | Backend API hoàn thành (CRUD Daily Logs & Comments) |

## 2. Frontend Modules (React 19)
| Feature | Giao diện (UI) | API Integration | Ghi chú |
|---------|----------------|-----------------|---------|
| **Setup Base** | ✅ | ✅ | Antd, React Query, Axios Client |
| **Login/Auth** | ✅ | ✅ | |
| **Dashboard** | ❌ | ❌ | |
| **WBS Workspace**| 🚧 | ❌ | Đã dựng Layout Tree, chưa nối API |
| **Inventory View**| ❌ | ❌ | |
| **Daily Log & Comments** | ✅ | ✅ | Refactored form, feed timeline, and comment CRUD |


---
**Hướng dẫn cho AI Agent:**
Trước khi tạo bất kỳ file nào mới (Service, DTO, Controller), hãy tra cứu bảng này. Nếu Module đã có dấu ✅ hoặc 🚧, nghĩa là file có thể đã tồn tại, hãy dùng tính năng search để đọc file cũ thay vì tạo đè file mới.