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
};
