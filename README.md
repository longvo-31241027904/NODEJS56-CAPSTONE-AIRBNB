# Backend Airbnb — NestJS / Prisma / MySQL

Đã có code và kiểm thử MySQL thật **36/36 thao tác nghiệp vụ**; không tính hai health. Đã có Postman Collection v2.1, environment mẫu và hướng dẫn demo; chưa deploy public hoặc quay video demo. Không yêu cầu tokenCybersoft.

Hướng dẫn từ source sạch: [docs/setup.md](docs/setup.md).

## Chạy trên máy hiện tại

Node.js24, npm11, MySQL80 phiên bản8.0.44 tại127.0.0.1:3306. Hai tài khoản/database dev/test riêng đã cấu hình trong .env (gitignore), không dùng root chạy ứng dụng. ADMIN/user demo local nằm ở .env.demo.local; chỉ mở xem tại máy, không đưa file/password lên chat/Git. Signup luôn USER; ADMIN phải signin bằng account seed.

```powershell
npm ci
npm run prisma:generate
npm run build
npm run db:verify
npm start
```

Swagger http://localhost:3069/api/docs; JSON /api/docs-json. Health /api/health; database /api/health/database truy vấn thật (200 hoặc503). Ctrl+C đóng Prisma pool. Môi trường mới: xem docs/mysql-local.md, .env.example và SQL preflight trước ghi schema có sẵn. JWT_SECRET ngẫu nhiên>=32byte; không ghi đè secret cũ. db:verify dùng migrate deploy không shadow, seed hai lần kiểm tra accounts/password/counts không đổi, không reset dữ liệu.

Compose giữ nguyên tại cổng3308 như lựa chọn riêng. MySQL80 hiện tại không cần Docker; hai backup runtime Docker không bị sửa.

## Thử luồng Swagger

1. POST /api/auth/signin, nhập data.token vào Authorize (không thêm Bearer). API cũng nhận Authorization: Bearer; hai header khác nhau trả401. JWT HS256 hạn1giờ; quyền đọc lại DB, không refresh token.
2. GET /api/phong-thue công khai, chọn id/sức chứa.
3. POST /api/dat-phong với maPhong, maNguoiDung, soLuongKhach, ngayDen/ngayDi có timezone (ví dụ2040-01-10T07:00:00+07:00). USER chỉ tạo cho mình; ADMIN được chọn user tồn tại. ID do DB sinh.
4. GET /api/dat-phong/lay-theo-nguoi-dung/{MaNguoiDung} hoặc /api/dat-phong/{id}; chính chủ/ADMIN. GET toàn bộ đơn chỉ ADMIN.
5. POST /api/binh-luan: maPhong, maNguoiBinhLuan bằng JWT user id, noiDung, saoBinhLuan1..5. Ngày do server xác định. Không yêu cầu đã ở hoặc giới hạn một bình luận. PUT/DELETE chỉ tác giả/ADMIN, không chuyển tác giả.

## Hợp đồng

Success {status,statusCode,data}; lỗi {status,statusCode,message}. POST tạo/upload201, signin và GET/PUT/DELETE200. Lỗi dự kiến400/401/403/404/409, upload413/415, rate limit signin429. Không trả stack, connection string hoặc password hash; tác giả bình luận công khai chỉ id/name/avatar.

DTO whitelist, từ chối trường thừa; không implicit boolean conversion. PUT nhận partial trường hợp lệ; body id nếu có phải khớp path, không đổi PK. Phân trang pageIndex/pageSize/keyword mặc định1/10, max pageSize100, order id tăng. User PUT không đổi password; USER không gửi role. ADMIN chỉ được hạ quyền/xóa ADMIN khi còn ADMIN khác; ADMIN cuối trả409, khóa trong transaction và có test cạnh tranh. Birthday DATE, YYYY-MM-DD thật từ1900 đến hôm nay. Password tạo user12..72ký tự và<=72byte UTF-8. Giá integer VND không âm, khach>0; phòng ngủ/giường/tắm>=0; banLa và banUi riêng.

## Lịch đặt và quyền

Ngày đặt là ISO-8601 có timezone, tối đa3 chữ số mili giây, chuẩn hóa UTC DATETIME(3). ngayDen<ngayDi; soLuongKhach nguyên dương<=sức chứa. Không cấm quá khứ. Khoảng nửa mở [ngayDen,ngayDi): hai đơn liền kề được phép. Overlap khi existing.ngayDen<requested.ngayDi và existing.ngayDi>requested.ngayDen, trả409. PUT kiểm tra lại quyền/ngày/phòng/user/sức chứa/lịch, loại chính đơn khỏi overlap. DELETE xóa vật lý, chưa thêm thanh toán/hoàn tiền/trạng thái hủy.

Đặt phòng luôn yêu cầu JWT; toàn bộ danh sách ADMIN, còn detail/update/delete/theo-user chính chủ hoặc ADMIN. USER không được chuyển đơn cho user khác. Bình luận POST tác giả phải khớp JWT kể cả ADMIN; PUT không chuyển tác giả. noiDung trim1..10000, sao nguyên1..5. ngayBinhLuan request nhận chuỗi để tương thích nhưng bỏ qua; server tạo ngày, PUT giữ nguyên ngày cũ. Không yêu cầu đã ở/giới hạn một bình luận.

## Transaction và khóa

Xem src/modules-api/stays/booking.service.ts. READ COMMITTED; create khóa hàng Phong bằng SELECT ... FOR UPDATE trước đọc overlap và insert. PUT/DELETE khóa DatPhong trước, đọc lại đơn và quyền; khóa phòng cũ/mới theo ID tăng dần, kiểm tra lịch sau khóa. READ COMMITTED nhìn thấy commit của holder trước khi chờ khóa xong. SQL raw tham số hóa; tối đa3 lần thử khi P2034 hoặc MySQL1213/1205, hết lượt trả409.

Mọi ghi lịch ứng dụng phải đi qua service này. Schema/index không tự chống overlap nếu ghi SQL/seed bên ngoài. Không khẳng định mọi tải production đã được kiểm chứng. FK RESTRICT giữ lịch sử liên quan; xóa bị chặn trả409.

## Upload và source

ImageStorage dùng chung avatar/phòng/vị trí: Multer memory2MiB; giải mã JPEG/PNG/WebP không động<=16triệu pixel, chuyển WebP UUID. Multipart formFile, upload phòng thêm query maPhong, vị trí maViTri. Kiểm tra quyền/record trước lưu; commit DB trước dọn ảnh cũ; lỗi DB dọn file mới, chỉ xóa file app quản lý. UPLOAD_DIR mặc định uploads/avatars, prefix /uploads/avatars/ giữ tương thích. PUBLIC_URL đúng domain. Local upload cần persistent volume; Render Free dùng IMAGE_STORAGE=cloudinary với TLS Aiven và không dùng disk tạm để lưu ảnh. Upload không đưa Git.

common chứa config/guard/filter/interceptor/helper; modules-system/prisma quản lý DB/shutdown; modules-api/users/catalog/stays chứa nghiệp vụ. Kế thừa tổ chức Nest gateway và Multer Express từ source học tập. Không thêm Redis/microservices/ORM khác. Giữ schema/migration gốc, RSA retrieval chỉ bật loopback.

## Kiểm thử và tài liệu

```powershell
npm run build
npm run test:mysql
npm run test:auth-users
npm run test:smoke
npm run test:db-target
```

MySQL thật: hồi quy HTTP/MySQL 36 thao tác cùng bảo vệ ADMIN cuối, phủ36 thao tác, gồm hồi quy25 trước và11 mới. Ba vòng6 request cùng phòng/lịch: mỗi vòng1 thành công5 xung đột, countDB đúng1. Tạo-vs-PUT:1 thành công1 xung đột; phòng độc lập2 thành công. Bao gồm overlap/adjacency/timezone/ownership/FK/upload, dọn ảnh mới khi DB thất bại. Test chỉ dùng airbnb_capstone_test với opt-in; xác minh đích/account trước ghi, cleanup chỉ ID của lượt, không drop/truncate/reset/schema khác.

Mock riêng: test:auth-users47 kiểm tra, không coi là MySQL. Smoke kiểm tra Swagger38 thao tác (36nghiệp vụ+2health), CORS và DB503. Guard test2ca chặn đích không an toàn.

Chi tiết36endpoint: docs/api-scope.md. Swagger UI tham khảo truy cập được nhưng JSON không đọc được bằng web tool trong lượt này; dùng docs/airbnb-reference.swagger.json đã lưu.

## Chuẩn bị nộp còn lại

Postman collection và hướng dẫn demo đã có trong docs/. Các bước còn lại: rà soát môi trường deploy/TLS/proxy/secret/backup DB và ảnh, quản lý task theo yêu cầu lớp, deploy khi được yêu cầu và quay video YouTube. Đủ36endpoint chưa đồng nghĩa hoàn thành các phần nộp bài này. Chưa deploy public.


## Bàn giao và các kiểm tra mới

- Bảo vệ ADMIN cuối: transaction READ COMMITTED khóa các hàng ADMIN theo ID tăng dần trước count và update/delete; đọc lại quyền actor. Tối đa 3 thử deadlock, không nâng quyền công khai. Test chỉ thay đổi fixtures trong database test; không đụng tài khoản phát triển.
- db:verify xác minh loopback/schema, không so sánh client port với @@port: mapping host3308 → server3306 hợp lệ. Test độc lập bao phủ port mapping; chưa chạy Docker thật.
- `npm run format` và `npm run format:check`: Prettier cho source/script/config, bỏ qua generated client/lockfile/snapshot. `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` kiểm tra import/code thừa.
- `npm run check:postman`: đối chiếu36method/path, JSON và script syntax; chưa chạy collection end-to-end. Collection/Environment trong docs/postman, import và đọc docs/postman/README.md. Không tự chạy trên database phát triển.
- Dockerfile/.dockerignore và hướng dẫn docs/containers.md: migration target giữ CLI, production non-root, không seed; persistent volume ảnh và hostname container khác Windows. Đã build hai target và chạy container smoke non-root; chưa migrate MySQL thật từ container hoặc kiểm chứng Compose port mapping.
- Kịch bản quay/demo: docs/demo.md. Repository: https://github.com/longvo-31241027904/NODEJS56-CAPSTONE-AIRBNB . Chưa có link deploy/YouTube; chỉ bổ sung khi có thật.

Kiểm tra đóng gói thực tế: `npm run check:containers` đạt (sau build hai image local review); migrate CLI/schema engine chạy offline, runtime health/Swagger/DB503 đạt. Chưa triển khai public, chưa thử migration live từ container. Audit production0; audit toàn bộ còn9 cảnh báo trong dev dependencies, không dùng audit fix --force đổi major.

## Deploy Render Free / Aiven / Cloudinary

Xem [docs/deploy-free.md](docs/deploy-free.md) và render.yaml. Đã thử kết nối TLS, migration và bootstrap ADMIN trên database Aiven riêng; đã kiểm thử Cloudinary Free thật (upload/CDN/replace/rollback); chưa xác nhận deploy public. Cấu hình cloud trong .env.cloud.local, credential ADMIN trong .env.cloud-admin.local (đều Git ignore); giữ nguyên .env local. `test:cloud-prep` là kiểm tra mock/config, không thay thế kiểm chứng cloud thật.
