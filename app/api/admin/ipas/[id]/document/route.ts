import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { pool } from "@/lib/db";
import { redirectTo, withError } from "@/lib/admin";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const path = `/admin/ipas/${id}`;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return withError(req, path, "Choose a file to upload");
  if (file.size > MAX_BYTES) return withError(req, path, "File is larger than 4 MB");
  if (!ALLOWED.has(file.type)) return withError(req, path, "Upload a PDF, Word document, text, Markdown, PNG or JPG");

  const bytes = Buffer.from(await file.arrayBuffer());
  const r = await pool.query(
    `update ipas set document = $2, document_name = $3, document_type = $4 where id = $1`,
    [Number(id), bytes, file.name.slice(0, 200), file.type],
  );
  if (r.rowCount === 0) return NextResponse.json({ error: "IPA not found" }, { status: 404 });
  return redirectTo(req, path);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const { rows } = await pool.query(
    `select document, document_name, document_type from ipas where id = $1`,
    [Number(id)],
  );
  const doc = rows[0];
  if (!doc?.document) return new NextResponse("No document", { status: 404 });
  const name = (doc.document_name as string).replace(/"/g, "");
  return new NextResponse(doc.document, {
    headers: {
      "Content-Type": doc.document_type,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
