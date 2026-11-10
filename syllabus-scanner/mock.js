// Sample result used when SYLLABUS_MOCK=1, so the UI can be tried without an API key.
function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mockSyllabus(start) {
  const end = addDays(start, 105);
  return {
    course: {
      title: "Introduction to Psychology",
      code: "PSYC 101",
      instructor: "Dr. A. Rivera",
      email: "instructor@example.edu",
      term: "Sample Term",
      term_start: start,
      term_end: end,
      meeting_times: "Mon/Wed 10:00–11:15",
      location: "Hall B, Room 204",
      office_hours: "Tue 2:00–4:00 pm",
    },
    grading: [
      { category: "Homework", weight: 20, notes: "Lowest score dropped" },
      { category: "Quizzes", weight: 15, notes: null },
      { category: "Midterm Exam", weight: 25, notes: null },
      { category: "Research Paper", weight: 15, notes: null },
      { category: "Final Exam", weight: 25, notes: "Cumulative" },
    ],
    events: [
      { title: "Homework 1", type: "assignment", date: addDays(start, 9), time: "23:59", date_text: "Week 2 Wed", category: "Homework", weight: null, notes: null },
      { title: "Quiz 1", type: "quiz", date: addDays(start, 14), time: "10:00", date_text: "Week 3 Mon", category: "Quizzes", weight: null, notes: "Chapters 1–2" },
      { title: "Last day to drop without a W", type: "deadline", date: addDays(start, 18), time: null, date_text: null, category: null, weight: null, notes: null },
      { title: "Homework 2", type: "assignment", date: addDays(start, 23), time: "23:59", date_text: "Week 4 Wed", category: "Homework", weight: null, notes: null },
      { title: "Quiz 2", type: "quiz", date: addDays(start, 35), time: "10:00", date_text: "Week 6 Mon", category: "Quizzes", weight: null, notes: null },
      { title: "Midterm Exam", type: "exam", date: addDays(start, 44), time: "10:00", date_text: "Week 7 Wed", category: "Midterm Exam", weight: 25, notes: "Chapters 1–6" },
      { title: "Fall break — no class", type: "no_class", date: addDays(start, 49), time: null, date_text: null, category: null, weight: null, notes: null },
      { title: "Paper topic proposal", type: "paper", date: addDays(start, 58), time: "23:59", date_text: null, category: "Research Paper", weight: null, notes: "One paragraph" },
      { title: "Homework 3", type: "assignment", date: addDays(start, 65), time: "23:59", date_text: null, category: "Homework", weight: null, notes: null },
      { title: "Quiz 3", type: "quiz", date: addDays(start, 70), time: "10:00", date_text: null, category: "Quizzes", weight: null, notes: null },
      { title: "Research paper final draft", type: "paper", date: addDays(start, 86), time: "23:59", date_text: null, category: "Research Paper", weight: 15, notes: "2,000 words, APA style" },
      { title: "Reading: Chapter 12", type: "reading", date: null, time: null, date_text: "Before the last week of class", category: null, weight: null, notes: "Couldn't resolve to a specific date" },
      { title: "Final Exam", type: "exam", date: addDays(start, 100), time: "08:00", date_text: "Finals week", category: "Final Exam", weight: 25, notes: "Cumulative" },
    ],
    policies: [
      "Late work loses 10% per day, up to 3 days.",
      "Lowest homework score is dropped.",
      "More than 3 unexcused absences lowers your final grade by one step.",
    ],
  };
}
