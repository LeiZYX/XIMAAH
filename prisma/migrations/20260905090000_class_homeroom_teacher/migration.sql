-- Class form teachers (班主任) + student adjustment routing + staff email toggle

ALTER TABLE `SystemEmailSettings`
  ADD COLUMN `notifyStaffStudentAdjustment` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `StudentNotificationLog`
  MODIFY COLUMN `type` ENUM(
    'REG_LOCKED',
    'FEE_ISSUED',
    'REG_UPDATED',
    'FEE_PAID',
    'STUDENT_ADJUSTMENT_TEACHER_REVIEWED'
  ) NOT NULL;

CREATE TABLE `ClassHomeroomTeacher` (
  `id` VARCHAR(191) NOT NULL,
  `grade` ENUM('G9', 'G10', 'G11', 'G12') NOT NULL,
  `className` VARCHAR(191) NOT NULL,
  `teacherUserId` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `ClassHomeroomTeacher_grade_className_key` ON `ClassHomeroomTeacher`(`grade`, `className`);
CREATE INDEX `ClassHomeroomTeacher_teacherUserId_idx` ON `ClassHomeroomTeacher`(`teacherUserId`);
CREATE INDEX `ClassHomeroomTeacher_grade_idx` ON `ClassHomeroomTeacher`(`grade`);

ALTER TABLE `ClassHomeroomTeacher`
  ADD CONSTRAINT `ClassHomeroomTeacher_teacherUserId_fkey`
    FOREIGN KEY (`teacherUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `StudentAdjustmentRequest`
  ADD COLUMN `primaryHomeroomTeacherId` VARCHAR(191) NULL,
  ADD COLUMN `studentGradeSnapshot` ENUM('G9', 'G10', 'G11', 'G12') NULL,
  ADD COLUMN `studentClassNameSnapshot` VARCHAR(191) NULL;

CREATE INDEX `StudentAdjustmentRequest_primaryHomeroomTeacherId_idx` ON `StudentAdjustmentRequest`(`primaryHomeroomTeacherId`);
CREATE INDEX `StudentAdjustmentRequest_studentGradeSnapshot_idx` ON `StudentAdjustmentRequest`(`studentGradeSnapshot`);

ALTER TABLE `StudentAdjustmentRequest`
  ADD CONSTRAINT `StudentAdjustmentRequest_primaryHomeroomTeacherId_fkey`
    FOREIGN KEY (`primaryHomeroomTeacherId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
