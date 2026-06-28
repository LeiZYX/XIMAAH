-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `studentNo` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NOT NULL DEFAULT 'STUDENT',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_phone_key`(`phone`),
    UNIQUE INDEX `User_studentNo_key`(`studentNo`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetToken` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PasswordResetToken_tokenHash_key`(`tokenHash`),
    INDEX `PasswordResetToken_userId_idx`(`userId`),
    INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `studentNo` VARCHAR(191) NOT NULL,
    `currentGrade` VARCHAR(191) NOT NULL,
    `currentClassName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'GRADUATED', 'LEFT', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `entryYear` INTEGER NULL,
    `graduationYear` INTEGER NULL,
    `graduatedAt` DATETIME(3) NULL,
    `leftAt` DATETIME(3) NULL,
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StudentProfile_userId_key`(`userId`),
    UNIQUE INDEX `StudentProfile_studentNo_key`(`studentNo`),
    INDEX `StudentProfile_currentGrade_idx`(`currentGrade`),
    INDEX `StudentProfile_currentClassName_idx`(`currentClassName`),
    INDEX `StudentProfile_status_idx`(`status`),
    INDEX `StudentProfile_studentNo_idx`(`studentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Candidate` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentHubCandidateNumber` VARCHAR(191) NOT NULL,
    `candidateType` ENUM('INTERNAL', 'EXTERNAL') NOT NULL,
    `userId` VARCHAR(191) NULL,
    `studentNumber` VARCHAR(191) NULL,
    `englishName` VARCHAR(191) NOT NULL,
    `chineseName` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `gender` VARCHAR(191) NULL,
    `idNumber` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `schoolName` VARCHAR(191) NULL,
    `grade` VARCHAR(191) NULL,
    `className` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'GRADUATED', 'LEFT', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `loginEnabled` BOOLEAN NOT NULL DEFAULT false,
    `sourceSystem` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Candidate_userId_key`(`userId`),
    INDEX `Candidate_candidateType_idx`(`candidateType`),
    INDEX `Candidate_status_idx`(`status`),
    INDEX `Candidate_assessmentHubCandidateNumber_idx`(`assessmentHubCandidateNumber`),
    INDEX `Candidate_studentNumber_idx`(`studentNumber`),
    INDEX `Candidate_englishName_idx`(`englishName`),
    INDEX `Candidate_grade_idx`(`grade`),
    INDEX `Candidate_className_idx`(`className`),
    INDEX `Candidate_externalId_idx`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CandidateExamIdentity` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `centreNumber` VARCHAR(191) NULL,
    `boardCandidateNumber` VARCHAR(191) NULL,
    `uci` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CandidateExamIdentity_candidateId_idx`(`candidateId`),
    INDEX `CandidateExamIdentity_examBoardId_idx`(`examBoardId`),
    INDEX `CandidateExamIdentity_boardCandidateNumber_idx`(`boardCandidateNumber`),
    UNIQUE INDEX `CandidateExamIdentity_candidateId_examBoardId_key`(`candidateId`, `examBoardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TeacherAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `teacherId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TeacherAssignment_teacherId_idx`(`teacherId`),
    INDEX `TeacherAssignment_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `TeacherAssignment_teacherId_subjectId_key`(`teacherId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationWindow` (
    `id` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `startAt` DATETIME(3) NOT NULL,
    `endAt` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'OPEN', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationWindow_examBoardId_idx`(`examBoardId`),
    INDEX `RegistrationWindow_examSeriesId_idx`(`examSeriesId`),
    INDEX `RegistrationWindow_status_idx`(`status`),
    INDEX `RegistrationWindow_startAt_endAt_idx`(`startAt`, `endAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationWorkspace` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `lockedAt` DATETIME(3) NULL,
    `lastAdjustedByUserId` VARCHAR(191) NULL,
    `lastAdjustedByRole` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NULL,
    `lastAdjustedAt` DATETIME(3) NULL,
    `lastAdjustmentReason` VARCHAR(191) NULL,
    `lastAdjustmentSummary` VARCHAR(191) NULL,
    `hasPostLockAdjustment` BOOLEAN NOT NULL DEFAULT false,
    `isLateRegistration` BOOLEAN NOT NULL DEFAULT false,
    `registrationSource` ENUM('STUDENT_SUBMITTED', 'TEACHER_REQUEST_APPROVED', 'EO_ASSISTED', 'ADMIN_ASSISTED', 'EO_FORCED_INTERNAL', 'ADMIN_FORCED_INTERNAL', 'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT', 'EXTERNAL_CANDIDATE') NOT NULL DEFAULT 'STUDENT_SUBMITTED',
    `visibility` ENUM('STUDENT_AND_TEACHER', 'STUDENT_ONLY', 'EXAM_OFFICE_ONLY') NOT NULL DEFAULT 'STUDENT_AND_TEACHER',
    `billingScope` ENUM('NORMAL_BILLING', 'OFFICE_ONLY_BILLING', 'NO_BILLING', 'MANUAL_REVIEW') NOT NULL DEFAULT 'NORMAL_BILLING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationWorkspace_candidateId_idx`(`candidateId`),
    INDEX `RegistrationWorkspace_studentId_idx`(`studentId`),
    INDEX `RegistrationWorkspace_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `RegistrationWorkspace_hasPostLockAdjustment_idx`(`hasPostLockAdjustment`),
    INDEX `RegistrationWorkspace_registrationSource_idx`(`registrationSource`),
    INDEX `RegistrationWorkspace_visibility_idx`(`visibility`),
    INDEX `RegistrationWorkspace_billingScope_idx`(`billingScope`),
    UNIQUE INDEX `RegistrationWorkspace_candidateId_registrationWindowId_key`(`candidateId`, `registrationWindowId`),
    UNIQUE INDEX `RegistrationWorkspace_studentId_registrationWindowId_key`(`studentId`, `registrationWindowId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentExamRegistration` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `registrationWorkspaceId` VARCHAR(191) NULL,
    `examSessionId` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `paperId` VARCHAR(191) NOT NULL,
    `studentNameSnapshot` VARCHAR(191) NOT NULL,
    `studentNoSnapshot` VARCHAR(191) NOT NULL,
    `gradeSnapshot` VARCHAR(191) NOT NULL,
    `classNameSnapshot` VARCHAR(191) NOT NULL,
    `emailSnapshot` VARCHAR(191) NULL,
    `phoneSnapshot` VARCHAR(191) NULL,
    `assessmentHubCandidateNumberSnapshot` VARCHAR(191) NULL,
    `candidateTypeSnapshot` ENUM('INTERNAL', 'EXTERNAL') NULL,
    `status` ENUM('ACTIVE', 'CANCELLED', 'LOCKED') NOT NULL DEFAULT 'ACTIVE',
    `lockedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `registrationSource` ENUM('STUDENT_SUBMITTED', 'TEACHER_REQUEST_APPROVED', 'EO_ASSISTED', 'ADMIN_ASSISTED', 'EO_FORCED_INTERNAL', 'ADMIN_FORCED_INTERNAL', 'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT', 'EXTERNAL_CANDIDATE') NOT NULL DEFAULT 'STUDENT_SUBMITTED',
    `visibility` ENUM('STUDENT_AND_TEACHER', 'STUDENT_ONLY', 'EXAM_OFFICE_ONLY') NOT NULL DEFAULT 'STUDENT_AND_TEACHER',
    `billingScope` ENUM('NORMAL_BILLING', 'OFFICE_ONLY_BILLING', 'NO_BILLING', 'MANUAL_REVIEW') NOT NULL DEFAULT 'NORMAL_BILLING',
    `addedByUserId` VARCHAR(191) NULL,
    `addedByRole` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NULL,
    `addedAt` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentExamRegistration_candidateId_idx`(`candidateId`),
    INDEX `StudentExamRegistration_studentId_idx`(`studentId`),
    INDEX `StudentExamRegistration_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
    INDEX `StudentExamRegistration_examSessionId_idx`(`examSessionId`),
    INDEX `StudentExamRegistration_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `StudentExamRegistration_examBoardId_idx`(`examBoardId`),
    INDEX `StudentExamRegistration_examSeriesId_idx`(`examSeriesId`),
    INDEX `StudentExamRegistration_subjectId_idx`(`subjectId`),
    INDEX `StudentExamRegistration_status_idx`(`status`),
    INDEX `StudentExamRegistration_registrationSource_idx`(`registrationSource`),
    INDEX `StudentExamRegistration_visibility_idx`(`visibility`),
    INDEX `StudentExamRegistration_billingScope_idx`(`billingScope`),
    INDEX `StudentExamRegistration_gradeSnapshot_classNameSnapshot_idx`(`gradeSnapshot`, `classNameSnapshot`),
    INDEX `StudentExamRegistration_studentNoSnapshot_idx`(`studentNoSnapshot`),
    UNIQUE INDEX `StudentExamRegistration_candidateId_examSessionId_key`(`candidateId`, `examSessionId`),
    UNIQUE INDEX `StudentExamRegistration_studentId_examSessionId_key`(`studentId`, `examSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWorkspaceId` VARCHAR(191) NULL,
    `candidateId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `registrationId` VARCHAR(191) NULL,
    `examSessionId` VARCHAR(191) NOT NULL,
    `action` ENUM('ADD', 'REMOVE', 'SUBMIT', 'UPDATE', 'CANCEL', 'LOCK', 'ADMIN_ADJUST', 'STUDENT_ADD', 'STUDENT_REMOVE', 'STUDENT_SUBMIT', 'SYSTEM_LOCK', 'EO_ADD_AFTER_LOCK', 'EO_REMOVE_AFTER_LOCK', 'EO_REPLACE_AFTER_LOCK', 'ADMIN_ADD_AFTER_LOCK', 'ADMIN_REMOVE_AFTER_LOCK', 'ADMIN_REPLACE_AFTER_LOCK', 'TEACHER_CHANGE_REQUEST', 'TEACHER_REQUEST_APPROVED', 'TEACHER_REQUEST_REJECTED', 'TEACHER_LATE_REGISTRATION_REQUEST', 'TEACHER_LATE_REGISTRATION_APPROVED', 'TEACHER_LATE_REGISTRATION_REJECTED', 'EO_LATE_REGISTRATION_CREATED', 'ADMIN_LATE_REGISTRATION_CREATED', 'EO_ASSISTED_REGISTRATION_CREATED', 'ADMIN_ASSISTED_REGISTRATION_CREATED', 'EO_OFFICE_ONLY_REGISTRATION_CREATED', 'ADMIN_OFFICE_ONLY_REGISTRATION_CREATED', 'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT', 'STUDENT_REGISTRATION_SUBMITTED', 'EXTERNAL_CANDIDATE_REGISTRATION_CREATED') NOT NULL,
    `performedById` VARCHAR(191) NOT NULL,
    `performedByRole` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `beforeValue` VARCHAR(191) NULL,
    `afterValue` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `registrationSource` ENUM('STUDENT_SUBMITTED', 'TEACHER_REQUEST_APPROVED', 'EO_ASSISTED', 'ADMIN_ASSISTED', 'EO_FORCED_INTERNAL', 'ADMIN_FORCED_INTERNAL', 'EO_POST_LOCK_ADJUSTMENT', 'ADMIN_POST_LOCK_ADJUSTMENT', 'EXTERNAL_CANDIDATE') NULL,
    `visibility` ENUM('STUDENT_AND_TEACHER', 'STUDENT_ONLY', 'EXAM_OFFICE_ONLY') NULL,
    `billingScope` ENUM('NORMAL_BILLING', 'OFFICE_ONLY_BILLING', 'NO_BILLING', 'MANUAL_REVIEW') NULL,
    `assessmentHubCandidateNumberSnapshot` VARCHAR(191) NULL,
    `candidateTypeSnapshot` ENUM('INTERNAL', 'EXTERNAL') NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RegistrationAuditLog_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
    INDEX `RegistrationAuditLog_candidateId_idx`(`candidateId`),
    INDEX `RegistrationAuditLog_studentId_idx`(`studentId`),
    INDEX `RegistrationAuditLog_registrationId_idx`(`registrationId`),
    INDEX `RegistrationAuditLog_examSessionId_idx`(`examSessionId`),
    INDEX `RegistrationAuditLog_performedById_idx`(`performedById`),
    INDEX `RegistrationAuditLog_performedAt_idx`(`performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationChangeRequest` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWorkspaceId` VARCHAR(191) NULL,
    `registrationWindowId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `candidateId` VARCHAR(191) NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `requestedByRole` ENUM('ADMIN', 'EXAM_OFFICER', 'SUBJECT_TEACHER', 'STUDENT') NOT NULL,
    `requestType` ENUM('ADD_EXAM', 'REMOVE_EXAM', 'REPLACE_EXAM', 'LATE_REGISTRATION') NOT NULL,
    `targetExamSessionId` VARCHAR(191) NULL,
    `targetRegistrationId` VARCHAR(191) NULL,
    `replacementExamSessionId` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RegistrationChangeRequest_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
    INDEX `RegistrationChangeRequest_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `RegistrationChangeRequest_candidateId_idx`(`candidateId`),
    INDEX `RegistrationChangeRequest_studentId_idx`(`studentId`),
    INDEX `RegistrationChangeRequest_requestedByUserId_idx`(`requestedByUserId`),
    INDEX `RegistrationChangeRequest_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RegistrationChangeRequestExamSession` (
    `id` VARCHAR(191) NOT NULL,
    `changeRequestId` VARCHAR(191) NOT NULL,
    `examSessionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RegistrationChangeRequestExamSession_changeRequestId_idx`(`changeRequestId`),
    INDEX `RegistrationChangeRequestExamSession_examSessionId_idx`(`examSessionId`),
    UNIQUE INDEX `RegistrationChangeRequestExamSession_changeRequestId_examSes_key`(`changeRequestId`, `examSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamBoard` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `calendarSubjectFilterEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ExamBoard_code_key`(`code`),
    INDEX `ExamBoard_country_idx`(`country`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Qualification` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Qualification_examBoardId_idx`(`examBoardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `qualificationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subject_qualificationId_idx`(`qualificationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CalendarSubjectSelection` (
    `id` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CalendarSubjectSelection_examBoardId_idx`(`examBoardId`),
    INDEX `CalendarSubjectSelection_subjectId_idx`(`subjectId`),
    UNIQUE INDEX `CalendarSubjectSelection_examBoardId_subjectId_key`(`examBoardId`, `subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Paper` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `subjectId` VARCHAR(191) NOT NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Paper_subjectId_idx`(`subjectId`),
    INDEX `Paper_sourceDocumentId_idx`(`sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamSeries` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExamSeries_examBoardId_idx`(`examBoardId`),
    INDEX `ExamSeries_year_idx`(`year`),
    INDEX `ExamSeries_sourceDocumentId_idx`(`sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExamSession` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `startTime` VARCHAR(191) NULL,
    `endTime` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `venue` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `paperId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExamSession_paperId_idx`(`paperId`),
    INDEX `ExamSession_examSeriesId_idx`(`examSeriesId`),
    INDEX `ExamSession_date_idx`(`date`),
    INDEX `ExamSession_sourceDocumentId_idx`(`sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KeyDate` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `type` ENUM('DEADLINE', 'RESULTS', 'REGISTRATION', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `description` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `examBoardId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `examSeriesId` VARCHAR(191) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `KeyDate_date_idx`(`date`),
    INDEX `KeyDate_examBoardId_idx`(`examBoardId`),
    INDEX `KeyDate_subjectId_idx`(`subjectId`),
    INDEX `KeyDate_examSeriesId_idx`(`examSeriesId`),
    INDEX `KeyDate_sourceDocumentId_idx`(`sourceDocumentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Resource` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `url` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NULL,
    `type` ENUM('SYLLABUS', 'SPECIFICATION', 'PAST_PAPER', 'MARK_SCHEME', 'GUIDE', 'LINK', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `language` VARCHAR(191) NULL,
    `examBoardId` VARCHAR(191) NULL,
    `qualificationId` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,
    `paperId` VARCHAR(191) NULL,
    `examSeriesId` VARCHAR(191) NULL,
    `sourceDocumentId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Resource_examBoardId_idx`(`examBoardId`),
    INDEX `Resource_qualificationId_idx`(`qualificationId`),
    INDEX `Resource_subjectId_idx`(`subjectId`),
    INDEX `Resource_paperId_idx`(`paperId`),
    INDEX `Resource_examSeriesId_idx`(`examSeriesId`),
    INDEX `Resource_sourceDocumentId_idx`(`sourceDocumentId`),
    INDEX `Resource_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SourceDocument` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `type` ENUM('EXAM_TIMETABLE', 'KEY_DATES', 'REGISTRATION', 'RESULTS', 'SYLLABUS', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `sourceUrl` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `fileHash` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `fetchedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `examBoardId` VARCHAR(191) NULL,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SourceDocument_examBoardId_idx`(`examBoardId`),
    INDEX `SourceDocument_uploadedById_idx`(`uploadedById`),
    INDEX `SourceDocument_type_idx`(`type`),
    INDEX `SourceDocument_publishedAt_idx`(`publishedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeRule` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `examBoardId` VARCHAR(191) NOT NULL,
    `examSeriesId` VARCHAR(191) NOT NULL,
    `qualificationId` VARCHAR(191) NOT NULL,
    `subjectId` VARCHAR(191) NULL,
    `paperId` VARCHAR(191) NULL,
    `examSessionId` VARCHAR(191) NULL,
    `entryType` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL DEFAULT 'NORMAL',
    `costCurrency` ENUM('GBP', 'CNY') NOT NULL,
    `costAmount` DECIMAL(12, 2) NOT NULL,
    `exchangeRateToCny` DECIMAL(12, 4) NULL,
    `markupType` ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'MANUAL') NOT NULL,
    `markupValue` DECIMAL(12, 2) NULL,
    `salesCurrency` ENUM('GBP', 'CNY') NOT NULL,
    `salesAmount` DECIMAL(12, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FeeRule_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `FeeRule_examBoardId_idx`(`examBoardId`),
    INDEX `FeeRule_examSeriesId_idx`(`examSeriesId`),
    INDEX `FeeRule_qualificationId_idx`(`qualificationId`),
    INDEX `FeeRule_subjectId_idx`(`subjectId`),
    INDEX `FeeRule_paperId_idx`(`paperId`),
    INDEX `FeeRule_examSessionId_idx`(`examSessionId`),
    INDEX `FeeRule_entryType_idx`(`entryType`),
    INDEX `FeeRule_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ExchangeRate` (
    `id` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `baseCurrency` ENUM('GBP', 'CNY') NOT NULL,
    `targetCurrency` ENUM('GBP', 'CNY') NOT NULL,
    `rate` DECIMAL(12, 4) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ExchangeRate_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `ExchangeRate_baseCurrency_targetCurrency_idx`(`baseCurrency`, `targetCurrency`),
    INDEX `ExchangeRate_effectiveDate_idx`(`effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeStatement` (
    `id` VARCHAR(191) NOT NULL,
    `candidateId` VARCHAR(191) NULL,
    `studentId` VARCHAR(191) NULL,
    `registrationWorkspaceId` VARCHAR(191) NOT NULL,
    `registrationWindowId` VARCHAR(191) NOT NULL,
    `statementNo` VARCHAR(191) NOT NULL,
    `displayCurrency` ENUM('GBP', 'CNY', 'BOTH') NOT NULL DEFAULT 'BOTH',
    `exchangeRateSnapshot` DECIMAL(12, 4) NULL,
    `studentNameSnapshot` VARCHAR(191) NOT NULL,
    `studentNoSnapshot` VARCHAR(191) NOT NULL,
    `gradeSnapshot` VARCHAR(191) NOT NULL,
    `classNameSnapshot` VARCHAR(191) NOT NULL,
    `emailSnapshot` VARCHAR(191) NULL,
    `assessmentHubCandidateNumberSnapshot` VARCHAR(191) NULL,
    `candidateTypeSnapshot` ENUM('INTERNAL', 'EXTERNAL') NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PAID', 'CANCELLED', 'REVISED', 'NEEDS_REVIEW') NOT NULL DEFAULT 'DRAFT',
    `totalGbpAmount` DECIMAL(12, 2) NOT NULL,
    `totalCnyAmount` DECIMAL(12, 2) NOT NULL,
    `paymentNotes` VARCHAR(191) NULL,
    `generatedByUserId` VARCHAR(191) NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `issuedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FeeStatement_statementNo_key`(`statementNo`),
    INDEX `FeeStatement_candidateId_idx`(`candidateId`),
    INDEX `FeeStatement_studentId_idx`(`studentId`),
    INDEX `FeeStatement_registrationWorkspaceId_idx`(`registrationWorkspaceId`),
    INDEX `FeeStatement_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `FeeStatement_status_idx`(`status`),
    INDEX `FeeStatement_statementNo_idx`(`statementNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeStatementItem` (
    `id` VARCHAR(191) NOT NULL,
    `feeStatementId` VARCHAR(191) NOT NULL,
    `examSessionId` VARCHAR(191) NULL,
    `examBoardSnapshot` VARCHAR(191) NOT NULL,
    `qualificationSnapshot` VARCHAR(191) NOT NULL,
    `subjectSnapshot` VARCHAR(191) NOT NULL,
    `paperCodeSnapshot` VARCHAR(191) NOT NULL,
    `paperTitleSnapshot` VARCHAR(191) NOT NULL,
    `entryTypeSnapshot` ENUM('NORMAL', 'LATE', 'HIGH_LATE') NOT NULL,
    `costCurrencySnapshot` ENUM('GBP', 'CNY') NOT NULL,
    `costAmountSnapshot` DECIMAL(12, 2) NOT NULL,
    `exchangeRateSnapshot` DECIMAL(12, 4) NULL,
    `markupTypeSnapshot` ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'MANUAL') NOT NULL,
    `markupValueSnapshot` DECIMAL(12, 2) NULL,
    `salesGbpAmountSnapshot` DECIMAL(12, 2) NOT NULL,
    `salesCnyAmountSnapshot` DECIMAL(12, 2) NOT NULL,
    `displayCurrencySnapshot` ENUM('GBP', 'CNY', 'BOTH') NOT NULL,
    `lineTotalGbp` DECIMAL(12, 2) NOT NULL,
    `lineTotalCny` DECIMAL(12, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FeeStatementItem_feeStatementId_idx`(`feeStatementId`),
    INDEX `FeeStatementItem_examSessionId_idx`(`examSessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeeAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `action` ENUM('FEE_RULE_CREATED', 'FEE_RULE_UPDATED', 'EXCHANGE_RATE_UPDATED', 'FEE_STATEMENT_GENERATED', 'FEE_STATEMENT_BATCH_GENERATED', 'FEE_STATEMENT_PRINTED', 'FEE_SUMMARY_EXPORTED', 'FEE_DETAILS_EXPORTED') NOT NULL,
    `registrationWindowId` VARCHAR(191) NULL,
    `performedByUserId` VARCHAR(191) NOT NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `metadata` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,

    INDEX `FeeAuditLog_registrationWindowId_idx`(`registrationWindowId`),
    INDEX `FeeAuditLog_performedByUserId_idx`(`performedByUserId`),
    INDEX `FeeAuditLog_action_idx`(`action`),
    INDEX `FeeAuditLog_performedAt_idx`(`performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PasswordResetToken` ADD CONSTRAINT `PasswordResetToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentProfile` ADD CONSTRAINT `StudentProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Candidate` ADD CONSTRAINT `Candidate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidateExamIdentity` ADD CONSTRAINT `CandidateExamIdentity_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CandidateExamIdentity` ADD CONSTRAINT `CandidateExamIdentity_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_teacherId_fkey` FOREIGN KEY (`teacherId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TeacherAssignment` ADD CONSTRAINT `TeacherAssignment_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWindow` ADD CONSTRAINT `RegistrationWindow_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWindow` ADD CONSTRAINT `RegistrationWindow_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWindow` ADD CONSTRAINT `RegistrationWindow_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWorkspace` ADD CONSTRAINT `RegistrationWorkspace_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWorkspace` ADD CONSTRAINT `RegistrationWorkspace_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWorkspace` ADD CONSTRAINT `RegistrationWorkspace_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationWorkspace` ADD CONSTRAINT `RegistrationWorkspace_lastAdjustedByUserId_fkey` FOREIGN KEY (`lastAdjustedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_registrationWorkspaceId_fkey` FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentExamRegistration` ADD CONSTRAINT `StudentExamRegistration_addedByUserId_fkey` FOREIGN KEY (`addedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_registrationWorkspaceId_fkey` FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_registrationId_fkey` FOREIGN KEY (`registrationId`) REFERENCES `StudentExamRegistration`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationAuditLog` ADD CONSTRAINT `RegistrationAuditLog_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_registrationWorkspaceId_fkey` FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_targetExamSessionId_fkey` FOREIGN KEY (`targetExamSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_replacementExamSessionId_fkey` FOREIGN KEY (`replacementExamSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequest` ADD CONSTRAINT `RegistrationChangeRequest_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequestExamSession` ADD CONSTRAINT `RegistrationChangeRequestExamSession_changeRequestId_fkey` FOREIGN KEY (`changeRequestId`) REFERENCES `RegistrationChangeRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RegistrationChangeRequestExamSession` ADD CONSTRAINT `RegistrationChangeRequestExamSession_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Qualification` ADD CONSTRAINT `Qualification_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarSubjectSelection` ADD CONSTRAINT `CalendarSubjectSelection_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CalendarSubjectSelection` ADD CONSTRAINT `CalendarSubjectSelection_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paper` ADD CONSTRAINT `Paper_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paper` ADD CONSTRAINT `Paper_sourceDocumentId_fkey` FOREIGN KEY (`sourceDocumentId`) REFERENCES `SourceDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSeries` ADD CONSTRAINT `ExamSeries_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSeries` ADD CONSTRAINT `ExamSeries_sourceDocumentId_fkey` FOREIGN KEY (`sourceDocumentId`) REFERENCES `SourceDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExamSession` ADD CONSTRAINT `ExamSession_sourceDocumentId_fkey` FOREIGN KEY (`sourceDocumentId`) REFERENCES `SourceDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeyDate` ADD CONSTRAINT `KeyDate_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeyDate` ADD CONSTRAINT `KeyDate_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeyDate` ADD CONSTRAINT `KeyDate_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KeyDate` ADD CONSTRAINT `KeyDate_sourceDocumentId_fkey` FOREIGN KEY (`sourceDocumentId`) REFERENCES `SourceDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Resource` ADD CONSTRAINT `Resource_sourceDocumentId_fkey` FOREIGN KEY (`sourceDocumentId`) REFERENCES `SourceDocument`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SourceDocument` ADD CONSTRAINT `SourceDocument_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SourceDocument` ADD CONSTRAINT `SourceDocument_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_examBoardId_fkey` FOREIGN KEY (`examBoardId`) REFERENCES `ExamBoard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_examSeriesId_fkey` FOREIGN KEY (`examSeriesId`) REFERENCES `ExamSeries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_qualificationId_fkey` FOREIGN KEY (`qualificationId`) REFERENCES `Qualification`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_paperId_fkey` FOREIGN KEY (`paperId`) REFERENCES `Paper`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeRule` ADD CONSTRAINT `FeeRule_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeRate` ADD CONSTRAINT `ExchangeRate_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ExchangeRate` ADD CONSTRAINT `ExchangeRate_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_candidateId_fkey` FOREIGN KEY (`candidateId`) REFERENCES `Candidate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_registrationWorkspaceId_fkey` FOREIGN KEY (`registrationWorkspaceId`) REFERENCES `RegistrationWorkspace`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatement` ADD CONSTRAINT `FeeStatement_generatedByUserId_fkey` FOREIGN KEY (`generatedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatementItem` ADD CONSTRAINT `FeeStatementItem_feeStatementId_fkey` FOREIGN KEY (`feeStatementId`) REFERENCES `FeeStatement`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeStatementItem` ADD CONSTRAINT `FeeStatementItem_examSessionId_fkey` FOREIGN KEY (`examSessionId`) REFERENCES `ExamSession`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeAuditLog` ADD CONSTRAINT `FeeAuditLog_registrationWindowId_fkey` FOREIGN KEY (`registrationWindowId`) REFERENCES `RegistrationWindow`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeeAuditLog` ADD CONSTRAINT `FeeAuditLog_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
