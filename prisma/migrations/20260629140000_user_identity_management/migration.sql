-- CreateTable
CREATE TABLE `TeacherProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `visibleGrades` JSON NULL,
    `visibleClasses` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TeacherProfile_userId_key`(`userId`),
    INDEX `TeacherProfile_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` ENUM('USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'STUDENT_IMPORTED', 'TEACHER_IMPORTED', 'STUDENT_PROMOTED', 'STUDENT_ARCHIVED') NOT NULL,
    `targetUserId` VARCHAR(191) NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserAuditLog_action_idx`(`action`),
    INDEX `UserAuditLog_targetUserId_idx`(`targetUserId`),
    INDEX `UserAuditLog_performedById_idx`(`performedById`),
    INDEX `UserAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TeacherProfile` ADD CONSTRAINT `TeacherProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAuditLog` ADD CONSTRAINT `UserAuditLog_targetUserId_fkey` FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserAuditLog` ADD CONSTRAINT `UserAuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
