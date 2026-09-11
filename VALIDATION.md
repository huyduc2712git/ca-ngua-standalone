# Kiểm tra UI 2.1 và bản triển khai 2.1.1

Đã thực thi trên Linux, Node.js 24.19.0. Dự án khai báo Node.js 22+; chưa chạy trực tiếp Node.js 22, Windows/macOS hoặc thiết bị di động trong phiên này.

## Các lệnh đã chạy thành công

```sh
node scripts/check.mjs
node scripts/build-host.mjs
node --test tests/engine.test.mjs tests/server.test.mjs tests/pwa-motion.test.mjs tests/embedded-host.test.mjs tests/deployment.test.mjs
```

Kết quả: **38 test, 38 pass, 0 fail, 0 skip**. Kiểm tra syntax và tài nguyên cục bộ thành công; bản host sinh ra chứa 22 tài nguyên nhúng. Không cài gói npm ngoài.

| Nhóm | Số bài | Nội dung đã xác nhận |
| --- | ---: | --- |
| Bộ luật | 11 | 56 ô liên tục, cửa/chuồng đúng màu, ra quân 1/6, thêm lượt, chắn/đá, đi đúng cửa, lên chuồng, xếp 6–5–4–3, bỏ cuộc, sai lượt. Một bài mô phỏng 12 ván hoàn chỉnh với 2–4 người, kiểm tra không trùng ô và tất cả đạt điều kiện thắng. |
| Host, đồng bộ và startup | 8 | Chạy tiến trình thực, bắt lỗi quyền đọc danh sách mạng, hai phiên HTTP/SSE độc lập, xúc xắc do host quyết định, chống thao tác đồng thời/lặp, xác thực ghế, sẵn sàng, sức chứa, đổi chủ, bỏ cuộc, nối lại và không lộ tệp server. |
| Lưu phòng | 3 | Khởi động lại giữ đúng ghế/ván/revision/mã thao tác, nối lại SSE, snapshot riêng không bị phục vụ công khai; tệp hỏng không bị ghi đè; phòng quá hạn bị xóa cả trong RAM và snapshot. |
| Hoạt ảnh, hình học và PWA | 6 | Nhảy qua từng ô trung gian, độ cao/tiếp đất, kết thúc khi đưa nền; diện tích silhouette/hình khối, camera không cắt góc khi xoay; manifest và kích thước PNG; service worker cache tài nguyên, không can thiệp API/phương thức ghi và không xóa cache ứng dụng khác. |
| Màu quân và báo lượt | 4 | Từng người giữ đúng màu qua tất cả lượt; nhận diện ghế ở phòng chờ/khi mất mạng; không báo lượt lặp hoặc trước khi hoạt ảnh xong; chơi chung máy hiển thị tên người đang đi. |
| Host nhúng độc lập | 1 | Chép duy nhất `host.mjs` vào thư mục trống, chạy tiến trình Node, so sánh từng byte của mọi tài nguyên phục vụ với nguồn, kiểm tra header PWA, health và tạo phòng. |
| Triển khai tách frontend/host | 5 | CORS preflight theo origin chính xác; hai phiên REST/SSE từ origin giao diện khác origin host có thể vào phòng, sẵn sàng, bắt đầu, gieo, đi và khôi phục ghế; standalone vẫn chặn origin lạ, proxy HTTPS hoạt động; URL host và khóa phiên không bị trộn; build Vercel không đổi nguồn standalone, có đủ cache offline và đổi cache khi host/UI đổi. |

Phép thử service worker dùng các API giả lập trong Node VM để kiểm tra logic. Phép thử hoạt ảnh kiểm tra đường đi/thời gian và công thức chuyển động. Phép thử WebGL kiểm tra dữ liệu hình học/phép chiếu, không khởi tạo GPU/trình duyệt. Mặt bàn SVG dùng chung đã được xuất PNG để kiểm tra bố cục ô, màu và số chuồng; ảnh này không phải ảnh chụp ứng dụng trong trình duyệt. Đây không phải bằng chứng hoàn tất cài PWA hay kiểm tra hình ảnh trên điện thoại.

## Phạm vi chưa kiểm tra trực tiếp

- Chưa xem/điều khiển giao diện trong trình duyệt: shader, hình ảnh 3D, mức mượt, cảm ứng và tốc độ trên GPU điện thoại cần xác nhận trên thiết bị đích.
- Chưa chạy luồng cài Android/iOS, offline lần mở lại và cập nhật service worker trên trình duyệt thật.
- Chưa kiểm tra hai thiết bị vật lý qua Wi-Fi, firewall/router, mất mạng di động hoặc nền iOS. Kiểm thử nhiều người hiện ở tầng HTTP/SSE.
- Chưa deploy Render/Vercel, xác nhận Blueprint hoặc project trên dashboard hay thử persistent disk Render thật. Lưu phòng và luồng khác origin đã được kiểm tra trên máy chạy test; header Origin được mô phỏng bằng HTTP client Node, chưa chạy CORS trong trình duyệt thật.
- Dockerfile, trình đọc màn hình và WebMCP tùy chọn chưa chạy thử. Game không phụ thuộc WebMCP.

## Kiểm tra nghiệm thu trên thiết bị đích

1. Tạo và tham gia một phòng bằng hai thiết bị trên cùng địa chỉ host; sẵn sàng và bắt đầu.
2. Gieo và chọn ngựa. Quan sát nhảy từng ô, tiếp đất và đá về bãi; so sánh kết quả trên hai màn hình.
3. Xoay bàn 3D, chọn ngựa trên điện thoại, chuyển 2D và thử phím tắt trên máy tính.
4. Đưa ứng dụng vào nền trong lúc ngựa nhảy, rồi mở lại. Kiểm tra không kẹt nút và giữ đúng lượt.
5. Qua HTTPS, cài PWA và chờ báo tải đủ tài nguyên. Tắt mạng, mở lại và chơi chung máy; bật mạng để quay lại phòng online.
6. Khi đã bật `ROOMS_FILE`, restart host thử nghiệm: khách nối lại cùng ghế/ván; `/api/health` báo `persistence: true`.
7. Xác nhận nhãn BẠN đúng màu của từng thiết bị, giữ nguyên khi chờ đối phương; xoay bàn và đối chiếu nhãn tên nằm đúng chuồng.
8. Cập nhật bản cache mới sau khi kết thúc ván, kiểm tra nút Cập nhật và tải lại đủ tài nguyên.
