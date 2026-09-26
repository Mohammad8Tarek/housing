import { pool } from "../lib/db/src/index.ts";

async function updateEvals() {
  console.log("Updating evaluations...");
  const res = await pool.query(
    "UPDATE taal_housing.evaluations SET expires_at = NULL WHERE survey_template_id IS NULL"
  );
  console.log("Updated expired evaluations to active:", res.rowCount);

  const existingSurvey = await pool.query(
    "SELECT id FROM taal_housing.evaluations WHERE title_ar = $1 LIMIT 1",
    ["استبيان رضا المقيمين عن جودة السكن"]
  );

  if (existingSurvey.rows.length === 0) {
    const inserted = await pool.query(
      `INSERT INTO taal_housing.evaluations 
        (category, title_ar, title_en, description_ar, description_en, department, status, created_at, submitted_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW()) RETURNING id`,
      [
        "general",
        "استبيان رضا المقيمين عن جودة السكن",
        "Resident Housing & Services Satisfaction Survey",
        "يرجى مشاركتنا برأيك الصادق لتطوير خدمات السكن ومستوى المعيشة",
        "Please share your valuable feedback to help us enhance housing services",
        "",
        "pending",
      ]
    );
    const tId = inserted.rows[0].id;
    console.log("Created new resident satisfaction survey with id:", tId);

    await pool.query(
      `INSERT INTO taal_housing.survey_items 
        (template_id, title_ar, title_en, type, required, order_index) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tId,
        "ما هو تقييمك لمستوى نظافة المبنى والغرفة؟",
        "How do you rate the cleanliness of the building and room?",
        "rating",
        true,
        0,
      ]
    );

    await pool.query(
      `INSERT INTO taal_housing.survey_items 
        (template_id, title_ar, title_en, type, required, order_index) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tId,
        "هل تستجيب خدمات الصيانة في الوقت المناسب عند تقديم بلاغ؟",
        "Do maintenance services respond in a timely manner?",
        "yes_no",
        true,
        1,
      ]
    );

    await pool.query(
      `INSERT INTO taal_housing.survey_items 
        (template_id, title_ar, title_en, type, required, order_index) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        tId,
        "ما هي مقترحاتك لتطوير بيئة السكن ومستوى الراحة؟",
        "What are your suggestions to improve the housing environment?",
        "text",
        false,
        2,
      ]
    );

    console.log("Inserted 3 survey questions for template", tId);
  }

  const check = await pool.query(
    "SELECT id, title_ar, expires_at FROM taal_housing.evaluations WHERE survey_template_id IS NULL"
  );
  console.table(check.rows);

  await pool.end();
  process.exit(0);
}

updateEvals().catch((err) => {
  console.error(err);
  process.exit(1);
});
