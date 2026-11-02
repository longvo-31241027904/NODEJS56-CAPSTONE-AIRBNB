# Cài từ source sạch (không cần lịch sử cuộc trò chuyện)

1. Cài Node.js24.x/npm11 và MySQL8 local hoặc Docker Desktop nếu chọn Compose. Giải nén source, mở terminal tại package.json, chạy npm ci. Không chép node_modules/dist từ máy khác.
2. Nếu chưa có .env, sao chép .env.example. Không ghi đè file đã có. Đặt JWT_SECRET ngẫu nhiên >=32byte bằng password manager, không dùng ví dụ làm secret production. Đặt PORT=3069, PUBLIC_URL=http://localhost:3069, CORS_ORIGINS là origin frontend, UPLOAD_DIR=uploads/avatars.
3. Chọn đúng một backend database:
   - MySQL80 local: dịch vụ của bạn tại127.0.0.1:3306, đăng nhập quản trị bằng Workbench hoặc mysql CLI --password để hỏi tại máy. Không dùng root chạy backend.
   - Compose: thay MYSQL_PASSWORD/MYSQL_ROOT_PASSWORD trong .env, rồi docker compose up -d --wait mysql. Host Windows truy cập127.0.0.1:3308; @@port trong container vẫn3306. Không xóa named volume nếu đã có dữ liệu.
4. Trong phiên quản trị của lựa chọn trên, chạy scripts/mysql/01-preflight.sql, kiểm tra hai tên airbnb_capstone_local/test. Nếu có sẵn, xác minh ownership trước khi ghi. Dùng bản *.local.sql từ template02 để tạo account local/test riêng, không reset account cũ. Với Compose có thể mở CLI bằng docker compose exec mysql mysql -u root --password, nhập mật khẩu tại máy. Không truyền password qua command line hoặc chat.
5. Cập nhật DATABASE_URL và TEST_DATABASE_URL trong .env bằng hai account riêng; password phải URL-encode. scripts/configure-local-mysql.ps1 hỗ trợ nhập ẩn cho cổng3306. Với3308, sau khi chạy script đó chỉnh riêng số port trong hai URL, không thay phần password đã encode. Không đặt localhost trong container để trỏ container MySQL khác; xem containers.md.
6. Đặt SEED_ALLOW_LOCAL=true, SEED_ADMIN_EMAIL riêng, SEED_ADMIN_PASSWORD/SEED_USER_PASSWORD đủ12–72byte trong .env. Đây chỉ là demo local, không seed lúc production startup. Không có sẵn .env.demo.local trong bản source sạch; file đó chỉ là tài khoản demo máy phát triển, bị gitignore. Bạn tự đặt seed credential của môi trường mình, không dùng signup để tạo ADMIN.

```powershell
npm run prisma:validate
npm run prisma:generate
npm run build
npm run db:verify
npm start
```

db:verify kiểm tra loopback và database_name trước ghi, dùng migrate deploy không shadow, seed2lần và health200. Cần account đủ CREATE/ALTER/INDEX/REFERENCES trên schema, không cần quyền toàn server. Nếu chạy từng bước: npm run db:migrate rồi npm run db:seed, nhưng luôn xác nhận URL trước. Không migrate reset hoặc drop/truncate để chạy test.

Để kiểm thử: xác minh airbnb_capstone_test thuộc project, test account chỉ có quyền trên schema này, đặt TEST_DB_ALLOW_WRITE=true; npm run test:mysql tự migrate test và chỉ cleanup ID tạo trong lượt. Test last-admin yêu cầu schema test không có ADMIN ngoài fixtures của lượt; nếu có sẽ dừng thay vì hạ quyền/xóa account cũ. Dùng schema test riêng, không sửa dữ liệu phát triển để đáp ứng test.

Swagger http://localhost:3069/api/docs. Import hai file docs/postman theo README ở đó. Có thể thử bằng Swagger trước: signin → Authorize → tạo vị trí/phòng bằng ADMIN → đặt phòng → bình luận. Các ví dụ ngày có timezone; không dùng ID seed làm mục tiêu xóa.

Trước deploy: database và account migration/app, secret runtime, TLS nếu hạ tầng yêu cầu, reverse proxy/body-size/timeout, CORS, PUBLIC_URL, ảnh trên volume ghi được/backup. Chỉ cấu hình trust proxy cho proxy tin cậy; không tắt auth/TLS để chạy qua. Xem containers.md cho image/migration target và giới hạn đã kiểm chứng. Link GitHub/deploy/YouTube cần bổ sung sau khi có thật.
