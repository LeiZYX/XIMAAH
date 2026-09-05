export const registrationInclude = {
  examSession: {
    include: {
      paper: {
        include: {
          subject: {
            include: {
              qualification: {
                include: { examBoard: true },
              },
            },
          },
        },
      },
      examSeries: true,
    },
  },
  registrationWindow: true,
  examBoard: true,
  examSeries: true,
  subject: { include: { qualification: true } },
  paper: true,
  student: { include: { studentProfile: true } },
  candidate: {
    select: {
      studentId: true,
      candidateType: true,
      chineseName: true,
      examIdentities: {
        select: {
          examBoardId: true,
          uciNumber: true,
        },
      },
    },
  },
  registrationWorkspace: {
    select: {
      id: true,
      registrationNumber: true,
      confirmationNumber: true,
      registrationType: true,
    },
  },
};
