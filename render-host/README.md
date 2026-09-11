# Host Cá Ngựa Club 2.1 cho Render

`host.mjs` là một tệp Node.js tự chứa toàn bộ game 3D/PWA, luật chơi và server HTTP/SSE. Tệp chạy trong thư mục trống, không cần `dist`, `node_modules` hoặc `npm install`. Cần Node.js 22+.

## Chạy thử ở máy tính

```sh
node host.mjs
```

Mở `http://localhost:3000`. Bạn bè cùng Wi-Fi mở `http://<IP-của-máy-host>:3000`. Dừng bằng Ctrl+C. Trong thử nghiệm cục bộ, PWA cài/offline được qua localhost trên máy host; IP LAN dùng HTTP không có secure context để service worker hoạt động trên điện thoại.

## Cách đưa lên Render

Render triển khai từ mã trong repository Git. Không có bước tải riêng tệp `.mjs` lên trang chủ Render.

1. Commit nội dung gói host vào repository/nhánh bạn muốn triển khai. Không cần merge vào nhánh mặc định.
2. Trên Render chọn **New → Web Service**, kết nối repository và chọn **đúng nhánh** có mã game.
3. Runtime **Node**. Đặt **Root Directory**:
   - Nếu `host.mjs` nằm tại gốc repository: để trống.
   - Nếu dùng toàn bộ mã nguồn standalone và tệp nằm tại `render-host/host.mjs`: nhập `render-host`.
   - Nếu dự án nằm sâu hơn: nhập đúng đường dẫn thư mục chứa `host.mjs` tính từ gốc repository.
4. **Build Command:** `node --check host.mjs`.
5. **Start Command:** `node host.mjs`.
6. Biến môi trường: `NODE_VERSION=22`, `TRUST_PROXY=1`. Không gán `HOST=127.0.0.1`; Render cần host lắng nghe `0.0.0.0` và cổng `PORT` do Render cung cấp.
7. Health Check Path: `/api/health`. Chọn **một instance**. Tắt tự deploy nếu muốn tránh cập nhật giữa ván.
8. Chọn cấu hình Free hoặc compute trả phí bên dưới, rồi deploy. Mở địa chỉ `https://…onrender.com`, tạo phòng và chia sẻ link cho mọi người.

Tài liệu chính thức: [Deploy Node apps](https://render.com/docs/deploy-node-express-app), [Blueprint specification](https://render.com/docs/blueprint-spec).

## Chọn cấu hình lưu phòng

| Lựa chọn | Thiết lập | Phạm vi |
| --- | --- | --- |
| Thử miễn phí | Plan Free, không đặt `ROOMS_FILE`, không gắn disk | Phòng nằm trong RAM, mất khi tiến trình bị dừng/khởi động lại. |
| Dùng thường xuyên | Compute trả phí, persistent disk gắn tại `/var/data`, biến `ROOMS_FILE=/var/data/rooms.json` | Lưu phòng và ván sau thay đổi, khôi phục cùng ghế khi host chạy lại. |

Render Free có thể ngủ sau 15 phút không có lưu lượng đến; lần mở lại có thể phải chờ khởi động. Free không hỗ trợ persistent disk. Cấu hình trả phí tránh cơ chế ngủ do nhàn rỗi của Free nhưng không bảo đảm không bao giờ ngắt kết nối: deploy/bảo trì vẫn có thể khởi động lại tiến trình. Xem [giới hạn Free](https://render.com/docs/free) và [persistent disk](https://render.com/docs/disks).

Đĩa lưu phòng chứa token ghế và trạng thái riêng của người chơi. Chỉ server đọc, không đặt trong tài nguyên công khai hoặc commit vào Git. Không chạy nhiều instance/máy cùng ghi snapshot. Snapshot quá hạn 24 giờ được dọn; nếu tệp hỏng, host giữ nguyên tệp và dừng thay vì xóa ván.

## Dùng Blueprint YAML

- `render.yaml`: cấu hình **trả phí**, plan `0.5c-512mb` và persistent disk 1 GB.
- `render-free.yaml`: cấu hình **thử miễn phí**.

Các YAML mặc định giả định **`host.mjs` nằm tại gốc repository**. Để dùng Free, chọn `render-free.yaml` làm Blueprint path hoặc chép nội dung của nó sang `render.yaml` trên nhánh triển khai. Nếu giữ dự án đầy đủ, chọn Blueprint path `render-host/render.yaml` (hoặc bản Free), đồng thời thêm trường sau trong service:

```yaml
    rootDir: render-host
```

Nếu dự án có thư mục cha khác, thay bằng đúng đường dẫn từ gốc repository. Khi tạo Blueprint, chọn nhánh có bản cập nhật và kiểm tra plan/disk hiển thị trước khi deploy. YAML được cung cấp dưới dạng mã cấu hình; chưa có dịch vụ nào được tạo tự động.

## Cài trên điện thoại

Android: mở HTTPS bằng trình duyệt hỗ trợ, bấm **Cài game** hoặc dùng menu cài ứng dụng. iPhone/iPad: Safari → **Chia sẻ → Thêm vào Màn hình chính**. Giữ mạng trong lần đầu để tải tài nguyên offline.

PWA đã cài chơi chung máy offline được; nhiều máy vẫn cần tới host Render qua Internet. PWA không tự biến điện thoại thành server LAN. HTTP tại IP Wi-Fi chỉ dùng để chơi bằng trình duyệt, trừ khi bạn tự cấu hình HTTPS tin cậy. [Yêu cầu PWA của MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Kiểm tra sau khi deploy

1. Mở `/api/health`: thấy `ok: true`, `version: "2.1.0"`; `persistence: true` nếu đã bật lưu phòng.
2. Hai thiết bị tạo/vào cùng phòng, sẵn sàng, bắt đầu và đi ngựa.
3. Tải lại PWA/tab; kiểm tra ghế, vị trí, lượt hiện tại.
4. Với disk: thử restart dịch vụ khi kiểm tra trước buổi chơi, chờ các thiết bị kết nối lại đúng ván.
5. Cài PWA, tải xong, tắt mạng và thử chế độ **Chơi trên máy này**.

Host một tệp đã chạy trong thư mục trống và phục vụ đủ 20 tài nguyên, API tạo phòng trong kiểm thử tự động. Chưa deploy thật trên tài khoản Render hoặc kiểm thử cài PWA trên điện thoại trong phiên bàn giao.

## Cập nhật từ mã nguồn

Sửa dự án standalone gốc rồi chạy `node scripts/build-host.mjs`; thay `host.mjs` bằng tệp sinh lại. Khi sửa frontend, tăng phiên bản cache trong `dist/sw.js`. Không chỉnh các chuỗi base64 tài nguyên thủ công. Giấy phép tài sản đã nhúng trong phần chú thích đầu tệp host.

## Giao diện 2.1

Host này đã chứa bàn gỗ theo ảnh tham khảo, nhãn màu của bạn và báo lượt ngay trên bàn. Sau khi thay host, mở lại PWA khi có mạng và bấm **Cập nhật** sau khi kết thúc ván. Cache mới là `ca-ngua-static-v2.1.0`.
