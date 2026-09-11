# GitHub → Render host + Vercel PWA

Bản triển khai **2.1.1**, giữ UI **2.1**: bàn gỗ, bốn màu quân, nhãn BẠN, báo lượt desktop/mobile và hoạt ảnh từng ô. Hai phần dùng cùng một mã nguồn, không cần thư viện npm khi chạy.

## Trạng thái bàn giao

- Đã tạo Git cục bộ: `main` lưu nguyên bản standalone 2.1; `deploy/render-vercel-v2.1` chứa thay đổi triển khai. Không merge.
- Đã chạy kiểm tra cú pháp, sinh lại host một tệp và **38/38 test** thành công.
- Chưa tạo repository GitHub hoặc đẩy commit lên GitHub. Kết nối GitHub xác nhận tài khoản `huyduc2712git`, nhưng không cung cấp thao tác tạo repository mới trong phiên chuẩn bị này.
- Render và Vercel đã báo kết nối thành công. Các thao tác triển khai chưa được cung cấp cho phiên chuẩn bị này; chưa tạo dịch vụ, project, tên miền hay đăng ký trả phí.
- Các địa chỉ dạng `YOUR-HOST.onrender.com` hoặc `YOUR-GAME.vercel.app` bên dưới là **ví dụ cần thay**, không phải địa chỉ đã triển khai.

## 1. Repository GitHub

Tạo repository tên `ca-ngua-standalone` trong tài khoản của bạn, mặc định chọn Private. Không ghi đè repository khác. Khi repository tồn tại và kết nối GitHub có quyền truy cập, có thể đẩy toàn bộ nguồn lên nhánh `deploy/render-vercel-v2.1` và giữ `main` làm bản gốc, không merge.

Nếu tự đẩy từ bản Git đã được khôi phục:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/ca-ngua-standalone.git
git push -u origin main
git push -u origin deploy/render-vercel-v2.1
```

Nếu dùng bản ZIP đi kèm `git-history.bundle`, có thể khôi phục đầy đủ hai nhánh vào thư mục mới:

```sh
git clone git-history.bundle ca-ngua-source
cd ca-ngua-source
git branch main origin/main
git remote remove origin
```

Lệnh clone chọn nhánh triển khai đang là HEAD trong bundle; kiểm tra bằng `git branch`. Sau đó thêm remote GitHub như trên. Các lệnh này cần Git và đăng nhập GitHub trên máy thực hiện; không đưa token truy cập vào mã nguồn hoặc tin nhắn.

## 2. Render: chạy host

Trong Render, tạo **Web Service** từ repository và chọn nhánh `deploy/render-vercel-v2.1`. Có thể dùng Blueprint `render.yaml` tại gốc repo, hoặc điền:

| Mục | Giá trị |
| --- | --- |
| Name | `ca-ngua-club-host` hoặc tên còn trống |
| Runtime | Node |
| Branch | `deploy/render-vercel-v2.1` |
| Root Directory | Để trống — repository chứa nguyên thư mục dự án ở gốc |
| Build Command | `node scripts/check.mjs && node scripts/build-host.mjs` |
| Start Command | `node render-host/host.mjs` |
| Health Check Path | `/api/health` |
| Region | Singapore |
| Initial plan | Free |
| Automatic deploy | Off; triển khai có chủ đích để tránh cắt ván đang chơi |
| `NODE_VERSION` | `22` |
| `TRUST_PROXY` | `1` |

Sau khi deploy thành công, lấy địa chỉ HTTPS thực tế do Render cấp. Mở `/api/health`: cần trả JSON `ok: true`, `version: "2.1.1"`. Địa chỉ Render cũng phục vụ được nguyên game độc lập.

Chưa cần đặt `ALLOWED_ORIGINS` ở bước này. Khi có URL Vercel ở bước 3, bổ sung ở bước 4.

**Free là cấu hình thử nghiệm.** Render Free ngủ sau 15 phút không có lưu lượng đến và có thể mất khoảng một phút để thức dậy; phòng trong RAM mất khi host ngủ, restart hoặc deploy. Muốn host hoạt động thường xuyên và khôi phục phòng, chọn compute trả phí và persistent disk, rồi đặt `ROOMS_FILE=/var/data/rooms.json`, disk mount `/var/data`, 1 GB, một instance. Chỉ dùng gói trả phí sau khi chủ tài khoản chọn mức chi phí.

Tham khảo [Render Free](https://render.com/docs/free), [Blueprint reference](https://render.com/docs/blueprint-spec), [Persistent disks](https://render.com/docs/disks).

## 3. Vercel: giao diện PWA

Import cùng repository vào Vercel:

| Mục | Giá trị |
| --- | --- |
| Framework | Other |
| Root Directory | Để trống |
| Production Branch | `deploy/render-vercel-v2.1` |
| Install Command | `node --version` |
| Build Command | `node scripts/check.mjs && node scripts/build-vercel.mjs` |
| Output Directory | `vercel-dist` |
| Node.js | 22.x hoặc bản đáp ứng Node.js 22+ |
| Environment Variable | `HOST_URL=https://YOUR-HOST.onrender.com` — thay bằng URL thực tế từ bước 2 |

Các thiết lập build, install, output và header đã có trong `vercel.json`. Đặt `HOST_URL` cho Production; chỉ đặt cho Preview nếu bạn cần preview chơi online. Biến này là địa chỉ công khai, không phải bí mật và không được chứa API key.

Nếu Vercel chỉ cho chọn Production Branch sau khi tạo project, đổi sang nhánh trên trước khi redeploy production; không phát hành bản `main` chưa có cấu hình Vercel. `HOST_URL` trỏ tới **origin HTTPS**, không thêm `/api`, query, mã phòng hoặc dấu `#`.

Build tạo thư mục `vercel-dist` riêng, không thay `dist` của standalone. Thiếu host HTTPS thì build dừng với thông báo rõ ràng. Frontend gọi REST và SSE trực tiếp tới Render; không chạy host lưu phòng trong Vercel Functions và không proxy SSE qua Vercel.

Tham khảo [Vercel project configuration](https://vercel.com/docs/project-configuration), [vercel.json](https://vercel.com/docs/project-configuration/vercel-json).

## 4. Cho phép URL Vercel trên Render

Sau khi Vercel cấp địa chỉ, thêm biến môi trường cho dịch vụ Render:

```text
ALLOWED_ORIGINS=https://YOUR-GAME.vercel.app
```

Nếu có tên miền riêng hoặc preview cần dùng chung host, liệt kê từng origin chính xác, ngăn bằng dấu phẩy. Không dùng `*` hoặc `*.vercel.app`. Lưu biến và triển khai lại Render trước khi bắt đầu ván.

`HOST_URL` trên Vercel chỉ định **máy chủ**. `ALLOWED_ORIGINS` trên Render chỉ định **các giao diện được phép kết nối**. Chúng không phải hai giá trị giống nhau. Mở trực tiếp game từ địa chỉ Render vẫn được chấp nhận.

Nếu đổi Render host, sửa `HOST_URL` trên Vercel và redeploy. Build tự đổi tên cache PWA theo host và toàn bộ tài nguyên; người đang dùng bản đã cài áp dụng cập nhật sau khi kết thúc ván. Phiên ghế được lưu tách theo host để không gửi phiên cũ sang máy chủ mới.

## 5. Kiểm tra sau triển khai

1. Mở URL Vercel bằng hai trình duyệt/thiết bị; tạo và tham gia cùng một phòng.
2. Khách sẵn sàng, chủ phòng bắt đầu. Kiểm tra mỗi máy có đúng màu, nhãn BẠN và báo lượt; gieo/chọn ngựa và đối chiếu hai bàn cờ.
3. Trong Network, REST `/api/rooms` và SSE `/events` phải trỏ tới URL Render, không phải Vercel; không có lỗi CORS. Tải lại một tab để kiểm tra khôi phục ghế.
4. Cài PWA qua HTTPS. Chờ đủ cache, tắt mạng, mở lại và chọn Chơi trên máy này. Phòng nhiều máy vẫn cần mạng đến Render.
5. Kiểm tra bàn gỗ, quân và nhãn trên desktop/mobile thực tế. Bộ test Node xác nhận luật, hình học, dữ liệu và cache; không thay thế kiểm tra WebGL/cài PWA trên điện thoại thật.

## Chạy và kiểm thử tại máy

```sh
node server.mjs
```

Không cần `HOST_URL` hoặc `ALLOWED_ORIGINS` khi chạy standalone thông thường. Để kiểm tra nguồn và host nhúng:

```sh
node scripts/check.mjs
node scripts/build-host.mjs
node --test tests/engine.test.mjs tests/server.test.mjs tests/pwa-motion.test.mjs tests/embedded-host.test.mjs tests/deployment.test.mjs
```

Kiểm tra build PWA bằng một địa chỉ host hợp lệ:

```sh
HOST_URL=https://YOUR-HOST.onrender.com node scripts/build-vercel.mjs
```

PowerShell:

```powershell
$env:HOST_URL="https://YOUR-HOST.onrender.com"
node scripts/build-vercel.mjs
```

Phép build không tự upload hoặc tạo deployment. Không commit `.data`, `.env`, file snapshot phòng hoặc cấu hình đăng nhập cá nhân.
