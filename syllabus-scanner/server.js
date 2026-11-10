import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { SyllabusSchema } from "./schema.js";
import { mockSyllabus } from "./mock.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MOCK = process.env.SYLLABUS_MOCK === "1";
const MODEL = process.env.SYLLABUS_MODEL || "claude-opus-5-5";

const client = MOCK ? null : new Anthropic();
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
});

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SYSTEM_PROMPT = `You read course syllabi and turn them into structured data a student can plan with.

Extract:
- Course details (title, code, instructor, term, meeting times, location, office hours, contact).
- Every graded or scheduled item: assignments, exams, quizzes, projects, papers, labs, presentations, readings with due dates, and key dates such as add/drop deadlines and holidays (no class).
- The grading breakdown: each category and its weight in percent. If the syllabus uses points instead of percentages, convert to percentages of the total.
- Policies worth knowing (late work, attendance, drop-lowest rules) as short one-line notes.

Dates:
- Return dates as YYYY-MM-DD. Infer the year from the term and the reference date you are given.
- If an item is relative ("Week 5 Thursday", "the second lecture after midterm"), resolve it with the term start date when one is provided or stated in the syllabus. If you can't resolve it, set date to null and keep the original wording in date_text.
- Use 24-hour HH:MM for times when the syllabus gives one; otherwise null.
- Recurring items ("weekly quiz every Friday") become one event per occurrence when the term dates are known; otherwise one event with the recurrence in notes.

Link each event to a grading category by its exact category name when it clearly belongs to one. Don't invent items, weights, or dates that the syllabus doesn't support; use null and say so in notes when something is ambiguous.`;

app.use(express.static(path.join(here, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mock: MOCK, model: MODEL });
});

app.post("/api/extract", upload.array("files", 10), async (req, res) => {
  const files = req.files ?? [];
  const pastedText = (req.body?.text ?? "").trim();
  const termStart = (req.body?.termStart ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);

  if (files.length === 0 && !pastedText) {
    return res.status(400).json({ error: "Upload a syllabus file or paste its text." });
  }

  if (MOCK) {
    return res.json({ syllabus: mockSyllabus(termStart || today), mock: true });
  }

  const content = [];
  for (const f of files) {
    if (f.mimetype === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: f.buffer.toString("base64") },
        title: f.originalname,
      });
    } else if (IMAGE_TYPES.has(f.mimetype)) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: f.mimetype, data: f.buffer.toString("base64") },
      });
    } else if (f.mimetype.startsWith("text/") || /\.(txt|md|csv|html?)$/i.test(f.originalname)) {
      content.push({
        type: "document",
        source: { type: "text", media_type: "text/plain", data: f.buffer.toString("utf8") },
        title: f.originalname,
      });
    } else {
      return res.status(415).json({
        error: `Unsupported file type for ${f.originalname}. Use PDF, an image (JPG/PNG/WebP), or plain text. For Word files, save as PDF first.`,
      });
    }
  }
  if (pastedText) {
    content.push({ type: "text", text: `Syllabus text:\n\n${pastedText}` });
  }
  content.push({
    type: "text",
    text: `Reference date (today): ${today}.${termStart ? ` Term start date: ${termStart}.` : ""}\nExtract the syllabus above.`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
      output_config: { effort: "medium", format: betaZodOutputFormat(SyllabusSchema) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") {
      return res.status(422).json({ error: "The model declined to process this document." });
    }
    if (response.stop_reason === "max_tokens") {
      return res.status(422).json({ error: "This syllabus is too long to extract in one pass. Try uploading fewer pages." });
    }
    if (!response.parsed_output) {
      return res.status(502).json({ error: "Couldn't read a structured result from the model. Please try again." });
    }
    res.json({ syllabus: response.parsed_output });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(500).json({ error: "Server is missing a valid ANTHROPIC_API_KEY." });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "Rate limited. Wait a moment and try again." });
    }
    if (err instanceof Anthropic.BadRequestError) {
      return res.status(400).json({ error: `The document couldn't be processed: ${err.message}` });
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Claude API error (${err.status ?? "network"}). Try again.` });
    }
    console.error(err);
    res.status(500).json({ error: "Unexpected server error." });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(413).json({ error: err.code === "LIMIT_FILE_SIZE" ? "Files must be under 25 MB." : err.message });
  }
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Syllabus Scanner running at http://localhost:${PORT}${MOCK ? " (mock mode)" : ""}`);
});
