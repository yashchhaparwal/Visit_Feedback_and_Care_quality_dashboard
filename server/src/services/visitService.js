import { paramsFor } from '../db/database.js';
import { nowIso } from '../lib/dates.js';
import { HttpError } from '../lib/httpError.js';

/** Visits with the state of their feedback link, for the "Visits & links" screen. */
export function createVisitService(db, linkService) {
  const STATUS_SQL = `CASE
      WHEN l.id IS NULL THEN 'no_link'
      WHEN l.used_at IS NOT NULL THEN 'used'
      WHEN l.expires_at <= :now THEN 'expired'
      ELSE 'pending' END`;

  function list({ status, nurseId, search, page, pageSize }) {
    const where = [];
    const params = { now: nowIso() };
    if (status) { where.push(`${STATUS_SQL} = :status`); params.status = status; }
    if (nurseId) { where.push('v.nurse_id = :nurseId'); params.nurseId = nurseId; }
    if (search) {
      where.push('(fam.contact_name LIKE :search OR fam.patient_name LIKE :search OR n.name LIKE :search)');
      params.search = `%${search}%`;
    }
    const from = `FROM visits v
      JOIN nurses n ON n.id = v.nurse_id
      JOIN families fam ON fam.id = v.family_id
      LEFT JOIN feedback_links l ON l.visit_id = v.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;

    const countSql = `SELECT COUNT(*) AS c ${from}`;
    const total = db.prepare(countSql).get(paramsFor(countSql, params)).c;
    const rows = db
      .prepare(
        `SELECT v.id, v.visit_date, v.shift, v.service, n.id AS nurse_id, n.name AS nurse_name,
                fam.contact_name, fam.patient_name, fam.phone, l.token, l.created_at AS link_created_at,
                l.expires_at, l.used_at, ${STATUS_SQL} AS link_status
         ${from}
         ORDER BY v.visit_date DESC, v.id DESC
         LIMIT :limit OFFSET :offset`,
      )
      .all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });

    return {
      total,
      page,
      pageSize,
      items: rows.map((r) => ({
        id: r.id,
        visitDate: r.visit_date,
        shift: r.shift,
        service: r.service,
        nurse: { id: r.nurse_id, name: r.nurse_name },
        family: { contactName: r.contact_name, patientName: r.patient_name, phone: r.phone },
        link: r.token
          ? {
              url: r.link_status === 'pending' ? linkService.buildUrl(r.token) : null,
              createdAt: r.link_created_at,
              expiresAt: r.expires_at,
              usedAt: r.used_at,
              status: r.link_status,
            }
          : { status: 'no_link' },
      })),
    };
  }

  function create({ nurseId, familyId, visitDate, shift, service }) {
    if (!db.prepare('SELECT 1 FROM nurses WHERE id = ? AND active = 1').get(nurseId)) {
      throw new HttpError(400, 'invalid_nurse', 'Unknown or inactive nurse.');
    }
    if (!db.prepare('SELECT 1 FROM families WHERE id = ?').get(familyId)) {
      throw new HttpError(400, 'invalid_family', 'Unknown family.');
    }
    const result = db
      .prepare('INSERT INTO visits (nurse_id, family_id, visit_date, shift, service, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(nurseId, familyId, visitDate, shift, service, nowIso());
    return { id: Number(result.lastInsertRowid) };
  }

  const nurses = () =>
    db.prepare('SELECT id, name, specialization, city FROM nurses WHERE active = 1 ORDER BY name').all();

  const families = () =>
    db.prepare('SELECT id, contact_name AS contactName, patient_name AS patientName, city, care_type AS careType FROM families ORDER BY contact_name').all();

  return { list, create, nurses, families };
}
