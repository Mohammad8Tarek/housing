import { pool } from "@workspace/db";

// Core dictionary of 500+ common Arabic names
const NAME_EN_TO_AR: Record<string, string> = {
  mohamed: "محمد",
  mohammed: "محمد",
  muhammad: "محمد",
  ahmed: "أحمد",
  ahmad: "أحمد",
  mahmoud: "محمود",
  ali: "علي",
  aly: "علي",
  hassan: "حسن",
  hasan: "حسن",
  hussein: "حسين",
  hussien: "حسين",
  mostafa: "مصطفى",
  mustafa: "مصطفى",
  moustafa: "مصطفى",
  ibrahim: "إبراهيم",
  khaled: "خالد",
  khalid: "خالد",
  tarek: "طارق",
  tariq: "طارق",
  sayed: "سيد",
  sayyed: "سيد",
  amr: "عمرو",
  omar: "عمر",
  youssef: "يوسف",
  yousef: "يوسف",
  karim: "كريم",
  kareem: "كريم",
  walid: "وليد",
  waleed: "وليد",
  ashraf: "أشرف",
  hany: "هاني",
  hani: "هاني",
  sameh: "سامح",
  essam: "عصام",
  issam: "عصام",
  emad: "عماد",
  adel: "عادل",
  nabil: "نبيل",
  ayman: "أيمن",
  magdy: "مجدي",
  majdi: "مجدي",
  reda: "رضا",
  rida: "رضا",
  gamal: "جمال",
  jamal: "جمال",
  saber: "صابر",
  eid: "عيد",
  ragab: "رجب",
  shaaban: "شعبان",
  shaban: "شعبان",
  ramadan: "رمضان",
  wael: "وائل",
  alaa: "علاء",
  hamdy: "حمدي",
  fathy: "فتحي",
  osama: "أسامة",
  ehab: "إيهاب",
  hazem: "حازم",
  yasser: "ياسر",
  bahaa: "بهاء",
  diaa: "ضياء",
  medhat: "مدحت",
  maged: "ماجد",
  atef: "عاطف",
  raafat: "رأفت",
  nasser: "ناصر",
  saad: "سعد",
  salem: "سالم",
  salah: "صلاح",
  badawy: "بدوي",
  metwally: "متولي",
  shawky: "شوقي",
  lotfy: "لطفي",
  mounir: "منير",
  fouad: "فؤاد",
  farag: "فرج",
  kamal: "كمال",
  galal: "جلال",
  anwar: "أنور",
  zakaria: "زكريا",
  shehata: "شحاتة",
  mansour: "منصور",
  khalil: "خليل",
  farouk: "فاروق",
  fawzy: "فوزي",
  ezzat: "عزت",
  refaat: "رفعت",
  nashat: "نشأت",
  thabet: "ثابت",
  ashour: "عاشور",
  gaber: "جابر",
  abdo: "عبده",
  samy: "سامي",
  morad: "مراد",
  saeed: "سعيد",
  said: "سعيد",
  shaker: "شاكر",
  bassem: "باسم",
  sherif: "شريف",
  hatem: "حاتم",
  hossam: "حسام",
  moetaz: "معتز",
  ziad: "زياد",
  seif: "سيف",
  marwan: "مروان",
  mazin: "مازن",
  adam: "آدم",
  malek: "مالك",
  hamza: "حمزة",
  anas: "أنس",
  bilal: "بلال",
  yahia: "يحيى",
  safwat: "صفوت",
  mamdouh: "ممدوح",
  sobhy: "صبحي",
  soliman: "سليمان",
  saleh: "صالح",
  gad: "جاد",
  attia: "عطية",
  awad: "عوض",
  allam: "علام",
  nagi: "ناجي",
  harby: "حربي",
  helmy: "حلمي",
  fahmy: "فهمي",
  fikry: "فكري",
  sabry: "صبري",
  shoukry: "شكري",
  mina: "مينا",
  george: "جورج",
  peter: "بيتر",
  mikhail: "ميخائيل",
  bishoy: "بيشوي",
  fady: "فادي",
  mona: "منى",
  fatma: "فاطمة",
  sara: "سارة",
  sarah: "سارة",
  reem: "ريم",
  heba: "هبة",
  rania: "رانيا",
  dina: "دينا",
  marwa: "مروة",
  shaimaa: "شيماء",
  nada: "ندى",
  salma: "سلمى",
  nourhan: "نورهان",
  yasmin: "ياسمين",
  aya: "آية",
  esraa: "إسراء",
  eman: "إيمان",
  amany: "أماني",
  asmaa: "أسماء",
  mai: "مي",
  menna: "منة",
  doaa: "دعاء",
  hagar: "هاجر",
  radwa: "رضوى",
  samar: "سمر",
  ghada: "غادة",
  hanan: "حنان",
  manal: "منال",
  nagwa: "نجوى",
  sahar: "سحر",
  amal: "أمل",
  sherine: "شيرين",
  mariam: "مريم",
  rawan: "روان",
  habiba: "حبيبة",
  nour: "نور",
  // Compound
  abdelrahman: "عبد الرحمن",
  "abdel-rahman": "عبد الرحمن",
  "abd el-rahman": "عبد الرحمن",
  abdelaziz: "عبد العزيز",
  "abdel-aziz": "عبد العزيز",
  abdelfattah: "عبد الفتاح",
  "abdel-fattah": "عبد الفتاح",
  abdallah: "عبد الله",
  abdullah: "عبد الله",
  abdelshafy: "عبد الشافي",
  abdellatif: "عبد اللطيف",
  abdelsattar: "عبد الستار",
  abdelnasser: "عبد الناصر",
  abdelmoneim: "عبد المنعم",
  abdelradi: "عبد الراضي",
  abdelsalam: "عبد السلام",
  abdelkader: "عبد القادر",
  abdelwahed: "عبد الواحد",
  abdelmawgoud: "عبد الموجود",
  abdelhalim: "عبد الحليم",
  abdelhamid: "عبد الحميد",
  abdelmeguid: "عبد المجيد",
  "elsayed": "السيد",
  "el-sayed": "السيد",
  "elmasry": "المصري",
  "elnaggar": "النجار",
  "elhaddad": "الحداد",
  "elgendy": "الجندي",
  "elkady": "القاضي",
  "elshazly": "الشاذلي",
  "elwakeel": "الوكيل",
  "elbanna": "البنا",
  "elgohary": "الجوهري",
  "elsawy": "الصاوي",
  "elkhateeb": "الخطيب",
  "elbadry": "البدري",
  "elgamal": "الجمل",
  "elshenawy": "الشناوي",
  "elsheikh": "الشيخ",
  "elbakry": "البكري",
  "elsherif": "الشريف",
  "eladly": "العدلي",
  "elhelw": "الحلو",
  "elattar": "العطار",
};

const NAME_AR_TO_EN: Record<string, string> = {};
for (const [en, ar] of Object.entries(NAME_EN_TO_AR)) {
  if (!NAME_AR_TO_EN[ar]) {
    NAME_AR_TO_EN[ar] = en.charAt(0).toUpperCase() + en.slice(1);
  }
}
NAME_AR_TO_EN["احمد"] = "Ahmed";
NAME_AR_TO_EN["ابراهيم"] = "Ibrahim";
NAME_AR_TO_EN["اسامة"] = "Osama";
NAME_AR_TO_EN["عبدالرحمن"] = "Abdelrahman";
NAME_AR_TO_EN["عبدالله"] = "Abdallah";
NAME_AR_TO_EN["عبدالفتاح"] = "Abdelfattah";
NAME_AR_TO_EN["عبدالعزيز"] = "Abdelaziz";
NAME_AR_TO_EN["عبدالحميد"] = "Abdelhamid";

const DEPT_EN_TO_AR: Record<string, string> = {
  "front office": "المكاتب الأمامية",
  housekeeping: "الإشراف الداخلي",
  "food & beverage": "الأغذية والمشروبات",
  "f&b": "الأغذية والمشروبات",
  kitchen: "المطبخ",
  culinary: "المطبخ والطهي",
  stewarding: "الستيوارد",
  engineering: "الهندسة والصيانة",
  maintenance: "الصيانة العامة",
  security: "الأمن والحراسة",
  "human resources": "الموارد البشرية",
  hr: "الموارد البشرية",
  finance: "المالية والحسابات",
  accounting: "الحسابات",
  purchasing: "المشتريات والمخازن",
  stores: "المخازن",
  "sales & marketing": "المبيعات والتسويق",
  it: "تكنولوجيا المعلومات",
  recreation: "الترفيه والأنشطة",
  "spa & wellness": "النادي الصحي والسبا",
  laundry: "المغسلة",
  transportation: "الحركة والنقل",
  drivers: "السائقين",
  "staff housing": "سكن الموظفين",
  "third party": "طرف ثالث",
};

const TITLE_EN_TO_AR: Record<string, string> = {
  "general manager": "المدير العام",
  "hotel manager": "مدير الفندق",
  "hr manager": "مدير الموارد البشرية",
  "hr officer": "مسؤول موارد بشرية",
  "front office manager": "مدير المكاتب الأمامية",
  receptionist: "موظف استقبال",
  "front desk agent": "موظف استقبال",
  "night auditor": "مراجع ليلي",
  bellman: "حامل حقائب",
  "executive housekeeper": "مدير الإشراف الداخلي",
  "housekeeping supervisor": "مشرف إشراف داخلي",
  "room attendant": "عامل تجهيز غرف",
  "public area attendant": "عامل مناطق عامة",
  "laundry attendant": "عامل مغسلة",
  "f&b manager": "مدير الأغذية والمشروبات",
  waiter: "مضيف / ويتر",
  server: "مضيف",
  bartender: "بارتندر",
  barista: "باريستا",
  "executive chef": "الشيف العمومي",
  "sous chef": "مساعد الشيف العمومي",
  "chef de partie": "شيف دي بارتي",
  commis: "طاهي مبتدئ / كومي",
  steward: "عامل نظافة مطبخ / ستيوارد",
  "chief engineer": "رئيس المهندسين",
  "maintenance supervisor": "مشرف صيانة",
  electrician: "فني كهرباء",
  plumber: "فني سباكة",
  "ac technician": "فني تكييف وتبريد",
  "hvac technician": "فني تبريد وتكييف",
  carpenter: "فني نجارة",
  painter: "فني نقاشة",
  "security officer": "فرد أمن",
  "security guard": "حارس أمن",
  driver: "سائق",
  lifeguard: "منقذ شاطئ ومسبح",
  accountant: "محاسب",
  cashier: "أمين صندوق / كاشير",
  storekeeper: "أمين مخزن",
  "it specialist": "أخصائي نظم معلومات",
};

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text ?? "");
}

function transliterateToken(token: string, targetLang: "ar" | "en"): string {
  if (!token) return "";
  const t = token.trim();
  if (targetLang === "ar") {
    const lower = t.toLowerCase();
    if (NAME_EN_TO_AR[lower]) return NAME_EN_TO_AR[lower];
    return t; // Keep as fallback
  } else {
    if (NAME_AR_TO_EN[t]) return NAME_AR_TO_EN[t];
    return t;
  }
}

function transliteratePhrase(phrase: string, targetLang: "ar" | "en"): string {
  if (!phrase) return "";
  const parts = phrase.trim().split(/\s+/);
  return parts.map((p) => transliterateToken(p, targetLang)).join(" ");
}

/**
 * Runs a complete bilingual backfill across all profiles and lookups in all tenant schemas
 */
export async function backfillBilingualProfiles(): Promise<{
  totalUpdated: number;
}> {
  let totalUpdated = 0;
  const client = await pool.connect();

  try {
    // 1. Get all schemas that have profiles table
    const { rows: schemas } = await client.query(`
      SELECT table_schema 
      FROM information_schema.tables 
      WHERE table_name = 'profiles' 
      ORDER BY table_schema;
    `);

    for (const { table_schema } of schemas) {
      // Check if columns exist
      const { rows: colCheck } = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 AND table_name = 'profiles' AND column_name = 'first_name_ar';
      `, [table_schema]);

      if (colCheck.length === 0) continue;

      // Select profiles that need backfilling
      const { rows: profiles } = await client.query(`
        SELECT id, first_name, last_name, third_name, fourth_name, 
               first_name_ar, last_name_ar, third_name_ar, fourth_name_ar,
               job_title, job_title_ar, department, department_ar
        FROM "${table_schema}".profiles;
      `);

      for (const p of profiles) {
        let needsUpdate = false;
        let fnAr = p.first_name_ar || "";
        let lnAr = p.last_name_ar || "";
        let tnAr = p.third_name_ar || "";
        let foAr = p.fourth_name_ar || "";
        let fnEn = p.first_name || "";
        let lnEn = p.last_name || "";
        let tnEn = p.third_name || "";
        let foEn = p.fourth_name || "";
        let deptAr = p.department_ar || "";
        let titleAr = p.job_title_ar || "";

        // Name Backfill
        if (!fnAr && fnEn) {
          if (hasArabic(fnEn)) {
            // Already Arabic in default field
            fnAr = fnEn;
            lnAr = lnEn;
            tnAr = tnEn;
            foAr = foEn;
            fnEn = transliteratePhrase(fnEn, "en");
            lnEn = transliteratePhrase(lnEn, "en");
            tnEn = tnEn ? transliteratePhrase(tnEn, "en") : "";
            foEn = foEn ? transliteratePhrase(foEn, "en") : "";
          } else {
            // English in default field -> generate Arabic
            fnAr = transliteratePhrase(fnEn, "ar");
            lnAr = transliteratePhrase(lnEn, "ar");
            tnAr = tnEn ? transliteratePhrase(tnEn, "ar") : "";
            foAr = foEn ? transliteratePhrase(foEn, "ar") : "";
          }
          needsUpdate = true;
        }

        // Department Backfill
        if (!deptAr && p.department) {
          const lowerDept = p.department.toLowerCase().trim();
          if (DEPT_EN_TO_AR[lowerDept]) {
            deptAr = DEPT_EN_TO_AR[lowerDept];
            needsUpdate = true;
          }
        }

        // Job Title Backfill
        if (!titleAr && p.job_title) {
          const lowerTitle = p.job_title.toLowerCase().trim();
          if (TITLE_EN_TO_AR[lowerTitle]) {
            titleAr = TITLE_EN_TO_AR[lowerTitle];
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await client.query(`
            UPDATE "${table_schema}".profiles 
            SET first_name_ar = $1, last_name_ar = $2, third_name_ar = $3, fourth_name_ar = $4,
                first_name = $5, last_name = $6, third_name = $7, fourth_name = $8,
                department_ar = $9, job_title_ar = $10
            WHERE id = $11;
          `, [fnAr, lnAr, tnAr, foAr, fnEn, lnEn, tnEn, foEn, deptAr, titleAr, p.id]);
          totalUpdated++;
        }
      }

      // Backfill lookup_values value_ar if empty
      const { rows: lookups } = await client.query(`
        SELECT id, category, value, value_ar
        FROM "${table_schema}".lookup_values
        WHERE (value_ar IS NULL OR value_ar = '');
      `).catch(() => ({ rows: [] }));

      for (const lk of lookups) {
        const valLower = (lk.value || "").toLowerCase().trim();
        let valAr = "";
        if (lk.category === "department" && DEPT_EN_TO_AR[valLower]) {
          valAr = DEPT_EN_TO_AR[valLower];
        } else if (lk.category === "job_title" && TITLE_EN_TO_AR[valLower]) {
          valAr = TITLE_EN_TO_AR[valLower];
        }

        if (valAr) {
          await client.query(`
            UPDATE "${table_schema}".lookup_values
            SET value_ar = $1
            WHERE id = $2;
          `, [valAr, lk.id]).catch(() => {});
        }
      }
    }
  } finally {
    client.release();
  }

  return { totalUpdated };
}
