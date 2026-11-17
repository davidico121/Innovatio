import { pool } from "./db";
import type { Kind } from "./resourceLinks";

export * from "./resourceLinks";

export type MemberResource = {
  id: number;
  title: string;
  url: string;
  kind: Kind;
  category: string;
  description: string;
  pinned: boolean;
  isNew: boolean;
  /** Names of the IPAs it is meant for. Empty means everyone. */
  ipas: string[];
  forMe: boolean;
};

/**
 * Every published resource, in the order the admin set, with whether it is new and whether it is meant
 * for this member's IPA. Everyone can see every published resource: tagging an IPA brings it to the
 * top for the people on that IPA, it does not hide it from anyone else.
 */
export async function listForMember(ipaId: number | null): Promise<MemberResource[]> {
  const { rows } = await pool.query(
    `select r.id, r.title, r.url, r.kind, r.category, r.description, r.pinned,
            (r.created_at > now() - interval '7 days') as is_new,
            coalesce(array_agg(i.name order by i.name) filter (where i.id is not null), '{}') as ipas,
            coalesce(bool_or(i.id = $1), false) as for_me
       from resources r
       left join resource_ipas ri on ri.resource_id = r.id
       left join ipas i on i.id = ri.ipa_id
      where r.published
      group by r.id
      order by r.position, r.id`,
    [ipaId],
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    kind: r.kind as Kind,
    category: r.category,
    description: r.description,
    pinned: r.pinned,
    isNew: r.is_new,
    ipas: r.ipas,
    forMe: r.for_me,
  }));
}
