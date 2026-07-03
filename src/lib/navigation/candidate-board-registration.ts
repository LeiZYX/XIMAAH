export const CANDIDATE_BOARD_REGISTRATION_MODULE_TITLE = "Candidate Board Registration";

export const CANDIDATE_BOARD_REGISTRATION_MODULE_DESCRIPTION =
  "Manage each candidate's identity at an exam board — centre number, board candidate number, and UCI. " +
  "This module is not subject exam registration. One student may hold separate identities for Pearson / Edexcel, AQA, Cambridge, and other boards.";

export const CANDIDATE_BOARD_REGISTRATION_TAB = "board-registration";

export const EXAM_BOARD_IDENTITIES_TAB = "exam-board-identities";

export const EXAM_BOARD_IDENTITIES_TAB_TITLE = "Exam Board Identities";

/** @deprecated Use EXAM_BOARD_IDENTITIES_TAB */
export const LEGACY_EXAM_IDENTITIES_TAB = "exam-identities";

export function resolveCandidateDetailTab(
  tab: string | null | undefined,
): typeof EXAM_BOARD_IDENTITIES_TAB | "profile" {
  if (
    tab === EXAM_BOARD_IDENTITIES_TAB ||
    tab === CANDIDATE_BOARD_REGISTRATION_TAB ||
    tab === LEGACY_EXAM_IDENTITIES_TAB
  ) {
    return EXAM_BOARD_IDENTITIES_TAB;
  }
  return "profile";
}

/** @deprecated Use resolveCandidateDetailTab */
export const resolveCandidateBoardRegistrationTab = resolveCandidateDetailTab;
