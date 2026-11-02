# Đóng gói backend

Dockerfile dùng Node24.14 như máy kiểm thử, npm ci theo lockfile, Prisma generate trước Nest build. Target production chạy user node, không seed, đã prune devDependencies; npm có thể giữ Prisma CLI do peer dependency, nhưng không dựa vào CLI của runtime để migrate. Target migrate giữ CLI để chạy migrate deploy; không giả định CLI còn sau npm prune. .dockerignore loại .env*, node_modules, generated client, upload và tài liệu.

```powershell
docker build --target migrate -t airbnb-migrate .
docker build --target production -t airbnb-backend .
```

Cấp DATABASE_URL runtime qua secret manager hoặc env-file local không đưa vào Git/image. Migration: docker run --rm --env-file .env.container airbnb-migrate. Sau đó chạy app: docker run --rm -p 3069:3069 --env-file .env.container --mount type=volume,source=airbnb_uploads,target=/app/uploads/avatars airbnb-backend. Volume cần ghi được bởi UID/GID node (1000); dữ liệu ảnh phải backup độc lập. Không chạy seed demo khi production startup.

Máy Windows kết nối MySQL80:127.0.0.1:3306. Container backend kết nối MySQL trên Windows:host.docker.internal:3306 (cần server cho phép account/host và network phù hợp, TLS nếu cần). Nếu backend ở cùng Compose với service mysql, hostname phải là mysql:3306, không localhost và không dùng host port3308. Compose hiện tại chỉ có MySQL, vẫn giữ nguyên volume mysql_data, không bổ sung app tự khởi tạo lại database. Muốn cùng network, cấu hình network tường minh cho docker run hoặc file Compose riêng khi triển khai, không xóa volume.

RSA retrieval hiện chỉ bật loopback. Container dùng host/network khác phải có TLS/public-key cấu hình phù hợp trước kết nối; không đổi tài khoản sang authentication yếu để chạy qua. Xem cấu hình driver và hạ tầng trước deploy.

Database deploy phải tồn tại và account migration có đủ quyền trên schema đó. Khi chưa có .env ở build time, generate dùng schema không cần DB; không nhúng URL thật vào build args. PUBLIC_URL là origin công khai, CORS_ORIGINS là frontend được phép. UPLOAD_DIR=/app/uploads/avatars; PORT=3069. Reverse proxy tin cậy/TLS/body-size/timeout và trust proxy phải cấu hình theo hạ tầng, không bật trust proxy bừa. NODE_ENV=production; JWT_SECRET riêng >=32 byte; không dùng demo credentials ở production.

Trạng thái thực tế: đã build target production và migrate, kiểm tra runtime UID1000/không .env/quyền ghi upload, health/Swagger và DB-unavailable503 trong container. Target migration chạy CLI/schema engine bằng migrate diff không kết nối database. Chưa chạy migration từ container vào MySQL thật, chưa kiểm chứng Compose port mapping3308, persistent volume/proxy/TLS production. Compose config --quiet đạt. Không sửa Docker Desktop/backup; không deploy. Image local kiểm tra: airbnb-backend:review và airbnb-migrate:review; chạy lại npm run check:containers sau build để tái kiểm tra.
