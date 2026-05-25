BẢN MÔ TẢ NGHIỆP VỤ CỰC KỲ CHI TIẾT
Dành cho: SEP490_G38 – BPG Construction Management System (MVP)
Mục tiêu: 2 module core – Quản lý thi công (tiến độ) & Kiểm soát vật tư (chống thất thoát)
Nguyên tắc: Không chat, không ticket, không khách hàng, không bảo hành. Tập trung vào nội bộ doanh nghiệp.
PHÂN QUYỀN CHI TIẾT
Vai trò
Quyền trên Dự án & Task
Quyền trên Vật tư
Trưởng phòng Kỹ thuật (TPKT)
- Tạo, sửa, xóa dự án (khi ở trạng thái draft).
- Upload các design hay các tiêu chí liên quan đến các phase của dự án cho nhân viên clean về sản phẩm cuối còn thi công
- Kích hoạt dự án (draft → active).
- Tạm dừng / tiếp tục dự án (active ↔ paused).
- Lập, sửa WBS (thêm/sửa phase, task) trước khi có cập nhật tiến độ.
- Phân công, điều chỉnh deadline task (có ghi log lý do).
- Điều chỉnh giảm % hoàn thành task (khi có sự cố) – chỉ TPKT mới có quyền này, kèm báo cáo sự cố và quyết định điều chỉnh tiến độ.
- Nghiệm thu phase (khi tất cả task đạt 100%, có ảnh minh chứng).
- Hủy nghiệm thu (trong vòng 7 ngày, phải có lý do).
- Đánh dấu task obsolete (bỏ qua).
- Xem tất cả dự án, dashboard, báo cáo tiến độ.
- Khai báo, sửa bảng định mức vật tư cho dự án (trước khi có yêu cầu).
- Xem tất cả yêu cầu vật tư, PO, tồn kho, báo cáo.
- Tạo phiếu đề xuất xử lý vật tư thừa (trả NCC / chuyển kho) – cần qua Kế toán và Giám đốc.
- Không có quyền duyệt yêu cầu vượt định mức (chỉ Giám đốc).
- Không có quyền tạo PO (chỉ Kế toán).
Nhân viên phòng kỹ thuật
- Xem danh sách task được phân công.
- Cập nhật % hoàn thành task (chỉ tăng, không giảm) kèm ảnh và mô tả (tạo nhật ký hàng ngày).
- Xem dashboard dự án (tiến độ của mình).
- Được tag trong comment dưới nhật ký.
- Tạo yêu cầu vật tư (chọn vật tư, số lượng, lý do).
- Xem yêu cầu của mình và trạng thái.
- Ghi nhận nhận hàng (chọn PO, nhập số lượng thực nhận, upload ảnh phiếu giao hàng).
- Ghi nhận xuất dùng (chọn vật tư, số lượng, mục đích, có thể chọn task liên quan).
- Xem tồn kho công trình.
- Tạo phiếu đề xuất xử lý vật tư thừa (trả NCC / chuyển kho) – cần qua Kế toán và Giám đốc.
- Xác nhận đã giao hàng (khi chuyển kho) và xác nhận đã nhận hàng (khi nhận chuyển kho từ công trình khác).
- Không có quyền tự ý giảm % task, không duyệt yêu cầu, không tạo PO.
Giám đốc
- Xem tất cả dự án, dashboard tổng thể (cảnh báo trễ đỏ/vàng).
- Xem nhật ký công trường, bình luận (nếu cần).
- Xem báo cáo AI tóm tắt nhật ký.
- Duyệt tất cả các yêu cầu vật tư (sau khi Kế toán trình) – đặc biệt chú ý các yêu cầu vượt định mức (hiển thị cảnh báo đỏ).
- Duyệt phiếu xử lý vật tư thừa (trả NCC / chuyển kho).
- Duyệt phiếu điều chỉnh giảm tồn (hao hụt, mất mát, kiểm kê thiếu).
- Xem báo cáo tồn kho, nhập/xuất, lãi lỗ tham khảo.
Kế toán
- Chỉ xem tên dự án và các thông tin cần thiết để phục vụ công việc (ví dụ: để biết PO thuộc dự án nào).
- Kiểm tra tất cả các yêu cầu vật tư (bất kể vượt hay không) trước khi trình Giám đốc.
- Tạo PO từ các yêu cầu đã được Giám đốc duyệt (có thể gộp nhiều yêu cầu).
- Nhập tay tên NCC (text tự do), số lượng, đơn giá, thành tiền.
- Sửa PO (chỉ khi chưa có nhận hàng) hoặc hủy PO.
- Xem báo cáo nhập/xuất/tồn, báo cáo chi phí (tham khảo).
- Không có quyền tạo phiếu xử lý vật tư thừa (chỉ kỹ sư, TPKT tạo).
- Không có quyền duyệt yêu cầu (chỉ trình).
Admin
- Quản lý người dùng (thêm, sửa, xóa, gán role).
- Xem log hành động toàn hệ thống.
- Cấu hình tham số: ngưỡng cảnh báo tồn kho thấp (ngày), % trễ kỳ vọng, thời gian hết hạn phiếu (ngày).
- Như bên cạnh (không can thiệp sâu vào nghiệp vụ vật tư, chỉ quản trị hệ thống).


0. CÁC THỰC THỂ CHÍNH VÀ VÒNG ĐỜI

Thực thể
Vòng đời (các bước diễn ra theo thời gian)
Dự án
Tạo mới (bản nháp) → Kích hoạt (bắt đầu thi công) → Đang thi công → Tạm dừng (nếu có lý do) → Hoàn thành (đã xong) → Đóng (kết thúc, lưu trữ)
Task (công việc chi tiết)
Tạo mới (thuộc kế hoạch WBS) → Đã phân công (giao cho kỹ sư) → Đang thực hiện (đã có tiến độ) → Hoàn thành (đạt 100%) → Đã nghiệm thu (được xác nhận đạt chất lượng)
Nhật ký công trường
Mỗi ngày, kỹ sư tạo một bản ghi mới cho từng task. Không có vòng đời, chỉ thêm mới.
Yêu cầu vật tư
Tạo yêu cầu (gửi lên) → Kế toán kiểm tra → Trình giám đốc duyệt → Đã duyệt (hoặc bị từ chối) → Đã tạo đơn đặt hàng (PO) → Đã nhận hàng (một phần hoặc toàn bộ)
Đơn đặt hàng (PO)
Tạo đơn (nhập thông tin) → Đã gửi cho nhà cung cấp (hệ thống lưu lại) → Đã giao một phần → Đã giao đủ → Đóng (hoàn tất). Lưu ý: việc thanh toán, gửi hàng thực tế do kế toán tự làm bên ngoài, hệ thống chỉ lưu để đối chiếu và tính lãi lỗ.
Kho ảo công trình
Nhập kho (theo đơn đặt hàng, tăng tồn) → Xuất kho (khi dùng cho thi công, giảm tồn) → Điều chỉnh giảm (do trả nhà cung cấp, chuyển sang công trình khác, hao hụt, mất mát). Không có vòng đời, chỉ thay đổi số lượng tồn.
Phiếu xử lý vật tư thừa
Tạo phiếu (đề xuất xử lý số thừa) → Kế toán kiểm tra → Trình giám đốc duyệt → Đã duyệt (cho phép xử lý) → Đã thực hiện (trả NCC hoặc chuyển kho thành công) → Đóng
Các nghiệp vụ phát sinh (hao hụt, mất mát, kiểm kê) 
Phát hiện chênh lệch → Tạo phiếu điều chỉnh giảm tồn → Kế toán kiểm tra → Giám đốc duyệt → Cập nhật kho (giảm tồn) → Hoàn thành. Không phải thực thể riêng, chỉ là một quy trình xử lý. 


1. QUẢN LÝ DỰ ÁN & THI CÔNG 
1.1. Tạo dự án mới
Người thực hiện: Trưởng phòng Kỹ thuật (TPKT) 
Các bước:
Nhập tên dự án, địa chỉ, ngày bắt đầu dự kiến, ngày kết thúc dự kiến (baseline), upload bản thiết kế có thể tổng thể
theo từng phase hoặc từng task tùy độ chi tiết của thiết kế để nhân viên đc assign biết nên lấy số lượng và loại vật tư như nào.
Chọn loại dự án (để phân loại, không ảnh hưởng đến WBS): xây mới, cải tạo, sửa chữa, nội thất, combo (xây dựng + nội thất).
Lưu ý: WBS không có template mặc định. TPKT sẽ tự tạo các phase và task phù hợp với đặc thù từng dự án.
Lưu dự án ở trạng thái draft.
Sau khi hoàn thành WBS (xem mục 1.2), TPKT bấm "Kích hoạt" → dự án chuyển sang active.
Exception / Edge cases:
Nếu dự án ở active mà muốn thay đổi loại dự án → không cho phép. Chỉ được sửa khi còn draft.
Khi kích hoạt, hệ thống kiểm tra: WBS có ít nhất 1 task, deadline của các task phải >= ngày bắt đầu dự án.
1.2. Lập kế hoạch chi tiết (WBS) và phân công task
Người thực hiện: TPKT 
Chi tiết:
Tạo phase : tên phase, thứ tự phase ngày bắt đầu, ngày kết thúc, status
Mỗi task có: tên, mô tả, ngày bắt đầu dự kiến, ngày kết thúc dự kiến, người phụ trách (chọn từ danh sách nhân viên kỹ thuật).
Task có thể có task con.
Ràng buộc:
Deadline của task con không được vượt quá deadline của task cha.
Không được giao task cho người không có role "Nhân viên kỹ thuật".
Exception:
Nếu task đã có tiến độ cập nhật (>0%) thì không thể xóa, chỉ có thể đánh dấu hủy (cancel) hoặc điều chỉnh deadline có lý do.
Điều chỉnh deadline task đang in progress cần ghi chú lý do và lưu vào log.
1.3. Cập nhật nhật ký công trường hàng ngày 
Người thực hiện: Nhân viên kỹ thuật (được phân công task).
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
Hành động này được ghi log và thông báo cho Giám đốc. Nếu nguyên nhân do lỗi chủ quan. Sau khi TPKT điều chỉnh giảm % task, kỹ thuật phải lập phiếu giảm tồn cho vật tư đã mất (mục 2.8.1) trước khi được tạo yêu cầu vật tư bổ sung.
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
TPKT kiểm tra ảnh đó và lên thẳng công trình nghiệm thu thực tế.,
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

1.7. Tổng hợp báo cáo nhật ký bằng AI
Mục đích: Giúp Giám đốc, TPKT không phải đọc hàng trăm dòng nhật ký mỗi ngày. AI đọc và tóm tắt thành báo cáo ngắn gọn, nêu bật tiến độ, rủi ro, vật tư thiếu.
Cách hoạt động:
Trên dashboard của Giám đốc/TPKT, có nút "Tạo báo cáo tuần bằng AI" (hoặc báo cáo theo khoảng thời gian tùy chọn).
Hệ thống thu thập tất cả các dòng nhật ký (mô tả) của dự án trong khoảng thời gian đó (ví dụ 7 ngày qua).
Gửi dữ liệu đến API của Gemini Flash hoặc GPT-4o mini (giá rẻ) với prompt:
*"Hãy tóm tắt tiến độ thi công tuần qua dựa trên các nhật ký sau. Liệt kê các rủi ro chính, vật tư thiếu hụt, và đánh giá tổng thể (tốt/trung bình/chậm). Trả về dạng văn bản ngắn gọn, tối đa 10 dòng."*
AI trả về báo cáo, hiển thị ngay trên màn hình, có thể xuất PDF hoặc copy.
2. KIỂM SOÁT VẬT TƯ 
2.1. Khai báo bảng định mức vật tư cho dự án
Người thực hiện: TPKT (ngay sau khi dự án được kích hoạt, trước khi có yêu cầu vật tư).
Chi tiết:
TPKT có thể thêm bớt, custom theo đúng chuẩn tính chất công trình hiện tại vs các đồ trong báo giá đã thống nhất vs khách hàng. Với mỗi vật tư, nhập số lượng định mức tối đa (theo đơn vị tính: tấn, m3, cái, bộ...). Đây là ngưỡng không được vượt quá trong suốt dự án nếu.
Nhập định mức chi tiết theo phase
Ràng buộc:
Định mức chỉ được nhập/sửa khi dự án ở trạng thái active và chưa có yêu cầu vật tư nào. Nếu đã có yêu cầu muốn sửa định mức phải có lý do và được Giám đốc duyệt (vì sẽ ảnh hưởng đến kiểm soát).
Không thể xóa một vật tư đã có yêu cầu, chỉ có thể đánh dấu ngừng sử dụng.
2.2. Tạo yêu cầu vật tư 
Người thực hiện: Nhân viên kỹ thuật (Kỹ sư hiện trường).
Các bước:
Chọn dự án, chọn phase, chọn vật tư từ danh mục (chỉ hiển thị những vật tư có trong bảng định mức của dự án đó).
Nhập số lượng yêu cầu, đơn vị tính (tự động lấy từ danh mục).
Nhập lý do yêu cầu (ví dụ: "thi công móng, hết xi măng").
Hệ thống tự động tính tổng số lượng đã sử dụng (đã xuất kho) + số lượng đang yêu cầu.
So sánh với định mức gốc:
Nếu tổng <= định mức → yêu cầu được gắn nhãn “trong định mức”
Nếu tổng > định mức → yêu cầu được gắn nhãn “vượt mức”, kèm cảnh báo đỏ, hiển thị số vượt.
Kỹ sư nhập giải trình vào yêu cầu vật tư (bắt buộc nếu vượt định mức)
Exception:
Chỉ tính tổng để so định mức của các yêu cầu đã đồng ý và tạo PO; yêu cầu submitted chưa tính vì chưa chắc được duyệt. 
Kỹ sư có thể hủy yêu cầu khi nó còn ở trạng thái chưa qua kế toán. Nếu đã qua kế toán hoặc đã duyệt thì không hủy được (chỉ có thể tạo phiếu xử lý thừa sau).

2.3. Xử lý yêu cầu vượt định mức (Giám đốc duyệt)
Nguyên tắc: Chỉ những yêu cầu vượt định mức mới phải qua Kế toán kiểm tra và Giám đốc phê duyệt trước khi tạo PO, còn những yêu cầu dưới định mức sau khi kế toán xem xét thấy hợp lí thì tạo PO luôn đc.
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
Người thực hiện: Nhân viên kỹ thuật (người yêu cầu vật tư)
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
Người thực hiện: Nhân viên kỹ thuật
Các bước:
Chọn dự án, chọn vật tư từ danh sách (chỉ hiển thị những vật tư đang có tồn > 0).
Nhập số lượng xuất, chọn task liên quan (nếu có, không bắt buộc).
Nhập mục đích (ví dụ: "đổ móng ngày 20/5").
Hệ thống kiểm tra nếu số lượng xuất > tồn kho hiện tại → báo lỗi, không cho xuất (vì không thể xuất âm). Tuy nhiên có thể xuất một phần, phần còn lại để lần sau.
Lưu, hệ thống trừ tồn kho.
Exception:
Xuất dùng nhưng sau đó phát hiện bị hư hỏng, mất mát: không có cơ chế hoàn nhập trực tiếp. Thay vào đó, tạo phiếu "điều chỉnh giảm tồn" (kiểu kiểm kê) với lý do hư hỏng, cần Giám đốc duyệt (xem mục 2.8.3).
Nếu xuất cho task nhưng task đó sau bị hủy (obsolete), vật tư đã dùng không thể hoàn lại. Nhưng có thể tạo phiếu nhập lại nếu vật tư chưa dùng và còn nguyên (rất hiếm, có thể xử lý thủ công bằng phiếu điều chỉnh tăng tồn).
2.7. Xử lý vật tư thừa cuối dự án (hoặc giữa chừng) – ĐÃ THÊM BƯỚC KẾ TOÁN
Vấn đề thực tế: Mua 10 bao xi măng, dùng hết 9 bao, còn 1 bao thừa.
Các lựa chọn:
Trả lại NCC để lấy lại tiền 
Chuyển sang công trình khác (dùng tiếp cho dự án khác).
Hệ thống hỗ trợ cả hai, nhưng có kiểm soát chặt chẽ qua Kế toán.

2.7.1. Tạo phiếu đề xuất xử lý vật tư thừa
Người thực hiện: Leader dự án.
Các bước:
Chọn dự án, chọn vật tư (chỉ hiển thị vật tư có tồn kho > 0).
Nhập số lượng thừa muốn xử lý (≤ tồn kho hiện tại).
Chọn loại xử lý:
Trả lại NCC
Chuyển sang công trình khác
Nếu chọn chuyển sang công trình khác :
Chuyển sang Trưởng phòng kỹ thuật
Chọn dự án đích (phải khác dự án hiện tại, đang ở trạng thái active).
Nhập lý do (bắt buộc).
Lưu phiếu ở trạng thái submitted (đã gửi, chờ Kế toán kiểm tra).
Ràng buộc: Một phiếu chỉ xử lý một loại vật tư.
2.7.2. Kế toán kiểm tra phiếu xử lý vật tư thừa
Người thực hiện: Kế toán.
Các bước:
Kế toán xem danh sách phiếu đã yêu cầu.
Mở chi tiết: dự án, vật tư, số lượng, loại xử lý, dự án đích (nếu có), lý do.
Kiểm tra tính hợp lệ:
Với loại trả lại NCC: có thể điện thoại hỏi NCC trước xem họ có nhận lại không? (thực tế). Hoặc đối chiếu với hợp đồng NCC.
Với loại chuyển sang công trình khác: kiểm tra xem dự án đích có thực sự cần không, tránh chuyển lãng phí.
Kế toán có thể thêm ghi chú (ví dụ: "đã hỏi NCC A, họ đồng ý nhận lại 50 bao, giá hoàn trả 80%").
Nếu OK → bấm "Trình duyệt" → phiếu chuyển sang chờ Giám đốc duyệt, gửi thông báo cho Giám đốc.
Nếu không OK → bấm "Từ chối" → phiếu chuyển từ chối, kèm lý do (bắt buộc). Kỹ sư nhận thông báo, có thể hủy hoặc sửa lại phiếu.
2.7.3. Xác nhận thực tế & cập nhật tồn kho + tài chính
Trường hợp trả lại NCC:
Người thực hiện: Kế toán 
Các bước:
Sau khi trả hàng thực tế và nhận được tiền hoàn lại, kế toán vào phiếu đồng ý.
Bấm "Xác nhận đã trả NCC".
Hệ thống hiển thị form nhập:
Số tiền thực hoàn lại (hoặc tự động tính = số lượng trả * đơn giá gốc * tỷ lệ % đã nhập ở bước 2.7.2 – có thể sửa).
Hệ thống tự động:
Giảm tồn kho dự án hiện tại.
Ghi nhận giảm chi phí (thu hồi) cho dự án, lưu vào bảng chi phí điều chỉnh để sau tính lãi lỗ.
Phiếu → Hoàn thành.
Trường hợp chuyển sang công trình khác:
Yêu cầu: Hai xác nhận (bên giao, bên nhận).
Các bước:
Kỹ sư bên giao bấm "Xác nhận đã xuất hàng" – chưa cập nhật tồn kho.
Kỹ sư bên nhận bấm "Xác nhận đã nhận hàng" – kiểm tra nếu đã có xác nhận của bên giao, hệ thống:
Giảm tồn kho dự án nguồn.
Tăng tồn kho dự án đích.
Ghi nhận chuyển chi phí (giảm chi phí dự án nguồn, tăng chi phí dự án đích) dựa trên đơn giá gốc từ PO.
Phiếu → Hoàn thành.
2.7.5. Edge cases & exception
Tình huống
Xử lý
NCC không nhận lại hàng (đã có phiếu duyệt)
Kế toán không thể xác nhận trả. Phải hủy phiếu (nếu chưa xác nhận). Nếu đã xác nhận rồi thì phải tạo phiếu điều chỉnh tăng tồn + tăng chi phí (gỡ lại).
Số tiền hoàn lại thực tế khác với dự kiến
Kế toán nhập số thực tế khi xác nhận. Hệ thống ghi nhận chênh lệch.
Chuyển kho nhưng bên nhận không xác nhận sau 7 ngày
Hệ thống cảnh báo. Giám đốc có thể hủy phiếu (không thay đổi tồn kho) hoặc yêu cầu điều tra.
Hàng hư hỏng trên đường chuyển
Bên nhận từ chối xác nhận. Hủy phiếu, bên giao tạo phiếu điều chỉnh giảm tồn + ghi nhận hao hụt (giảm chi phí? Không, hao hụt vẫn là chi phí của dự án nguồn).
Chuyển kho nhưng dự án đích không có định mức vật tư đó
Vẫn cho phép chuyển. Hệ thống tự động thêm vật tư vào danh mục của dự án đích (với định mức bằng 0, để cảnh báo sau).



2.8. Điều chỉnh tồn kho đặc biệt (hao hụt, mất mát, kiểm kê)
2.8.1. Nguyên tắc chung
Chỉ được giảm tồn kho qua phiếu điều chỉnh (không tự nhiên tăng tồn nếu không có PO hoặc chuyển kho).
Mọi phiếu điều chỉnh giảm tồn đều phải có lý do rõ ràng, chứng từ kèm theo và được Giám đốc duyệt.
Sau duyệt, hệ thống tự động giảm tồn kho, ghi nhận vào bảng inventory_adjustments (lưu lý do, số lượng, giá trị hao hụt dựa trên đơn giá gốc từ PO gần nhất theo nguyên tắc FIFO hoặc bình quân).	
Không được phép tự ý tăng tồn kho bằng phiếu điều chỉnh. Mọi trường hợp tăng tồn chỉ qua nhập kho từ PO hoặc chuyển kho từ dự án khác.
2.8.2. Các trường hợp cần điều chỉnh giảm tồn
Tình huống
Mô tả
Ai đề xuất
Ai duyệt
Điều kiện tiên quyết / Ghi chú
Hao hụt tự nhiên
Xi măng bị ẩm mốc, cát đá bị rơi vãi, hao hụt trong bảo quản
Kỹ sư hiện trường (kèm ảnh minh chứng)
Giám đốc
Có biên bản kiểm kê đính kèm (upload file).
Mất mát (trộm, thất lạc)
Bị mất trộm, thất lạc trong quá trình thi công
Kỹ sư hiện trường + báo công an (nếu cần)
Giám đốc
Có biên bản xác nhận mất mát. Hệ thống không theo dõi bồi thường cá nhân.
Hư hỏng do thi công sai (phá đi làm lại)
Đổ bê tông sai, phải phá bỏ, vật tư bỏ đi
Kỹ sư hiện trường (kèm báo cáo sự cố)
TPKT duyệt điều chỉnh tiến độ → Giám đốc duyệt giảm tồn
Bắt buộc có báo cáo sự cố và quyết định điều chỉnh tiến độ (lùi deadline, thêm task phụ). Phiếu giảm tồn phải liên kết với các quyết định đó.
Kiểm kê cuối kỳ phát hiện thiếu
So sánh tồn lý thuyết với thực tế thấy thiếu
Kế toán (hoặc người kiểm kê)
Giám đốc
Có biên bản kiểm kê và đối chiếu sổ sách.
Sai sót quy trình (quên nhập kho)
Nhận hàng nhưng quên ghi nhận nhập kho, dẫn đến thiếu hụt tồn ảo
Kế toán (phát hiện qua đối chiếu)
Giám đốc
Không xử lý bằng phiếu giảm tồn. Phải tạo lại quy trình nhập kho từ PO (hoặc nhập bổ sung).

2.8.3. Quy trình thực hiện (cho các trường hợp hao hụt, mất mát, hư hỏng, kiểm kê)
Bước 0 – (Chỉ áp dụng cho trường hợp hư hỏng do thi công sai):
Nhân viên kỹ thuật tạo báo cáo sự cố (gắn với task, mô tả nguyên nhân, kèm ảnh).
TPKT xem báo cáo, ra quyết định điều chỉnh tiến độ (lùi deadline, thêm task phụ, v.v.). Hệ thống lưu quyết định này.
Chỉ sau khi có quyết định điều chỉnh tiến độ mới được phép tạo phiếu giảm tồn.
Bước 1 – Tạo phiếu đề xuất điều chỉnh giảm tồn:
Ai được tạo:
Kỹ sư hiện trường: hao hụt tự nhiên, mất mát, hư hỏng do thi công sai.
Kế toán: kiểm kê cuối kỳ phát hiện thiếu.
Thao tác:
Chọn dự án, vật tư (tồn kho > 0), nhập số lượng hao hụt.
Chọn loại lý do từ danh sách.
Nếu chọn lý do "hư hỏng do thi công sai" → hệ thống bắt buộc nhập ID báo cáo sự cố và ID quyết định điều chỉnh tiến độ (nếu chưa có, chặn không cho tạo).
Nhập mô tả chi tiết (bắt buộc), upload ảnh hoặc file minh chứng (nếu có).
Lưu phiếu ở trạng thái submitted (chờ Kế toán kiểm tra).
Bước 2 – Kế toán kiểm tra (bắt buộc):
Kế toán xem danh sách phiếu chờ.
Kiểm tra tính hợp lệ (lý do, chứng từ, ảnh).
Xác định đơn giá hao hụt 
Thêm ghi chú nếu cần.
Bấm "Trình duyệt" → phiếu chuyển gửi Giám đốc
Hoặc "Từ chối" → kèm lý do (bắt buộc).
Bước 3 – Giám đốc duyệt:
Giám đốc xem chi tiết phiếu (bao gồm ghi chú của Kế toán, chứng từ liên quan).
Quyết định: Duyệt or Từ chối  (có lý do).
Bước 4 – Hệ thống cập nhật tồn kho:
Ngay sau khi phiếu được đồng ý, hệ thống tự động:
Giảm tồn kho tương ứng.
Ghi nhận giá trị hao hụt vào bảng điều chỉnh kho (tham khảo cho báo cáo lãi lỗ, không tự động tạo bút toán kế toán).
Phiếu chuyển sang hoàn thành.
Bước 5 – Xử lý phiếu hết hạn (tự động):
Phiếu quá 7 ngày không được Kế toán kiểm tra → hệ thống gửi nhắc nhở Kế toán và TPKT.
2.8.4. Cấm điều chỉnh tăng tồn
Không có phiếu điều chỉnh tăng tồn. Mọi trường hợp cần tăng tồn (nhập thiếu, quên nhập) phải thực hiện lại quy trình nhập kho từ PO hoặc tạo PO bổ sung.
Ngoại lệ: Khi kiểm kê phát hiện thừa so với lý thuyết, không được tự ý tăng tồn. Phải điều tra nguyên nhân (nhập dư, xuất thiếu). Nếu không thể điều chỉnh bằng quy trình chuẩn, Giám đốc có thể cho phép tạo phiếu điều chỉnh tăng tồn đặc biệt, nhưng tính năng này nằm ngoài MVP (có thể phát triển sau nếu cần).
2.8.5. Edge cases & xử lý
Tình huống
Xử lý
Kỹ sư tạo phiếu hao hụt nhưng không có ảnh minh chứng
Hệ thống cảnh báo "thiếu ảnh" nhưng vẫn cho phép tạo. Khi trình duyệt, Kế toán/Giám đốc có thể từ chối nếu thấy không thuyết phục.
Giám đốc từ chối
 Kỹ sư nhận thông báo, có thể tạo phiếu mới với bằng chứng đầy đủ hơn.
Phiếu đã đồng ý và cập nhật tồn kho, sau đó phát hiện sai sót (sai số, sai lý do)
Không sửa trực tiếp. Phải tạo phiếu điều chỉnh ngược lại (tăng tồn) với lý do "Điều chỉnh do sai sót" – phiếu này cũng phải qua Kế toán và Giám đốc duyệt. MVP có thể bỏ qua hoặc để xử lý thủ công ngoài hệ thống.
Hao hụt xảy ra liên tục ở cùng một dự án
Hệ thống không tự động chặn, nhưng báo cáo sẽ hiển thị để Giám đốc có biện pháp quản lý (cảnh báo, kiểm tra, kỷ luật).
Hư hỏng do thi công sai: TPKT duyệt điều chỉnh tiến độ nhưng Giám đốc từ chối giảm tồn
Task vẫn được điều chỉnh (vì cần thời gian làm lại), nhưng tồn kho không giảm → sẽ có sai lệch. Để tránh, quy trình nên yêu cầu Giám đốc duyệt cả hai cùng lúc. Trong MVP, nếu xảy ra, Kế toán phát hiện qua báo cáo đối chiếu và xử lý thủ công (tạo phiếu giảm tồn lại sau).
Nhiều PO cho cùng một vật tư, hệ thống lấy đơn giá nào?
Mặc định lấy đơn giá của PO gần nhất với thời điểm tạo phiếu (FIFO). Kế toán có thể ghi đè (nhập tay) nhưng phải có ghi chú lý do.
Kỹ sư tạo phiếu hao hụt với số lượng > 20% tồn kho hiện tại
Hệ thống cảnh báo "Số lượng hao hụt lớn bất thường, vui lòng kiểm tra lại" nhưng vẫn cho phép tạo. Khi trình duyệt, Kế toán/Giám đốc đặc biệt chú ý.


2.9. Kiểm kê cuối kỳ (tùy chọn, nâng cao)
Không bắt buộc trong MVP
Thay vào đó, hệ thống cung cấp báo cáo xuất Excel danh sách tồn kho lý thuyết (theo công trình). Kế toán in ra, mang ra kiểm kê thực tế, tự tính chênh lệch và tạo phiếu điều chỉnh thủ công (theo mục 2.8).
Nếu sau khi hoàn thành core còn thời gian, có thể thêm màn hình kiểm kê đơn giản (nhập số thực tế → hệ thống tự tính chênh lệch → đề xuất tạo phiếu điều chỉnh).
2.10. Các edge cases & exception khác 

Tình huống
Xử lý
Yêu cầu vật tư khẩn cấp
Thêm checkbox "khẩn cấp". Yêu cầu vẫn phải qua quy trình (kế toán → giám đốc), nhưng được ưu tiên hiển thị đầu danh sách và thông báo riêng (email có tag urgent). Không có duyệt đặc biệt.
NCC giao hàng thiếu nhiều lần
Hệ thống cho phép nhận từng phần. PO chuyển sang trạng thái giao 1 phần. Sau 3 lần nhận một phần, tự động gửi email cảnh báo cho Kế toán.
Hàng giao sai chủng loại
Kỹ sư từ chối nhận, không nhập kho. Ghi chú vào PO. Kế toán liên hệ NCC đổi trả. Hệ thống không xử lý thêm.
Vật tư bị hư hỏng trước khi xuất dùng
Tạo phiếu điều chỉnh giảm tồn theo mục 2.8.
Kế toán tạo PO – ghi nhận NCC
Hệ thống không có module quản lý NCC riêng. Khi tạo PO, Kế toán nhập tay tên NCC (dạng text, không bắt buộc chọn từ danh sách). Không lưu thông tin chi tiết (địa chỉ, số điện thoại, mã số thuế…).
Một vật tư có nhiều đơn vị tính (xi măng: bao, tấn)
Trong danh mục vật tư, khai báo đơn vị cơ bản (kg). Hệ thống lưu tồn kho theo đơn vị cơ bản. Khi nhập số lượng, người dùng chọn đơn vị (bao, tấn), hệ thống tự quy đổi.
Chuyển kho (xử lý thừa) nhưng dự án đích không có định mức vật tư đó
Vẫn cho phép chuyển. Hệ thống tự động thêm vật tư đó vào danh mục của dự án đích, với định mức = 0 (nghĩa là không được phép mua mới, nhưng có thể nhận chuyển về). Nếu dự án đích cần mua thêm sau này, phải cập nhật định mức thủ công.
Trả lại NCC nhưng NCC chỉ nhận một phần
Kỹ sư tạo phiếu xử lý thừa với số lượng thực tế NCC nhận. Phần còn lại có thể xử lý bằng phiếu khác (chuyển kho, hao hụt, hoặc bỏ).
Kế toán quên kiểm tra phiếu vật tư
Hệ thống gửi email hàng ngày (batch job) danh sách các phiếu submitted quá 2 ngày chưa xử lý.



3. BÁO CÁO & DASHBOARD (HỖ TRỢ QUẢN LÝ)
Hệ thống cung cấp các báo cáo trực quan và chi tiết phục vụ Giám đốc, Trưởng phòng Kỹ thuật, Kế toán. Tất cả báo cáo đều có thể xuất ra Excel/PDF.
3.1. Dashboard tổng thể (dành cho Giám đốc)
3.2. Báo cáo tiến độ dự án (dạng Gantt & bảng)ư
3.3. Báo cáo nhật ký công trường (theo task, theo ngày)
3.4. Báo cáo tồn kho vật tư theo công trình
3.5. Báo cáo lịch sử nhập/xuất vật tư (theo thời gian)
3.6. Báo cáo chi phí vật tư và lãi lỗ tham khảo
3.7. Báo cáo yêu cầu vật tư chờ duyệt / đã duyệt
3.8. Báo cáo phiếu xử lý vật tư thừa (đã xử lý, chờ xử lý)
3.9. Báo cáo phiếu điều chỉnh giảm tồn (hao hụt, mất mát)
3.10. Xuất toàn bộ báo cáo ra Excel/PDF

4. QUẢN TRỊ HỆ THỐNG (ADMIN)
4.1. Quản lý người dùng (User Management)
4.2. Phân quyền (Role  )
4.3. Xem log hành động (Audit Log)
4.4. Cấu hình hệ thống (System Configuration)
4.5. Quản lý danh mục vật tư (Material Catalog)
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


