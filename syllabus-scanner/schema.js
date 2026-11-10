import { z } from "zod";

export const EVENT_TYPES = [
  "assignment",
  "exam",
  "quiz",
  "project",
  "paper",
  "lab",
  "presentation",
  "reading",
  "deadline",
  "no_class",
  "other",
];

const nullableString = z.string().nullable();

export const SyllabusSchema = z.object({
  course: z.object({
    title: z.string().describe("Course title, e.g. Introduction to Psychology"),
    code: nullableString.describe("Course code, e.g. PSYC 101"),
    instructor: nullableString,
    email: nullableString,
    term: nullableString.describe("e.g. Fall 2026"),
    term_start: nullableString.describe("YYYY-MM-DD if known"),
    term_end: nullableString.describe("YYYY-MM-DD if known"),
    meeting_times: nullableString,
    location: nullableString,
    office_hours: nullableString,
  }),
  grading: z
    .array(
      z.object({
        category: z.string(),
        weight: z.number().nullable().describe("Percent of final grade, 0-100"),
        notes: nullableString.describe("e.g. lowest score dropped"),
      }),
    )
    .describe("Grading breakdown categories"),
  events: z.array(
    z.object({
      title: z.string(),
      type: z.enum(EVENT_TYPES),
      date: nullableString.describe("YYYY-MM-DD, or null if it can't be resolved"),
      time: nullableString.describe("HH:MM 24-hour, or null"),
      date_text: nullableString.describe("Original date wording from the syllabus"),
      category: nullableString.describe("Matching grading category name, if any"),
      weight: z.number().nullable().describe("Percent of final grade for this single item, if stated"),
      notes: nullableString,
    }),
  ),
  policies: z.array(z.string()).describe("Short one-line policy notes"),
});
