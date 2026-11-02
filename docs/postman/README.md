# Postman — review thủ công

Import airbnb.postman_collection.json và airbnb.postman_environment.json. Chọn environment mẫu; baseUrl mặc định http://localhost:3069. Tại máy nhập adminEmail/adminPassword của ADMIN seed và demoPassword riêng (12–72 ký tự, <=72 byte). Không export environment có secret/token; bản mẫu không có credential thật.

Chạy các folder theo thứ tự Auth → Users → Vị trí → Phòng → Đặt phòng → Bình luận, sau cùng Cleanup. Signin lưu token và actorId, tạo dữ liệu lưu userId/locationId/roomId/bookingId/commentId. Chọn file JPEG/PNG/WebP <=2MiB cho formFile trước mỗi upload, không gửi request upload trống. Ảnh phòng query maPhong; ảnh vị trí maViTri. Avatar là tài khoản đang signin; thử trên account demo phù hợp.

DELETE kiểm tra ID nằm trong danh sách created_*Ids thu từ response201 của chính phiên demo; thiếu ID/ID seed tự nhập sẽ skipRequest. Cleanup xóa bình luận → đơn → phòng → vị trí → user. Signup tạo thêm một USER khác với user quản lý: nếu cần dọn USER signup, chọn đúng ID đã tạo trong created_userIds làm userId và gửi lại DELETE users; guard vẫn kiểm tra ownership của lượt. Không đặt ID seed làm mục tiêu xóa.

Trước phiên demo mới, xóa collection variables token/IDs/demoRunId/created_*Ids để không dùng marker của phiên cũ. Có thể import lại collection gốc để có state trống. Không tự động chạy Runner/Newman trên database phát triển. Nếu tự viết runner, bắt buộc trỏ database test riêng đã xác minh, cleanup chỉ dữ liệu của lượt chạy. Collection này chỉ kiểm tra tĩnh, chưa chạy end-to-end bằng Postman/Newman.

Thử lỗi riêng (không thuộc luồng happy-path): gender="false" hoặc số khách0 →400; bỏ token ở API bảo vệ →401; dùng JWT USER gọi ghi phòng →403; gửi lại POST đặt cùng phòng/cùng lịch →409. Hai đơn [10,12) và [12,14) được phép. Tạo trước khi xem/sửa/xóa, tránh gọi lại POST thành công ngoài ý muốn. Bản mẫu dùng ngày2040 có timezone; nếu đặt trùng ngoài ý muốn hãy đổi khoảng ngày hoặc tạo phòng demo mới.

Kiểm tra file: npm run check:postman. Điều này không chứng minh collection chạy trên server; kiểm thử HTTP/MySQL tự động của project là npm run test:mysql.

Public Render Free: import `airbnb.render.postman_environment.json` với baseUrl đã kiểm chứng HTTPS. Credential/token mẫu để trống; chỉ nhập tại máy. Collection có thao tác tạo/xóa: không chạy toàn bộ collection trên deploy khi chưa xem guards và phạm vi fixture.
