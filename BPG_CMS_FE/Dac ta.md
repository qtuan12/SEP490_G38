BẢN ĐỊNH HƯỚNG VÀ GIỚI HẠN PHẠM VI HỆ THỐNG 
Dự án: SEP490_G38 – BPG Construction Management System (MVP)
MỤC TIÊU CỐT LÕI: Hệ thống được thiết kế tinh gọn để giải quyết triệt để 2 bài toán vận hành tại công trường thông qua 2 module chính:
Quản lý  thi công: Kiểm soát tiến độ WBS, ghi nhận nhật ký công trường và nghiệm thu minh bạch.
Kiểm soát vật tư: Quản lý kho ảo (Virtual Stock) tại từng công trình. Công ty không sử dụng kho tập trung; mỗi công trình có kho riêng để giảm chi phí vận chuyển và tối ưu việc mua hàng tại địa phương. Hệ thống đối chiếu với định mức (BOQ) nhằm ngăn chặn gian lận và thất thoát. 
NGUYÊN TẮC THIẾT KẾ (RÀNH GIỚI NGHIỆP VỤ): Để đảm bảo tính khả thi cho phiên bản MVP, hệ thống tuân thủ nghiêm ngặt các giới hạn sau:
Thuần quản trị nội bộ: Hệ thống tập trung 100% vào luồng công việc giữa các phòng ban. Bỏ qua hoàn toàn các tính năng không cốt lõi như: Nhắn tin (Chat), Quản lý yêu cầu hỗ trợ (Ticket), Cổng thông tin khách hàng (Customer Portal), và Quản lý bảo hành.
Phi tài chính (Non-Accounting System): Hệ thống này không thay thế phần mềm kế toán (ERP). Mọi dữ liệu liên quan đến tiền bạc (giá trị PO, giá trị vật tư hao hụt) chỉ được lưu trữ dưới dạng trường thông tin tham chiếu (reference data). Hệ thống tuyệt đối không thực hiện các nghiệp vụ: quản lý dòng tiền, theo dõi công nợ, xuất hóa đơn VAT, hay tạo các bút toán kế toán.
PHÂN QUYỀN CHI TIẾT

Vai trò
Quyền trên Dự án & Task
Quyền trên Vật tư
Trưởng phòng Kỹ thuật (TPKT)
- Tạo, sửa, xóa dự án (khi ở trạng thái draft).
- Upload các design của dự án cho nhân viên clean về sản phẩm cuối còn thi công
- Kích hoạt dự án (draft → active).
- Tạm dừng / tiếp tục dự án (active ↔ paused).
- Lập, sửa WBS (thêm/sửa phase, task) trước khi có cập nhật tiến độ.
- Phân công, điều chỉnh deadline task (có ghi log lý do).
- Điều chỉnh giảm % hoàn thành task (khi có sự cố) – chỉ TPKT mới có quyền này, kèm báo cáo sự cố và quyết định điều chỉnh tiến độ.
- Nghiệm thu phase (khi tất cả task đạt 100%, có ảnh minh chứng).
- Hủy nghiệm thu (trong vòng 7 ngày, phải có lý do).
- Đánh dấu task obsolete (bỏ qua).
- Xem tất cả dự án, dashboard, báo cáo tiến độ.
- Assign leader cho dự án
- Comment vào daily log của các task
- Check báo cáo sự cố để quyết định điều chỉnh tiến độ.
- Khai báo, sửa bảng định mức vật tư cho dự án (trước khi có yêu cầu).
- Xem kho của tất cả các dự án.
- Duyệt phiếu transfer vật tư sang công trình khác


Nhân viên phòng kỹ thuật
- Được thêm vào project bởi TPKT hoặc Leader và xem project đó các thông tin cơ bản.
- Cập nhật % hoàn thành task (chỉ tăng) kèm ảnh và mô tả; tạo nhật ký hàng ngày cho từng task. 
- Xem dashboard dự án (tiến độ của mình).
-Comment dưới nhật ký
- Xem design của dự án.



- Tạo báo cáo sự cố khi gặp sự cố làm hỏng do ngoại lực hay nội lực
Leader project
- Được thêm vào project bởi TPKT
- Cập nhật % hoàn thành task (chỉ tăng, không giảm) kèm ảnh và mô tả (tạo nhật ký hàng ngày) và log daily dự án.
- Xem dashboard dự án (tiến độ của mình).
- Comment dưới nhật ký.
- Tạo task, assign thành viên 
- Add member vào project
- Tạo yêu cầu vật tư (chọn vật tư, số lượng, lý do).
- Xem yêu cầu của mình và trạng thái.
- Ghi nhận nhận hàng (chọn PO, nhập số lượng thực nhận, upload ảnh phiếu giao hàng).
- Ghi nhận xuất dùng (chọn vật tư, số lượng, mục đích, có thể chọn phase/task liên quan).
- Xem tồn kho công trình.
- Tạo phiếu đề xuất xử lý vật tư thừa: 
(1) Trả NCC → gửi Kế toán; (2) Chuyển công trình → gửi Trưởng phòng duyệt; 
(3) Thanh lý → gửi Kế toán. 
- Xác nhận đã giao hàng (khi chuyển kho) và xác nhận đã nhận hàng (khi nhận chuyển kho từ công trình khác).
- Không có quyền tự ý giảm % task, không duyệt yêu cầu, không tạo PO.
- Tạo đơn Khẩn cấp: Nhập vật tư mua ngoài (Direct Purchase) 
- Tạo phiếu điều chỉnh tồn kho:
 (1) Tăng tồn (không cần duyệt): nhập lại vật tư đã xuất nhưng không dùng hết, hoặc kiểm kê phát hiện thừa. (2) Giảm tồn (cần duyệt qua Kế toán + Giám đốc): do thất thoát, mất mát, hư hỏng. 
 - Nhận báo cáo sự cố từ Site Engineer, kiểm tra sơ bộ, sau đó chuyển lên Trưởng phòng để xác nhận và điều chỉnh tiến độ 
Giám đốc
- Xem tất cả dự án, dashboard tổng thể (cảnh báo trễ đỏ/vàng).
- Xem báo cáo AI tóm tắt nhật ký.
- Duyệt tất cả các yêu cầu vật tư vượt định mức (sau khi Kế toán trình) 
- Duyệt phiếu điều chỉnh giảm tồn (hao hụt, mất mát, kiểm kê thiếu).


Kế toán
- Xem các thông tin cần thiết của dự án (tên dự án, PO, tồn kho, BOQ, báo cáo nhập/xuất) để phục vụ kiểm kê và thanh toán. 
- Kiểm tra tất cả yêu cầu vật tư. Nếu trong định mức và hợp lệ → tạo PO ngay; nếu vượt định mức → trình Giám đốc duyệt. 
- Tạo PO từ các yêu cầu đã được Giám đốc duyệt (có thể gộp nhiều yêu cầu).
- Sửa PO (chỉ khi chưa có nhận hàng) hoặc hủy PO.
- Xử lý phiếu xử lý vật tư thừa (trả lại NCC hay thanh lý vật tư)
- Xem đơn Khẩn cấp: Nhập vật tư mua ngoài (Direct Purchase) của PL để giải ngân cho người ta
- Tạo phiếu đề xuất điều chỉnh giảm tồn khi kiểm kê cuối kỳ phát hiện thiếu (sau đó trình Giám đốc duyệt). 
- Xem được BOQ để check được độ hợp lý của material request
- Xem được tồn kho



Admin
- Quản lý người dùng: Thêm, sửa, khóa tài khoản (không xóa cứng để tránh lỗi DB), gán role.
Quản lý danh mục vật tư: Thêm, sửa, khóa. Chỉ thiết lập 1 Đơn vị tính cơ bản (tuyệt đối không quy đổi hệ số).
Cấu hình tham số: Cài đặt ngưỡng tồn kho thấp, % trễ kỳ vọng, thời hạn tự động hủy phiếu.
Xem Audit Log: Xem lịch sử các thao tác thay đổi dữ liệu toàn hệ thống (chỉ đọc).


- Như bên cạnh (không can thiệp sâu vào nghiệp vụ vật tư, chỉ quản trị hệ thống).



0. CÁC THỰC THỂ CHÍNH VÀ VÒNG ĐỜI (ĐÃ CHỈNH SỬA)
Thực thể
Vòng đời (các bước diễn ra theo thời gian)
Dự án
Tạo mới (bản nháp) → Kích hoạt (bắt đầu thi công) → Đang thi công → Tạm dừng (bởi TPKT hoặc Giám đốc)  (nếu có lý do) → Hoàn thành (đã xong) → Đóng (kết thúc, lưu trữ)
Task
Tạo mới (thuộc kế hoạch WBS) → Đã phân công (giao cho kỹ sư) → Đang thực hiện (đã có tiến độ) → Hoàn thành (đạt 100%) → Đã nghiệm thu (được xác nhận đạt chất lượng) 
Có thể chuyển sang Obsolete từ các trạng thái trước khi hoàn thành (trừ Đã nghiệm thu) 
Nhật ký công trường
Mỗi ngày, kỹ sư hoặc leader tạo một bản ghi mới cho từng task. Không có vòng đời, chỉ thêm mới.
Báo cáo sự cố
Tạo báo cáo (kèm ảnh, mô tả) → Project Leader review → TPKT từ chối (yêu cầu bổ sung) → quay lại bước tạo báo cáo  =>  TPKT xác nhận (nếu đủ căn cứ) → (Kích hoạt giảm % task hay thêm phase/task để xử lý sự cố, làm phiếu hoặc điền giá trị/số lượng thất thoát do vụ hỏng này vào bảng báo cáo) 
Yêu cầu vật tư (Material Request)
- Loại thường (trong định mức): Tạo yêu cầu → Kế toán kiểm tra thủ tục → Kế toán từ chối (yêu cầu sửa hoặc hủy) → quay lại bước tạo yêu cầu  → (Nếu hợp lệ) chuyển sang tạo PO.
- Loại vượt định mức: Tạo yêu cầu → Kế toán kiểm tra → Trình Giám đốc duyệt → (Sau duyệt) chuyển sang tạo PO.
- Loại khẩn cấp mua ngoài (Direct Purchase): Leader tạo yêu cầu (bắt buộc đính kèm ảnh hóa đơn bán lẻ)  → Hệ thống tự động (Auto) sinh PO và Phiếu nhập kho (Kho tăng ngay lập tức để thợ dùng) → Kế toán kiểm tra: nếu hợp lệ thì giải ngân; nếu không hợp lệ thì từ chối (yêu cầu sửa hoặc hủy) 
Đơn đặt hàng (PO)
Tạo đơn từ yêu cầu đã được duyệt → Đã gửi NCC → Đã giao một phần → Đã giao đủ → Đóng (hoàn tất). Lưu ý: việc thanh toán, gửi hàng thực tế do kế toán tự làm bên ngoài, hệ thống chỉ lưu để đối chiếu tồn kho và báo cáo tham khảo
Kho ảo công trình
Nhập kho (theo PO hoặc Direct Purchase) → Xuất kho (khi dùng cho thi công) → Điều chỉnh giảm (do trả NCC, chuyển kho, hao hụt, mất mát). Không có vòng đời, chỉ thay đổi số lượng tồn →  Điều chỉnh tăng
Phiếu xử lý vật tư thừa
3 loại:
- Trả NCC: Leader tạo phiếu → Kế toán xử lý (liên hệ NCC)→ Đã trả (giảm tồn, ghi nhận thu hồi).
- Chuyển kho (Transfer): Leader tạo phiếu → TPKT duyệt (đánh giá nhu cầu bên nhận) → Xác nhận giao và nhận → Giảm tồn bên gửi, tăng tồn bên nhận.
- Thanh lý: Leader tạo phiếu → Kế toán xử lý → Thực hiện thanh lý (giảm tồn, ghi nhận thu hồi).
Phiếu điều chỉnh tồn kho (Tăng/Giảm) 
- Phiếu Giảm tồn (Hao hụt/Mất mát): Leader tạo phiếu (kèm ảnh/biên bản) →Kế toán kiểm tra → Giám đốc duyệt → Giảm tồn.
- Phiếu Tăng tồn (Thu hồi từ thợ/Dư do kiểm kê): Leader tạo phiếu → Kế toán kiểm tra hợp lệ →Tăng tồn (Không cần Giám đốc duyệt để tránh rườm rà).



1. QUẢN LÝ DỰ ÁN & THI CÔNG 
1.1. Tạo dự án mới
Người thực hiện: Trưởng phòng Kỹ thuật (TPKT) 
Các bước:
Nhập tên dự án, địa chỉ, ngày bắt đầu dự kiến, ngày kết thúc dự kiến (baseline)
Upload file thiết kế (PDF, DWG, ảnh) 
Add member vào dự án
Gán leader dự án
Lưu dự án ở trạng thái draft.
Tạo phase hoặc task chính
Tạo BOQ ứng với từng phase
TPKT bấm "Kích hoạt" → dự án chuyển sang active.
Exception / Edge cases:
Khi kích hoạt, hệ thống kiểm tra: WBS có ít nhất 1 task, deadline của các task phải >= ngày bắt đầu dự án.
1.2. Lập kế hoạch chi tiết (WBS) và phân công task
Người thực hiện: TPKT/Leader dự án
Chi tiết:
Thêm thành viên vào dự án 
Mỗi task có: tên, mô tả, ngày bắt đầu dự kiến, ngày kết thúc dự kiến, người phụ trách (chọn từ danh sách nhân viên kỹ thuật).
Task có thể có task con.

Ràng buộc:
Deadline của task con không được vượt quá deadline của task cha.
Không được giao task cho người không có role "Nhân viên kỹ thuật".
TPKT và Leader có thể xóa task khi progress = 0% 
Exception:
Nếu task đã có tiến độ cập nhật (>0%) thì không thể xóa, chỉ có thể đánh dấu hủy (cancel) hoặc điều chỉnh deadline có lý do.
Điều chỉnh deadline task đang in progress cần ghi chú lý do và lưu vào log.
1.3. Cập nhật nhật ký công trường hàng ngày 
Người thực hiện: Nhân viên kỹ thuật (được phân công task) và leader dự án nếu nhân viên hôm đó ko cập nhật đc hoặc nhập cho hội nhóm thầu bên ngoài - người k đc dùng hệ thống
Mục đích: Ghi lại tiến độ thực tế, khó khăn, ảnh minh chứng để lãnh đạo có thể theo dõi mà không cần lên tận công trình.
Các bước:
Chọn dự án và task (có thể chọn nhiều task trong cùng một phiếu nhật ký, nhưng MVP cho phép chọn 1 task để đơn giản).
Nhập % hoàn thành mới (số nguyên 0-100, chỉ được tăng, không được giảm).
Nhập mô tả ngắn (tối đa 500 ký tự): ví dụ "hôm nay đổ móng xong, gặp mưa nhẹ, vẫn tiến hành được".
Tải lên tối đa 5 ảnh 1 lần tải lên (định dạng JPG, PNG, mỗi ảnh ≤ 5MB). Ảnh được lưu trên server và hiển thị sau.
Hệ thống tự động ghi nhận người tạo, thời gian tạo.
Lưu lại. Mỗi lần lưu tạo thành một bản ghi nhật ký riêng (không ghi đè lên ngày trước).
Yêu cầu bổ sung:
Nếu một task có nhiều kỹ sư cùng làm, tất cả đều có thể cập nhật nhật ký cho task đó. Hệ thống lấy % cao nhất làm tiến độ hiện tại (vì tiến độ tổng hợp của cả nhóm).
Khi một người cập nhật, gửi thông báo cho những người khác trong task (để tránh ghi đè).
Nếu bên leader/giám đốc xem được nhật ký mà thấy bất thường hay muốn bình luận gì thì có thể comment.
Exception:
Trường hợp giảm % hoàn thành do sự cố: (Thiên tai, hỏng hóc lớn, hoặc lỗi kỹ thuật của nhân viên): 
Kỹ sư hiện trường không thể tự nhập % giảm trên giao diện Nhật ký. Hệ thống chặn (validate % mới nhỏ hơn % cũ) và báo lỗi: "Không thể giảm tiến độ. Vui lòng báo cáo TPKT để xử lý sự cố 
TPKT 	sử dụng chức năng 'Điều chỉnh tiến độ task' (chỉ xuất hiện khi task có %<100), chọn loại nguyên nhân (khách quan/chủ quan), nhập lý do chi tiết và % mới
Task nghiệm thu thất bại => trưởng phòng tạo thêm task mới…
Hành động giảm % được ghi log và thông báo cho Giám đốc. Vật tư đã thi công hỏng không được lập Phiếu Giảm Tồn (vì đã xuất kho rồi). Để có vật tư làm lại, Leader dự án phải tạo Yêu cầu vật tư mới. Yêu cầu này sẽ tự động bị gắn nhãn "Vượt định mức", bắt buộc Giám đốc duyệt để ghi nhận chi phí thiệt hại. 
Khi TPKT giảm % của task (ví dụ từ 50% xuống 30%), hệ thống cần khóa chức năng "Tạo yêu cầu vật tư mới" của task đó/dự án đó đối với kỹ sư, cho đến khi phiếu giảm tồn được Giám đốc duyệt ở mục 2.8.1. 
Nếu task đã đạt 100% nhưng chưa được nghiệm thu, vẫn có thể thêm ảnh và mô tả (nhưng % không thay đổi)
Nếu task đã được nghiệm thu (phase approved) → không cho phép cập nhật nhật ký nữa.	
1.4. Cảnh báo trễ hạn task
Thực hiện tự động bởi hệ thống (batch job hàng ngày).
Công thức:
Nếu current_date > deadline và %_complete < 100 → cảnh báo đỏ (đã trễ).
Nếu current_date <= deadline nhưng %_complete thấp hơn mức kỳ vọng → cảnh báo vàng (nguy cơ trễ). Mức kỳ vọng tính bằng (số ngày đã qua / tổng số ngày dự kiến) * 100%.
Hành động:
Gửi thông báo cho người phụ trách task, TPKT, Giám đốc.
Trên dashboard, task hiển thị icon cảnh báo kèm tooltip "Trễ X ngày" hoặc "Nguy cơ trễ Y%".
1.5. Nghiệm thu phase
Người thực hiện: TPKT.
Điều kiện: Tất cả các task trong phase phải có trạng thái done (100%) và đã được cập nhật nhật ký kèm ảnh. 
Các bước:
Chọn phase cần nghiệm thu.
Hệ thống hiển thị danh sách task thuôc phase, kèm theo:
Ảnh cuối cùng (mới nhất) của mỗi task (nếu có).
% hoàn thành và ngày cập nhật cuối.
TPKT kiểm tra ảnh và có thể lên công trình kiểm tra thực tế nếu cần. 
TPKT nhập báo cáo nghiệm thu (bắt buộc, tối thiểu 50 ký tự), nêu rõ kết luận đạt/không đạt.
Bấm "Nghiệm thu phase".
Hệ thống tự động:
Tạo biên bản nghiệm thu dạng PDF gồm: tên phase, danh sách task, % hoàn thành, ngày nghiệm thu, chữ ký số giả lập (dòng chữ "Đã duyệt bởi [Tên TPKT] vào ngày...").
Chuyển phase sang trạng thái **approved**.
Khóa tất cả các task thuộc phase (không thể cập nhật %, nhật ký, hay sửa task).
Gửi thông báo cho Giám đốc, Kế toán và các kỹ sư liên quan.
Hủy nghiệm thu (Theo phase): Chỉ được thực hiện trong vòng 7 ngày, phải có lý do. Khi đó phase trở lại trạng thái chưa nghiệm thu, các task mở khóa.
Khi bấm "Hủy nghiệm thu", hệ thống bắt buộc nhập lý do chi tiết. Toàn bộ nhật ký cũ trước khi nghiệm thu vẫn phải giữ nguyên trạng thái khóa. Kỹ sư chỉ được phép tạo thêm các bản ghi nhật ký mới kể từ ngày hủy nghiệm thu trở đi chứ không được sửa/xóa các dòng nhật ký của quá khứ. 
1.6. Các edge cases & exception khác (dễ bị bắt bẻ)
Tình huống
Xử lý
Dự án tạm dừng (pause)
TPKT hoặc Giám đốc bấm "Tạm dừng". Khi đó không cho cập nhật tiến độ, không gửi cảnh báo trễ. Deadline đóng băng. Khi resume, deadline có thể được điều chỉnh thủ công.
Kỹ sư nghỉ việc giữa chừng
TPKT assign task của người đó sang người khác ngay trên hệ thống WBS
Nhiều kỹ sư cùng task
Ai cũng có thể cập nhật %, hệ thống lấy % cao nhất. Khi cập nhật, gửi thông báo cho những người còn lại.
Task bị bỏ qua do thay đổi thiết kế
TPKT đánh dấu task là obsolete, không tính vào tiến độ. Phải nhập lý do.


1.7. Quy trình xử lý Sự cố thi công & Xử lý trễ hạn (Incident & Rework Management)
Bước 1: Khởi tạo báo cáo sự cố (Người thực hiện: Site Engineer)
Kỹ sư hiện trường tạo Báo cáo sự cố (Incident Report).
Chọn phân loại (ngoại lực/nội lực), đính kèm ảnh và mô tả sơ bộ.
Hệ thống ghi nhận thời gian, người tạo.
Bước 2: Lập báo cáo thiệt hại chi tiết (Người thực hiện: Project Leader)
Leader nhận được thông báo có báo cáo sự cố mới.
Leader xuống hiện trường kiểm tra thực tế, sau đó vào hệ thống tạo Báo cáo thiệt hại (Damage Report) liên kết với báo cáo sự cố tương ứng.
Báo cáo thiệt hại bao gồm các thông tin bắt buộc:
Mô tả thiệt hại cụ thể (hư hỏng ở phần nào, nguyên nhân chính xác).
Ước tính số lượng vật tư đã mất/hỏng (tham khảo từ định mức).
Ước tính thời gian khắc phục (số ngày cần để làm lại).
Đề xuất nhân sự thay thế (nếu cần).
Đính kèm ảnh, biên bản hiện trường (có thể upload thêm).
Leader có thể tham khảo ý kiến của kỹ thuật viên khác (nếu cần) trước khi gửi.
Sau khi hoàn thành, Leader chuyển báo cáo thiệt hại lên Trưởng phòng Kỹ thuật (TPKT). Hệ thống tự động liên kết báo cáo sự cố gốc và báo cáo thiệt hại.
Bước 3: Xác nhận và ra quyết định xử lý (Người thực hiện: TPKT)
TPKT xem xét Báo cáo sự cố và Báo cáo thiệt hại.
TPKT có thể yêu cầu bổ sung thông tin (gửi lại Leader) nếu thấy chưa đủ căn cứ.
Nếu đồng ý với báo cáo thiệt hại, TPKT tiến hành các thao tác:
Đánh dấu Task cũ (task bị hỏng) thành trạng thái Obsolete (không tính vào tiến độ, vẫn giữ lịch sử log).
Tạo một Task mới (Rework Task) để làm lại phần việc bị hỏng.
Gán (Assign) Task mới cho một kỹ sư khác (hoặc cùng team) để xử lý.
Set deadline cho Task mới (dựa trên ước tính khắc phục và quỹ thời gian dự phòng).
Hệ thống ghi log toàn bộ hành động của TPKT (người, thời gian, quyết định).
Bước 4: Tiêu hao quỹ dự phòng (Auto-tracking)
Khi TPKT set deadline cho Rework Task, hệ thống tự động so sánh với deadline gốc của Phase:
Trạng thái Xanh/Vàng (An toàn): Nếu deadline của Rework Task ≤ deadline của Phase → sự cố đã "ăn" vào quỹ thời gian dự phòng nhưng vẫn đảm bảo tiến độ giao khách. Hệ thống im lặng cho qua.
Trạng thái Đỏ (Vỡ kế hoạch): Nếu deadline của Rework Task > deadline của Phase → thủng quỹ dự phòng. Hệ thống ngay lập tức bật cảnh báo đỏ trên Dashboard của Giám đốc để có kế hoạch đàm phán lại hợp đồng hoặc chi thêm tiền ép tiến độ.
Bước 5: Xử lý vật tư đền bù (Auto-trigger)
Vật tư đã thi công hỏng tuyệt đối không dùng "Phiếu Giảm Tồn" (vì đã xuất dùng trước đó).
Project Leader tạo Yêu cầu vật tư mới cho Rework Task.
Hệ thống cộng dồn thấy lượng vật tư yêu cầu vượt định mức BOQ → tự động gắn nhãn "Vượt định mức (Over BOQ)".
Yêu cầu này bắt buộc phải được Giám đốc duyệt (sau khi Kế toán kiểm tra thủ tục).
Khi Giám đốc duyệt, hệ thống ghi nhận khoản chi phí thiệt hại vào báo cáo lỗ/lãi của dự án (tham khảo).

2. KIỂM SOÁT VẬT TƯ 
2.1. Khai báo bảng định mức vật tư cho dự án
Người thực hiện: TPKT (ngay sau khi dự án được kích hoạt, trước khi có yêu cầu vật tư).
Chi tiết:
TPKT có thể thêm bớt, custom theo đúng chuẩn tính chất công trình hiện tại vs các đồ trong báo giá đã thống nhất vs khách hàng. Với mỗi vật tư, nhập số lượng định mức tối đa (theo đơn vị tính: tấn, m3, cái, bộ...). Đây là ngưỡng không được vượt quá trong suốt dự án nếu.
Nhập định mức chi tiết theo phase.
Ràng buộc:
Định mức chỉ được nhập/sửa khi dự án ở trạng thái active và chưa có yêu cầu vật tư nào. Nếu đã có yêu cầu muốn sửa định mức phải có lý do và được Giám đốc duyệt (vì sẽ ảnh hưởng đến kiểm soát).
Không thể xóa một vật tư đã có yêu cầu, chỉ có thể đánh dấu ngừng sử dụng.
2.2. Tạo yêu cầu vật tư 
Người thực hiện: Leader dự án.
Các bước:
Chọn dự án, chọn phase, chọn vật tư từ danh mục (chỉ hiển thị những vật tư có trong bảng định mức của dự án đó).
Nhập số lượng yêu cầu, đơn vị tính (tự động lấy từ danh mục).
Nhập lý do yêu cầu (ví dụ: "thi công móng, hết xi măng").
Hệ thống tự động tính tổng số lượng đã sử dụng (đã xuất kho) + số lượng đang yêu cầu.
So sánh với định mức gốc:
Nếu tổng <= định mức → yêu cầu được gắn nhãn “trong định mức”
Nếu tổng > định mức → yêu cầu được gắn nhãn “vượt mức”, kèm cảnh báo đỏ, hiển thị số vượt.
Leader  giải trình vào yêu cầu vật tư (bắt buộc nếu vượt định mức)
Exception:
Chỉ tính tổng để so định mức của các yêu cầu đã đồng ý và tạo PO; yêu cầu submitted chưa tính vì chưa chắc được duyệt. 
Leader project có thể hủy yêu cầu khi nó còn ở trạng thái chưa qua kế toán. Nếu đã qua kế toán hoặc đã duyệt thì không hủy được (chỉ có thể tạo phiếu xử lý thừa sau).
2.3. Xử lý yêu cầu vượt định mức (Giám đốc duyệt)
Nguyên tắc: Chỉ những yêu cầu vượt định mức mới phải qua Kế toán kiểm tra và Giám đốc phê duyệt trước khi tạo PO, còn những yêu cầu dưới định mức sau khi kế toán xem xét thấy hợp lí thì tạo PO luôn đc. Đối với yêu cầu trong định mức, sau khi Kế toán kiểm tra thấy hợp lệ, có thể tạo PO ngay (không cần trình Giám đốc) 
2.3.1. Kế toán kiểm tra
Người thực hiện: Kế toán.
Các bước:
Kế toán xem danh sách các yêu cầu có trạng thái chờ soát.
Mở chi tiết từng yêu cầu: xem thông tin dự án, vật tư, số lượng, định mức, tình trạng vượt (nếu có), giải trình của kỹ sư, ảnh minh chứng (nếu có).
Kế toán có thể thêm ghi chú (ví dụ: "đã đối chiếu ngân sách, OK" hoặc "cần hỏi lại giám đốc vì giá cao").
Kế toán bấm nút "Trình duyệt" → chuyển yêu cầu sang trạng thái chờ Giám đốc duyệt. Lúc này, hệ thống gửi thông báo cho Giám đốc.
Nếu Kế toán thấy không hợp lệ, có thể từ chối (ví dụ: sai vật tư, thiếu thông tin) → yêu cầu chuyển sang từ chối, kèm lý do. Kỹ sư nhận được thông báo và có thể tạo lại yêu cầu khác.
2.3.2. Giám đốc duyệt
Người thực hiện: Giám đốc.
Các bước:
Giám đốc xem danh sách các yêu cầu chờ duyệt.
Xem chi tiết (bao gồm cả ghi chú của Kế toán).
Quyết định:
Duyệt → yêu cầu chuyển sang trạng thái đồng ý. Hệ thống ghi nhận người duyệt, thời gian.
Từ chối → yêu cầu chuyển sang từ chối, kèm lý do (bắt buộc), thông báo cho Kế toán và Kỹ sư.
Sau khi được đồng ý, Kế toán mới được phép tạo PO (xem mục 2.4)
2.3.3. Exception và edge cases
Yêu cầu vượt định mức: Khi Giám đốc duyệt, hệ thống vẫn ghi nhận là đã duyệt vượt. Không có bước duyệt đặc biệt nào thêm. Tuy nhiên, trên màn hình duyệt, cần hiển thị rõ cảnh báo đỏ và phần vượt để Giám đốc biết.
Yêu cầu đã đồng ý nhưng sau đó phát hiện sai (ví dụ do nhập lỗi). Không thể sửa trực tiếp. Cách xử lý: Kỹ sư tạo yêu cầu mới và hủy yêu cầu cũ (nếu chưa tạo PO). Nếu đã tạo PO rồi thì phải xử lý qua phiếu trả hàng / điều chỉnh.
2.4. Tạo đơn đặt hàng (PO)
Người thực hiện: Kế toán.
Điều kiện: Yêu cầu vật tư đã ở trạng thái đồng ý (sau khi Giám đốc duyệt).
Các bước:
Kế toán chọn yêu cầu (có thể gộp nhiều yêu cầu cùng dự án, cùng nhà cung cấp).
Nhập các thông tin của PO (thực tế đã gửi cho NCC bên ngoài):
Số PO (do công ty tự đặt, hoặc để trống để hệ thống tự sinh).
Tên nhà cung cấp (nhập tên NCC).
Từng mặt hàng: tên vật tư, số lượng, đơn giá, thành tiền.
Ngày đặt hàng, ngày giao hàng dự kiến (tham khảo).
Hệ thống lưu PO với trạng thái đã gửi.
Các yêu cầu liên quan được đánh dấu PO đã tạo.
Ràng buộc:
Tổng số lượng trong PO không được vượt quá tổng số lượng của các yêu cầu đã đồng ý (có thể ít hơn, nhưng không nhiều hơn).
Nếu Kế toán muốn thay đổi PO sau khi đã lưu, phải hủy PO cũ và tạo mới (không cho sửa trực tiếp).
Mục đích của PO trong hệ thống:
Làm căn cứ để khi nhận hàng, nhân viên kỹ thuật chọn PO và nhập số lượng thực nhận (đối soát).
Lưu giá trị tiền đã chi (để sau tính lãi lỗ).
Không làm: Không theo dõi thanh toán từng phần cho NCC, không công nợ NCC, không tích hợp ngân hàng.
2.5. Ghi nhận nhận hàng (Nhập kho ảo)
Người thực hiện: Leader dự án
Các bước:
Chọn PO đã gửi (hiển thị danh sách các PO của dự án).
Nhập số  lượng thực nhận (có thể ít hơn hoặc bằng số lượng trong PO). Nếu nhiều hơn → không cho phép, bắt buộc phải tạo PO bổ sung.
Tải lên ảnh phiếu giao hàng (hoặc chụp hàng thực tế) 
Hệ thống cập nhật tồn kho ảo của công trình: cộng số lượng thực nhận vào tồn.
PO được cập nhật trạng thái nhận 1 nửa hoặc nhận full 
Exception:
Nếu số lượng thực nhận khác với số lượng yêu cầu (trong PO), hệ thống hiển thị cảnh báo nhưng vẫn cho phép lưu. Kế toán sẽ được thông báo để xử lý với NCC (nếu thiếu) hoặc điều chỉnh yêu cầu (nếu thừa).
Nếu nhận hàng nhưng chưa có PO (trường hợp khẩn cấp): không cho phép. Phải tạo yêu cầu và PO trước, sau đó mới nhập kho. (Quy trình cứng để tránh thất thoát).
2.6. Ghi nhận xuất dùng (sử dụng vật tư)
Người thực hiện: Leader dự án
Các bước:
Chọn dự án, chọn vật tư từ danh sách (chỉ hiển thị những vật tư đang có tồn > 0).
Nhập số lượng xuất, chọn task liên quan (nếu có, không bắt buộc).
Nhập mục đích (ví dụ: "đổ móng ngày 20/5").
Hệ thống kiểm tra nếu số lượng xuất > tồn kho hiện tại → báo lỗi, không cho xuất (vì không thể xuất âm). Tuy nhiên có thể xuất một phần, phần còn lại để lần sau.
Lưu, hệ thống trừ tồn kho.
Exception:
Xuất dùng nhưng sau đó phát hiện bị hư hỏng, mất mát: không có cơ chế hoàn nhập trực tiếp. Thay vào đó, tạo phiếu "điều chỉnh giảm tồn" (kiểu kiểm kê) với lý do hư hỏng, cần Giám đốc duyệt (xem mục 2.8.3).
Nếu xuất cho task nhưng task đó sau bị hủy (obsolete), vật tư đã dùng không thể hoàn lại. Nhưng có thể tạo phiếu nhập lại nếu vật tư chưa dùng và còn nguyên (rất hiếm, có thể xử lý thủ công bằng phiếu điều chỉnh tăng tồn).
2.7. Quy trình xử lý vật tư thừa (Surplus Material Handling)
Mục tiêu nghiệp vụ:
Khi phát sinh vật tư dư thừa tại công trình, hệ thống ép buộc người dùng phải tuân thủ thứ tự ưu tiên xử lý để chống thất thoát tài sản: (1) Trả NCC => (2) Chuyển công trình => (3) Thanh lý.
"Thanh lý" là lựa chọn cuối cùng và chỉ được mở khóa khi 2 phương án trên thất bại.
2.7.1. Khởi tạo phiếu đề xuất (Người thực hiện: Leader dự án)
Bước 1: Leader chọn Dự án => Chọn vật tư dư thừa (Hệ thống tự filter các vật tư có Tồn kho ảo > 0 và chưa bị khóa bởi phiếu khác).
Bước 2: Nhập số lượng cần xử lý (<= Tồn kho hiện tại).
Bước 3: Hệ thống tự động đẩy yêu cầu vào Luồng 1 (Trả NCC) làm mặc định. Nếu Leader muốn nhảy cóc sang Luồng 2 hoặc Luồng 3, hệ thống sẽ yêu cầu tick chọn xác nhận ngoại lệ (Ví dụ: "Vật tư này công ty tự sản xuất, không có NCC" hoặc "Vật tư đã hết hạn đổi trả").
2.7.2. Luồng 1: Trả lại Nhà cung cấp (Ưu tiên 1 - Xử lý bởi Kế toán)
Phiếu được gửi cho Kế toán.
Kế toán liên hệ NCC ở bên ngoài hệ thống.
Nếu NCC đồng ý nhận lại: Kế toán nhập số tiền dự kiến thu hồi => Bấm "Hoàn tất trả hàng". Hệ thống trừ tồn kho ảo công trình và đóng phiếu.
Nếu NCC TỪ CHỐI: Kế toán bấm nút "NCC từ chối nhận". Phiếu tự động chuyển trạng thái thành Need Reprocess (Cần chuyển hướng) và bắn thông báo trả về cho Leader dự án.
2.7.3. Luồng 2: Chuyển công trình khác (Ưu tiên 2 - Xử lý bởi TPKT)
Thỏa thuận trước (Ngoài hệ thống): Leader Dự án A chủ động liên hệ nội bộ (Zalo/Gọi điện) với các công trình khác. Khi có Dự án B đồng ý nhận, Leader A mới bắt đầu thao tác trên hệ thống.
Cập nhật phiếu: Sau khi bị NCC từ chối (hoặc chọn ngoại lệ từ đầu), Leader A chuyển mục đích phiếu sang "Chuyển công trình" và chủ động chọn đích đến là Dự án B.
TPKT kiểm duyệt: Phiếu được đẩy lên cho Trưởng phòng Kỹ thuật (TPKT). TPKT kiểm tra để đảm bảo tính hợp lý (Ví dụ: Dự án B có thực sự phù hợp để dùng loại vật tư này không, quãng đường vận chuyển có quá xa gây lãng phí không).
Nếu TPKT TỪ CHỐI: TPKT nhập lý do (VD: "Dự án B sắp đóng rồi không nhận thêm"). Phiếu chuyển về trạng thái Need Process và trả lại cho Leader A để chuyển sang phương án Thanh lý.
Nếu TPKT ĐỒNG Ý: 1. Phiếu chuyển trạng thái thành Chờ xuất hàng. 2. Hàng được bốc lên xe, Leader Dự án A bấm nút "Xác nhận đã xuất". 3. Phiếu chuyển trạng thái thành Chờ nhận hàng. Khi xe tới nơi, Leader Dự án B kiểm đếm và bấm nút "Xác nhận đã nhận". 4. Hệ thống ngầm định hoàn tất giao dịch: Trừ (-) tồn kho Dự án A và Cộng (+) tồn kho Dự án B.
2.7.4. Luồng 3: Thanh lý (Lựa chọn cuối - Xử lý bởi Kế toán)
Chỉ khi phiếu bị TPKT từ chối điều chuyển, Leader mới được phép cập nhật phiếu sang mục đích "Thanh lý".
Leader nhập mô tả tình trạng vật tư, đính kèm ảnh chụp => Gửi đi.
Phiếu được gửi cho Kế toán.
Kế toán thực hiện gọi người mua ve chai/thanh lý bên ngoài. Sau khi bán xong, Kế toán điền "Giá trị thu hồi thực tế" vào phiếu => Bấm "Hoàn tất thanh lý".
Hệ thống trừ tồn kho ảo. (Số tiền thanh lý được lưu lại làm tham chiếu báo cáo lỗ/lãi dự án).
2.7.5. Edge Cases & Exception (Các tình huống ngoại lệ)
Tình huống phát sinh
Cách hệ thống xử lý
NCC từ chối nhận lại một phần
Kế toán duyệt số lượng NCC chịu nhận (hệ thống trừ kho phần này). Phần dư còn lại, Leader phải tạo 1 Phiếu xử lý thừa mới để đi luồng Chuyển kho/Thanh lý.
Chuyển kho nhưng Dự án B không xác nhận nhận hàng
Nếu sau 7 ngày Dự án B không bấm "Xác nhận nhận", hệ thống auto-tag Giám đốc và TPKT vào để cảnh báo thất thoát vật tư trên đường vận chuyển.
Hàng hư hỏng trong lúc chuyển kho (từ A sang B)
Leader Dự án B từ chối nhận hàng trên hệ thống. Hàng bị trả về trạng thái của Dự án A. Leader Dự án A phải tạo "Phiếu Giảm tồn" (Lý do: Hư hỏng khi vận chuyển) để Giám đốc duyệt trừ kho.
Dự án B chưa từng khai báo loại vật tư này trong BOQ
Hệ thống vẫn cho phép nhận chuyển kho. Nó sẽ tự động Add loại vật tư đó vào kho ảo của Dự án B với Định mức (BOQ) = 0.
Khóa vật tư đang xử lý
Một khi vật tư (VD: Xi măng) đang nằm trong 1 Phiếu xử lý thừa chưa đóng, Leader không được phép tạo thêm phiếu xử lý khác cho phần tồn kho đó để tránh xuất âm (Double-booking).



2.8. Phiếu điều chỉnh tồn kho (Tăng / Giảm)
2.8.1. Nguyên tắc phân luồng
Để đảm bảo kho ảo khớp với thực tế mà không làm quá tải ban lãnh đạo, hệ thống chia làm 2 luồng rõ rệt:
Luồng Tăng Tồn (Tự động): Áp dụng khi thợ xuất dùng không hết trả lại kho, hoặc kiểm kê phát hiện thừa. Vì việc tăng tồn có lợi cho tài sản công ty nên hệ thống không cần ai duyệt (Auto-approve). Tạo phiếu xong là kho cộng lập tức.
Luồng Giảm Tồn (Kiểm soát chặt): Áp dụng khi vật tư bị mất mát, hao hụt tự nhiên, hoặc kiểm kê thiếu. Mọi phiếu giảm tồn đều gắn liền với thất thoát tài chính nên bắt buộc phải qua Kế toán soát xét và Giám đốc duyệt trước khi trừ kho.
2.8.2. Các tình huống điều chỉnh và Thẩm quyền
Loại Phiếu
Tình huống
Người khởi tạo
Người duyệt
Điều kiện / Ghi chú
TĂNG TỒN
Thợ dùng dư trả lại kho, hoặc kiểm kê phát hiện thừa.
Leader dự án
Hệ thống (Auto)
Bắt buộc ghi chú rõ nguồn gốc trả lại hoặc đính kèm biên bản kiểm kê.
GIẢM TỒN
Hao hụt tự nhiên (xi măng ẩm mốc, cát rơi vãi...).
Leader dự án
Giám đốc (Kế toán soát)
Bắt buộc đính kèm ảnh chụp tình trạng hao hụt.
GIẢM TỒN
Mất mát, thất lạc, mất trộm tại công trình.
Leader dự án
Giám đốc (Kế toán soát)
Bắt buộc đính kèm biên bản xác nhận mất mát.
GIẢM TỒN
Kiểm kê cuối kỳ phát hiện thiếu hụt kho ảo vs kho thực tế.
Kế toán
Giám đốc
Bắt buộc có biên bản kiểm kê đối chiếu sổ sách.

2.8.3. Quy trình thực hiện chi tiết
Luồng 1: Điều chỉnh Tăng Tồn 
Leader dự án/Kế toán tạo Phiếu tăng tồn => Chọn vật tư, nhập số lượng dư, ghi chú lý do.
Bấm Lưu. Hệ thống tự động hoàn thành phiếu và cộng (+) số lượng vào kho ảo công trình mà không cần chờ Kế toán hay Giám đốc.
Luồng 2: Điều chỉnh Giảm Tồn (Có thất thoát)
Leader dự án (hoặc Kế toán) tạo Phiếu giảm tồn =>  Chọn vật tư, nhập số lượng hụt, đính kèm ảnh/biên bản minh chứng.
Phiếu được đẩy sang Kế toán. Kế toán kiểm tra tính hợp lệ, hệ thống tự tính giá trị tiền bị thất thoát (dựa trên đơn giá PO gần nhất). Kế toán có thể thêm ghi chú rồi bấm "Trình Giám đốc".
Giám đốc xem báo cáo tổn thất => Quyết định Duyệt hoặc Từ chối (kèm lý do).
Ngay khi Giám đốc duyệt, hệ thống tự động trừ (-) tồn kho ảo và lưu giá trị hao hụt vào log tài chính.
2.8.4. Xử lý ngoại lệ: Hư hỏng vật tư do thi công sai (Rework/Damages)
Hệ thống TUYỆT ĐỐI KHÔNG dùng "Phiếu Giảm Tồn" cho các vật tư đã được trộn/thi công hỏng (vì vật tư đó đã bị trừ khỏi kho lúc xuất dùng, nếu trừ nữa sẽ ra tồn kho âm). Quy trình ghi nhận thiệt hại như sau:
Site Engineer tạo Báo cáo sự cố. Leader kiểm tra và đẩy lên TPKT.
TPKT ra quyết định giảm % tiến độ Task hoặc yêu cầu đập đi làm lại.
Leader dự án tạo Yêu cầu vật tư mới để bù vào phần làm hỏng. Do hao hụt, yêu cầu này tự động bị hệ thống gắn nhãn "Vượt định mức (Over BOQ)".
Khi Giám đốc duyệt cái Yêu cầu vật tư Vượt định mức này, đồng nghĩa với việc Giám đốc chấp nhận chi phí thiệt hại do sự cố thi công sai. Hệ thống luân chuyển sang Kế toán tạo PO và Nhập kho bình thường.
2.8.5. Edge Cases (Ngoại lệ xử lý khác)
Sai sót quy trình (Quên nhập kho): Nếu kiểm kê thấy kho ảo thiếu do Kế toán/Leader quên làm thủ tục "Nhận hàng" từ PO, thì TUYỆT ĐỐI KHÔNG dùng Phiếu Tăng Tồn để bù vào. Phải quay lại làm đúng luồng "Ghi nhận nhận hàng" từ PO gốc.
Thiếu ảnh minh chứng (Giảm tồn): Nếu Leader tạo phiếu Giảm tồn mà không up ảnh, hệ thống cảnh báo đỏ nhưng vẫn cho Submit. Kế toán/Giám đốc có quyền Từ chối nếu thấy không thuyết phục.
Cảnh báo hao hụt lớn: Nếu Leader nhập số lượng Giảm tồn > 20% tồn kho hiện tại, hệ thống bật cờ cảnh báo "Số lượng hao hụt lớn bất thường" để Kế toán và Giám đốc soi kỹ khi duyệt.

2.9. Kiểm kê cuối kỳ
Bước 1: Chỉ cần cung cấp 1 nút "Xuất Excel" ở màn hình Tồn kho. File này sẽ in ra danh sách số lượng vật tư đáng lẽ phải có (Tồn kho lý thuyết).
Bước 2 : Kế toán cầm file Excel in ra giấy, chạy ra công trường, đếm số lượng xi măng, sắt thép thực tế và tự ghi chép lại sự chênh lệch.
Bước 3 (Dùng lại tính năng có sẵn): Sau khi đếm xong và chốt được chênh lệch:
Nếu đếm thực tế thấy THỪA: Kế toán/Leader vào lại hệ thống, dùng tính năng Tạo Phiếu Tăng Tồn (ở mục 2.8).
Nếu đếm thực tế thấy THIẾU: Kế toán/Leader dùng tính năng Tạo Phiếu Giảm Tồn (ở mục 2.8) để xin Giám đốc duyệt trừ kho.
2.10. Các edge cases & exception 
Tình huống
Xử lý 
Yêu cầu vật tư khẩn cấp (Direct Purchase)
Leader dự án chọn loại phiếu "Mua ngoài khẩn cấp" (chỉ áp dụng vật tư trong BOQ) và bắt buộc tải ảnh hóa đơn. Hệ thống tự động (Auto) sinh PO và Phiếu nhập => Tồn kho ảo tăng ngay lập tức để thợ dùng. Kế toán chỉ xem lại các phiếu này để làm thủ tục hoàn tiền/giải ngân bên ngoài hệ thống.
NCC giao hàng thiếu nhiều lần
Hệ thống cho phép nhận từng phần. PO chuyển sang trạng thái "Giao 1 phần". Sau 3 lần ghi nhận nhận hàng một phần trên cùng 1 PO, hệ thống tự động gửi cảnh báo cho Kế toán để làm việc lại với NCC.
Hàng giao sai chủng loại
Leader dự án từ chối nhận, không nhập kho trên hệ thống. Ghi chú vào PO. Kế toán liên hệ NCC đổi trả. Hệ thống không sinh thêm phiếu giao dịch nào.
Vật tư bị hư hỏng trước khi xuất dùng
(Ví dụ: Xi măng để trong kho bị ngập nước). Leader dự án tạo Phiếu điều chỉnh giảm tồn theo mục 2.8 (Trình Kế toán soát => Giám đốc duyệt trừ kho).
Kế toán tạo PO – ghi nhận NCC
Hệ thống không có module quản lý NCC riêng (Supplier Management). Khi tạo PO, Kế toán chỉ nhập tay tên NCC (dạng text). Không lưu thông tin chi tiết (địa chỉ, mã số thuế) để giảm tải Database.
Một vật tư có nhiều đơn vị tính
Hệ thống TUYỆT ĐỐI KHÔNG hỗ trợ quy đổi hệ số phức tạp. Mỗi vật tư trong Catalog chỉ có 1 Đơn vị cơ bản (Base Unit). Mọi giao dịch (Xin, PO, Nhập, Xuất) bắt buộc nhập theo đơn vị này. Nếu NCC báo giá theo đơn vị khác, Kế toán phải tự nhân tay ra đơn vị chuẩn trước khi nhập vào PO.
Chuyển kho nhưng dự án đích không có định mức (BOQ) vật tư đó
Vẫn cho phép chuyển. Hệ thống tự động thêm vật tư đó vào kho ảo của dự án đích, với định mức (BOQ) = 0. Nghĩa là không được phép mua mới thêm, nhưng có thể nhận đồ chuyển về để xài tạm.
Trả lại NCC nhưng NCC chỉ nhận một phần
(Ví dụ: Dư 10 bao, NCC chỉ cho trả 6 bao). Leader dự án ghi nhận trả 6 bao trong phiếu Trả NCC. 4 bao còn lại sẽ nằm trong tồn kho, Leader phải làm 1 phiếu Xử lý thừa khác (Chuyển kho hoặc Thanh lý) để dọn sạch.
Kế toán quên kiểm tra phiếu vật tư
Hệ thống có job chạy ngầm (batch job) hàng ngày: Gửi email cảnh báo danh sách các phiếu Yêu cầu/Giảm tồn đã tạo quá 48h mà Kế toán chưa xử lý.



3. BÁO CÁO & DASHBOARD (HỖ TRỢ QUẢN LÝ)
Hệ thống cung cấp các báo cáo trực quan và chi tiết phục vụ Giám đốc, Trưởng phòng Kỹ thuật, Kế toán. Tất cả báo cáo đều có thể xuất ra Excel/PDF.
3.1. Dashboard tổng thể (dành cho Giám đốc & TPKT): Cung cấp biểu đồ trực quan về sức khỏe các dự án (số dự án đúng hạn/trễ hạn, tỷ lệ vượt định mức vật tư, cảnh báo tồn kho đỏ).
3.2. Báo cáo AI tóm tắt tiến độ: Sử dụng Gemini AI tóm tắt các nhật ký công trường rải rác thành một đoạn báo cáo ngắn gọn hàng tuần, nêu bật rủi ro và các mốc hoàn thành.
3.3. Báo cáo tiến độ dự án (Gantt Chart & Dạng lưới): Hiển thị WBS, so sánh ngày Baseline (Kế hoạch) với Actual (Thực tế) để theo dõi độ trễ của từng Task/Phase.
3.4. Báo cáo nhật ký công trường: Liệt kê lịch sử cập nhật tiến độ, hình ảnh thi công và các comment theo từng Task/Ngày.
3.5. Báo cáo đối chiếu Định mức vật tư (BOQ vs Actual): So sánh tổng số lượng vật tư Đã xuất dùng so với Định mức thiết kế ban đầu. Highlight đỏ các vật tư vượt BOQ.
3.6. Báo cáo tồn kho vật tư theo công trình: Theo dõi số lượng Tồn ảo hiện tại của từng dự án, hỗ trợ đối chiếu khi kiểm kê.
3.7. Báo cáo lịch sử Nhập/Xuất kho (Inventory Ledger): Truy xuất chi tiết dòng chảy vật tư: Nhập từ PO nào, Xuất cho Task nào, Tăng/Giảm tồn do phiếu nào.
3.8. Báo cáo chi phí vật tư tham khảo: Tính toán tổng giá trị tiền dựa trên PO và số lượng nhập kho (Hỗ trợ Kế toán tham khảo, không sinh hạch toán).
3.9. Báo cáo thống kê thất thoát vật tư: Tổng hợp số lượng và giá trị vật tư bị giảm tồn (do hao hụt, hư hỏng, mất trộm) để đánh giá hiệu quả quản lý hao phí của Leader.

4. QUẢN TRỊ HỆ THỐNG (ADMIN)
4.1. Quản lý người dùng (User Management)
4.2. Phân quyền (Role  )
4.3. Xem log hành động (Audit Log)
4.4. Cấu hình hệ thống (System Configuration)
4.5. Material Catalog management

5. CÁC TÍNH NĂNG AUTH
Tính năng
Mô tả
Đăng nhập
Người dùng nhập email và mật khẩu. Hệ thống kiểm tra, nếu đúng thì chuyển đến dashboard tương ứng theo vai trò.
Đăng xuất
Hủy phiên làm việc, quay về màn hình đăng nhập.
Đổi mật khẩu 
Sau khi đã đăng nhập, người dùng có thể vào màn hình "Cá nhân" để đổi mật khẩu 
Quên mật khẩu
Trên màn hình login, có link "Quên mật khẩu". Người dùng nhập email, hệ thống gửi link đặt lại mật khẩu qua email (link có hiệu lực 15 phút). Không yêu cầu câu hỏi bảo mật.
Khóa tài khoản sau nhiều lần sai
Sau 5 lần nhập sai mật khẩu liên tiếp, tài khoản bị khóa tạm thời trong 15 phút. Admin có thể mở khóa sớm.







