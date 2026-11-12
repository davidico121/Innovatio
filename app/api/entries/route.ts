import { NextRequest, NextResponse } from "next/server";
import { currentMember } from "@/lib/auth";
import { pool } from "@/lib/db";
import { todayLagos, shiftDate } from "@/lib/lagos";
import { memberRequirements } from "@/lib/status";
import { memberStats } from "@/lib/stats";
import { allDoneLine, taskDoneLine } from "@/lib/copy";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const form = await req.formData();
  const today = todayLagos();
  const workDate = String(form.get("work_date") || today);
  if (workDate !== today && workDate !== shiftDate(today, -1)) {
    return NextResponse.json({ error: "You can only log today or yesterday" }, { status: 400 });
  }

  const count = Number(form.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > 100000) {
    return NextResponse.json({ error: "Count must be a whole number" }, { status: 400 });
  }

  const workKey = String(form.get("work_key") ?? "");
  const requirement = (await memberRequirements(me.id)).find((r) => r.key === workKey);
  if (!requirement) {
    return NextResponse.json({ error: "That work type is not assigned to you" }, { status: 400 });
  }

  const link = String(form.get("proof_url") ?? "").trim();
  if (link && !/^https?:\/\//.test(link)) {
    return NextResponse.json({ error: "A proof link must start with https://" }, { status: 400 });
  }

  const file = form.get("proof_image");
  let image: Buffer | null = null;
  let imageType: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "That screenshot is over 2 MB. Try a smaller one." }, { status: 400 });
    }
    if (!IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Screenshots must be PNG, JPG or WebP" }, { status: 400 });
    }
    image = Buffer.from(await file.arrayBuffer());
    imageType = file.type;
  }

  if (requirement.requires_proof && !link && !image) {
    return NextResponse.json({ error: "Add a screenshot or a link as proof" }, { status: 400 });
  }

  const before = workDate === today ? await memberStats(me.id, today) : null;
  const notes = String(form.get("notes") ?? "").slice(0, 500);
  await pool.query(
    `insert into entries (member_id, work_date, work_key, count, proof_url, notes, proof_image, proof_image_type)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [me.id, workDate, workKey, count, link || null, notes || null, image, imageType],
  );

  // Celebrate only real wins: a target crossed by this entry, or the whole day completed.
  const celebrations: string[] = [];
  let streak = 0;
  if (before) {
    const after = await memberStats(me.id, today);
    streak = after.streak;
    const was = before.tasks.find((t) => t.key === workKey);
    const now = after.tasks.find((t) => t.key === workKey);
    if (was && now && !was.met && now.met) celebrations.push(taskDoneLine(requirement.label));
    if (!before.allMetToday && after.allMetToday) celebrations.push(allDoneLine(after.streak));
  }
  return NextResponse.json({ ok: true, celebrations, streak });
}
