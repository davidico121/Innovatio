"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { celebrate } from "./Toaster";

type Work = { key: string; label: string; requires_proof: boolean };

/** Shrinks a screenshot before upload, to save mobile data and stay under the host's request size limit. The server re-encodes it again. */
async function shrink(file: File): Promise<File> {
  if (file.size < 150 * 1024 || !file.type.startsWith("image/")) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
  return blob && blob.size < file.size ? new File([blob], "proof.jpg", { type: "image/jpeg" }) : file;
}

export default function LogForm({ work, today, yesterday }: { work: Work[]; today: string; yesterday: string }) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(work[0]?.key ?? "");
  const needsProof = work.find((w) => w.key === selected)?.requires_proof ?? false;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const f = new FormData(formEl);
    setBusy(true);
    setStatus("");
    const shot = f.get("proof_image");
    if (shot instanceof File && shot.size > 0) f.set("proof_image", await shrink(shot));
    const res = await fetch("/api/entries", { method: "POST", body: f });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setStatus(data.error ?? "Could not save");
      return;
    }
    formEl.reset();
    setSelected(work[0]?.key ?? "");
    setStatus(data.celebrations.length ? "" : "Logged. Every one counts.");
    celebrate(data.celebrations);
    router.refresh();
  }

  if (work.length === 0) return <p className="muted">You have no targets yet. Your manager will assign them.</p>;

  return (
    <form onSubmit={submit} className="stack tight">
      <select name="work_key" value={selected} onChange={(e) => setSelected(e.target.value)} className="field" aria-label="Work type">
        {work.map((w) => (
          <option key={w.key} value={w.key}>{w.label}</option>
        ))}
      </select>
      <div className="row">
        <input name="count" type="number" min={1} defaultValue={1} required className="field" aria-label="How many" />
        <select name="work_date" defaultValue={today} className="field" aria-label="Date">
          <option value={today}>Today</option>
          <option value={yesterday}>Yesterday</option>
        </select>
      </div>
      <label className="label">
        Proof {needsProof ? "(a screenshot or a link)" : "(optional)"}
        <input name="proof_image" type="file" accept="image/png,image/jpeg,image/webp" className="field" />
      </label>
      <input name="proof_url" type="url" placeholder="Or paste a link, https://" className="field" aria-label="Proof link" />
      <input name="notes" maxLength={500} placeholder="Notes (optional)" className="field" aria-label="Notes" />
      <button type="submit" disabled={busy} className="btn">{busy ? "Saving..." : "Log it"}</button>
      {status && <p className={status.startsWith("Logged") ? "muted" : "err"} role={status.startsWith("Logged") ? "status" : "alert"}>{status}</p>}
    </form>
  );
}
