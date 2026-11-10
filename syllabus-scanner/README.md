# SyllaPlan — AI syllabus scanner

Upload a course syllabus (PDF, photos of the pages, or pasted text) and SyllaPlan uses Claude to pull out every assignment, exam, quiz, and key date, plus the grading breakdown. You review and fix the results, then plan with them.

## Features

- **Scan**: PDF, JPG/PNG/WebP photos (several pages at once), TXT, or pasted text. An optional "first day of term" lets it resolve dates like "Week 5 Thursday".
- **Review & edit**: course info, grading weights (warns if they don't add up to 100%), and every item. Items it couldn't date are highlighted and show the syllabus's original wording.
- **Upcoming**: deadlines across all your courses, grouped into overdue / today / next 7 days / later, with checkboxes to mark items done.
- **Calendar**: month view, color-coded by course.
- **Export**: `.ics` (Google Calendar, Apple Calendar, Outlook) with a reminder the day before, and CSV.
- **Grade calculator**: enter scores per item to see your current weighted grade, and the average you need on the remaining work to hit a target grade.

Everything is stored in your browser (localStorage). Nothing is saved on the server.

## Run it

Requires Node 20+ and an Anthropic API key.

```bash
cd syllabus-scanner
npm install
```

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Open http://localhost:3000.

To try the UI without an API key, run mock mode, which returns a sample syllabus:

```bash
npm run mock
```

### Settings

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Your API key |
| `PORT` | `3000` | Server port |
| `SYLLABUS_MODEL` | `claude-opus-5-5` | Claude model to use |
| `SYLLABUS_MOCK` | unset | Set to `1` for sample data |

## How it works

- `server.js`: Express server. `POST /api/extract` sends the uploaded files to Claude (PDFs as document blocks, photos as image blocks) with structured outputs, so the response always matches the schema in `schema.js`. Server-side refusal fallbacks are turned on (`fallbacks: "default"`).
- `public/`: a plain HTML/CSS/JS front end with no build step.

Word documents aren't read directly. Save them as PDF first.
