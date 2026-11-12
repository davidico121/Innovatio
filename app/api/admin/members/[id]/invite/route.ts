import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { sendInvite } from "@/lib/invite";
import { redirectTo } from "@/lib/admin";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const result = await sendInvite(Number(id));
  const note = result.ok ? `notice=${encodeURIComponent("New invite sent.")}` : `error=${encodeURIComponent(result.error)}`;
  return redirectTo(req, `/admin/members/${id}?${note}`);
}
