import { del } from "@vercel/blob";
import { isNotNull } from "drizzle-orm";

import { db } from "~/server/db";
import { lessons } from "~/server/db/schema";
import { getBlobReadWriteToken } from "~/server/lesson-evidence";

async function main() {
  const rows = await db.query.lessons.findMany({
    columns: {
      evidenceKey: true,
      id: true,
    },
    where: isNotNull(lessons.evidenceKey),
  });

  const blobToken = getBlobReadWriteToken();
  const blobKeys = rows
    .map((row) => row.evidenceKey)
    .filter((value): value is string => Boolean(value));

  if (blobToken && blobKeys.length > 0) {
    await Promise.all(blobKeys.map((blobKey) => del(blobKey, { token: blobToken }).catch(() => null)));
  }

  await db
    .update(lessons)
    .set({
      evidenceKey: null,
      evidenceMime: null,
      evidenceUrl: null,
      updatedAt: new Date(),
    })
    .where(isNotNull(lessons.evidenceKey));

  console.log(`Reset fake lesson evidence for ${rows.length} lesson(s).`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
