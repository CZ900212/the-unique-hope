import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { count } from "drizzle-orm";
import { z } from "zod";

const DEFAULT_INPUT_PATH = "imports/student-inquiries.json";
const SOURCE_IP_HASH_PREFIX = "hmac-sha256";
const args = process.argv.slice(2);

const sourceIpHashSchema = z
  .string()
  .trim()
  .regex(
    new RegExp(`^${SOURCE_IP_HASH_PREFIX}:[a-f0-9]{64}$`, "i"),
    `sourceIpHash must use the ${SOURCE_IP_HASH_PREFIX}:<64 hex> format`,
  );

export const inquiryInputSchema = z
  .object({
    sourceSerial: z.string().trim().min(1).max(128),
    sourceSubmittedAt: z.string().trim().min(1),
    sourceIp: z.string().trim().min(1).optional(),
    sourceIpHash: sourceIpHashSchema.optional(),
    sourceRegion: z.string().trim().max(120).optional(),
    sourceChannel: z.string().trim().min(1).max(64),
    studentName: z.string().trim().min(1).max(255),
    gender: z.string().trim().min(1).max(16),
    school: z.string().trim().min(1).max(255),
    grade: z.string().trim().min(1).max(64),
    englishScore: z.string().trim().min(1),
  })
  .superRefine((value, context) => {
    if (!value.sourceIp && !value.sourceIpHash) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either sourceIp or sourceIpHash.",
        path: ["sourceIp"],
      });
    }

    const submittedAt = new Date(value.sourceSubmittedAt);
    if (Number.isNaN(submittedAt.getTime())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "sourceSubmittedAt must be a valid ISO 8601 date-time string.",
        path: ["sourceSubmittedAt"],
      });
    }
  });

export const inquiryBatchSchema = z.union([
  z.array(inquiryInputSchema),
  z.object({
    inquiries: z.array(inquiryInputSchema),
  }),
]);

type InquiryInput = z.infer<typeof inquiryInputSchema>;

type InquiryRecord = {
  sourceSerial: string;
  sourceSubmittedAt: Date;
  sourceIpHash: string;
  sourceRegion: string | null;
  sourceChannel: string;
  studentName: string;
  gender: string;
  school: string;
  grade: string;
  englishScore: string;
};

function getSourceIpHashKey() {
  const key = process.env.STUDENT_INQUIRIES_IP_HASH_KEY?.trim();
  if (!key) {
    throw new Error(
      "STUDENT_INQUIRIES_IP_HASH_KEY is required when importing raw sourceIp values.",
    );
  }

  return key;
}

function resolveInputPath() {
  const inputIndex = args.findIndex((arg) => arg === "--input");

  if (inputIndex >= 0) {
    const value = args[inputIndex + 1];
    if (!value) {
      throw new Error("Missing value for --input.");
    }
    return path.resolve(process.cwd(), value);
  }

  if (process.env.STUDENT_INQUIRIES_FILE) {
    return path.resolve(process.cwd(), process.env.STUDENT_INQUIRIES_FILE);
  }

  return path.resolve(process.cwd(), DEFAULT_INPUT_PATH);
}

function isDryRun() {
  return args.includes("--dry-run");
}

async function loadInquiryBatch(inputPath: string) {
  let rawFile: string;
  try {
    rawFile = await readFile(inputPath, "utf8");
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown file read error while loading import data.";
    throw new Error(
      `Unable to read inquiry import file at ${inputPath}. Put a protected JSON file there or pass --input <path>. ${message}`,
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawFile);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown JSON parse error while loading import data.";
    throw new Error(`Inquiry import file is not valid JSON. ${message}`);
  }

  const parsedBatch = inquiryBatchSchema.parse(parsedJson);
  return Array.isArray(parsedBatch) ? parsedBatch : parsedBatch.inquiries;
}

export function hashSourceIp(sourceIp: string, secretKey: string) {
  return `${SOURCE_IP_HASH_PREFIX}:${createHmac("sha256", secretKey)
    .update(sourceIp.trim())
    .digest("hex")}`;
}

export function normalizeRecord(record: InquiryInput): InquiryRecord {
  const sourceRegion = record.sourceRegion?.trim();
  const normalizedSourceIpHash = record.sourceIpHash?.trim().toLowerCase();
  const hashedSourceIp = record.sourceIp
    ? hashSourceIp(record.sourceIp, getSourceIpHashKey())
    : null;

  if (
    normalizedSourceIpHash &&
    hashedSourceIp &&
    normalizedSourceIpHash !== hashedSourceIp
  ) {
    throw new Error(
      `sourceIpHash does not match sourceIp for source ${record.sourceChannel}::${record.sourceSerial}.`,
    );
  }

  return {
    sourceSerial: record.sourceSerial.trim(),
    sourceSubmittedAt: new Date(record.sourceSubmittedAt),
    sourceIpHash: normalizedSourceIpHash ?? hashedSourceIp!,
    sourceRegion: sourceRegion && sourceRegion.length > 0 ? sourceRegion : null,
    sourceChannel: record.sourceChannel.trim(),
    studentName: record.studentName.trim(),
    gender: record.gender.trim(),
    school: record.school.trim(),
    grade: record.grade.trim(),
    englishScore: record.englishScore.trim(),
  };
}

function assertNoDuplicateSourceKeys(records: InquiryRecord[]) {
  const sourceKeys = new Set<string>();

  for (const record of records) {
    const key = `${record.sourceChannel}::${record.sourceSerial}`;
    if (sourceKeys.has(key)) {
      throw new Error(`Duplicate source key in batch: ${key}`);
    }
    sourceKeys.add(key);
  }
}

async function main() {
  const inputPath = resolveInputPath();
  const dryRun = isDryRun();
  const rawBatch = await loadInquiryBatch(inputPath);
  const inquiryBatch = rawBatch.map(normalizeRecord);

  assertNoDuplicateSourceKeys(inquiryBatch);

  if (dryRun) {
    const uniqueChannels = Array.from(
      new Set(inquiryBatch.map((record) => record.sourceChannel)),
    ).sort();

    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          inputPath,
          attempted: inquiryBatch.length,
          uniqueChannels,
          firstSubmittedAt:
            inquiryBatch[0]?.sourceSubmittedAt.toISOString() ?? null,
          lastSubmittedAt:
            inquiryBatch.at(-1)?.sourceSubmittedAt.toISOString() ?? null,
        },
        null,
        2,
      ),
    );

    return;
  }

  const [{ db, conn }, { studentInquiries }] = await Promise.all([
    import("~/server/db"),
    import("~/server/db/schema"),
  ]);

  try {
    const [existingSummary] = await db
      .select({ total: count() })
      .from(studentInquiries);
    const existingCount = existingSummary?.total ?? 0;

    await db.transaction(async (tx) => {
      for (const record of inquiryBatch) {
        await tx
          .insert(studentInquiries)
          .values({
            sourceSerial: record.sourceSerial,
            sourceSubmittedAt: record.sourceSubmittedAt,
            sourceIpHash: record.sourceIpHash,
            sourceRegion: record.sourceRegion,
            sourceChannel: record.sourceChannel,
            studentName: record.studentName,
            gender: record.gender,
            school: record.school,
            grade: record.grade,
            englishScore: record.englishScore,
          })
          .onConflictDoUpdate({
            target: [
              studentInquiries.sourceChannel,
              studentInquiries.sourceSerial,
            ],
            set: {
              sourceSubmittedAt: record.sourceSubmittedAt,
              sourceIpHash: record.sourceIpHash,
              sourceRegion: record.sourceRegion,
              studentName: record.studentName,
              gender: record.gender,
              school: record.school,
              grade: record.grade,
              englishScore: record.englishScore,
            },
          });
      }
    });

    const [currentSummary] = await db
      .select({ total: count() })
      .from(studentInquiries);
    const totalAfter = currentSummary?.total ?? 0;
    const insertedCount = Math.max(0, totalAfter - existingCount);

    console.log(
      JSON.stringify(
        {
          mode: "import",
          inputPath,
          attempted: inquiryBatch.length,
          existingBefore: existingCount,
          inserted: insertedCount,
          totalAfter,
        },
        null,
        2,
      ),
    );
  } finally {
    await conn.end();
  }
}

const isMainModule =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  await main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
