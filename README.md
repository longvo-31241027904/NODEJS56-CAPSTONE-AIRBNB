# Airbnb Backend

Dự án cuối khóa Node.js xây dựng REST API cho ứng dụng đặt phòng Airbnb.
Hệ thống hỗ trợ xác thực, phân quyền, quản lý người dùng, vị trí, phòng,
đặt phòng và bình luận, kèm tài liệu API tương tác bằng Swagger UI.

**Swagger public:** [Mở tài liệu API](https://nodejs56-capstone-airbnb.onrender.com/api/docs)

## Công nghệ

- **Backend:** NestJS, TypeScript.
- **Dữ liệu:** Prisma ORM, MySQL.
- **Xác thực:** JWT, phân quyền USER/ADMIN.
- **Tài liệu API:** Swagger / OpenAPI.
- **Lưu trữ ảnh:** Cloudinary; hỗ trợ lưu local khi phát triển.
- **Triển khai:** Render cho backend, Aiven cho MySQL.

## Chức năng chính

Tổng cộng **36 thao tác nghiệp vụ**, chia thành 6 nhóm API:

| Nhóm API | Chức năng | Số thao tác |
| --- | --- | ---: |
| Auth | Đăng ký, đăng nhập | 2 |
| Người dùng | Quản lý, tìm kiếm, phân trang và upload avatar | 8 |
| Vị trí | Quản lý, tìm kiếm, phân trang và upload ảnh vị trí | 7 |
| Phòng | Quản lý, tìm kiếm, lọc theo vị trí và upload ảnh phòng | 8 |
| Đặt phòng | Tạo, xem, cập nhật, xóa và tra cứu theo người dùng; kiểm tra lịch trùng | 6 |
| Bình luận | Thêm, sửa, xóa và xem bình luận theo phòng | 5 |

## Chạy local

### Yêu cầu

- Node.js **24.x**, npm **11**.
- MySQL **8.x** đang chạy; database riêng và tài khoản có quyền áp dụng migration.

### Cài đặt và cấu hình

1. Mở terminal tại thư mục chứa `package.json`.
2. Nếu chưa có `.env`, sao chép file mẫu:

   ```sh
   cp .env.example .env
   ```

3. Tạo database MySQL riêng và cập nhật `DATABASE_URL` trong `.env`
   theo host, port, database và tài khoản của bạn; URL-encode ký tự đặc biệt trong mật khẩu.
4. Đặt `JWT_SECRET` ngẫu nhiên tối thiểu 32 byte; giữ `IMAGE_STORAGE=local`
   để chạy local mà không cần cấu hình Cloudinary. Không đưa `.env` lên Git.
5. Cài dependency, generate Prisma Client, áp dụng migration và khởi động:

   ```sh
   npm ci
   npm run prisma:generate
   npm run db:migrate
   npm run build
   npm start
   ```

Swagger local: [http://localhost:3069/api/docs](http://localhost:3069/api/docs)
(với `PORT=3069` mặc định).

## Sử dụng Swagger

1. Gọi `POST /api/auth/signin` bằng tài khoản đã đăng ký.
2. Sao chép `data.token` từ response.
3. Bấm **Authorize**, dán token nguyên bản, không thêm tiền tố `Bearer`.
4. Gọi API được bảo vệ theo quyền của tài khoản; đăng ký mới luôn nhận quyền USER.

## Liên kết

- [Source code trên GitHub](https://github.com/longvo-31241027904/NODEJS56-CAPSTONE-AIRBNB)
- [Postman Collection](docs/postman/airbnb.postman_collection.json)
- [Postman environment local](docs/postman/airbnb.postman_environment.json)
- [Postman environment public](docs/postman/airbnb.render.postman_environment.json)
- [Swagger tham khảo (JSON)](docs/airbnb-reference.swagger.json)

> Render Free có cold start: request đầu tiên sau thời gian không hoạt động có thể phản hồi chậm.
