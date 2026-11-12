/** All the app's encouragement lives here so the tone stays consistent. No guilt, only real wins get celebrated. */

export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

const QUOTES = [
  "Small reps, done daily, beat big plans done once.",
  "You do not need a perfect day. You need a finished one.",
  "The work you log today is the proof you show yourself later.",
  "Momentum is built one boring, finished task at a time.",
  "Start before you feel ready. Readiness shows up after you begin.",
  "Consistency is quiet. It still wins loudly.",
  "Every send, every scout, every report is a vote for the person you are becoming.",
  "Hard days count the most. Do the minimum, then decide about more.",
  "Progress you can see is progress you will keep.",
  "A streak is just a promise you keep to yourself, again.",
  "Do the next right thing. Then the next one.",
  "You are closer than the version of you from last month would believe.",
  "Done is a feeling worth chasing. Go and get it.",
  "Nobody ever regretted finishing their list.",
  "Focus on the next hour. The month takes care of itself.",
  "Your future self is cheering for what you do in the next ten minutes.",
  "Be proud of showing up. The results follow the showing up.",
  "Skill is just repetition that nobody quit on.",
  "One more outreach is one more chance. Take the chance.",
  "Today's effort is tomorrow's easy.",
  "You have already done harder things than your to-do list.",
  "Good habits are built on days you almost skipped.",
  "Keep the promise. Keep the streak. Keep going.",
  "The goal is not to feel motivated. The goal is to move.",
  "Win the morning, and the day tends to follow.",
  "Real growth looks like ordinary days, repeated.",
  "You are building something. Lay one more brick.",
  "Tired is allowed. Quitting is optional.",
  "Make today count by finishing what you started.",
  "A little progress today still beats a perfect plan tomorrow.",
];

export function quoteFor(seed: number, dayOfYear: number): string {
  return QUOTES[(seed * 7 + dayOfYear) % QUOTES.length];
}

export function greeting(name: string, hour: number): string {
  const first = name.split(" ")[0];
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

export function todayNudge(pct: number, allMet: boolean, due: boolean): string {
  if (!due) return "Rest day. Enjoy it. Log anything you want, it all counts.";
  if (allMet) return "All targets done. That is a win. Enjoy the rest of your day.";
  if (pct === 0) return "A fresh page. Log your first one and the rest gets easier.";
  if (pct < 50) return "You are on the board. Keep stacking them.";
  if (pct < 100) return "More than halfway. The finish line is in sight.";
  return "Nearly there.";
}

export function streakLine(streak: number): string {
  if (streak === 0) return "Start a streak today. It begins with one finished day.";
  if (streak === 1) return "Day 1. Every streak starts here.";
  return `${streak} days in a row. Keep it alive.`;
}

export function milestoneLine(streak: number): string {
  if (streak >= 100) return `${streak} days. That is rare. Be proud.`;
  if (streak >= 30) return `${streak} days in a row. This is who you are now.`;
  if (streak >= 14) return `${streak} days in a row. Two weeks of showing up.`;
  if (streak >= 7) return `${streak} days in a row. A full week of keeping your word.`;
  return `${streak} days in a row. The habit is forming.`;
}

export function taskDoneLine(label: string): string {
  return `${label} target hit. Nice work.`;
}

export function allDoneLine(streak: number): string {
  return streak > 1 ? `Everything done today. Streak: ${streak} days.` : "Everything done today. Your streak has started.";
}

export function freshStartLine(): string {
  return "Yesterday got away from you. That is fine. Today is a clean page, and your streak restarts the moment you finish it.";
}
