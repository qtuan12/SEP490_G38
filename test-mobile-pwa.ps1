<#
.SYNOPSIS
  Chạy backend + frontend BPG-CMS ở chế độ có thể truy cập từ điện thoại thật để test
  PWA (chụp ảnh, cài đặt Add to Home Screen, standalone mode...), và tự dọn dẹp khi xong.

.DESCRIPTION
  Có 2 chế độ:
    - LAN     : Nhanh, chỉ cần cùng Wi-Fi. Đủ để test chọn ảnh / gọi API trên trình duyệt
                thường. KHÔNG đủ để cài đặt PWA thật (Add to Home Screen, Service Worker)
                vì thiếu HTTPS.
    - Tunnel  : Dùng cloudflared tạo 2 tunnel HTTPS công khai (frontend + backend). Đủ điều
                kiện để cài đặt PWA thật và test camera/service worker/standalone mode.
                Cần máy có Internet ra ngoài; URL là tunnel tạm thời, đổi mỗi lần chạy.

  Script tự backup file .env, tự phục hồi lại khi bạn dừng script (nhấn Enter), và tự tắt
  toàn bộ tiến trình nó đã mở (backend, frontend, tunnel).

.PARAMETER Mode
  "LAN" hoặc "Tunnel". Mặc định "Tunnel" (đầy đủ tính năng nhất, dùng để test cài PWA).

.EXAMPLE
  # Chạy PowerShell thường (không cần Admin) từ thư mục gốc repo:
  .\test-mobile-pwa.ps1
  .\test-mobile-pwa.ps1 -Mode LAN

.NOTES
  Nếu chưa từng mở firewall cho các cổng dev (5173/5160), hãy tự chạy 1 lần (Admin):
    New-NetFirewallRule -DisplayName "Vite Dev 5173" -Direction Inbound -LocalPort 5173 -Protocol TCP -Action Allow -Profile Any
    New-NetFirewallRule -DisplayName "BPG API 5160"  -Direction Inbound -LocalPort 5160 -Protocol TCP -Action Allow -Profile Any
  Script này không tự tạo được rule vì cần quyền Admin mà không nên chạy ẩn với quyền cao.
#>

param(
  [ValidateSet('LAN', 'Tunnel')]
  [string]$Mode = 'Tunnel'
)

$ErrorActionPreference = 'Stop'
$repoRoot = $PSScriptRoot
$feDir = Join-Path $repoRoot 'BPG_CMS_FE'
$beDir = Join-Path $repoRoot 'BPG_CMS_BE\src\BPG.Api'
$envPath = Join-Path $feDir '.env'

$processes = @()
$envBackup = $null

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Info($msg) { Write-Host "    $msg" -ForegroundColor DarkGray }

function Get-LanIPv4 {
    (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object {
            $_.InterfaceAlias -notmatch 'Loopback|vEthernet' -and
            $_.IPAddress -notlike '169.254.*'
        } | Select-Object -First 1 -ExpandProperty IPAddress)
}

function Wait-ForLine {
    # Nếu $Pattern có capture group thì trả về nhóm 1 (vd: bóc URL tunnel).
    # Nếu không có group (chỉ cần biết đã xuất hiện dòng đó) thì trả $true.
    param([string]$Path, [string]$Pattern, [int]$TimeoutSec = 30)
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        if (Test-Path $Path) {
            $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
            if ($content -match $Pattern) {
                if ($Matches.ContainsKey(1)) { return $Matches[1] }
                return $true
            }
        }
        Start-Sleep -Milliseconds 500
    }
    return $null
}

function Restore-Env {
    if ($null -ne $envBackup) {
        Write-Step "Khôi phục BPG_CMS_FE/.env về giá trị ban đầu"
        Set-Content -Path $envPath -Value $envBackup -Encoding utf8
    }
}

function Stop-Everything {
    Write-Step "Đang dừng toàn bộ tiến trình đã mở..."
    foreach ($p in $processes) {
        try {
            if ($p -and -not $p.HasExited) {
                # Các tiến trình được spawn qua "cmd.exe /c ..." (npm/npx là .cmd trên Windows) —
                # PID lưu lại là của cmd.exe, Stop-Process thường không giết được tiến trình con
                # thật sự bên trong (node/npx/cloudflared). Dùng taskkill /T để giết cả cây.
                taskkill /F /T /PID $p.Id 2>&1 | Out-Null
                Write-Info "Đã dừng PID $($p.Id) ($($p.ProcessName)) và tiến trình con"
            }
        } catch {}
    }
    Restore-Env
    Write-Host "`nDọn dẹp xong. Chạy lại 'run_servers.bat' để quay về chế độ dev bình thường (localhost)." -ForegroundColor Green
}

try {
    Write-Step "Kiểm tra thông tin mạng"
    $lanIp = Get-LanIPv4
    if (-not $lanIp) { throw "Không tìm được địa chỉ IP LAN (Wi-Fi). Kiểm tra kết nối mạng." }
    Write-Info "IP LAN máy này: $lanIp"

    Write-Step "Backup BPG_CMS_FE/.env"
    if (-not (Test-Path $envPath)) { throw "Không thấy $envPath. Hãy tạo .env trước (xem .env.example)." }
    $envBackup = Get-Content $envPath -Raw
    Write-Info "Đã lưu nội dung .env hiện tại, sẽ phục hồi khi kết thúc."

    Write-Step "Khởi động Backend (.NET) — bind 0.0.0.0:5160, môi trường Development"
    $beLog = New-TemporaryFile
    # Start-Process trên Windows PowerShell 5.1 không có tham số -Environment (chỉ pwsh 7+ mới có).
    # Set biến môi trường ở tiến trình cha — tiến trình con sẽ tự kế thừa.
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    $beProc = Start-Process -FilePath "dotnet" `
        -ArgumentList "run", "--no-launch-profile", "--urls", "http://0.0.0.0:5160" `
        -WorkingDirectory $beDir `
        -RedirectStandardOutput $beLog -RedirectStandardError "$beLog.err" `
        -WindowStyle Hidden -PassThru
    $processes += $beProc
    Write-Info "Đang chờ backend khởi động (log: $beLog)..."
    $started = Wait-ForLine -Path $beLog -Pattern "Now listening on" -TimeoutSec 40
    if (-not $started) { throw "Backend không khởi động được trong 40s. Xem log: $beLog" }
    Write-Info "Backend đã sẵn sàng."

    $apiUrl = "http://$($lanIp):5160/api"
    $env:VITE_DEV_TUNNEL_HOST = $null

    if ($Mode -eq 'Tunnel') {
        Write-Step "Tạo tunnel HTTPS cho Backend (cloudflared)"
        $beTunnelLog = New-TemporaryFile
        # npx/npm là file .cmd trên Windows, không phải .exe — phải gọi qua cmd.exe /c.
        $beTunnelProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx --yes cloudflared tunnel --url http://localhost:5160" `
            -WorkingDirectory $repoRoot -RedirectStandardOutput $beTunnelLog -RedirectStandardError "$beTunnelLog.err" `
            -WindowStyle Hidden -PassThru
        $processes += $beTunnelProc
        $beTunnelUrl = Wait-ForLine -Path "$beTunnelLog.err" -Pattern "(https://[a-z0-9\-]+\.trycloudflare\.com)" -TimeoutSec 60
        if (-not $beTunnelUrl) {
            Write-Host "----- Nội dung log tunnel backend -----" -ForegroundColor Red
            Get-Content "$beTunnelLog.err" -ErrorAction SilentlyContinue | Write-Host
            throw "Không lấy được URL tunnel backend. Xem log: $beTunnelLog.err"
        }
        Write-Info "Backend tunnel: $beTunnelUrl"
        $apiUrl = "$beTunnelUrl/api"

        Write-Step "Tạo tunnel HTTPS cho Frontend (cloudflared)"
        $feTunnelLog = New-TemporaryFile
        $feTunnelProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npx --yes cloudflared tunnel --url http://localhost:5173" `
            -WorkingDirectory $repoRoot -RedirectStandardOutput $feTunnelLog -RedirectStandardError "$feTunnelLog.err" `
            -WindowStyle Hidden -PassThru
        $processes += $feTunnelProc
        $feTunnelUrl = Wait-ForLine -Path "$feTunnelLog.err" -Pattern "(https://[a-z0-9\-]+\.trycloudflare\.com)" -TimeoutSec 60
        if (-not $feTunnelUrl) {
            Write-Host "----- Nội dung log tunnel frontend -----" -ForegroundColor Red
            Get-Content "$feTunnelLog.err" -ErrorAction SilentlyContinue | Write-Host
            throw "Không lấy được URL tunnel frontend. Xem log: $feTunnelLog.err"
        }
        Write-Info "Frontend tunnel: $feTunnelUrl"

        $env:VITE_DEV_TUNNEL_HOST = ($feTunnelUrl -replace '^https://', '')
    }

    Write-Step "Ghi VITE_API_URL tạm thời vào .env"
    $newEnv = ($envBackup -replace 'VITE_API_URL=.*', "VITE_API_URL=$apiUrl")
    Set-Content -Path $envPath -Value $newEnv -Encoding utf8
    Write-Info "VITE_API_URL=$apiUrl"

    Write-Step "Khởi động Frontend (Vite) — bind 0.0.0.0:5173"
    $feLog = New-TemporaryFile
    $feProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm run dev -- --host --port 5173" `
        -WorkingDirectory $feDir -RedirectStandardOutput $feLog -RedirectStandardError "$feLog.err" `
        -WindowStyle Hidden -PassThru
    $processes += $feProc
    $ready = Wait-ForLine -Path $feLog -Pattern "(ready in)" -TimeoutSec 40
    if (-not $ready) { throw "Frontend không khởi động được trong 40s. Xem log: $feLog" }
    Write-Info "Frontend đã sẵn sàng."

    $phoneUrl = if ($Mode -eq 'Tunnel') { $feTunnelUrl } else { "http://$($lanIp):5173" }

    Write-Host "`n============================================================" -ForegroundColor Green
    Write-Host " Mở link này trên điện thoại:" -ForegroundColor Green
    Write-Host " $phoneUrl" -ForegroundColor Yellow
    Write-Host "============================================================" -ForegroundColor Green
    if ($Mode -eq 'LAN') {
        Write-Host " Chế độ LAN: đủ test chọn ảnh / đăng nhập / API." -ForegroundColor DarkYellow
        Write-Host " KHÔNG cài được PWA thật (thiếu HTTPS) — dùng -Mode Tunnel nếu cần." -ForegroundColor DarkYellow
        Write-Host " Đảm bảo điện thoại + máy tính cùng Wi-Fi, và đã mở firewall cổng 5173/5160." -ForegroundColor DarkYellow
    } else {
        Write-Host " Chế độ Tunnel: HTTPS thật, cài PWA/test camera/standalone được." -ForegroundColor DarkYellow
        Write-Host " URL tunnel là tạm thời — sẽ mất khi bạn dừng script này." -ForegroundColor DarkYellow
    }
    Write-Host "`nNhấn Enter khi test xong để tự động dừng và dọn dẹp..." -ForegroundColor Cyan
    Read-Host | Out-Null
}
finally {
    Stop-Everything
}

