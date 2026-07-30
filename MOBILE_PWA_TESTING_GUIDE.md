# Hướng dẫn test BPG-CMS trên điện thoại thật (PWA / Field Mode)

Tài liệu này dành cho việc test các tính năng mobile/PWA (Field Workbench, chụp ảnh nhật ký,
cài đặt Add to Home Screen, chế độ standalone...) trên điện thoại Android/iOS thật, kết nối
tới backend + frontend đang chạy dev trên máy tính.

## Vì sao cần setup riêng?

- Vite dev server mặc định chỉ bind vào `localhost` — điện thoại không vào được.
- Backend (.NET) theo `launchSettings.json` cũng chỉ bind `localhost`.
- Cài đặt PWA thật (Add to Home Screen tạo app standalone, Service Worker hoạt động) **bắt
  buộc phải chạy trên HTTPS** — trừ đúng `localhost`. Truy cập qua IP LAN (`http://192.168.x.x`)
  KHÔNG đủ điều kiện để cài PWA, dù vẫn dùng bình thường được trên trình duyệt.
- `<input capture>` (chụp ảnh qua camera hệ thống) hoạt động được cả trên HTTP LAN, nhưng khi
  PWA đã cài chạy standalone trên Android, mở camera hệ thống có thể làm mất trạng thái app —
  vì vậy BPG-CMS tự chụp ảnh ngay trong trang bằng `getUserMedia` (cần HTTPS hoặc `localhost`).

## Cách 1 — Dùng script tự động (khuyến nghị)

Chạy PowerShell **thường** (không cần Admin) từ thư mục gốc repo:

```powershell
.\test-mobile-pwa.ps1
```

Script sẽ:
1. Dò IP LAN của máy.
2. Backup file `BPG_CMS_FE/.env`.
3. Khởi động backend (bind `0.0.0.0:5160`, môi trường `Development`).
4. Tạo 2 tunnel HTTPS công khai bằng `cloudflared` (qua `npx`, không cần cài) — một cho
   frontend, một cho backend.
5. Tự cập nhật `VITE_API_URL` trỏ về tunnel backend, khởi động frontend.
6. In ra URL để mở trên điện thoại.
7. Khi bạn nhấn **Enter** (test xong) → tự tắt hết tunnel/server và phục hồi `.env` gốc.

Chỉ cần test nhanh (chọn ảnh, gọi API, không cần cài PWA thật) và không có mạng ra Internet
để tunnel, dùng chế độ LAN (nhanh hơn, không cần internet):

```powershell
.\test-mobile-pwa.ps1 -Mode LAN
```

### Yêu cầu 1 lần duy nhất: mở firewall

Nếu đây là lần đầu test trên máy này, mở **PowerShell as Administrator** và chạy 1 lần:

```powershell
New-NetFirewallRule -DisplayName "Vite Dev 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Any
New-NetFirewallRule -DisplayName "BPG API 5160"  -Direction Inbound -LocalPort 5160 -Protocol TCP -Action Allow -Profile Any
```

(Chỉ cần cho chế độ `-Mode LAN`. Chế độ `Tunnel` không cần mở firewall vì traffic đi qua
`cloudflared` ra ngoài, không kết nối trực tiếp vào máy.)

## Cách 2 — Làm thủ công (khi cần hiểu/chỉnh từng bước)

1. **Tìm IP LAN của máy:**
   ```powershell
   (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback' }).IPAddress
   ```

2. **Chạy backend cho phép truy cập từ ngoài:**
   ```powershell
   cd BPG_CMS_BE/src/BPG.Api
   $env:ASPNETCORE_ENVIRONMENT="Development"
   dotnet run --no-launch-profile --urls "http://0.0.0.0:5160"
   ```
   > Dùng `--no-launch-profile` vì `launchSettings.json` sẽ ghi đè `applicationUrl` về
   > `localhost` nếu không bỏ qua nó. Nhớ tự set `ASPNETCORE_ENVIRONMENT=Development`, nếu
   > không app sẽ chạy `Production`.

3. **Sửa `BPG_CMS_FE/.env`** (nhớ đổi lại sau khi test xong, file này không nằm trong git):
   ```
   VITE_API_URL=http://<IP-LAN-máy-bạn>:5160/api
   ```

4. **Chạy frontend cho phép truy cập từ ngoài:**
   ```powershell
   cd BPG_CMS_FE
   npm run dev -- --host
   ```

5. **Chỉ test trên cùng Wi-Fi (HTTP), không cần cài PWA:**
   Mở `http://<IP-LAN-máy-bạn>:5173` trên điện thoại. Đủ để test đăng nhập, chọn ảnh, gọi API.

6. **Test cài đặt PWA thật (bắt buộc HTTPS):**
   Cần tunnel HTTPS. Ví dụ dùng `cloudflared` (miễn phí, không cần tài khoản, không cần cài —
   chạy qua `npx`):
   ```powershell
   npx --yes cloudflared tunnel --url http://localhost:5160   # tunnel cho backend
   npx --yes cloudflared tunnel --url http://localhost:5173   # tunnel cho frontend (tab khác)
   ```
   Mỗi lệnh in ra 1 URL dạng `https://xxx.trycloudflare.com`. Cập nhật lại `.env` trỏ
   `VITE_API_URL` về URL tunnel backend, khởi động lại frontend, rồi mở URL tunnel frontend
   trên điện thoại.

   Vite chặn mặc định các Host header lạ (chống DNS rebinding) — nếu gặp lỗi 403 "Blocked
   request", set biến môi trường trước khi chạy `npm run dev`:
   ```powershell
   $env:VITE_DEV_TUNNEL_HOST="xxx.trycloudflare.com"   # domain tunnel frontend, không có https://
   npm run dev -- --host
   ```
   (`vite.config.ts` đã có sẵn cấu hình đọc biến này — xem phần `server.allowedHosts`.)

7. **Dọn dẹp sau khi test:** đổi `VITE_API_URL` trong `.env` về lại
   `http://localhost:5160/api`, dừng các tunnel/server, khởi động lại bình thường bằng
   `run_servers.bat` nếu cần.

## Các bước test trên điện thoại (sau khi có URL truy cập được)

1. Mở URL trên trình duyệt điện thoại (Chrome/Android hoặc Safari/iOS), đăng nhập.
2. Vào "Việc của tôi" → chọn task → thử tạo Nhật ký, thử cả "Chụp ảnh" lẫn "Chọn ảnh".
3. Cài đặt PWA (chỉ khi truy cập qua HTTPS thật, không phải IP LAN):
   - **Android Chrome:** menu (⋮) → "Cài đặt ứng dụng" / banner cài đặt tự hiện.
   - **iOS Safari:** nút Chia sẻ → "Thêm vào Màn hình chính".
4. Mở lại app từ icon trên màn hình chính để test chế độ standalone (không thanh địa chỉ),
   thử lại "Chụp ảnh" trong chế độ này — đây là kịch bản dễ lộ lỗi nhất trên Android.

## Sự cố thường gặp

| Triệu chứng | Nguyên nhân khả dĩ | Cách xử lý |
|---|---|---|
| Điện thoại không load được trang (chế độ LAN) | Firewall Windows chặn cổng | Mở firewall rule (xem trên), kiểm tra `Get-NetConnectionProfile` — mạng "Public" bị chặn chặt hơn "Private" |
| Load được trang nhưng đăng nhập/gọi API lỗi | `VITE_API_URL` đang trỏ `localhost` — trên điện thoại `localhost` là chính nó, không phải máy tính | Sửa `.env` trỏ đúng IP LAN hoặc URL tunnel, restart frontend |
| Backend chỉ nghe `127.0.0.1` dù đã set `ASPNETCORE_URLS` | `dotnet run` ưu tiên `applicationUrl` trong `launchSettings.json`, đè lên biến môi trường | Thêm `--no-launch-profile`, hoặc dùng `--urls` trực tiếp |
| Backend chạy nhưng vào `Production` thay vì `Development` | Dùng `--no-launch-profile` làm mất luôn biến `ASPNETCORE_ENVIRONMENT` set trong `launchSettings.json` | Tự set lại `ASPNETCORE_ENVIRONMENT=Development` trước khi chạy |
| Vite báo lỗi 403 "Blocked request" khi vào qua tunnel | Vite chặn Host header lạ mặc định | Set `VITE_DEV_TUNNEL_HOST` trước khi chạy `npm run dev` (xem trên) |
| Tunnel `localtunnel` (`loca.lt`) báo lỗi liên tục, `ERR_HTTP_RESPONSE_CODE_FAILURE` | Dịch vụ `localtunnel` miễn phí không ổn định | Dùng `cloudflared` thay thế (ổn định hơn nhiều, script tự động đã dùng sẵn) |
| Chụp ảnh trong PWA đã cài (standalone) không thấy ảnh trả về | Android không trả app về đúng cửa sổ standalone sau khi mở camera hệ thống | Đã xử lý trong code — nút "Chụp ảnh" tự chụp ngay trong trang bằng `getUserMedia`, không mở app Camera ngoài |
| Bấm "Chụp ảnh", camera che kín màn hình nhưng nút chụp bị thanh điều hướng dưới cùng che mất | `Modal` cha có CSS `transform` (animation) tạo containing block mới, khiến phần tử `position: fixed` bên trong không còn tính theo toàn viewport | Đã xử lý — camera render qua `ReactDOM.createPortal` ra thẳng `document.body` |
