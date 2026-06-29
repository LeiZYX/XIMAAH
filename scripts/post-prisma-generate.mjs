import { writeFileSync } from "node:fs";
import { join } from "node:path";

const enumsPath = join(process.cwd(), "src/generated/prisma/enums.ts");
writeFileSync(enumsPath, 'export * from "./index";\n');
