# Demo cuối khóa (khoảng 8–12 phút)

1. Giới thiệu NestJS/TypeScript, Prisma/MySQL, modules-api/modules-system/common, 5 bảng và quan hệ. Không mở .env hoặc file password khi quay.
2. Signup luôn USER; signin lấy JWT, Authorize trong Swagger. Minh họa USER gọi ghi vị trí bị403, ADMIN seed signin quản lý được. Last-admin DELETE/hạ quyền trả409.
3. Tạo vị trí và phòng tên demo mới, tìm kiếm/phân trang, cập nhật, upload formFile; mở URL ảnh. Giữ ID của bản ghi demo, không dùng ID seed để xóa.
4. USER đặt phòng cho mình, xem đơn theo user. Gửi lại cùng lịch409, lịch liền kề được phép. Token user khác không xem/sửa đơn. Giải thích READ COMMITTED, khóa phòng, thứ tự khóa và test đồng thời MySQL.
5. Tạo bình luận, đọc công khai không contact details, sửa/xóa đúng tác giả hoặc ADMIN; giả mạo tác giả bị403. Không yêu cầu đã ở theo phạm vi bài.
6. Giới thiệu schema/FK RESTRICT, kết quả npm run test:mysql, mock báo riêng và test bảo vệ đích. Mở Postman mẫu, giải thích ID capture/DELETE guard. Dọn dữ liệu demo theo thứ tự bình luận, đơn, phòng, vị trí, user.

Trước nộp: bổ sung link GitHub thực, URL deploy thực, link YouTube thực và tài liệu Postman. Repository đã có tại https://github.com/longvo-31241027904/NODEJS56-CAPSTONE-AIRBNB . Link deploy và YouTube vẫn cần bổ sung khi có thật. Chuẩn bị secret, database, TLS/proxy, backup DB/ảnh và persistent volume; chỉ deploy/push khi được yêu cầu.
