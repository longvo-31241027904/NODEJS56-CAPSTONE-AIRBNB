# Deploy miễn phí: Render + Aiven MySQL + Cloudinary

Giữ NestJS/Prisma và 36 API hiện tại. Không có tài nguyên trả phí, disk,
bot ping hoặc sao chép database local. Cấu hình mẫu: `render.yaml`.

## Trạng thái đã xác minh

Ngày 2026-11-03: Aiven service Free hiện có đã bật lại, MySQL 8.4.8;
kết nối CA/TLS nghiêm ngặt thành công. Đã tạo mới database
`airbnb_capstone_deploy` và tài khoản riêng, không dùng `avnadmin` chạy app.
Migration CLI và MariaDB adapter đều đã kết nối thật. Bootstrap ADMIN
đã chạy, chạy lại không tạo thêm hoặc đổi mật khẩu. NestJS chạy tại máy
kết nối Aiven thật đã trả200 cho health/database health/ADMIN signin/OpenAPI.
Cloudinary Free đã kiểm thử thật: upload ảnh test, CDN200, thay ảnh dọn
asset cũ và lỗi DB dọn asset mới. Render Free đã public tại https://nodejs56-capstone-airbnb.onrender.com,
health/database/OpenAPI200 và23 kiểm tra HTTPS đầu tiên đạt.

## Database cloud riêng

Không tạo service MySQL thứ hai nếu tài khoản đã có một Free service.
Kiểm tra plan và bật lại service cũ; không đổi mật khẩu, upgrade hoặc sửa
database dự án khác. Free dùng chung CPU/RAM/disk và giới hạn kết nối.

`node scripts/cloud-preflight.cjs` chỉ đọc metadata và TLS, dùng credential
quản trị từ `.env.cloud-provision.local` (ignored). Không in credential.
`CLOUD_PROVISION_NEW=true node scripts/cloud-provision.cjs` chỉ dành cho
namespace hoàn toàn mới: dừng nếu database/user/config đã có. Script lưu
credential app trước DDL; lỗi giữa chừng cần kiểm tra trạng thái, không xóa
database rồi chạy lại. Cấp SELECT/INSERT/UPDATE/DELETE và quyền DDL migration
CREATE/ALTER/INDEX/REFERENCES chỉ trong database Airbnb, REQUIRE SSL;
không global privilege, DROP hoặc GRANT OPTION. Xử lý tên schema theo
`@@partial_revokes` của MySQL để không cấp nhầm pattern có dấu gạch dưới.

Biến local cloud trong `.env.cloud.local`, không ghi đè `.env` local:

- `DATABASE_URL`: URL tài khoản app, credential được URL-encode.
- `DB_TLS_REQUIRED=true`, `DB_CA_CERT_PATH` cho local hoặc
  `DB_CA_CERT_BASE64` cho Render (CA công khai, không phải private key).
- `CLOUD_ALLOW_WRITE=true`, `CLOUD_DB_OWNERSHIP_CONFIRMED=true`,
  `CLOUD_DB_EXPECTED_HOST` đúng host, `CLOUD_DB_EXPECTED_DATABASE=airbnb_capstone_deploy`.

`npm run cloud:prepare` xác minh database thực và Ssl_cipher, sau đó
`prisma migrate deploy`, không shadow/reset/seed local. CA dùng cho cả
adapter và CLI, luôn kiểm tra chứng chỉ và hostname. Chỉ chấp nhận các
query TLS được whitelist; không dùng accept_invalid_certs.

Bootstrap một lần tại máy: `CLOUD_BOOTSTRAP_ADMIN=true` và
`CLOUD_ADMIN_EMAIL` trong file cloud local rồi chạy `cloud:prepare`.
Mật khẩu ngẫu nhiên được hash bcrypt12; credential lưu riêng
`.env.cloud-admin.local` (ignored). Nếu đã có ADMIN thì bỏ qua; không nâng
quyền user có sẵn. Sau đó đặt bootstrap=false, đặc biệt trên Render.
Không chạy `test:mysql`, `db:verify` hoặc seed local trên cloud.

## Cloudinary

Chọn `IMAGE_STORAGE=cloudinary`; điền `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`CLOUDINARY_ASSET_SIGNING_KEY` ngẫu nhiên ổn định >=32 byte.
Không đưa API secret lên Git, Postman, build args hoặc log.
Dashboard có thể yêu cầu chủ tài khoản xác minh trước khi xem secret.

Vẫn dùng formFile/Multer2MiB/Sharp; chỉ JPEG/PNG/WebP không động,
giới hạn pixel và chuyển WebP. Public ID do app sinh trong `airbnb/UUID`.
URL có HMAC nhận dạng asset do app quản lý. Upload mới → ghi DB → dọn
ảnh cũ; lỗi DB thì dọn ảnh mới. Không nhận public_id từ client, không xóa
ảnh cá nhân hoặc asset không có chữ ký hợp lệ. Khóa ký phải giữ ổn định
qua redeploy; xoay khóa làm ảnh cũ không còn đủ điều kiện cleanup tự động.
Local cũ dùng `IMAGE_STORAGE=local`, không cần Cloudinary.

## Render Web Service Free

1. New Web Service, public repository của project, nhánh main; Node runtime.
2. Instance Free, không disk; build `npm ci --include=dev && npm run prisma:generate && npm run build`.
3. Start `npm run cloud:start`; Node24, NODE_ENV=production.
   Giữ dev dependencies vì migration CLI/tsx cần lúc start.
4. Điền các biến TLS/đích cloud ở trên và Cloudinary, JWT_SECRET riêng;
   CLOUD_BOOTSTRAP_ADMIN=false. Không dùng credential quản trị Aiven.
5. Sau khi Render cấp hostname HTTPS, đặt PUBLIC_URL đúng origin,
   CORS_ORIGINS là các origin frontend được phép (không `*`). Swagger
   cùng origin hoạt động khi không có frontend. App nghe 0.0.0.0 và PORT.
6. Giữ TRUST_PROXY_HOPS=0 trên service này. Rate limiter chỉ khi RENDER=true
   dùng CF-Connecting-IP do Cloudflare ghi đè tại Render public ingress;
   header thiếu/không hợp lệ thì fallback socket/IP. Local bỏ qua header này.
   Không trust proxy=true hoặc dùng entry XFF đầu tiên từ client.
   Rate limiter trong RAM, reset khi restart, chưa dùng chung nhiều instance.
7. Healthcheck `/api/health`; kiểm tra riêng `/api/health/database` phải200.
   Swagger `/api/docs`, JSON `/api/docs-json`.

`cloud:start` chạy migration đã có trước khi nghe HTTP. Script xác minh
quyền sở hữu/TLS trước ghi; không tự bootstrap ADMIN trên mỗi deploy.
Không dùng production Docker target hiện tại cho quy trình native Node này.

## Kiểm chứng và giới hạn

`npm run test:cloud-prep` là **mock** Cloudinary và kiểm tra config TLS.
Live migration Aiven không đồng nghĩa đã thử toàn bộ API hoặc Cloudinary.
Sau deploy phải thử signup/signin/USER/ADMIN, vị trí→phòng→booking→comment,
lịch trùng, sai quyền, upload, tải ảnh sau redeploy. Chỉ cleanup ID/asset
do chính lần kiểm chứng tạo. Không chạy script test có cleanup local lên deploy.

Chỉ cập nhật Postman public environment bằng hostname Render đã xác minh;
mọi credential/token trong mẫu để trống. Không tạo link public dự đoán.

Render Free có cold start sau khi ngủ, filesystem tạm và hạn mức sử dụng;
Aiven Free chia sẻ 1GB disk/1GB RAM/1CPU, max_connections76 và có thể bị
power off do không hoạt động. Cloudinary có quota credits/storage/bandwidth.
Không hứa miễn phí vô hạn hoặc uptime production. Không nâng cấp tự động.

Nguồn chính thức: [Render Free](https://render.com/docs/free),
[Aiven MySQL Free](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier),
[Prisma MySQL TLS](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql),
[Cloudinary Node](https://cloudinary.com/documentation/node_image_and_video_upload).

## Kiểm chứng public có journal riêng

`CLOUD_PUBLIC_VERIFY=true node scripts/verify-public.cjs prepare` đọc
PUBLIC_URL trong .env.cloud.local, tạo fixture riêng và lưu journal ignored
.env.cloud-verification.local. Nếu journal đã có thì dừng trước ghi.
Sau khi redeploy thành công, chạy cùng opt-in với mode `after-redeploy`:
kiểm tra ảnh/DB còn tồn tại rồi cleanup đúng ID và marker, theo thứ tự FK,
chỉ xóa Cloudinary asset có HMAC hợp lệ của lượt này. Nếu lỗi giữa chừng,
kiểm tra journal trước; không reset hoặc chạy lại prepare để ghi đè nó.

Rate limit ingress: [Render edge architecture](https://render.com/articles/how-render-handles-ddos-attacks),
[Cloudflare request headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/).
Chỉ áp dụng CF-Connecting-IP khi public ingress do Render quản lý; nếu đổi
host hoặc thêm đường đi trực tiếp thì phải xem lại giả định này.
