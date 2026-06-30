import { disconnectPrismaClient, prisma } from "@/lib/prisma";
import { backfillRegistrationNumbers } from "@/lib/registrations/numbering";

async function main() {
  const updated = await backfillRegistrationNumbers();
  console.log(`Backfilled registration numbers for ${updated} workspace(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrismaClient(prisma);
  });
