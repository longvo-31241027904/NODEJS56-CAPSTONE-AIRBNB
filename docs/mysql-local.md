# MySQL80 local: kết quả thiết lập và sử dụng

MySQL80 cổng 3306 đã đăng nhập và xác minh server **8.0.44**. Preflight xác nhận hai schema/tài khoản chưa tồn tại trước khi tạo. Đã tạo airbnb_capstone_local / airbnb_capstone_test, dùng airbnb_local_app / airbnb_test_app; quyền chỉ trên schema tương ứng, không global, GRANT OPTION hoặc DROP. Root chỉ dùng provisioning rồi đóng kết nối; không lưu credential root.

.env chứa DATABASE_URL và TEST_DATABASE_URL với password riêng ngẫu nhiên đã URL-encode; JWT secret được giữ nguyên. .env.demo.local chứa thông tin ADMIN/user demo local để bạn mở xem trên máy; hai file nằm trong pattern gitignore. Không gửi nội dung lên chat/Git. ADMIN đăng nhập qua signin; signup không tạo ADMIN.

`npm run db:verify` đã áp dụng migration không cần shadow (migrate deploy), chạy seed hai lần, kiểm tra 5 bảng/FK, account/password/counts không đổi và database health 200. `npm run test:mysql` dùng database test thật, xác minh đích/account và opt-in trước ghi; cleanup chỉ ID được tạo bởi lượt test, không reset/drop/truncate. `npm run test:db-target` kiểm tra chặn URL dev/host ngoài/account sai/thiếu opt-in.

Adapter chỉ bật allowPublicKeyRetrieval cho loopback để tương thích caching_sha2_password local; không bật cho host từ xa. Lỗi FK MySQL adapter P2039 chỉ ánh xạ 409 khi originalCode nằm trong 1216/1217/1451/1452, không nuốt mọi lỗi server.

Chạy tại project: `npm run build`, `npm run db:verify`, `npm run test:mysql`, rồi `npm start`. Swagger http://localhost:3069/api/docs; health DB /api/health/database. Không cần Docker. Compose cổng 3308, schema/migration và hai backup Docker được giữ nguyên, không sử dụng trong quy trình MySQL80.

Các file scripts/mysql/01-preflight.sql và 02-provision.template.sql giữ làm tài liệu provisioning cho môi trường mới; không chạy lại CREATE USER trên account đã tồn tại và không đổi password hiện hữu. Không dùng root để chạy ứng dụng. Script configure-local-mysql.ps1 chỉ dùng nếu cần nhập lại credential tại máy, không tự tạo/reset tài khoản.
