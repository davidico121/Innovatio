import { currentMember } from "@/lib/auth";
import { dayProgress, isMemberDue } from "@/lib/status";
import { todayLagos, shiftDate } from "@/lib/lagos";
import LogForm from "./LogForm";
import PushButton from "./PushButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentMember();
  if (!me) {
    return <p>Open your personal sign-in link from your manager to continue.</p>;
  }

  const today = todayLagos();
  const yesterday = shiftDate(today, -1);
  const todayDue = await isMemberDue(me.id, today);
  const [todayRows, yesterdayRows] = await Promise.all([
    dayProgress(me.id, today),
    dayProgress(me.id, yesterday),
  ]);
  const shortYesterday = yesterdayRows.filter((r) => !r.met);

  return (
    <main>
      <h1>Hi {me.name}</h1>
      <PushButton />

      {shortYesterday.length > 0 && (
        <p style={{ color: "#b00020" }}>
          Yesterday is short on:{" "}
          {shortYesterday.map((r) => `${r.label} (${r.done}/${r.daily_min})`).join(", ")}
        </p>
      )}

      <h2>Today ({today})</h2>
      {!todayDue && <p>Today is not a working day for your IPA. Nothing is due. You can still log work.</p>}
      <ul>
        {todayRows.map((r) => (
          <li key={r.key}>
            [{r.met ? "done" : "open"}] {r.label}: {r.done}/{r.daily_min}
            {r.requires_proof ? " (proof link required)" : ""}
          </li>
        ))}
      </ul>

      <h2>Log work</h2>
      <LogForm
        work={todayRows.map((r) => ({ key: r.key, label: r.label, requires_proof: r.requires_proof }))}
        today={today}
        yesterday={yesterday}
      />
    </main>
  );
}
