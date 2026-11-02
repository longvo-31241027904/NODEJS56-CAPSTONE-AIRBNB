# Phạm vi API Airbnb và trạng thái triển khai

Nguồn đã xác minh: https://airbnbnew.cybersoft.edu.vn/swagger/v1/swagger.json — Swagger 2.0, 36 thao tác. Snapshot đọc ngày 02/11/2026. Quyền dưới đây là thiết kế dự kiến, không phải kết luận về quyền của server mẫu.

| Nhóm | Method | Path | Tham số ngoài tokenCybersoft |
|---|---|---|---|
| Auth | POST | `/api/auth/signup` | body: model (ThongTinNguoiDung) |
| Auth | POST | `/api/auth/signin` | body: model (DangNhapView) |
| BinhLuan | GET | `/api/binh-luan` |  |
| BinhLuan | POST | `/api/binh-luan` | header: token, body: model (BinhLuanViewModel) |
| BinhLuan | PUT | `/api/binh-luan/{id}` | header: token, path: id, body: model (BinhLuanViewModel) |
| BinhLuan | DELETE | `/api/binh-luan/{id}` | header: token, path: id |
| BinhLuan | GET | `/api/binh-luan/lay-binh-luan-theo-phong/{MaPhong}` | path: MaPhong |
| DatPhong | GET | `/api/dat-phong` |  |
| DatPhong | POST | `/api/dat-phong` | body: model (DatPhongViewModel) |
| DatPhong | GET | `/api/dat-phong/{id}` | path: id |
| DatPhong | PUT | `/api/dat-phong/{id}` | path: id, body: model (DatPhongViewModel) |
| DatPhong | DELETE | `/api/dat-phong/{id}` | path: id |
| DatPhong | GET | `/api/dat-phong/lay-theo-nguoi-dung/{MaNguoiDung}` | path: MaNguoiDung |
| NguoiDung | GET | `/api/users` |  |
| NguoiDung | POST | `/api/users` | body: model (ThongTinNguoiDung) |
| NguoiDung | DELETE | `/api/users` | query: id |
| NguoiDung | GET | `/api/users/phan-trang-tim-kiem` | query: pageIndex, query: pageSize, query: keyword |
| NguoiDung | GET | `/api/users/{id}` | path: id |
| NguoiDung | PUT | `/api/users/{id}` | path: id, body: model (CapNhatNguoiDung) |
| NguoiDung | GET | `/api/users/search/{TenNguoiDung}` | path: TenNguoiDung |
| NguoiDung | POST | `/api/users/upload-avatar` | header: token, formData: formFile |
| Phong | GET | `/api/phong-thue` |  |
| Phong | POST | `/api/phong-thue` | header: token, body: model (PhongViewModel) |
| Phong | GET | `/api/phong-thue/lay-phong-theo-vi-tri` | query: maViTri |
| Phong | GET | `/api/phong-thue/phan-trang-tim-kiem` | query: pageIndex, query: pageSize, query: keyword |
| Phong | GET | `/api/phong-thue/{id}` | path: id |
| Phong | PUT | `/api/phong-thue/{id}` | header: token, path: id, body: model (PhongViewModel) |
| Phong | DELETE | `/api/phong-thue/{id}` | header: token, path: id |
| Phong | POST | `/api/phong-thue/upload-hinh-phong` | header: token, query: maPhong, formData: formFile |
| ViTri | GET | `/api/vi-tri` |  |
| ViTri | POST | `/api/vi-tri` | header: token, body: model (ViTriViewModel) |
| ViTri | GET | `/api/vi-tri/phan-trang-tim-kiem` | query: pageIndex, query: pageSize, query: keyword |
| ViTri | GET | `/api/vi-tri/{id}` | path: id |
| ViTri | PUT | `/api/vi-tri/{id}` | header: token, path: id, body: model (ViTriViewModel) |
| ViTri | DELETE | `/api/vi-tri/{id}` | header: token, path: id |
| ViTri | POST | `/api/vi-tri/upload-hinh-vitri` | header: token, query: maViTri, formData: formFile |

## Trạng thái hiện tại

Đã triển khai và kiểm thử MySQL thật **36/36** thao tác nghiệp vụ; không tính 2 health. Giữ bảng method/path ở trên; không yêu cầu tokenCybersoft. Đối chiếu snapshot đã lưu khi JSON tham khảo không đọc được.

## Quyền áp dụng

- Auth công khai, signup luôn USER và ID do DB sinh.
- User list/search/paging/create/delete ADMIN; detail/update chính chủ hoặc ADMIN. USER không gửi role, PUT không đổi password; avatar cho user đang đăng nhập.
- GET vị trí/phòng công khai; ghi/xóa/upload ADMIN.
- Đặt phòng luôn JWT. GET toàn bộ ADMIN; detail/update/delete/theo-user chính chủ hoặc ADMIN. USER chỉ tạo cho mình, không chuyển đơn sang user khác. ADMIN chọn user tồn tại.
- Hai GET bình luận công khai; POST tác giả khớp JWT kể cả ADMIN. PUT/DELETE tác giả hoặc ADMIN, không đổi tác giả. Public author chỉ id/name/avatar.

## Đặt phòng/Bình luận

DTO trong src/modules-api/stays/stays.dto.ts; controller mô tả request/response/quyền/lỗi. Ngày đặt có timezone, UTC DATETIME(3), tối đa 3 chữ số mili giây. Không cấm quá khứ. Khoảng [ngayDen,ngayDi), liền kề hợp lệ, overlap409. Số khách nguyên dương không vượt sức chứa. PUT partial, id nếu có khớp path, kiểm tra lại FK/quyền/ngày/lịch, loại chính đơn. DELETE vật lý, chưa thanh toán/hoàn tiền/trạng thái mới.

READ COMMITTED, create khóa phòng trước đọc lịch; PUT khóa booking rồi phòng cũ/mới theo ID tăng dần. Đọc lịch sau khóa nhìn thấy commit trước. Tối đa 3 thử khi deadlock/write conflict, SQL tham số hóa. Xem booking.service.ts và README. SQL/seed ghi trực tiếp không tự được schema bảo vệ overlap.

Bình luận trim 1..10000, sao nguyên 1..5. ngayBinhLuan client nhận chuỗi để tương thích nhưng bỏ qua; server tạo ngày, PUT giữ giờ tạo cũ. Không yêu cầu đã ở hoặc giới hạn một bình luận. ID DB sinh, FK xử lý lỗi có kiểm soát.

## Kiểm thử

MySQL thật: hồi quy HTTP/MySQL 36 thao tác cùng bảo vệ ADMIN cuối, đủ36 thao tác. Ba lượt x6 request cùng lịch: mỗi lượt1 thành công5 xung đột và countMySQL đúng1; tạo-vs-PUT một thành công một409; khác phòng2 thành công. Cleanup chỉ ID tạo bởi lượt test. Mock47, smoke và target guard2 báo riêng. Chưa commit/push/deploy/Postman/video.

## Bổ sung bàn giao

ADMIN cuối cùng không được xóa hoặc hạ quyền (409), kể cả thay đổi đồng thời; transaction khóa cùng tập ADMIN và đọc lại count/quyền trước mutation. API không đổi. Postman36 thao tác và mẫu environment: docs/postman; DELETE guard chỉ nhận ID tạo trong demo, chưa chạy collection tự động. Docker packaging và demo theo docs/containers.md, docs/demo.md.
