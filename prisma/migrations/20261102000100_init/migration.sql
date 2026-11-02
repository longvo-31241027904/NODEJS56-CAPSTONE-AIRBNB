-- CreateTable
CREATE TABLE `NguoiDung` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    `birthday` DATE NULL,
    `gender` BOOLEAN NOT NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `avatar` VARCHAR(2048) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `NguoiDung_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ViTri` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenViTri` VARCHAR(255) NOT NULL,
    `tinhThanh` VARCHAR(255) NOT NULL,
    `quocGia` VARCHAR(255) NOT NULL,
    `hinhAnh` VARCHAR(2048) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Phong` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tenPhong` VARCHAR(255) NOT NULL,
    `khach` INTEGER NOT NULL,
    `phongNgu` INTEGER NOT NULL,
    `giuong` INTEGER NOT NULL,
    `phongTam` INTEGER NOT NULL,
    `moTa` TEXT NOT NULL,
    `giaTien` INTEGER NOT NULL,
    `mayGiat` BOOLEAN NOT NULL DEFAULT false,
    `banLa` BOOLEAN NOT NULL DEFAULT false,
    `tivi` BOOLEAN NOT NULL DEFAULT false,
    `dieuHoa` BOOLEAN NOT NULL DEFAULT false,
    `wifi` BOOLEAN NOT NULL DEFAULT false,
    `bep` BOOLEAN NOT NULL DEFAULT false,
    `doXe` BOOLEAN NOT NULL DEFAULT false,
    `hoBoi` BOOLEAN NOT NULL DEFAULT false,
    `banUi` BOOLEAN NOT NULL DEFAULT false,
    `maViTri` INTEGER NOT NULL,
    `hinhAnh` VARCHAR(2048) NULL,

    INDEX `Phong_maViTri_idx`(`maViTri`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DatPhong` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maPhong` INTEGER NOT NULL,
    `ngayDen` DATETIME(3) NOT NULL,
    `ngayDi` DATETIME(3) NOT NULL,
    `soLuongKhach` INTEGER NOT NULL,
    `maNguoiDung` INTEGER NOT NULL,

    INDEX `DatPhong_maPhong_ngayDen_ngayDi_idx`(`maPhong`, `ngayDen`, `ngayDi`),
    INDEX `DatPhong_maNguoiDung_idx`(`maNguoiDung`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BinhLuan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `maPhong` INTEGER NOT NULL,
    `maNguoiBinhLuan` INTEGER NOT NULL,
    `ngayBinhLuan` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `noiDung` TEXT NOT NULL,
    `saoBinhLuan` INTEGER NOT NULL,

    INDEX `BinhLuan_maPhong_ngayBinhLuan_idx`(`maPhong`, `ngayBinhLuan`),
    INDEX `BinhLuan_maNguoiBinhLuan_idx`(`maNguoiBinhLuan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Phong` ADD CONSTRAINT `Phong_maViTri_fkey` FOREIGN KEY (`maViTri`) REFERENCES `ViTri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DatPhong` ADD CONSTRAINT `DatPhong_maPhong_fkey` FOREIGN KEY (`maPhong`) REFERENCES `Phong`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DatPhong` ADD CONSTRAINT `DatPhong_maNguoiDung_fkey` FOREIGN KEY (`maNguoiDung`) REFERENCES `NguoiDung`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BinhLuan` ADD CONSTRAINT `BinhLuan_maPhong_fkey` FOREIGN KEY (`maPhong`) REFERENCES `Phong`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BinhLuan` ADD CONSTRAINT `BinhLuan_maNguoiBinhLuan_fkey` FOREIGN KEY (`maNguoiBinhLuan`) REFERENCES `NguoiDung`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
