# Cá Ngựa Club 2.1 — 3D & PWA

Game cờ cá ngựa tiếng Việt cho 2–4 người: chơi nhiều máy trên cùng host hoặc thay phiên trên một máy. Giữ nguyên dạng standalone, không phụ thuộc CDN, dịch vụ bên thứ ba hay gói npm lúc chạy.

## Bản cập nhật 2.1 theo mẫu bàn gỗ

- Bàn cờ chuyển sang viền gỗ walnut, ô vuông màu kem kẻ nâu và bốn chuồng sơn đậm. Mặt bàn SVG dùng chung cho 2D và texture 3D; giữ đúng tọa độ đường đua, cửa và sáu bậc chuồng.
- Quân 3D được dựng theo dáng quân gỗ tiện tròn trong ảnh tham khảo, có đầu tròn, thân thắt, đế và số quân. 2D vẫn dùng biểu tượng ngựa để dễ đọc trên màn hình nhỏ.
- Thanh lớn **BẠN CẦM QUÂN · [MÀU]** luôn giữ màu của chính người chơi khi chờ người khác. Thanh **ĐẾN LƯỢT BẠN!** có hướng dẫn gieo/chọn ngựa và nút gieo ngay cạnh bàn.
- Nhãn tên, màu, **BẠN** và **ĐẾN LƯỢT** nằm trên đúng chuồng. Nhãn được chiếu theo camera khi xoay 3D. Quân của bạn có vòng trắng; quân đi được có vòng vàng. Chuồng đang đi có viền sáng.
- Góc nhìn 3D ban đầu quay chuồng của bạn về phía gần; nút đặt lại góc nhìn cũng quay về phía đó. Chơi chung máy ghi rõ tên người đang tới lượt, không gán một người sở hữu toàn bộ bàn.
- Báo lượt bằng thanh sáng và thông báo trong game; âm báo chỉ phát khi đã bật âm thanh. Không lặp báo lượt do cập nhật kết nối; không báo lượt mới khi hoạt ảnh ngựa còn đang chạy.
- Cache PWA tăng lên **2.1.0**. Sau khi thay host, mở game khi có mạng, kết thúc ván đang chơi rồi bấm **Cập nhật** để nhận giao diện mới. Tài nguyên gỗ cũng được lưu offline.

## Những tính năng standalone giữ lại

- Ngựa nhảy **từng ô** theo đúng đường đi; nhấc lên, tiếp đất, đổ bóng và phát tiếng bước chân khi bật âm thanh. Ngựa bị đá bật về bãi. Sự kiện kết nối không dựng lại bàn giữa hoạt ảnh.
- Bàn và quân ngựa **3D WebGL**: hình khối thật, ánh sáng, bóng tiếp xúc, xoay bằng kéo ngang, nút xoay và đặt lại góc nhìn. Chuyển **2D** bất kỳ lúc nào ngoài hoạt ảnh; tự về 2D nếu WebGL không khả dụng.
- PWA có manifest, biểu tượng thường/maskable/iOS, nút **Cài game**, service worker và bộ tài nguyên offline. Chế độ chơi chung máy dùng được offline sau lần tải đầu qua HTTPS.
- Bản host độc lập tại `render-host/host.mjs` chứa toàn bộ game, không cần thư mục `dist` đi kèm. Có cấu hình Render Free và cấu hình trả phí với đĩa lưu phòng.
- Giữ lỗi khởi động đã sửa: nếu hệ điều hành từ chối đọc danh sách mạng, host vẫn chạy và báo cách nhập địa chỉ LAN thủ công.

## Chạy standalone qua Wi-Fi

Máy host cần **Node.js 22+**; điện thoại và máy tham gia chỉ cần trình duyệt. Không cần `npm install`.

1. Giải nén toàn bộ thư mục.
2. Windows: mở `start.bat`. macOS/Linux: chạy `sh start.sh`. Lệnh chung:

   ```sh
   node server.mjs
   ```

3. Máy host mở `http://localhost:3000`, nhập tên và chọn **Tạo phòng mới**.
4. Bạn bè cùng Wi-Fi/LAN mở địa chỉ IP của máy host, ví dụ `http://192.168.1.10:3000`, rồi nhập mã phòng 6 ký tự. Địa chỉ được in trong cửa sổ khởi động nếu hệ thống cho phép đọc danh sách mạng.
5. Khách bấm **Tôi đã sẵn sàng**; chủ phòng bấm **Bắt đầu cuộc đua**. Phòng cho phép 4 người vẫn có thể bắt đầu khi đã có từ 2 người.

Mọi người phải vào **cùng host và cổng**. `localhost` trên điện thoại chỉ trỏ về chính điện thoại; không gửi link localhost cho bạn bè. Nút **Sao chép link mời** gắn sẵn mã phòng khi bạn mở bằng IP LAN hoặc tên miền.

Nếu không vào được: kiểm tra cùng mạng, địa chỉ IPv4 hiện tại của máy host, cổng 3000 qua tường lửa mạng riêng và chế độ cách ly thiết bị trên Wi-Fi khách. Máy host phải còn chạy; IP có thể thay đổi khi đổi mạng.

**PWA trên điện thoại không tự biến điện thoại thành server LAN.** Với bản này, host là tiến trình Node.js trên máy tính/máy chủ. Điện thoại có thể là chủ phòng trong game, còn máy chạy Node.js chịu trách nhiệm lưu và đồng bộ phòng.

## Cài PWA trên điện thoại

| Cách mở game | Chơi nhiều máy | Cài PWA và tải tài nguyên offline |
| --- | --- | --- |
| HTTP tại IP LAN, ví dụ `192.168.1.10:3000` | Có, khi truy cập được máy host | Không đáp ứng yêu cầu secure context tiêu chuẩn cho service worker; dùng trình duyệt. |
| HTTPS của Render hoặc tên miền riêng | Có, qua Internet tới cùng host | Có trên trình duyệt hỗ trợ. |
| `localhost` trên máy đang chạy host | Có tại máy host | Ngoại lệ dành cho phát triển; không áp dụng cho IP LAN trên điện thoại. |

PWA/service worker cần HTTPS hoặc ngoại lệ localhost. Một số trình duyệt cho thêm lối tắt từ HTTP, nhưng lối tắt đó không đồng nghĩa với khả năng offline của PWA. Tham khảo [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

- **Android:** mở địa chỉ HTTPS bằng Chrome/trình duyệt hỗ trợ, bấm **Cài game** hoặc dùng mục cài đặt ứng dụng trong menu.
- **iPhone/iPad:** mở địa chỉ HTTPS trong Safari → **Chia sẻ** → **Thêm vào Màn hình chính**; bật **Mở dưới dạng ứng dụng web** nếu có → **Thêm**.
- Trong lần mở đầu, giữ kết nối tới khi hộp **Cài game** báo đã tải đủ tài nguyên offline.
- Khi offline, chọn **Chơi trên máy này**. Có thể bắt đầu hoặc tiếp tục ván luân phiên đã lưu. **Phòng nhiều thiết bị vẫn cần kết nối tới host**; cài PWA không thay thế kết nối mạng.
- Bản cập nhật được báo qua nút **Cập nhật**. Chỉ áp dụng sau khi kết thúc ván. Khi tự sửa tài nguyên, đổi tên cache trong `dist/sw.js` rồi đóng gói lại host.

## Host Render tách riêng

Mở `render-host/README.md` để xem từng bước. `render-host/host.mjs` là **một tệp thực thi độc lập** đã nhúng giao diện, 3D, PWA, luật và server. Có thể chép duy nhất tệp này sang một thư mục trống rồi chạy:

```sh
node host.mjs
```

Để đưa lên Render, commit mã vào repository Git; Render lấy mã từ repository, không phải kéo thả tệp `.mjs` trực tiếp vào trang chủ. Dùng **Web Service** chạy Node, không dùng Static Site. Nếu repository chứa nguyên dự án này, đặt **Root Directory** là `render-host`; nếu chỉ đưa nội dung thư mục `render-host` vào gốc repository thì để trống.

| Cấu hình | Mục đích | Phòng khi host khởi động lại |
| --- | --- | --- |
| `render-free.yaml` | Thử nghiệm miễn phí | Mất vì chỉ lưu trong RAM; dịch vụ có thể ngủ. |
| `render.yaml` | Host dùng thường xuyên, compute trả phí và đĩa 1 GB | Khôi phục từ `/var/data/rooms.json` trên persistent disk. |

Render Free có thể ngủ sau 15 phút không có lưu lượng đến và không có persistent disk; dữ liệu trong hệ thống tệp tạm không bền qua khởi động lại. Cấu hình trả phí vẫn có thể ngắt kết nối trong bảo trì/deploy; ứng dụng tự nối lại và nạp phòng đã lưu. Chạy **một instance**, chưa có đồng bộ dữ liệu giữa nhiều tiến trình. Xem [Render Free](https://render.com/docs/free), [Persistent Disks](https://render.com/docs/disks), [Node deployment](https://render.com/docs/deploy-node-express-app) và [Blueprint specification](https://render.com/docs/blueprint-spec).

Các tệp chỉ là cấu hình bàn giao; chưa tạo dịch vụ hoặc phát sinh đăng ký Render trong phiên này. Render cấp địa chỉ `https://…onrender.com`; mọi người mở cùng địa chỉ đó để cài PWA và chơi.

## Điều khiển

- Bấm **Gieo xúc xắc**, rồi chọn một ngựa sáng. Rê chuột/đưa tiêu điểm vào ngựa để xem đích đến.
- **3D:** kéo ngang để xoay, dùng nút xoay 45° hoặc nút đặt lại góc nhìn; cuộn chuột thay đổi độ gần trong phạm vi giới hạn.
- **2D:** góc nhìn từ trên xuống, thuận tiện đọc đường đi trên màn hình nhỏ. Hai cách nhìn dùng cùng dữ liệu luật và vị trí.
- **Space:** gieo; **1–4:** chọn ngựa tương ứng. Phím tắt tạm ngừng khi nhập liệu hoặc mở hộp thoại.
- Trên điện thoại, nút gieo cố định phía dưới trong ván. Âm thanh mặc định tắt, có nút bật trên đầu trang.
- Tôn trọng tùy chọn giảm chuyển động của hệ điều hành. Đưa ứng dụng vào nền sẽ hoàn tất hoạt ảnh còn lại để không chặn kết nối khi quay lại.

## Bộ luật được triển khai


Cờ cá ngựa có nhiều giao kèo địa phương. Bản này cố định biến thể **một xúc xắc, ra 1/6, lên chuồng đúng số bậc kế tiếp**; mọi người trong phòng dùng cùng bộ luật.

| Tình huống | Cách xử lý |
| --- | --- |
| Bàn cờ | 56 ô đường đua ngược chiều kim đồng hồ, bốn bãi xuất phát, mỗi màu có sáu ô chuồng riêng. |
| Ra quân | Gieo 1 hoặc 6, đặt một ngựa lên ô mũi tên của mình; không đi thêm số bước sau khi xuất quân. |
| Thêm lượt | Gieo 1 hoặc 6 được gieo lại sau khi đi; vẫn có lượt thêm nếu bị chặn toàn bộ. |
| Đi | Đi đúng số ô. Không vượt qua bất kỳ ngựa nào, kể cả cùng màu. |
| Đá | Đáp đúng ô có ngựa đối thủ sẽ đá ngựa đó về bãi. Ô xuất phát và cửa chuồng cũng có thể bị đá. |
| Quân cùng màu | Không chồng quân, không đá quân mình. |
| Cửa chuồng | Phải dừng đúng cửa sau vòng đua. Không vượt cửa, không chạy vòng thứ hai. |
| Vào chuồng | Từ cửa, gieo số nào vào ô đó nếu đường đi trống. |
| Lên bậc | Khi đã vào chuồng, lên từng bậc bằng đúng số bậc kế tiếp: ô 2 cần gieo 3, ô 3 cần gieo 4. Không vượt ngựa trong chuồng. |
| Xếp đích | Ngựa sâu nhất được cố định lần lượt tại 6, 5, 4, 3. Ngựa cố định không di chuyển nữa. |
| Thắng | Người đầu tiên hoàn tất bốn vị trí 6, 5, 4, 3 thắng và kết thúc ván. |
| Không có nước đi | Tự chuyển lượt, trừ trường hợp đang được lượt thêm vì 1/6. Không tự ý bỏ lượt nếu còn nước đi. |
| Giao kèo khác | Không áp dụng ba lần 6 bị phạt, thầu mạ, sập hầm, ô an toàn hoặc nhảy chắn như một số bản Ludo. |

Tham khảo [luật cờ cá ngựa](https://vi.wikipedia.org/wiki/C%E1%BB%9D_c%C3%A1_ng%E1%BB%B1a). Cách lên chuồng trong bản này được ghi rõ để tránh nhầm giữa các biến thể.

## Phòng, lưu ván và kết nối lại

- Host quyết định xúc xắc và kiểm tra nước đi. Xác thực ghế, kiểm tra lượt và phiên bản bàn cờ; mã thao tác ngăn xử lý lặp do gửi lại yêu cầu.
- Tải lại đúng tab khôi phục ghế. PWA đã cài có thêm phiên tiếp tục trong bộ nhớ trình duyệt, giúp mở lại ứng dụng mà không cần chiếm ghế mới. Tab trình duyệt mới thông thường không tự lấy ghế tab khác.
- Mất mạng ngắn hạn tự kết nối lại. Mất mạng không tự bỏ lượt. Chủ phòng có thể bỏ ghế đã mất kết nối ít nhất 60 giây.
- Rời chủ động được tính bỏ cuộc; quyền chủ phòng chuyển cho người còn lại. Khi chỉ còn một người, người đó thắng. Chủ phòng mở ván mới và khách xác nhận sẵn sàng lại.
- Ván chơi chung máy lưu tại trình duyệt. Xóa dữ liệu trang/ứng dụng sẽ xóa ván và phiên ghế tại máy đó.
- Theo mặc định, phòng online nằm trong RAM và mất khi server dừng. Bật `ROOMS_FILE` để lưu thay đổi phòng, bàn cờ và mã thao tác vào JSON; host khôi phục khi chạy lại. Phòng không hoạt động quá 24 giờ được dọn.
- Không có tài khoản, bot hoặc xếp hạng. Quyền vào ghế phụ thuộc mã phiên tại trình duyệt.

Bật lưu phòng trên macOS/Linux:

```sh
ROOMS_FILE=./.data/rooms.json node server.mjs
```

Windows PowerShell:

```powershell
$env:ROOMS_FILE="./.data/rooms.json"
node server.mjs
```

Tệp lưu chứa mã phiên riêng, đặt ngoài `dist`, không commit hoặc chia sẻ. Nếu snapshot bị hỏng/không tương thích, host dừng để giữ nguyên dữ liệu; sao lưu và khôi phục tệp hợp lệ trước khi chạy lại. Không cho nhiều host cùng ghi một tệp.

## Đổi cổng và Docker

macOS/Linux: `PORT=8080 node server.mjs`. PowerShell: đặt `$env:PORT=8080` rồi chạy `node server.mjs`. Mặc định lắng nghe `0.0.0.0:3000`; Render tự cung cấp `PORT`. `HOST=127.0.0.1` giới hạn truy cập tại máy host.

```sh
docker build -t ca-ngua-club .
docker run --rm -p 3000:3000 ca-ngua-club
```

Dockerfile là lựa chọn thêm; chưa chạy Docker trong phiên kiểm tra. Muốn giữ phòng bằng Docker, gắn volume riêng và đặt `ROOMS_FILE` trỏ vào volume đó.

## Mã nguồn và đóng gói

| Tệp/thư mục | Vai trò |
| --- | --- |
| `dist/index.html`, `style.css`, `app.mjs` | Giao diện, điều khiển và đồng bộ. |
| `dist/engine.mjs` | Luật dùng chung cho local và host. |
| `dist/turn-status.mjs` | Màu ghế, người đang đi, trạng thái kết nối và thông báo lượt. |
| `dist/motion.mjs` | Đường di chuyển, nhảy từng ô và đồng hồ hoạt ảnh. |
| `dist/board3d.mjs`, `geometry.mjs`, `board-art.mjs` | WebGL, quân gỗ, mặt bàn dùng chung, camera. |
| `dist/manifest.webmanifest`, `sw.js`, `pwa.mjs`, `pwa/` | Cài đặt và cache offline. |
| `server.mjs`, `host-core.mjs`, `room-store.mjs` | Khởi động, HTTP/SSE và lưu phòng. |
| `render-host/` | Host một tệp, package, hai cấu hình Render và hướng dẫn. |
| `scripts/build-host.mjs` | Tái tạo host nhúng từ toàn bộ mã hiện tại. |
| `tests/`, `VALIDATION.md` | Kiểm thử và phạm vi đã xác nhận. |
| `start.bat`, `start.sh` | Khởi động Windows và macOS/Linux. |

`dist` đồng thời là mã nguồn frontend và bản sẵn sàng chạy, không cần bundler. Không mở bằng `file://`. Khi sửa mã, sửa các module nguồn rồi tái tạo host:

```sh
node scripts/check.mjs
node scripts/build-host.mjs
node --test tests/engine.test.mjs tests/server.test.mjs tests/pwa-motion.test.mjs tests/embedded-host.test.mjs
```

**33/33 bài kiểm tra thành công** trên Node.js 24.19.0/Linux, gồm 12 ván mô phỏng hoàn chỉnh, HTTP/SSE nhiều phiên, startup, snapshot khôi phục, đường nhảy, hình học/camera 3D, logic cache và host một tệp trong thư mục trống. Xem `VALIDATION.md`; chưa xác nhận hình ảnh WebGL hoặc cài PWA trên điện thoại thật.

## Mỹ thuật và giấy phép

Bàn gỗ ấm, đường đi kem kẻ nâu, bốn chuồng sơn đậm và quân gỗ tròn trong 3D, theo ảnh tham khảo người dùng gửi. WebGL native, không tải thư viện 3D từ CDN. Tọa độ hiển thị lấy từ cùng đường đua/chuồng của bộ luật.

Bản 2.1 dựa vào hướng mỹ thuật trong ảnh bàn Ludo người dùng cung cấp; không nhúng ảnh chụp đó vào ứng dụng. Vân gỗ gốc được tạo riêng và đóng gói tại `dist/assets/walnut.png`; xem `ASSET-NOTES.md`. Icon Lucide và đường nét quân mã dẫn xuất từ DejaVu Sans được ghi nguồn/giấy phép trong `THIRD-PARTY-NOTICES.txt`, đồng thời nhúng vào host độc lập.
