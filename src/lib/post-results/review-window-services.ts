import type { PostResultServiceType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { REVIEW_WINDOW_SERVICE_OPTIONS } from "@/lib/post-results/constants";

export async function createDefaultReviewWindowServices(reviewWindowId: string) {
  const serviceTypes = REVIEW_WINDOW_SERVICE_OPTIONS.map((option) => option.value);

  await prisma.reviewWindowService.createMany({
    data: serviceTypes.map((serviceType) => ({
      reviewWindowId,
      serviceType: serviceType as PostResultServiceType,
      enabled: false,
    })),
    skipDuplicates: true,
  });
}

export function assertReviewWindowTimingValid(openAt: Date, closeAt: Date) {
  if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime())) {
    throw new Error("Invalid review window dates");
  }
  if (closeAt <= openAt) {
    throw new Error("Close date must be after open date");
  }
}
