import { pool } from "@/lib/db";
import { isMissingSchema } from "@/lib/dbErrors";

/** What the resource form needs to offer: the IPAs with their member counts, the member total, and the categories already in use. */
export async function loadFormOptions() {
  const ipas = (
    await pool.query(
      `select i.id, i.name, (select count(*)::int from members m where m.ipa_id = i.id and m.active) as members from ipas i order by i.name`,
    )
  ).rows as { id: number; name: string; members: number }[];
  const totalMembers = (await pool.query(`select count(*)::int as n from members where active`)).rows[0].n as number;
  let categories: string[] = [];
  try {
    categories = (await pool.query(`select distinct category from resources where category <> '' order by category`)).rows.map((r) => r.category as string);
  } catch (err) {
    if (!isMissingSchema(err)) throw err;
  }
  return { ipas, totalMembers, categories };
}
