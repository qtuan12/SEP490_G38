

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
Quyền trên Dự án & Task (Quản lý thi công)
Quyền trên Vật tư (Quản lý kho ảo)
Trưởng phòng Kỹ thuật (TPKT)
- Tạo mới, sửa, xóa dự án (trạng thái Draft).

- Kích hoạt dự án (Draft → Active).

- Tạm dừng / Tiếp tục dự án.

- Upload bản vẽ thiết kế (Design) của dự án.

- Lập và chỉnh sửa WBS (Phase, Task) trước khi có tiến độ.

- Gán Leader cho dự án.

- Phân công và điều chỉnh deadline task (ghi log lý do).

- Điều chỉnh giảm % hoàn thành Task khi có sự cố (dựa trên báo cáo sự cố).

- Nghiệm thu Phase (khi 100% task hoàn thành & có ảnh).

- Hủy nghiệm thu Phase (trong 7 ngày, bắt buộc nhập lý do).

- Đánh dấu Task là Obsolete (Hủy/Bỏ qua).

- Xem toàn bộ dự án, báo cáo tiến độ, dashboard.

- Bình luận (Comment) vào nhật ký thi công.
- Thêm thành viên (Add member) vào dự án.
- Khai báo và chỉnh sửa Bảng định mức vật tư (BOQ) trước khi có yêu cầu.

- Xem tồn kho ảo của tất cả các dự án.

- Phê duyệt phiếu điều chuyển (Transfer) vật tư giữa các công trình.
Leader Project
- Thêm thành viên (Add member) vào dự án.

- Tạo task con, phân công (Assign) thành viên.

- Cập nhật nhật ký hàng ngày: Tăng % hoàn thành task, đính kèm ảnh và mô tả.

- Bình luận dưới nhật ký thi công.

- Xem Dashboard tiến độ cá nhân/dự án.

- Tiếp nhận báo cáo sự cố từ Site Engineer,  bộ, điền thiệt hại và trình TPKT.


- Tạo Yêu cầu vật tư (chọn vật tư, số lượng, lý do).

- Xem trạng thái yêu cầu vật tư của mình.

- Ghi nhận Nhập kho (chọn PO, nhập số thực nhận, tải ảnh phiếu giao hàng).

- Ghi nhận Xuất dùng (chọn vật tư, số lượng, mục đích, gắn task).

- Tạo phiếu Mua ngoài khẩn cấp (Direct Purchase).

- Xem tồn kho dự án mình quản lý.

- Tạo phiếu đề xuất xử lý vật tư thừa

- Xác nhận Giao/Nhận hàng khi điều chuyển kho.

- Tạo phiếu Điều chỉnh tồn kho: Tăng tồn (Auto duyệt)
- Tạo báo cáo sự cố cho việc mất hay hỏng vật tư trong kho cho kế toán còn tạo giảm tồn


Nhân viên Kỹ thuật (Site Engineer)
- Xem thông tin cơ bản và bản vẽ thiết kế của dự án.

- Cập nhật nhật ký hàng ngày: Tăng % hoàn thành task, đính kèm ảnh và mô tả.

- Bình luận dưới nhật ký thi công.

- Xem Dashboard tiến độ của cá nhân.

- Lập Báo cáo sự cố khi thi công hỏng do ngoại lực/nội lực.
(Chỉ xem thông tin liên quan đến công việc, không thao tác trên luồng xuất/nhập/tồn vật tư).
Giám đốc
- Xem tất cả dự án, Dashboard tổng thể.

- Xem cảnh báo trễ hạn (Đỏ/Vàng).
- Phê duyệt Yêu cầu vật tư vượt định mức (sau khi Kế toán trình).

- Phê duyệt Phiếu điều chỉnh giảm tồn (do hao hụt, mất mát, kiểm kê thiếu).
Kế toán
- Xem thông tin tham chiếu của dự án (Tên dự án, BOQ, báo cáo xuất/nhập, PO) để phục vụ kiểm kê/thanh toán.
- Xem Dashboard tồn kho toàn hệ thống.
- Kiểm tra Yêu cầu vật tư: Trong định mức (Tạo PO ngay), Vượt định mức (Trình Giám đốc).
- Tạo, sửa (khi chưa nhận hàng) và hủy PO.
- Xử lý phiếu vật tư thừa (Làm thủ tục Trả NCC, Thanh lý).
- Xem phiếu Mua ngoài khẩn cấp của PL để làm thủ tục giải ngân.
- Tạo Phiếu điều chỉnh giảm tồn khi đi kiểm kê cuối kỳ phát hiện thiếu (Trình Giám đốc duyệt).
Admin


- Quản lý User (Thêm, sửa, khóa, gán Role - Tuyệt đối không xóa cứng).

- Quản lý Danh mục vật tư (Thêm, sửa, khóa).

- Thiết lập cấu hình hệ thống: 1 Đơn vị tính cơ bản duy nhất (Không dùng hệ số quy đổi), Ngưỡng tồn kho thấp, Thời hạn hủy phiếu, % trễ kỳ vọng.



0. CÁC THỰC THỂ CHÍNH VÀ VÒNG ĐỜI (ĐÃ CHỈNH SỬA)

Thực thể
Vòng đời (Các bước diễn ra theo thời gian)
Dự án
Tạo mới (Bản nháp) => Kích hoạt (Bắt đầu thi công)=> Đang thi công => Tạm dừng (Bởi TPKT/Giám đốc nếu có sự cố/pháp lý) =>Hoàn thành=>Đóng (Lưu trữ).
Task
Tạo mới (Thuộc WBS) => Đã phân công (Giao kỹ sư) => Đang thực hiện (Có tiến độ)=>Hoàn thành (100%)=>Đã nghiệm thu (Khóa cập nhật).
(Ngoại lệ: Có thể chuyển sang trạng thái Obsolete (Hủy bỏ) từ bất kỳ bước nào trước nghiệm thu).
Nhật ký công trường
Không có vòng đời dài. Leader/Kỹ sư tạo bản ghi mới mỗi ngày cho từng task. (Có thể Undo/Hoàn tác trong vòng 24h nếu gõ sai, với điều kiện Phase chưa nghiệm thu).
Báo cáo sự cố (Incident)
Được chia làm 2 luồng độc lập tùy thuộc vào tính chất sự cố:
Nhánh 1: Sự cố thi công (Hỏng việc, Rework)
Nhân viên Kỹ thuật (SE) tạo báo cáo sơ bộ => Leader dự án (PL) xuống hiện trường kiểm tra, lập báo cáo chi tiết thiệt hại => Trưởng phòng Kỹ thuật (TPKT) thẩm định => (Nếu hợp lệ) TPKT đánh dấu Task cũ thành Obsolete và tạo Rework Task mới (Ghi nhận giá trị/khối lượng thiệt hại vào phiếu làm căn cứ cấp lại vật tư) hoặc giảm % task
Nhánh 2: Sự cố vật tư tại kho (Mất mát, hư hỏng khi chưa xuất dùng)
Leader dự án (PL) tạo báo cáo sự cố (kèm ảnh/biên bản) => Kế toán kiểm tra xác minh=> (Nếu hợp lệ) Kế toán dùng phiếu sự cố này làm căn cứ để tạo Phiếu điều chỉnh Giảm tồn (Trình Giám đốc duyệt trừ kho).
Yêu cầu vật tư (Material Request)
Ngay khi tạo, hệ thống tự động Tạm giữ (Hold) hạn mức BOQ và phân luồng:
- Trong định mức: Tạo yêu cầu=> Kế toán kiểm tra (Từ chối =>Hủy/Nhả BOQ)=> Hợp lệ => Chuyển sang tạo PO.
- Vượt định mức: Tạo yêu cầu => Kế toán soát hồ sơ => Trình Giám đốc duyệt=> Chuyển sang tạo PO
- Khẩn cấp mua ngoài (Direct Purchase): Leader tạo yêu cầu kèm ảnh hóa đơn => Hệ thống check điều kiện (Bắt buộc Tổng đối chiếu <= BOQ)=> Hợp lệ: Auto sinh PO và Phiếu nhập (Tồn kho tăng ngay) => Kế toán soát để giải ngân tài chính bên ngoài.
Đơn đặt hàng (PO)
Tạo đơn (từ Yêu cầu đã duyệt) => Đã gửi NCC =>Đã giao một phần (Partially Received) => Đã giao đủ (Fully Received) => Đóng.
(Lưu ý: Hệ thống chỉ lưu PO để đối soát kho, các bút toán thanh toán Kế toán làm trên phần mềm ERP riêng).
Kho ảo công trình
Không có vòng đời. Chỉ thay đổi số lượng tồn kho theo thời gian thực (Real-time) dựa vào: Phiếu nhập (PO/Khẩn cấp), Phiếu xuất dùng, Phiếu xử lý vật tư thừa, và Phiếu điều chỉnh.
Phiếu xử lý vật tư thừa
Leader tạo phiếu (Hệ thống tạm khóa vật tư thừa trong kho) => Chuyển sang 1 trong 3 nhánh hành động:
- Trả NCC: Gửi Kế toán xử lý=> Đã trả (Hệ thống trừ kho).
- Chuyển kho: PL tạo phiếu chuyển => TPKT duyệt=> Giao hàng => Nhận hàng=> Trừ kho gửi, Tăng kho nhận.
- Thanh lý: Gửi Kế toán xử lý=> Hoàn tất (Hệ thống trừ kho).
Phiếu Điều chỉnh tồn kho
- Tăng tồn (Thu hồi từ thợ/Kiểm kê dư): Leader dự án tạo phiếu => Hệ thống auto duyệt và Tăng tồn kho ngay lập tức (Rút gọn thủ tục).
- Giảm tồn (Mất mát/Hư hỏng/Kiểm kê thiếu): Kế toán tạo phiếu (Dựa trên Báo cáo sự cố/Biên bản) => Trình Giám đốc duyệt => Giảm tồn.



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
Xử lý sự cố thi công (hỏng hóc, lỗi kỹ thuật, thiên tai): Kỹ sư hiện trường tuyệt đối không thể tự nhập % giảm trên giao diện Nhật ký (hệ thống validate % mới phải >= % cũ).
Thay vào đó, Kỹ sư phải tạo Báo cáo sự cố (Incident Report) theo quy trình tại Mục 1.7. Hệ thống sẽ giữ nguyên % tiến độ của task cũ để làm lịch sử lưu vết.
Dựa trên Incident này, Leader sẽ điền thêm các thiệt hại về người về các loại thiệt hại rồi trình lên cho TPKT , rồi TPKT sẽ ra quyết định đánh dấu task cũ là Obsolete (Hủy) và sinh ra một Rework Task mới hoặc nếu chưa đủ nghiêm trọng thì chỉ cần giảm % progress của task thôi. Vật tư hư hỏng sẽ được ghi nhận thiệt hại thông qua Báo cáo sự cố thôi chứ k còn chỗ lưu.
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
2.2. Tạo yêu cầu cấp phát vật tư (Material Request)
Người thực hiện: Leader dự án. Mục đích: Yêu cầu bộ phận Kế toán/Thu mua cấp phát vật tư xuống công trường để thi công, đồng thời hệ thống tự động kiểm soát số lượng yêu cầu không được vượt quá Định mức (BOQ) đã phê duyệt.
1. Các bước thực hiện (Basic Flow)
Khởi tạo: Leader dự án truy cập tính năng "Tạo yêu cầu vật tư".
Chọn thông tin tham chiếu: Chọn Dự án và Phase tương ứng cần thi công.
Chọn vật tư: Hệ thống xổ ra danh sách vật tư. Ràng buộc: Chỉ hiển thị những vật tư đã được TPKT khai báo trong Bảng định mức (BOQ) của dự án đó.
Nhập thông tin chi tiết:
Nhập Số lượng yêu cầu (Đơn vị tính được hệ thống tự động lấy theo danh mục chuẩn).
Nhập Lý do yêu cầu (Bắt buộc. Ví dụ: "Xin vật tư thi công móng tuần 3 tháng 6").
Hệ thống tự động đối chiếu BOQ (Auto-Calculation): Ngay khi nhập số lượng, hệ thống sẽ tự động tính toán tổng khối lượng để đối chiếu với BOQ theo công thức:
Tổng đối chiếu = Số lượng đã xuất dùng + Số tồn kho ảo hiện tại + Các PO đang chờ giao + TẤT CẢ Yêu cầu vật tư đang ở trạng thái Chờ duyệt + Số lượng đang xin trong phiếu này.
Cảnh báo & Gắn nhãn phân luồng: Dựa vào kết quả đối chiếu, hệ thống xử lý:
Trường hợp 1 (Tổng đối chiếu <= Định mức gốc): Phiếu được gắn nhãn xanh "Trong định mức". Cho phép lưu và Submit bình thường.
Trường hợp 2 (Tổng đối chiếu > Định mức gốc): Phiếu lập tức bị gắn nhãn đỏ "Vượt định mức" kèm theo số lượng vượt lố. Hệ thống hiển thị thêm trường nhập liệu "Giải trình vượt định mức" (Bắt buộc nhập, phải đính kèm Báo cáo sự cố hoặc lý do chính đáng để Giám đốc xem xét).
Submit: Leader nhấn gửi. Phiếu chuyển sang trạng thái Chờ Kế toán kiểm tra (Pending).
2. Cơ chế "Tạm giữ" Hạn mức (Hold Quota)
Nhằm chống gian lận (Leader spam nhiều phiếu cùng lúc để lách trần BOQ), ngay khi một phiếu yêu cầu được Submit, hệ thống sẽ tạm giữ (hold) phần số lượng đó vào hạn mức BOQ hiện tại.
Bất kỳ yêu cầu nào tạo sau đó đều phải cộng dồn số tạm giữ này vào Tổng đối chiếu.
Nếu phiếu bị Kế toán hoặc Giám đốc Từ chối, hệ thống sẽ tự động hủy phiếu và "nhả" lại hạn mức đã tạm giữ trả về cho dự án.
3. Phân luồng phê duyệt (Approval Workflow)
Hệ thống tự động định tuyến phiếu dựa trên nhãn đánh giá:
Phiếu "Trong định mức": Đi thẳng đến màn hình của Kế toán. Kế toán kiểm tra hợp lệ là được phép duyệt và tạo PO ngay lập tức (Không làm phiền Giám đốc).
Phiếu "Vượt định mức": Bắt buộc phải qua Bộ lọc Kế toán. Kế toán soi xét giải trình và chứng từ. Nếu vô lý -> Kế toán Từ chối (hủy phiếu). Nếu hợp lý -> Kế toán bấm Trình duyệt, lúc này hệ thống mới báo cáo lên màn hình của Giám đốc để ra quyết định cuối cùng.
4. Quy tắc Hủy phiếu (Exceptions & Ràng buộc)
Quyền Hủy của Leader: Leader dự án chỉ được phép Hủy (Cancel) yêu cầu vật tư khi nó còn đang ở trạng thái Chờ Kế toán kiểm tra.
Trạng thái Khóa (Locked): Một khi Kế toán đã thao tác trên phiếu (Trình duyệt lên Giám đốc, hoặc Đã đồng ý tạo PO), Leader dự án tuyệt đối không thể tự hủy phiếu.
Xử lý "Sự đã rồi": Nếu phiếu đã duyệt/đã tạo PO mà Leader lại báo "Không cần vật tư này nữa", quy trình yêu cầu Kế toán cứ tiến hành nhập kho bình thường, sau đó Leader phải dùng tính năng Quy trình xử lý vật tư thừa (Surplus Management ở mục 2.7) để lập phiếu hoàn trả hoặc điều chuyển sang dự án khác. Tuyệt đối không xóa/hủy giao dịch trong quá khứ để đảm bảo tính minh bạch của luồng dữ liệu.
2.3. Phân luồng kiểm tra và phê duyệt Yêu cầu vật tư
Mục đích: Định tuyến chính xác luồng xử lý phiếu yêu cầu nhằm tối ưu hóa thời gian (phiếu an toàn được duyệt nhanh) và kiểm soát chặt chẽ rủi ro thất thoát tài sản (phiếu vượt định mức bắt buộc qua nhiều lớp rà soát).
1. Nguyên tắc phân luồng hệ thống
Luồng 1 - Phiếu "Trong định mức": Áp dụng quy trình duyệt phẳng rút gọn. Sau khi Kế toán kiểm tra tính hợp lệ về mặt hiện trường, nếu đồng ý thì hệ thống tự động chuyển trạng thái sang Approved (Đã đồng ý). Kế toán được phép tiến hành tạo Đơn đặt hàng (PO) ngay mà không cần trình Giám đốc phê duyệt.
Luồng 2 - Phiếu "Vượt định mức": Áp dụng quy trình kiểm soát nghiêm ngặt. Phiếu bắt buộc phải đi qua 02 lớp phê duyệt: Kế toán soát hồ sơ $\rightarrow$ Giám đốc ký duyệt cuối. Kế toán chỉ có quyền "Trình duyệt" chứ không có quyền tự thông qua phiếu vượt định mức.
2.3.1. Giai đoạn 1: Kế toán kiểm tra (Kiểm soát vòng sơ loại)
Người thực hiện: Kế toán.
Các bước thực hiện:
Tiếp nhận: Kế toán truy cập danh sách "Yêu cầu vật tư chờ soát", hệ thống hiển thị toàn bộ các phiếu có trạng thái Pending.
Rà soát chi tiết: Mở chi tiết từng phiếu để đối chiếu các thông tin:
Thông tin dự án, phase, chủng loại vật tư, số lượng xin cấp.
Nhãn phân luồng của hệ thống (Trong định mức hoặc Vượt định mức kèm số lượng lố).
Đoạn giải trình lý do của Leader dự án và các tài liệu liên kết đi kèm (Báo cáo sự cố/Incident Report, ảnh hiện trường nếu có).
Ghi nhận ý kiến: Kế toán bắt buộc/hoặc tùy chọn nhập vào trường Ghi chú kiểm tra (Ví dụ: "Đã đối chiếu tiến độ cấp phát thực tế, phát sinh do rework task của sự cố ngập móng, đề xuất duyệt").
Ra quyết định xử lý:
Trường hợp Từ chối (Áp dụng cho cả 2 luồng): Nếu phát hiện hồ sơ thiếu minh chứng, sai chủng loại, giải trình vô lý $\rightarrow$ Bấm nút "Từ chối". Hệ thống yêu cầu nhập lý do từ chối, chuyển trạng thái phiếu thành Rejected, tự động gửi thông báo cho Leader dự án và nhả lại ngay lập tức hạn mức BOQ đã tạm giữ.
Trường hợp Đồng ý đối với phiếu "Trong định mức": Bấm nút "Phê duyệt" $\rightarrow$ Phiếu chuyển thẳng sang trạng thái Approved. Hệ thống mở khóa tính năng "Tạo PO" cho phiếu này.
Trường hợp Đồng ý đối với phiếu "Vượt định mức": Bấm nút "Trình duyệt Giám đốc" $\rightarrow$ Phiếu chuyển sang trạng thái Waiting_Approval (Chờ Giám đốc duyệt). Hệ thống ghi nhận biên bản kiểm tra của Kế toán và gửi thông báo đẩy (Push Notification) đến tài khoản của Giám đốc.
2.3.2. Giai đoạn 2: Giám đốc phê duyệt (Quyết định tối cao cho phiếu Vượt định mức)
Người thực hiện: Giám đốc.
Các bước thực hiện:
Tiếp nhận: Giám đốc xem danh sách "Yêu cầu vượt định mức chờ duyệt" (Chỉ bao gồm các phiếu có trạng thái Waiting_Approval).
Thẩm định: Xem xét chi tiết phiếu bao gồm: Giải trình của Leader + Ý kiến/Ghi chú đối chiếu ngân sách của Kế toán gửi lên.
Ra quyết định cuối cùng:
Duyệt (Approve): Chuyển trạng thái phiếu sang Approved (Over_BOQ). Hệ thống ghi nhận định danh người duyệt, đóng dấu thời gian (Timestamp) thực tế. Phiếu quay trở lại màn hình của Kế toán để tiến hành tạo đơn đặt hàng (PO).
Từ chối (Reject): Chuyển trạng thái phiếu sang Rejected. Hệ thống bắt buộc Giám đốc nhập lý do từ chối, gửi thông báo hỏa tốc về cho Kế toán và Leader dự án, đồng thời giải phóng hoàn toàn số lượng quota vật tư đang bị tạm giữ.
2.3.3. Quy tắc xử lý ngoại lệ & Tình huống đặc biệt (Exceptions & Edge cases)
Tính toàn vẹn của dữ liệu Vượt định mức: Khi Giám đốc phê duyệt một phiếu lố BOQ, hệ thống tuyệt đối không làm sạch nhãn hay reset số lượng đối chiếu. Phiếu vẫn giữ nguyên nhãn Approved (Over_BOQ) và hiển thị cảnh báo đỏ nổi bật cùng con số vượt định mức trên mọi giao diện báo cáo, dashboard quản trị của Giám đốc/TPKT để phục vụ việc kiểm toán, tính toán hao hụt cuối kỳ.
Hiển thị trực quan cho Giám đốc: Trên giao diện duyệt của Giám đốc, hệ thống phải sử dụng màu sắc cảnh báo theo quy tắc: Phần khối lượng nằm trong BOQ hiển thị màu xanh/đen bình thường; riêng phần khối lượng lố vượt định mức bắt buộc phải highlight màu đỏ rực kèm theo tỉ lệ phần trăm lố (Ví dụ: "Vượt 20 bao - Lố 20% trần thiết kế Phase 1") để Giám đốc đập mắt vào là thấy ngay trọng tâm rủi ro.
Sửa đổi sai sót sau khi phê duyệt: Hệ thống áp dụng nguyên tắc Bất biến đối với dữ liệu đã duyệt. Nếu phiếu đã ở trạng thái Approved mà phát hiện sai sót (nhập nhầm số lượng, sai mã vật tư):
Trường hợp CHƯA tạo PO: Hệ thống cho phép Leader dự án tạo một Yêu cầu vật tư mới thay thế, đồng thời gửi yêu cầu hủy phiếu cũ. Kế toán/Giám đốc sẽ vào bấm "Hủy phiếu đã duyệt" để giải phóng quota, phiếu cũ chuyển trạng thái thành Cancelled.
Trường hợp ĐÃ tạo PO: Hệ thống khóa cứng hoàn toàn luồng Yêu cầu vật tư. Mọi sai sót lúc này không được sửa trên phiếu yêu cầu, bắt buộc phải xử lý bằng các nghiệp vụ thực tế ở giai đoạn sau bao gồm: Phiếu trả hàng cho NCC, hoặc Phiếu điều chỉnh giảm tồn kho (Kiểm kê thiếu) theo quy định tại mục 2.8.

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
2.5. Ghi nhận nhận hàng (Nhập kho ảo - Goods Receipt)
Người thực hiện: Leader dự án. Mục đích: Ghi nhận khối lượng vật tư thực tế được nhà cung cấp (NCC) bàn giao tại công trường, tự động đối chiếu với Đơn đặt hàng (PO) để cập nhật chính xác số lượng vào Kho ảo của từng công trình.
1. Các bước thực hiện (Basic Flow)
Chọn nguồn đối chiếu: Leader truy cập chức năng "Nhập kho", hệ thống hiển thị danh sách các Đơn đặt hàng có trạng thái Sent (Đã gửi NCC) hoặc Partially_Received (Đã nhận một phần) thuộc dự án đó. Leader chọn đúng mã PO cần nhập kho.
Khởi tạo Phiếu nhập (Goods Receipt - GR): Hệ thống tự động sinh một Phiếu nhập kho mới ở trạng thái Draft và load lên toàn bộ danh sách các mặt hàng (vật tư, số lượng đặt gốc) từ PO sang.
Nhập thông tin chứng từ thực tế: Leader nhập Tên người giao hàng, Số phiếu giao hàng của NCC (Delivery Doc No) và tải lên hình ảnh minh chứng (Chụp ảnh phiếu giao hàng bằng giấy hoặc chụp ảnh vật tư thực tế tại hiện trường - tối đa 3 ảnh).
Nhập số lượng thực nhận cho từng mặt hàng:
Đối với từng loại vật tư, hệ thống sẽ hiển thị: Số lượng đặt gốc (PO) | Số lượng đã nhập các đợt trước | Số lượng còn lại tối đa được phép nhập.
Leader tiến hành nhập Số lượng thực nhận của đợt giao hàng này.
Hệ thống kiểm tra điều kiện biên (Validation):
Số lượng còn lại tối đa = Số lượng đặt gốc - Tổng số lượng đã nhập ở các Phiếu nhập trước đó (Đã Approved).
Nếu Số lượng thực nhận đợt này > Số lượng còn lại tối đa $\rightarrow$ Hệ thống chặn cứng, báo lỗi và không cho phép lưu phiếu. (Quy định: NCC giao thừa không được tự ý nhận vào kho, bắt buộc phải làm PO bổ sung).
Xác nhận hoàn tất (Submit): Leader kiểm đếm xong, bấm nút "Hoàn tất nhập kho". Phiếu chuyển trạng thái thành Approved.
2. Logic cập nhật Tồn kho ảo & Trạng thái PO (Auto-Trigger)
Ngay khi Phiếu nhập kho được chuyển sang trạng thái Approved, hệ thống đồng thời kích hoạt 2 hành động ngầm:
Cập nhật Kho ảo dự án: Cộng (+) chính xác Số lượng thực nhận đợt này vào bảng CurrentInventory tương ứng với ProjectId và MaterialId. Ghi nhận lịch sử vào Báo cáo thẻ kho (InventoryLedger).
Dịch chuyển trạng thái Đơn đặt hàng (PO State Machine): Hệ thống tự động quét lại toàn bộ các mặt hàng trong PO:
Trường hợp 1: Nếu TẤT CẢ các mặt hàng đã được nhập đủ số lượng (Tổng số lượng thực nhận qua các đợt = Số lượng đặt gốc) $\rightarrow$ Tự động chuyển trạng thái PO sang Fully_Received (Đã nhận đủ).
Trường hợp 2: Nếu chỉ có một vài mặt hàng được nhập đủ, hoặc các mặt hàng mới chỉ nhập được một phần (Tổng số lượng thực nhận < Số lượng đặt gốc) $\rightarrow$ Tự động chuyển trạng thái PO sang Partially_Received (Đã nhận một phần) để đợt sau tiếp tục mở ra nhập kho tiếp.
3. Quy tắc ngoại lệ & Tình huống đặc biệt (Exceptions)
Nhận hàng khẩn cấp khi chưa có PO trên hệ thống: CHẶN CỨNG 100%. Hệ thống tuân thủ quy trình kiểm soát nghiêm ngặt để tránh thất thoát: hàng về đến cổng công trường mà hệ thống chưa có PO (do chưa tạo hoặc chưa được duyệt) thì tuyệt đối không cho phép tạo Phiếu nhập kho. Leader bắt buộc phải liên hệ Văn phòng giục Kế toán duyệt Yêu cầu và tạo PO trước, sau đó mới có dữ liệu để bấm Nhập kho lẻ.
Cảnh báo giao thiếu nhiều lần (Mục 2.10 bổ trợ): Nhằm kiểm soát năng lực giao hàng của NCC, nếu một PO bị xẻ lẻ và phải tạo đến Phiếu nhập kho thứ 3 (Goods Receipt count >= 3) mà trạng thái PO vẫn đang là Partially_Received (giao nhỏ giọt từng ít một), hệ thống sẽ tự động bật cảnh báo vàng trên màn hình Dashboard của Kế toán để Kế toán chủ động làm việc lại với NCC bên ngoài hệ thống.
Sửa đổi dữ liệu nhập kho: Tương tự luồng Yêu cầu vật tư, Phiếu nhập kho khi đã bấm "Hoàn tất" (Approved) sẽ bị khóa cứng, bất biến, không cho phép sửa số lượng hay xóa phiếu. Nếu phát hiện nhập nhầm (VD: thực tế nhận 5 bao nhưng gõ nhầm thành 50 bao), Leader không được sửa bậy mà phải báo Kế toán lập Phiếu điều chỉnh giảm tồn kho (Kiểm kê thiếu) có liên kết với Báo cáo sự cố nhập sai để trình Giám đốc phê duyệt hạ kho theo đúng quy định tại mục 2.8.






2.7. Quy trình xử lý vật tư thừa (Surplus Material Management)
Mục tiêu của quy trình là tập hợp các loại vật tư dư thừa sau khi hoàn thành công việc để phân bổ vào các luồng xử lý kinh tế, đảm bảo tài sản được kiểm soát chặt chẽ từ khi phát sinh đến khi hoàn tất.
2.7.1. Tập hợp và đề xuất xử lý (Batch Processing)
Khi kết thúc một giai đoạn thi công (Phase) hoặc toàn bộ dự án, Project Leader (PL) tiến hành gom nhóm các vật tư đang dư thừa tại kho ảo của công trình để đưa vào một Phiếu đề xuất xử lý.
Tạo phiếu: PL tạo phiếu, hệ thống tự động cho vật tư thừa tỏng khoa ro vào phiếu.
Trạng thái nháp: Phiếu ở trạng thái Draft, cho phép PL điều chỉnh số lượng hoặc thêm/bớt vật tư linh hoạt cho đến khi chốt danh sách.
Khóa tài sản: Khi PL gửi đi (Submit), hệ thống sẽ chuyển phiếu sang trạng thái Proccessing và đồng thời "đóng băng" số lượng vật tư này trong kho của dự án để đảm bảo không bị xuất dùng nhầm lẫn trong quá trình xử lý.
2.7.2. Phân tách mục đích và thực hiện (Action Assignment)
Tại mỗi loại vật tư trong phiếu, hệ thống yêu cầu xác định cụ thể cách thức giải quyết. Một vật tư có thể được chia nhỏ thành nhiều mục đích khác nhau để tối ưu hóa việc thu hồi:
Trả Nhà cung cấp: Dành cho vật tư còn mới, nguyên kiện và nhà cung cấp đồng ý thu hồi.
Chuyển công trình: Dành cho vật tư dư thừa tại dự án này nhưng lại đang là nhu cầu cấp thiết của dự án khác.
Thanh lý: Dành cho vật tư đã qua sử dụng, hư hỏng hoặc không còn giá trị sử dụng nội bộ.
Mỗi hành động này được hệ thống ghi nhận chi tiết, độc lập và chạy song song với nhau.
2.7.3. Phối hợp liên phòng ban
Đây là quy trình làm việc phẳng, nơi các bộ phận cùng truy cập vào phiếu để xử lý phần việc thuộc thẩm quyền:
Bộ phận Kế toán: Tiếp nhận các đầu việc liên quan đến tài chính là Trả NCC và Thanh lý. Kế toán trực tiếp làm việc với đối tác bên ngoài, cập nhật giá trị thu hồi (số tiền được hoàn lại hoặc tiền bán phế liệu) và xác nhận hoàn tất.
Bộ phận Kỹ thuật (TM): Tiếp nhận đầu việc Chuyển công trình được PL tạo phiếu nhé. TM sẽ kiểm tra sự hợp lý về mặt kỹ thuật giữa dự án gửi và dự án nhận. Nếu duyệt, TM xác nhận để quy trình điều chuyển nội bộ bắt đầu.
2.7.4. Quy trình điều chuyển nội bộ (Transfer Flow)
Đối với vật tư chuyển công trình, hệ thống yêu cầu sự phối hợp chặt chẽ giữa hai công trình để tránh thất thoát:
Duyệt: Sau khi TM đồng ý, phiếu chuyển sang trạng thái chờ thực hiện.
Xuất hàng: PL của dự án gửi xác nhận đã bốc hàng lên xe.
Nhận hàng: PL của dự án nhận kiểm đếm và xác nhận đã nhận đủ hàng.
Kết thúc: Hệ thống tự động trừ kho dự án gửi và cộng kho dự án nhận, hoàn tất giao dịch.
2.7.5. Hoàn tất và Đóng hồ sơ
Cập nhật tiến độ: Với mỗi mục đích (Trả, Chuyển, Thanh lý), hệ thống luôn theo dõi trạng thái riêng biệt của nó.
Đóng phiếu: Khi tất cả các mục đích xử lý cho toàn bộ vật tư trong phiếu đã được thực hiện xong, hệ thống tự động xác nhận phiếu đề xuất đã xử lý thành công.
Tính minh bạch: Mọi thay đổi từ lúc chọn vật tư, duyệt luồng xử lý cho đến khi xác nhận thu hồi tiền hay nhận hàng đều được lưu vết, giúp việc đối soát vật tư cuối kỳ không còn là gánh nặng.

2.8. Phiếu điều chỉnh tồn kho (Inventory Adjustment)
2.8.1. Nguyên tắc phân luồng
Luồng Tăng Tồn (Tự động - PL thực hiện): Áp dụng cho các trường hợp thu hồi vật tư dư thừa, thợ trả lại hoặc kiểm kê dư. Đây là gia tăng tài sản, được phép thực hiện nhanh chóng bởi Leader dự án .
Luồng Giảm Tồn (Kiểm soát - Kế toán thực hiện): Áp dụng khi vật tư mất mát, hư hỏng, thất thoát. Vì đây là thất thoát tài sản, chỉ Kế toán mới có quyền lập phiếu giảm tồn dựa trên Báo cáo sự cố đã xác minh.
2.8.2. Quy trình chi tiết
Loại phiếu
Tình huống
Khởi tạo
Duyệt
Cập nhật tồn kho
TĂNG TỒN
Thợ trả dư, kiểm kê thừa
Leader
Hệ thống, (Auto)
Ngay lập tức
GIẢM TỒN
Mất mát, hư hỏng, kiểm kê thiếu
Kế toán
Giám đốc
Sau khi Giám đốc duyệt


A. Luồng Tăng Tồn (Leader dự án)
Khởi tạo: Leader dự án tạo Phiếu tăng tồn, chọn vật tư, số lượng và nhập ghi chú nguồn gốc (VD: "Vật tư thu hồi từ Task A"), kế toán có teher xem được phiếu này.
Cập nhật: Hệ thống tự động cộng (+) số lượng vào kho ngay khi nhấn "Lưu".
B. Luồng Giảm Tồn (Kế toán)
Bước 1: Báo cáo sự cố: Leader phát hiện mất mát/hư hỏng phải tạo Báo cáo sự cố (Incident Report) kèm ảnh/biên bản minh chứng.
Bước 2: Khởi tạo phiếu giảm tồn: Kế toán kiểm tra Báo cáo sự cố và biên bản hiện trường. Nếu hợp lệ, Kế toán tạo Phiếu giảm tồn (liên kết với Báo cáo sự cố đó).
Bước 3: Phê duyệt (Giám đốc): Giám đốc xem xét nội dung sự cố, giá trị tổn thất và ký duyệt.
Bước 4: Cập nhật: Ngay khi Giám đốc phê duyệt, hệ thống tự động trừ (-) tồn kho và lưu giá trị hao hụt vào log tài chính dự án.
2.8.3. Kiểm soát chặt chẽ
Quyền hạn: Leader dự án hoàn toàn không có quyền tạo Phiếu giảm tồn. Nếu muốn xử lý hao hụt, Leader chỉ có nhiệm vụ tạo Báo cáo sự cố, mọi thao tác trừ kho phải thông qua Kế toán.
Tính liên kết: Phiếu giảm tồn bắt buộc phải gắn với một Báo cáo sự cố. Kế toán không thể tự ý tạo phiếu giảm tồn khống mà không có bằng chứng sự cố từ hiện trường.
Ngưỡng cảnh báo: Phiếu giảm tồn có số lượng > 20% tồn kho hiện tại sẽ kích hoạt cảnh báo đỏ, bắt buộc Giám đốc phải giải trình trước khi duyệt.
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
Leader dự án chọn loại phiếu "Mua ngoài khẩn cấp" (chỉ áp dụng vật tư trong BOQ) và bắt buộc tải ảnh hóa đơn. Hệ thống tự động (Auto) sinh PO và Phiếu nhập => Tồn kho ảo tăng ngay lập tức để thợ dùng. Kế toán chỉ xem lại các phiếu này để làm thủ tục hoàn tiền/giải ngân bên ngoài hệ thống. Nếu số lượng mua khẩn cấp làm vượt BOQ, hệ thống chặn cứng chức năng này. Bắt buộc Leader phải quay lại quy trình tạo Yêu cầu vật tư vượt định mức, có giải trình sự cố và chờ Giám đốc duyệt mới được phép mua. 
NCC giao hàng thiếu nhiều lần
Hệ thống cho phép nhận từng phần. PO chuyển sang trạng thái "Giao 1 phần". Sau 3 lần ghi nhận nhận hàng một phần trên cùng 1 PO, hệ thống tự động gửi cảnh báo cho Kế toán để làm việc lại với NCC.
Hàng giao sai chủng loại
Leader dự án từ chối nhận, không nhập kho trên hệ thống. Ghi chú vào PO. Kế toán liên hệ NCC đổi trả. Hệ thống không sinh thêm phiếu giao dịch nào.
Vật tư bị hư hỏng trước khi xuất dùng
(Ví dụ: Xi măng để trong kho bị ngập nước). Leader dự án tạo Phiếu điều chỉnh giảm tồn theo mục 2.8 (Trình Kế toán soát => Giám đốc duyệt trừ kho).
Kế toán tạo PO – ghi nhận NCC
Hệ thống không có module quản lý NCC riêng (Supplier Management). Khi tạo PO, Kế toán chỉ nhập tay tên NCC (dạng text). Không lưu thông tin chi tiết (địa chỉ, mã số thuế) để giảm tải Database.
Chuyển kho nhưng dự án đích không có định mức (BOQ) vật tư đó
Vẫn cho phép chuyển. Hệ thống tự động thêm vật tư đó vào kho ảo của dự án đích, với định mức (BOQ) = 0. Nghĩa là không được phép mua mới thêm, nhưng có thể nhận đồ chuyển về để xài tạm.
Trả lại NCC nhưng NCC chỉ nhận một phần
(Ví dụ: Dư 10 bao, NCC chỉ cho trả 6 bao). Leader dự án ghi nhận trả 6 bao trong phiếu Trả NCC. 4 bao còn lại sẽ nằm trong tồn kho, Leader phải làm 1 phiếu Xử lý thừa khác (Chuyển kho hoặc Thanh lý) để dọn sạch.
Kế toán quên kiểm tra phiếu vật tư
Hệ thống có job chạy ngầm (batch job) hàng ngày: Gửi email cảnh báo danh sách các phiếu Yêu cầu/Giảm tồn đã tạo quá 48h mà Kế toán chưa xử lý.



3. BÁO CÁO & DASHBOARD (HỖ TRỢ QUẢN LÝ)
Hệ thống cung cấp các báo cáo trực quan và chi tiết phục vụ Giám đốc, Trưởng phòng Kỹ thuật, Kế toán. Tất cả báo cáo đều có thể xuất ra Excel/PDF.
3.1. Dashboard tổng thể (dành cho Giám đốc & TPKT): Cung cấp biểu đồ trực quan về sức khỏe các dự án (số dự án đúng hạn/trễ hạn, tỷ lệ vượt định mức vật tư, cảnh báo tồn kho đỏ).
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









