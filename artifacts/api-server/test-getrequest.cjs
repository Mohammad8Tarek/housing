const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:admin123@localhost:5432/staff-housing'
});

async function run() {
  try {
    const requestRes = await pool.query(
      `SELECT fvr.*, p.display_name AS property_name,
        json_agg(
          json_build_object(
            'id', fas.id,
            'stepOrder', fas.step_order,
            'roleRequired', fas.role_required,
            'status', fas.status,
            'signedByUserId', fas.signed_by_user_id,
            'signedAt', fas.signed_at,
            'signatureImageUrlSnapshot', fas.signature_image_url_snapshot,
            'comment', fas.comment,
            'signerName', su.username,
            'signerJobTitle', su.job_title
          ) ORDER BY fas.step_order
        ) FILTER (WHERE fas.id IS NOT NULL) AS approval_steps
      FROM public.hosting_requests fvr
      LEFT JOIN public.properties p ON p.id = fvr.property_id
      LEFT JOIN public.hosting_request_approval_steps fas ON fas.request_id = fvr.id
      LEFT JOIN public.users su ON su.id = fas.signed_by_user_id
      WHERE fvr.id = $1
      GROUP BY fvr.id, p.display_name`,
      [2]
    );
    console.log(requestRes.rows[0]);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
