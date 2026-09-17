import pg from "pg";

const pool = new pg.Pool({
  connectionString: "postgresql://postgres:admin123@localhost:5432/staff-housing",
});

async function seed() {
  console.log("🚀 STARTING ROBUST MULTI-MODULE DATA POPULATION...");

  // =========================================================================
  // 1. PUBLIC SCHEMA SEEDING
  // =========================================================================
  console.log("\n📦 1. Seeding Public Activities, Evaluations & Surveys...");

  // 1.1 Activities
  const activities = [
    {
      title_ar: "دوري كرة القدم للموظفين",
      title_en: "Staff Football Tournament",
      desc_ar: "البطولة الرمضانية السنوية على ملاعب السكن بمشاركة 8 فرق من مختلف الأقسام.",
      desc_en: "Annual staff football tournament at housing sports court with 8 department teams.",
      category: "sports",
      loc_ar: "الملعب الرياضي بالسكن",
      loc_en: "Housing Sports Court",
      start_offset: 2,
      end_offset: 10,
      time: "19:00",
      max: 60,
      status: "ongoing",
      depts: []
    },
    {
      title_ar: "دورة اللغة الإنجليزية المهنية للضيافة",
      title_en: "Hospitality English Course",
      desc_ar: "برنامج تدريبي مكثف لرفع مهارات التواصل باللغة الإنجليزية في بيئة العمل الفندقي.",
      desc_en: "Intensive training program to enhance workplace English communication in hospitality.",
      category: "training",
      loc_ar: "قاعة التدريب الرئيسية",
      loc_en: "Main Training Hall",
      start_offset: 5,
      end_offset: 25,
      time: "16:00",
      max: 30,
      status: "planned",
      depts: ["Front Office", "Food & Beverage", "Guest Relations"]
    },
    {
      title_ar: "أمسية الشواء والأنشطة الترفيهية",
      title_en: "Weekly BBQ & Social Evening",
      desc_ar: "أمسية اجتماعية مفتوحة لجميع المقيمين تتضمن شواء حي ومسابقات وألعاب ذهنية.",
      desc_en: "Open social evening for all residents including live BBQ, trivia and fun games.",
      category: "social",
      loc_ar: "الحديقة المركزية بالسكن",
      loc_en: "Housing Central Garden",
      start_offset: 7,
      end_offset: 7,
      time: "20:00",
      max: 100,
      status: "planned",
      depts: []
    },
    {
      title_ar: "ورشة السلامة والصحة المهنية ومكافحة الحرائق",
      title_en: "Fire Safety & OHS Workshop",
      desc_ar: "تدريب عملي على إجراءات الإخلاء واستخدام طفايات الحريق والإسعافات الأولية.",
      desc_en: "Hands-on training on emergency evacuation, fire extinguisher usage, and first aid.",
      category: "training",
      loc_ar: "المسرح المفتوح بالسكن",
      loc_en: "Housing Open Arena",
      start_offset: -5,
      end_offset: -5,
      time: "10:00",
      max: 50,
      status: "completed",
      depts: []
    }
  ];

  for (const act of activities) {
    const ex = await pool.query("SELECT id FROM public.activities WHERE title_en = $1", [act.title_en]);
    if (ex.rows.length === 0) {
      await pool.query(`
        INSERT INTO public.activities (
          title_ar, title_en, description_ar, description_en, category,
          location_ar, location_en, start_date, end_date, start_time,
          max_participants, status, is_published, target_departments
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, CURRENT_DATE + ($8 || ' days')::interval, CURRENT_DATE + ($9 || ' days')::interval, $10,
          $11, $12, true, $13::text[]
        )
      `, [
        act.title_ar, act.title_en, act.desc_ar, act.desc_en, act.category,
        act.loc_ar, act.loc_en, act.start_offset, act.end_offset, act.time,
        act.max, act.status, act.depts
      ]);
    }
  }

  // 1.2 Evaluations / Surveys
  const surveyCheck = await pool.query("SELECT id FROM public.evaluations WHERE title_en = 'Annual Staff Housing Satisfaction Survey 2026'");
  let templateId: number;

  if (surveyCheck.rows.length === 0) {
    const surveyRes = await pool.query(`
      INSERT INTO public.evaluations (
        category, title_ar, title_en, description_ar, description_en,
        status, submitted_at, expires_at
      ) VALUES (
        'general',
        'استبيان الرضا السنوي عن سكن الموظفين 2026',
        'Annual Staff Housing Satisfaction Survey 2026',
        'يهدف هذا الاستبيان إلى قياس جودة المرافق والخدمات والنظافة والأمان في سكن الموظفين.',
        'This survey measures the overall quality of facilities, cleanliness, safety and services in staff housing.',
        'active',
        NOW(),
        NOW() + INTERVAL '30 days'
      ) RETURNING id;
    `);
    templateId = surveyRes.rows[0].id;

    const item1 = await pool.query(`
      INSERT INTO public.survey_items (template_id, title_ar, title_en, type, required, order_index)
      VALUES ($1, 'ما مدى رضاك عن مستوى نظافة الغرف والممرات العامة؟', 'How satisfied are you with room and corridor cleanliness?', 'rating', true, 1) RETURNING id;
    `, [templateId]);

    const item2 = await pool.query(`
      INSERT INTO public.survey_items (template_id, title_ar, title_en, type, required, order_index)
      VALUES ($1, 'ما مدى سرعة وكفاءة فريق الصيانة في التعامل مع البلاغات؟', 'How fast and effective is maintenance in handling reports?', 'rating', true, 2) RETURNING id;
    `, [templateId]);

    const item3 = await pool.query(`
      INSERT INTO public.survey_items (template_id, title_ar, title_en, type, required, order_index)
      VALUES ($1, 'هل خدمات التكييف والإنترنت تعمل بجودة ممتازة في غرفتك؟', 'Are AC and Wi-Fi services operating properly in your room?', 'yes_no', true, 3) RETURNING id;
    `, [templateId]);

    const item4 = await pool.query(`
      INSERT INTO public.survey_items (template_id, title_ar, title_en, type, required, order_index)
      VALUES ($1, 'ما هي مقترحاتك لتحسين البيئة المعيشية والأنشطة الترفيهية في السكن؟', 'What are your suggestions to improve living conditions and activities?', 'text', false, 4) RETURNING id;
    `, [templateId]);

    await pool.query(`
      INSERT INTO public.survey_item_responses (template_id, profile_id, item_id, rating_value, text_value) VALUES
      ($1, 1, $2, 5, NULL),
      ($1, 1, $3, 4.5, NULL),
      ($1, 1, $4, NULL, 'نعم'),
      ($1, 1, $5, NULL, 'نرجو إضافة صالة ألعاب رياضية إضافية وتوسيع منطقة الغسيل.'),
      ($1, 2, $2, 4, NULL),
      ($1, 2, $3, 5, NULL),
      ($1, 2, $4, NULL, 'نعم'),
      ($1, 2, $5, NULL, 'الخدمات ممتازة ونشكر إدارة السكن على الاهتمام الدائم.')
    `, [templateId, item1.rows[0].id, item2.rows[0].id, item3.rows[0].id, item4.rows[0].id]);
  }

  // 1.3 Gate Logs
  const gateLogs = [
    { propId: 1, profId: 1, empId: 'CLK-1001', name: 'أحمد محمد علي', dept: 'Food & Beverage', role: 'Head Bartender', room: '101', bldg: 'المبنى الرئيسي', dir: 'IN', stat: 'GRANTED', rsn: null, by: 'ضابط الأمن / محمود السيد', meth: 'QR_SCAN', off: '25 minutes' },
    { propId: 1, profId: 2, empId: 'CLK-1002', name: 'محمود إبراهيم خليل', dept: 'Housekeeping', role: 'Floor Supervisor', room: '102', bldg: 'المبنى الرئيسي', dir: 'OUT', stat: 'GRANTED', rsn: 'تصريح مأمورية رسمية', by: 'ضابط الأمن / محمود السيد', meth: 'QR_SCAN', off: '1 hour' },
    { propId: 1, profId: 3, empId: 'CLK-1003', name: 'سارة حسن عبد الله', dept: 'Front Office', role: 'Front Desk Agent', room: '103', bldg: 'المبنى الرئيسي', dir: 'IN', stat: 'GRANTED', rsn: null, by: 'ضابط الأمن / طارق فاروق', meth: 'BARCODE_GUN', off: '2 hours' },
    { propId: 1, profId: 4, empId: 'CLK-1004', name: 'كريم عادل يوسف', dept: 'Engineering', role: 'AC Technician', room: '104', bldg: 'المبنى الرئيسي', dir: 'OUT', stat: 'GRANTED', rsn: 'انتهاء الوردية', by: 'ضابط الأمن / طارق فاروق', meth: 'BARCODE_GUN', off: '3 hours' },
    { propId: 1, profId: 999, empId: 'CLK-9999', name: 'مجهول الهوية / زائر غير مسجل', dept: 'External', role: 'Contractor', room: null, bldg: null, dir: 'IN', stat: 'DENIED', rsn: 'عدم وجود بطاقة هوية سارية أو تصريح دخول مسبق', by: 'ضابط الأمن / محمود السيد', meth: 'MANUAL', off: '4 hours' },
    { propId: 2, profId: 5, empId: 'CLK-2001', name: 'عمر عبد العزيز خالد', dept: 'Kitchen', role: 'Sous Chef', room: '201', bldg: 'مبنى الواحة أ', dir: 'IN', stat: 'GRANTED', rsn: null, by: 'ضابط الأمن / أحمد ممدوح', meth: 'QR_SCAN', off: '15 minutes' }
  ];

  for (const g of gateLogs) {
    const ex = await pool.query("SELECT id FROM public.gate_logs WHERE employee_id = $1 AND scanned_by = $2", [g.empId, g.by]);
    if (ex.rows.length === 0) {
      await pool.query(`
        INSERT INTO public.gate_logs (
          property_id, profile_id, employee_id, full_name, department, job_title,
          room_number, building_name, direction, status, reason, scanned_by, scan_method, scanned_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13, NOW() - ($14 || '')::interval
        )
      `, [g.propId, g.profId, g.empId, g.name, g.dept, g.role, g.room, g.bldg, g.dir, g.stat, g.rsn, g.by, g.meth, g.off]);
    }
  }

  // 1.4 Hosting Requests (Family Visit)
  const reqCheck1 = await pool.query("SELECT id FROM public.hosting_requests WHERE request_number = 'FVR-2026-0010'");
  if (reqCheck1.rows.length === 0) {
    await pool.query(`
      INSERT INTO public.hosting_requests (
        request_number, property_id, requester_user_id, profile_name, clock_number,
        department, position, number_of_rooms, family_members_count, family_members_included,
        from_date, to_date, consumed_days, remarks, status, current_step_order
      ) VALUES (
        'FVR-2026-0010', 1, 1, 'أحمد محمد علي', 'CLK-1001',
        'Food & Beverage', 'Head Bartender', 1, 3, 'الزوجة وطفلين',
        CURRENT_DATE + INTERVAL '10 days', CURRENT_DATE + INTERVAL '14 days', 4,
        'طلب استضافة عائلية سنوية مستحقة.', 'approved', 4
      );
    `);
  }

  const reqCheck2 = await pool.query("SELECT id FROM public.hosting_requests WHERE request_number = 'FVR-2026-0011'");
  if (reqCheck2.rows.length === 0) {
    await pool.query(`
      INSERT INTO public.hosting_requests (
        request_number, property_id, requester_user_id, profile_name, clock_number,
        department, position, number_of_rooms, family_members_count, family_members_included,
        from_date, to_date, consumed_days, remarks, status, current_step_order
      ) VALUES (
        'FVR-2026-0011', 1, 1, 'محمود إبراهيم خليل', 'CLK-1002',
        'Housekeeping', 'Floor Supervisor', 1, 2, 'الزوجة',
        CURRENT_DATE + INTERVAL '15 days', CURRENT_DATE + INTERVAL '18 days', 3,
        'زيارة عائلية خاصة.', 'in_signing', 2
      );
    `);
  }

  // =========================================================================
  // 2. TAAL_HOUSING (Property 1) RICH DATA SEEDING
  // =========================================================================
  console.log("\n🏢 2. Seeding taal_housing (Property 1)...");

  // 2.1 Buildings
  const buildingsToAdd = [
    { name: "مبنى النيل - Nile Wing", loc: "القطاع الشرقي - المنطقة ب", cap: 80 },
    { name: "فيلا اللوتس - Lotus Villa", loc: "القطاع الغربي - المنطقة ج", cap: 40 }
  ];

  for (const b of buildingsToAdd) {
    const ex = await pool.query("SELECT id FROM taal_housing.buildings WHERE name = $1", [b.name]);
    if (ex.rows.length === 0) {
      await pool.query("INSERT INTO taal_housing.buildings (name, location, capacity, status) VALUES ($1, $2, $3, 'active')", [b.name, b.loc, b.cap]);
    }
  }

  const allBldgs = await pool.query("SELECT id, name FROM taal_housing.buildings ORDER BY id");

  // 2.2 Floors for each building
  for (const b of allBldgs.rows) {
    const flEx1 = await pool.query("SELECT id FROM taal_housing.floors WHERE building_id = $1 AND floor_number = '1'", [b.id]);
    if (flEx1.rows.length === 0) {
      await pool.query("INSERT INTO taal_housing.floors (building_id, floor_number, description) VALUES ($1, '1', 'الدور الأرضي - مجهز بمدخل مستقل')", [b.id]);
    }
    const flEx2 = await pool.query("SELECT id FROM taal_housing.floors WHERE building_id = $1 AND floor_number = '2'", [b.id]);
    if (flEx2.rows.length === 0) {
      await pool.query("INSERT INTO taal_housing.floors (building_id, floor_number, description) VALUES ($1, '2', 'الدور الأول علوي - إطلالة على الحديقة')", [b.id]);
    }
  }

  // 2.3 Rooms, Beds & Inventory
  const allFloors = await pool.query("SELECT id, building_id, floor_number FROM taal_housing.floors ORDER BY id");

  for (const f of allFloors.rows) {
    const bldgId = f.building_id;
    const flId = f.id;
    const prefix = bldgId === 1 ? '1' : bldgId === 2 ? '2' : '3';
    const floorNum = f.floor_number;

    for (let r = 1; r <= 3; r++) {
      const roomNum = `${prefix}${floorNum}0${r}`;
      const cap = r;
      const roomType = r === 1 ? 'single' : r === 2 ? 'double' : 'triple';
      const status = r === 1 ? 'available' : r === 2 ? 'occupied' : 'dirty';
      const gender = r % 2 === 1 ? 'male' : 'female';

      const ex = await pool.query("SELECT id FROM taal_housing.rooms WHERE room_number = $1", [roomNum]);
      let roomId: number;

      if (ex.rows.length === 0) {
        const ins = await pool.query(`
          INSERT INTO taal_housing.rooms (
            building_id, floor_id, room_number, room_type, capacity, current_occupancy,
            status, gender, view, bed_type, classification, separator_door, size_sqm,
            features_list, notes, is_active, property_id
          ) VALUES (
            $1, $2, $3, $4, $5, 0,
            $6, $7, 'Garden View', 'Single Bed', 'Standard', false, 28,
            '["AC", "TV", "Mini Fridge", "Balcony"]'::jsonb, 'غرفة نموذجية مجددة بالكامل', true, 1
          ) RETURNING id;
        `, [bldgId, flId, roomNum, roomType, cap, status, gender]);
        roomId = ins.rows[0].id;
      } else {
        roomId = ex.rows[0].id;
      }

      // Beds
      for (let b = 1; b <= cap; b++) {
        const bedEx = await pool.query("SELECT id FROM taal_housing.room_beds WHERE room_id = $1 AND bed_number = $2", [roomId, b]);
        if (bedEx.rows.length === 0) {
          await pool.query(
            "INSERT INTO taal_housing.room_beds (room_id, bed_number, bed_type, status) VALUES ($1, $2, 'Single', $3)",
            [roomId, b, b === 1 && status === 'occupied' ? 'OCCUPIED' : 'AVAILABLE']
          );
        }
      }

      // Inventory
      const invEx = await pool.query("SELECT id FROM taal_housing.room_inventory WHERE room_id = $1", [roomId]);
      if (invEx.rows.length === 0) {
        await pool.query(`
          INSERT INTO taal_housing.room_inventory (room_id, item_name, category, quantity, condition, notes)
          VALUES
          ($1, 'شاشة تلفزيون ذكية 43 بوصة', 'electronics', 1, 'good', 'ماركة سامسونج مع ريموت كنترول'),
          ($1, 'تكييف سبليت 2.25 حصان', 'electronics', 1, 'good', 'ماركة كاريير بحالة ممتازة'),
          ($1, 'ثلاجة ميني بار', 'appliances', 1, 'good', 'ماركة توشيبا'),
          ($1, 'دولاب ملابس خشبي درفتين', 'furniture', $2, 'good', 'خشب زان طبيعي'),
          ($1, 'سرير نوم كامل بالمفرش والمرتبة', 'furniture', $2, 'good', 'مرتبة تاكي بحالة جديدة');
        `, [roomId, cap]);
      }
    }
  }

  // 2.4 Profiles (bilingual with all required NOT NULL fields)
  const profilesToAdd = [
    { id: 'CLK-1010', fn: 'Hassan', ln: 'Salem', fn_ar: 'حسن', ln_ar: 'سالم', job: 'Executive Chef', job_ar: 'رئيس الطهاة', dept: 'Kitchen', dept_ar: 'المطبخ', nid: '29001011234567', nat: 'Egyptian', ph: '+201012345601', hd: '2022-01-15', gen: 'male', emp: 'INTERNAL', co: 'Sunrise Grand' },
    { id: 'CLK-1011', fn: 'Nour', ln: 'Ezzat', fn_ar: 'نور', ln_ar: 'عزت', job: 'Guest Service Agent', job_ar: 'مسؤولة علاقات نزلاء', dept: 'Front Office', dept_ar: 'المكاتب الأمامية', nid: '29505121234568', nat: 'Egyptian', ph: '+201012345602', hd: '2023-03-01', gen: 'female', emp: 'INTERNAL', co: 'Sunrise Grand' },
    { id: 'CLK-1012', fn: 'Yasser', ln: 'Ghanem', fn_ar: 'ياسر', ln_ar: 'غانم', job: 'Senior Electrician', job_ar: 'فني كهرباء أول', dept: 'Engineering', dept_ar: 'الإدارة الهندسية', nid: '28807151234569', nat: 'Egyptian', ph: '+201012345603', hd: '2021-08-10', gen: 'male', emp: 'INTERNAL', co: 'Sunrise Grand' },
    { id: 'CLK-1013', fn: 'Fatima', ln: 'Al-Sayed', fn_ar: 'فاطمة', ln_ar: 'السيد', job: 'Housekeeping Supervisor', job_ar: 'مشرفة نظافة غرف', dept: 'Housekeeping', dept_ar: 'نظافة الغرف والخدمة العامة', nid: '29411201234570', nat: 'Egyptian', ph: '+201012345604', hd: '2022-11-05', gen: 'female', emp: 'INTERNAL', co: 'Sunrise Grand' },
    { id: 'CLK-1014', fn: 'Khaled', ln: 'Mansour', fn_ar: 'خالد', ln_ar: 'منصور', job: 'Security Supervisor', job_ar: 'مشرف أمن وحراسة', dept: 'Security', dept_ar: 'الأمن والحراسة', nid: '28909091234571', nat: 'Egyptian', ph: '+201012345605', hd: '2020-05-20', gen: 'male', emp: 'CONTRACTOR', co: 'المتحدة للأمن والحراسة' },
    { id: 'CLK-1015', fn: 'Amr', ln: 'Dewidar', fn_ar: 'عمرو', ln_ar: 'دويدار', job: 'Landscape Specialist', job_ar: 'أخصائي حدائق وتجميل', dept: 'Engineering', dept_ar: 'الإدارة الهندسية', nid: '29104041234572', nat: 'Egyptian', ph: '+201012345606', hd: '2023-06-12', gen: 'male', emp: 'CONTRACTOR', co: 'النيل للتنسيق والحدائق' },
    { id: 'CLK-1016', fn: 'Dina', ln: 'Mustafa', fn_ar: 'دينا', ln_ar: 'مصطفى', job: 'Spa Therapist', job_ar: 'أخصائية علاج طبيعي وسبا', dept: 'Spa & Wellness', dept_ar: 'النادي الصحي والسبا', nid: '29602021234573', nat: 'Egyptian', ph: '+201012345607', hd: '2024-01-10', gen: 'female', emp: 'INTERNAL', co: 'Sunrise Grand' }
  ];

  for (const p of profilesToAdd) {
    const ex = await pool.query("SELECT id FROM taal_housing.profiles WHERE profile_id = $1", [p.id]);
    if (ex.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.profiles (
          profile_id, first_name, last_name, third_name, fourth_name,
          first_name_ar, last_name_ar, job_title, job_title_ar, department, department_ar,
          national_id, nationality, phone, hire_date, gender, employment_type,
          company_name, status, property_id, address, date_of_birth, email, emergency_contact, level
        ) VALUES (
          $1, $2, $3, '', '',
          $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15,
          $16, 'ACTIVE', 1, 'الغردقة - سكن الموظفين', '1992-05-15', 'staff@sunrise.com', '+201000000000', 'Staff'
        )
      `, [p.id, p.fn, p.ln, p.fn_ar, p.ln_ar, p.job, p.job_ar, p.dept, p.dept_ar, p.nid, p.nat, p.ph, p.hd, p.gen, p.emp, p.co]);
    }
  }

  // 2.5 Historical and Active Assignments
  const p1 = await pool.query("SELECT id FROM taal_housing.profiles WHERE profile_id = 'CLK-1010' LIMIT 1");
  const p2 = await pool.query("SELECT id FROM taal_housing.profiles WHERE profile_id = 'CLK-1011' LIMIT 1");
  const rAvail = await pool.query("SELECT id FROM taal_housing.rooms ORDER BY id LIMIT 5");

  if (p1.rows[0] && rAvail.rows[0]) {
    const asEx1 = await pool.query("SELECT id FROM taal_housing.assignments WHERE profile_id = $1 AND status = 'CHECKED_OUT'", [p1.rows[0].id]);
    if (asEx1.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.assignments (
          profile_id, room_id, bed_number, check_in_date, expected_check_out_date,
          check_out_date, status, notes, is_entire_room, property_id
        ) VALUES (
          $1, $2, 1, '2025-06-01', '2026-02-01', '2026-02-01', 'CHECKED_OUT',
          'تم إخلاء الغرفة بالكامل بعد انتهاء العقد السنوي وتسليم العهدة سليمة', false, 1
        );
      `, [p1.rows[0].id, rAvail.rows[0].id]);
    }
  }

  if (p2.rows[0] && rAvail.rows[1]) {
    const asEx2 = await pool.query("SELECT id FROM taal_housing.assignments WHERE profile_id = $1 AND status = 'ACTIVE'", [p2.rows[0].id]);
    if (asEx2.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.assignments (
          profile_id, room_id, bed_number, check_in_date, expected_check_out_date,
          status, notes, is_entire_room, property_id
        ) VALUES (
          $1, $2, 1, '2026-02-15', '2026-12-31', 'ACTIVE',
          'تسكين رسمي مستمر - غرفة مفردة ممتازة', true, 1
        );
      `, [p2.rows[0].id, rAvail.rows[1].id]);
    }
  }

  // 2.6 Reservations
  const reservationsToAdd = [
    { fn: 'أحمد', ln: 'البدري', dept: 'Kitchen', job: 'Chef de Partie', code: 'CLK-1020', nid: '29301011234580', ph: '+201099887766', gen: 'male', emp: 'INTERNAL', co: 'Sunrise Grand', notes: 'حجز تسكين موظف جديد منقول من فرع شرم الشيخ' },
    { fn: 'مروة', ln: 'سليمان', dept: 'Front Office', job: 'Night Auditor', code: 'CLK-1021', nid: '29705051234581', ph: '+201088776655', gen: 'female', emp: 'INTERNAL', co: 'Sunrise Grand', notes: 'حجز مسبق معتمد من إدارة الموارد البشرية' },
    { fn: 'محمد', ln: 'الشاذلي', dept: 'Engineering', job: 'Plumbing Specialist', code: 'CLK-1022', nid: '29108081234582', ph: '+201077665544', gen: 'male', emp: 'CONTRACTOR', co: 'الرواد للمقاولات العامة', notes: 'تسكين فنيين صيانة المشروع الموسمي' }
  ];

  for (const r of reservationsToAdd) {
    const ex = await pool.query("SELECT id FROM taal_housing.reservations WHERE profile_code = $1", [r.code]);
    if (ex.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.reservations (
          first_name, last_name, check_in_date, check_out_date, status,
          department, job_title, profile_code, guest_id_card_number, guest_phone,
          nationality, gender, employment_type, company_name, notes
        ) VALUES (
          $1, $2, TO_CHAR(CURRENT_DATE + INTERVAL '3 days', 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE + INTERVAL '90 days', 'YYYY-MM-DD'), 'UPCOMING',
          $3, $4, $5, $6, $7,
          'Egyptian', $8, $9, $10, $11
        );
      `, [r.fn, r.ln, r.dept, r.job, r.code, r.nid, r.ph, r.gen, r.emp, r.co, r.notes]);
    }
  }

  // 2.7 Maintenance with Ratings
  if (rAvail.rows[0] && p1.rows[0]) {
    const mEx1 = await pool.query("SELECT id FROM taal_housing.maintenance WHERE room_id = $1 AND problem_type = 'تسريب في صنبور الحمام'", [rAvail.rows[0].id]);
    if (mEx1.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.maintenance (
          room_id, category, problem_type, description, status, priority,
          reported_by, rating, rating_comment, rated_at, rated_by_profile_id,
          started_at, resolved_at, property_id
        ) VALUES (
          $1, 'plumbing', 'تسريب في صنبور الحمام', 'يوجد تسريب مياه مستمر من صنبور حوض الحمام الرئيسي يحتاج لتغيير المحبس.',
          'completed', 'medium', 'حسن سالم', 5, 'تم الإصلاح فوراً بعد البلاغ بنصف ساعة، شكراً لفريق الصيانة المحترف!',
          NOW() - INTERVAL '1 day', $2, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day', 1
        );
      `, [rAvail.rows[0].id, p1.rows[0].id]);
    }

    const mEx2 = await pool.query("SELECT id FROM taal_housing.maintenance WHERE room_id = $1 AND problem_type = 'صوت غير طبيعي في التكييف'", [rAvail.rows[0].id]);
    if (mEx2.rows.length === 0) {
      await pool.query(`
        INSERT INTO taal_housing.maintenance (
          room_id, category, problem_type, description, status, priority,
          reported_by, rating, rating_comment, rated_at, rated_by_profile_id,
          started_at, resolved_at, property_id
        ) VALUES (
          $1, 'ac', 'صوت غير طبيعي في التكييف', 'مروحة التكييف تصدر صوتاً مرتفعاً أثناء التبريد وتحتاج لتنظيف الفلاتر والفحص.',
          'completed', 'high', 'حسن سالم', 4, 'تم تنظيف الفلتر وصيانة المروحة وعاد التكييف للعمل بهدوء.',
          NOW() - INTERVAL '3 days', $2, NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days', 1
        );
      `, [rAvail.rows[0].id, p1.rows[0].id]);
    }
  }

  // 2.8 Guest Hostings with Companions
  if (p1.rows[0]) {
    const hEx = await pool.query("SELECT id FROM taal_housing.hostings WHERE profile_id = $1 AND notes LIKE '%نهاية الأسبوع%'", [p1.rows[0].id]);
    if (hEx.rows.length === 0) {
      const hostRes = await pool.query(`
        INSERT INTO taal_housing.hostings (
          profile_id, hosting_type, guests_count, expected_from, expected_to,
          status, notes, created_by
        ) VALUES (
          $1, 'SEPARATE_ROOM', 2,
          TO_CHAR(CURRENT_DATE + INTERVAL '4 days', 'YYYY-MM-DD'),
          TO_CHAR(CURRENT_DATE + INTERVAL '8 days', 'YYYY-MM-DD'),
          'APPROVED', 'استضافة والد ووالدة الموظف بمناسبة إجازة نهاية الأسبوع', 'الإدارة العامة'
        ) RETURNING id;
      `, [p1.rows[0].id]);

      if (hostRes.rows.length > 0) {
        await pool.query(`
          INSERT INTO taal_housing.hosting_companions (
            hosting_id, name, id_number, relation, is_child, age
          ) VALUES
          ($1, 'سالم أحمد سالم', '25001011234567', 'الأب', 0, 68),
          ($1, 'كريمة عبد الرحمن', '25505051234568', 'الأم', 0, 62);
        `, [hostRes.rows[0].id]);
      }
    }
  }

  // =========================================================================
  // 3. EL_WAHA_NEW (Property 2) COMPLETE SEEDING
  // =========================================================================
  console.log("\n🌴 3. Seeding el_waha_new (Property 2)...");

  // 3.1 Buildings
  const wBldgs = [
    { name: "مبنى الواحة أ (Al-Waha A)", loc: "المنطقة الشمالية - بوابة 1" },
    { name: "مبنى الواحة ب (Al-Waha B)", loc: "المنطقة الجنوبية - بوابة 2" }
  ];

  for (const b of wBldgs) {
    const ex = await pool.query("SELECT id FROM el_waha_new.buildings WHERE name = $1", [b.name]);
    if (ex.rows.length === 0) {
      await pool.query("INSERT INTO el_waha_new.buildings (name, location, capacity, status) VALUES ($1, $2, 60, 'active')", [b.name, b.loc]);
    }
  }

  const allWBldgs = await pool.query("SELECT id, name FROM el_waha_new.buildings ORDER BY id");

  for (const b of allWBldgs.rows) {
    const flEx1 = await pool.query("SELECT id FROM el_waha_new.floors WHERE building_id = $1 AND floor_number = '1'", [b.id]);
    if (flEx1.rows.length === 0) {
      await pool.query("INSERT INTO el_waha_new.floors (building_id, floor_number, description) VALUES ($1, '1', 'الدور الأرضي الواحة')", [b.id]);
    }
    const flEx2 = await pool.query("SELECT id FROM el_waha_new.floors WHERE building_id = $1 AND floor_number = '2'", [b.id]);
    if (flEx2.rows.length === 0) {
      await pool.query("INSERT INTO el_waha_new.floors (building_id, floor_number, description) VALUES ($1, '2', 'الدور الأول الواحة')", [b.id]);
    }
  }

  const allWFloors = await pool.query("SELECT id, building_id, floor_number FROM el_waha_new.floors ORDER BY id");

  for (const f of allWFloors.rows) {
    const bldgId = f.building_id;
    const flId = f.id;
    const floorNum = f.floor_number;

    for (let r = 1; r <= 3; r++) {
      const roomNum = `W${bldgId}-${floorNum}0${r}`;
      const cap = r === 1 ? 1 : 2;
      const status = r === 1 ? 'available' : r === 2 ? 'occupied' : 'dirty';

      const ex = await pool.query("SELECT id FROM el_waha_new.rooms WHERE room_number = $1", [roomNum]);
      let roomId: number;

      if (ex.rows.length === 0) {
        const ins = await pool.query(`
          INSERT INTO el_waha_new.rooms (
            building_id, floor_id, room_number, room_type, capacity, current_occupancy,
            status, gender, view, bed_type, classification, separator_door, size_sqm,
            features_list, notes, is_active, property_id
          ) VALUES (
            $1, $2, $3, $4, $5, 0,
            $6, 'male', 'Courtyard View', 'Single Bed', 'Standard', false, 25,
            '["AC", "TV", "Desk"]'::jsonb, 'غرف واحة النخيل', true, 2
          ) RETURNING id;
        `, [bldgId, flId, roomNum, cap === 1 ? 'single' : 'double', cap, status]);
        roomId = ins.rows[0].id;
      } else {
        roomId = ex.rows[0].id;
      }

      for (let b = 1; b <= cap; b++) {
        const bedEx = await pool.query("SELECT id FROM el_waha_new.room_beds WHERE room_id = $1 AND bed_number = $2", [roomId, b]);
        if (bedEx.rows.length === 0) {
          await pool.query("INSERT INTO el_waha_new.room_beds (room_id, bed_number, bed_type, status) VALUES ($1, $2, 'Single', 'AVAILABLE')", [roomId, b]);
        }
      }

      const invEx = await pool.query("SELECT id FROM el_waha_new.room_inventory WHERE room_id = $1", [roomId]);
      if (invEx.rows.length === 0) {
        await pool.query(`
          INSERT INTO el_waha_new.room_inventory (room_id, item_name, category, quantity, condition)
          VALUES
          ($1, 'تكييف سبليت', 'electronics', 1, 'good'),
          ($1, 'شاشة تلفزيون 32 بوصة', 'electronics', 1, 'good'),
          ($1, 'دولاب ملابس', 'furniture', $2, 'good');
        `, [roomId, cap]);
      }
    }
  }

  // 3.2 Profiles in el_waha_new
  const wProfilesToAdd = [
    { id: 'CLK-2010', fn: 'Hany', ln: 'Shoukry', fn_ar: 'هاني', ln_ar: 'شكري', job: 'Food & Beverage Manager', job_ar: 'مدير الأغذية والمشروبات', dept: 'Food & Beverage', dept_ar: 'المطاعم والأغذية', nid: '28501011234501', ph: '+201122334455', hd: '2020-01-10', gen: 'male', emp: 'INTERNAL', co: 'El Waha Resort' },
    { id: 'CLK-2011', fn: 'Mariam', ln: 'Fouad', fn_ar: 'مريم', ln_ar: 'فؤاد', job: 'HR Generalist', job_ar: 'أخصائية موارد بشرية', dept: 'Human Resources', dept_ar: 'الموارد البشرية', nid: '29408081234502', ph: '+201133445566', hd: '2022-04-15', gen: 'female', emp: 'INTERNAL', co: 'El Waha Resort' },
    { id: 'CLK-2012', fn: 'Ashraf', ln: 'Kamal', fn_ar: 'أشرف', ln_ar: 'كمال', job: 'Chief Engineer', job_ar: 'كبير المهندسين', dept: 'Engineering', dept_ar: 'الإدارة الهندسية', nid: '28003031234503', ph: '+201144556677', hd: '2019-09-01', gen: 'male', emp: 'INTERNAL', co: 'El Waha Resort' }
  ];

  for (const p of wProfilesToAdd) {
    const ex = await pool.query("SELECT id FROM el_waha_new.profiles WHERE profile_id = $1", [p.id]);
    if (ex.rows.length === 0) {
      await pool.query(`
        INSERT INTO el_waha_new.profiles (
          profile_id, first_name, last_name, third_name, fourth_name,
          first_name_ar, last_name_ar, job_title, job_title_ar, department, department_ar,
          national_id, nationality, phone, hire_date, gender, employment_type,
          company_name, status, property_id, address, date_of_birth, email, emergency_contact, level
        ) VALUES (
          $1, $2, $3, '', '',
          $4, $5, $6, $7, $8, $9,
          $10, 'Egyptian', $11, $12, $13, $14,
          $15, 'ACTIVE', 2, 'الواحة - سكن الإشراف', '1988-03-20', 'waha.staff@sunrise.com', '+201000000001', 'Supervisor'
        );
      `, [p.id, p.fn, p.ln, p.fn_ar, p.ln_ar, p.job, p.job_ar, p.dept, p.dept_ar, p.nid, p.ph, p.hd, p.gen, p.emp, p.co]);
    }
  }

  // 3.3 Assignments in el_waha_new
  const wProf = await pool.query("SELECT id FROM el_waha_new.profiles ORDER BY id LIMIT 2");
  const wRm = await pool.query("SELECT id FROM el_waha_new.rooms ORDER BY id LIMIT 2");

  if (wProf.rows.length >= 2 && wRm.rows.length >= 2) {
    const asEx1 = await pool.query("SELECT id FROM el_waha_new.assignments WHERE profile_id = $1", [wProf.rows[0].id]);
    if (asEx1.rows.length === 0) {
      await pool.query(`
        INSERT INTO el_waha_new.assignments (
          profile_id, room_id, bed_number, check_in_date, expected_check_out_date,
          status, notes, is_entire_room, property_id
        ) VALUES (
          $1, $2, 1, '2026-01-01', '2026-12-31', 'ACTIVE', 'تسكين مدير إدارة', true, 2
        );
      `, [wProf.rows[0].id, wRm.rows[0].id]);
    }

    const asEx2 = await pool.query("SELECT id FROM el_waha_new.assignments WHERE profile_id = $1", [wProf.rows[1].id]);
    if (asEx2.rows.length === 0) {
      await pool.query(`
        INSERT INTO el_waha_new.assignments (
          profile_id, room_id, bed_number, check_in_date, expected_check_out_date,
          status, notes, is_entire_room, property_id
        ) VALUES (
          $1, $2, 1, '2026-02-01', '2026-12-31', 'ACTIVE', 'تسكين إشرافي', false, 2
        );
      `, [wProf.rows[1].id, wRm.rows[1].id]);
    }
  }

  // 3.4 Maintenance in el_waha_new
  if (wRm.rows.length > 0) {
    const mEx = await pool.query("SELECT id FROM el_waha_new.maintenance WHERE room_id = $1", [wRm.rows[0].id]);
    if (mEx.rows.length === 0) {
      await pool.query(`
        INSERT INTO el_waha_new.maintenance (
          room_id, category, problem_type, description, status, priority,
          reported_by, rating, rating_comment, rated_at, property_id
        ) VALUES
        ($1, 'plumbing', 'صيانة سباكة الحمام', 'تم استبدال خلاط الدش بالكامل', 'completed', 'medium', 'هاني شكري', 5, 'خدمة صيانة فورية ونظيفة جداً', NOW() - INTERVAL '2 days', 2),
        ($1, 'ac', 'صيانة دورية للتكييف', 'غسيل الفلاتر وشحن الفريون السنوي', 'open', 'low', 'أشرف كمال', NULL, NULL, NULL, 2);
      `, [wRm.rows[0].id]);
    }
  }

  // 3.5 Reservations in el_waha_new
  const resEx = await pool.query("SELECT id FROM el_waha_new.reservations WHERE profile_code = 'CLK-2030'");
  if (resEx.rows.length === 0) {
    await pool.query(`
      INSERT INTO el_waha_new.reservations (
        first_name, last_name, check_in_date, check_out_date, status,
        department, job_title, profile_code, guest_id_card_number, guest_phone,
        nationality, gender, employment_type, company_name, notes
      ) VALUES (
        'سامح', 'جلال', TO_CHAR(CURRENT_DATE + INTERVAL '4 days', 'YYYY-MM-DD'), TO_CHAR(CURRENT_DATE + INTERVAL '45 days', 'YYYY-MM-DD'), 'UPCOMING',
        'Security', 'Security Supervisor', 'CLK-2030', '29201011234599', '+201155667788',
        'Egyptian', 'male', 'INTERNAL', 'El Waha Resort', 'حجز إقامة معتمد لمشرف الأمن الجديد'
      );
    `);
  }

  console.log("\n🎉 ALL MASTER DATA SEEDED CLEANLY ACROSS ALL MODULES AND PROPERTIES!");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
