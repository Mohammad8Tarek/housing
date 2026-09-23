/**
 * Enterprise Bilingual Translation & Transliteration Engine
 * Handles full bidirectional translation for Names, Job Titles, and Departments.
 * Designed specifically for Sunrise Resorts & Hotels staff housing.
 */

// ============================================================================
// 1. Core Name Dictionary (Arabic & International Hotel Staff)
// ============================================================================
export const NAME_EN_TO_AR: Record<string, string> = {
  // Common Egyptian & Arab Names
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
  houssein: "حسين",
  hussain: "حسين",
  mostafa: "مصطفى",
  mustafa: "مصطفى",
  moustafa: "مصطفى",
  ibrahim: "إبراهيم",
  ebraheem: "إبراهيم",
  ebrahim: "إبراهيم",
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
  rajab: "رجب",
  shaaban: "شعبان",
  shaban: "شعبان",
  ramadan: "رمضان",
  wael: "وائل",
  alaa: "علاء",
  allaeldin: "علاء الدين",
  hamdy: "حمدي",
  fathy: "فتحي",
  osama: "أسامة",
  oussama: "أسامة",
  ehab: "إيهاب",
  ihab: "إيهاب",
  hazem: "حازم",
  yasser: "ياسر",
  bahaa: "بهاء",
  diaa: "ضياء",
  medhat: "مدحت",
  maged: "ماجد",
  majed: "ماجد",
  atef: "عاطف",
  raafat: "رأفت",
  nasser: "ناصر",
  saad: "سعد",
  salem: "سالم",
  salah: "صلاح",
  badawy: "بدوي",
  metwally: "متولي",
  metwaly: "متولي",
  shawky: "شوقي",
  lotfy: "لطفي",
  mounir: "منير",
  monir: "منير",
  fouad: "فؤاد",
  farag: "فرج",
  kamal: "كمال",
  galal: "جلال",
  jalal: "جلال",
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
  jaber: "جابر",
  abdo: "عبده",
  samy: "سامي",
  morad: "مراد",
  saeed: "سعيد",
  said: "سعيد",
  shaker: "شاكر",
  bassem: "باسم",
  basim: "باسم",
  bassam: "بسام",
  sherif: "شريف",
  sharif: "شريف",
  hatem: "حاتم",
  hossam: "حسام",
  moetaz: "معتز",
  moataz: "معتز",
  ziad: "زياد",
  zeyad: "زياد",
  seif: "سيف",
  marwan: "مروان",
  mazin: "مازن",
  mazen: "مازن",
  adam: "آدم",
  malek: "مالك",
  hamza: "حمزة",
  anas: "أنس",
  bilal: "بلال",
  belal: "بلال",
  yahia: "يحيى",
  yehia: "يحيى",
  fayez: "فايز",
  safwat: "صفوت",
  mamdouh: "ممدوح",
  sobhy: "صبحي",
  soliman: "سليمان",
  sulaiman: "سليمان",
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
  mabrouk: "مبروك",
  mohsen: "محسن",
  karam: "كرم",
  metawea: "مطاوع",
  moussa: "موسى",
  seliem: "سليم",
  amjad: "أمجد",
  hamed: "حامد",
  islam: "إسلام",
  yassin: "ياسين",
  reyad: "رياض",
  riad: "رياض",
  mehmet: "محمد",

  // Christian Egyptian Names
  mina: "مينا",
  george: "جورج",
  peter: "بيتر",
  mikhail: "ميخائيل",
  bishoy: "بيشوي",
  kirollos: "كيرلس",
  fady: "فادي",
  romany: "روماني",
  makram: "مكرم",

  // Female Arab Names
  yara: "يارا",
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
  yasmine: "ياسمين",
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
  gehan: "جيهان",
  manar: "منار",

  // International Staff Names (Russian, Ukrainian, European, Latin)
  aleksandr: "ألكسندر",
  alexandr: "ألكسندر",
  alexander: "ألكسندر",
  aleksandra: "ألكسندرا",
  alexandra: "ألكسندرا",
  bazhitov: "باجيتوف",
  camila: "كاميلا",
  sanchez: "سانشيز",
  cabrera: "كابريرا",
  melissa: "ميليسا",
  gonzalez: "جونزاليس",
  velazquez: "فيلاسكيز",
  natallia: "ناتاليا",
  natalia: "ناتاليا",
  klimava: "كليمافا",
  oksana: "أوكسانا",
  osokina: "أوسوكينا",
  tomiris: "توميريس",
  aimakova: "أيماكوفا",
  uliana: "أوليانا",
  stulnikova: "ستولنيكوفا",
  alisa: "أليسا",
  evdokimova: "إيفدوكيموفا",
  tatiana: "تاتيانا",
  tatyana: "تاتيانا",
  popova: "بوبوفا",
  ulviya: "أولفيا",
  hashumova: "هاشوموفا",
  maria: "ماريا",
  mariya: "ماريا",
  los: "لوس",
  evgeniya: "إيفجينيا",
  yevgeniya: "إيفجينيا",
  vilyanovich: "فيليانوفيتش",
  andreeva: "أندريفا",
  alina: "ألينا",
  estranova: "إسترانوفا",
  francesco: "فرانشيسكو",
  picaro: "بيكارو",
  aslan: "أصلان",
  temirtas: "تيميرتاس",
  rolandi: "رولاندي",
  pisadze: "بيسادزي",
  marat: "مارات",
  baranov: "بارانوف",
  stanislav: "ستانيسلاف",
  kolomiets: "كولوميتس",
  kolomiiets: "كولوميتس",
  pavlinov: "بافلينوف",
  alexandarov: "ألكسندروف",
  stefano: "ستيفانو",
  mori: "موري",
  fabian: "فابيان",
  alvarez: "ألفاريز",
  arjay: "آرجاي",
  dalay: "دالاي",
  arroyo: "أرويو",
  maksym: "مكسيم",
  maksim: "مكسيم",
  maxim: "مكسيم",
  mikailov: "ميخائيلوف",
  mikhailov: "ميخائيلوف",
  parkhomenko: "بارخومينكو",
  viacheslav: "فياشيسلاف",
  vyacheslav: "فياشيسلاف",
  stepanenko: "ستيبانينكو",
  zaur: "زاور",
  hajiyev: "حاجييف",
  dmitrii: "ديمتري",
  dmitry: "ديمتري",
  dmitri: "ديمتري",
  bokov: "بوكوف",
  olga: "أولجا",
  tsishkovskaia: "سيشكوفسكايا",
  celestino: "سيليستينو",
  perez: "بيريز",
  igarza: "إيجارزا",
  yuri: "يوري",
  yury: "يوري",
  putivtsev: "بوتيفسيف",
  emrah: "إمراه",
  afsar: "أفسار",
  lahlali: "لحلالي",
  milena: "ميلينا",
  akimova: "أكيموفا",
  charnova: "تشارنوفا",
  angelina: "أنجيلينا",
  iureva: "يوريفا",
  kharkovskaia: "خاركوفسكايا",
  cherkasheninova: "تشيركاشينينوفا",
  irina: "إيرينا",
  motovilova: "موتوفيلوفا",
  iryna: "إيرينا",
  pukha: "بوخا",
  maja: "مايا",
  maya: "مايا",
  bidstrup: "بيدستروب",
  pedersen: "بيدرسن",
  maryia: "ماريا",
  hetman: "هيتمان",
  karina: "كارينا",
  ladina: "لادينا",
  liliia: "ليليا",
  lilia: "ليليا",
  fedyk: "فيديك",
  villegas: "فيليجاس",
  carmen: "كارمن",
  alex: "أليكس",
  diana: "ديانا",
  davydenko: "دافيدينكو",
  lisnaivis: "ليسنايفيس",
  preval: "بريفال",
  svitlana: "سفيتلانا",
  bilokin: "بيلوكين",
  anastasiia: "أنستازيا",
  anastasia: "أنستازيا",
  kolerova: "كوليروفا",
  gavrilova: "غافريلوفا",
  shania: "شانيا",
  jaymal: "جيمال",
  taisia: "تايسيا",
  poliakova: "بولياكوفا",
  valeriia: "فاليريا",
  valeria: "فاليريا",
  lukianenko: "لوكيانينكو",
  kinziabulatova: "كينزيابولاتوفا",
  darya: "داريا",
  daria: "داريا",
  haurylava: "هاوريلافا",
  diachenko: "دياشينكو",
  viktoria: "فيكتوريا",
  victoria: "فيكتوريا",
  viktoriia: "فيكتوريا",
  chikunova: "تشيكونوفا",
  ekaterina: "إيكاترينا",
  kobeleva: "كوبيليفا",
  renata: "ريناتا",
  iskandarova: "إسكندروفا",
  osypova: "أوسيبوفا",
  tavfik: "توفيق",
  neb: "نيب",
  anhelina: "أنجيلينا",
  khimiak: "خيمياك",
  khvorost: "خفورست",
  elizaveta: "إليزافيتا",

  // Compound Names with Abd / Abdel
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
  abdelsabour: "عبد الصبور",
  abdelkhaleq: "عبد الخالق",
  abdelgawad: "عبد الجواد",
  abdelazim: "عبد العظيم",

  // Common Egyptian Family Prefixes with El / Al
  "el-sayed": "السيد",
  elsayed: "السيد",
  "el-masry": "المصري",
  elmasry: "المصري",
  "el-naggar": "النجار",
  elnaggar: "النجار",
  "el-haddad": "الحداد",
  elhaddad: "الحداد",
  "el-gendy": "الجندي",
  elgendy: "الجندي",
  "el-kady": "القاضي",
  elkady: "القاضي",
  "el-shazly": "الشاذلي",
  elshazly: "الشاذلي",
  "el-wakeel": "الوكيل",
  elwakeel: "الوكيل",
  "el-banna": "البنا",
  elbanna: "البنا",
  "el-gohary": "الجوهري",
  elgohary: "الجوهري",
  "el-sawy": "الصاوي",
  elsawy: "الصاوي",
  "el-khateeb": "الخطيب",
  elkhateeb: "الخطيب",
  "el-badry": "البدري",
  elbadry: "البدري",
  "el-gamal": "الجمل",
  elgamal: "الجمل",
  "el-shenawy": "الشناوي",
  elshenawy: "الشناوي",
  "el-sheikh": "الشيخ",
  elsheikh: "الشيخ",
  "el-bakry": "البكري",
  elbakry: "البكري",
  "el-sherif": "الشريف",
  elsherif: "الشريف",
  "el-adly": "العدلي",
  eladly: "العدلي",
  "el-helw": "الحلو",
  elhelw: "الحلو",
  "el-attar": "العطار",
  elattar: "العطار",
};

// Reverse Dictionary (AR -> EN)
export const NAME_AR_TO_EN: Record<string, string> = {};
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
NAME_AR_TO_EN["علاء الدين"] = "AllaEldin";

// ============================================================================
// 2. Comprehensive Hospitality Departments Dictionary
// ============================================================================
export const DEPT_EN_TO_AR: Record<string, string> = {
  "front office": "المكاتب الأمامية",
  "front desk": "المكاتب الأمامية",
  housekeeping: "الإشراف الداخلي",
  "food & beverage": "الأغذية والمشروبات",
  "f&b": "الأغذية والمشروبات",
  kitchen: "المطبخ",
  culinary: "المطبخ والطهي",
  stewarding: "الستيوارد",
  steward: "الستيوارد",
  engineering: "الهندسة والصيانة",
  maintenance: "الصيانة العامة",
  security: "الأمن والحراسة",
  "human resources": "الموارد البشرية",
  hr: "الموارد البشرية",
  finance: "المالية والحسابات",
  financial: "الإدارة المالية",
  accounting: "الحسابات",
  purchasing: "المشتريات والمخازن",
  stores: "المخازن",
  "sales & marketing": "المبيعات والتسويق",
  it: "تكنولوجيا المعلومات",
  informationtechnology: "تكنولوجيا المعلومات",
  "information technology": "تكنولوجيا المعلومات",
  recreation: "الترفيه والأنشطة",
  entertainment: "الترفيه والأنشطة",
  animation: "الأنيميشن والترفيه",
  singer: "الأنشطة والترفيه",
  "mozza art": "الفنون والاستعراض",
  sports: "الأنشطة الرياضية",
  hygiene: "الصحة وسلامة الغذاء",
  "posh club": "نادي بوش كلوب",
  "a&g": "الإدارة العامة",
  "administrative & general": "الإدارة العامة",
  "executive office": "المكتب التنفيذي",
  administration: "الإدارة العامة",
  "spa & wellness": "النادي الصحي والسبا",
  laundry: "المغسلة",
  transportation: "الحركة والنقل",
  drivers: "السائقين",
  "staff housing": "سكن الموظفين",
  "housing management": "إدارة السكن",
  "third party": "طرف ثالث",
};

export const DEPT_AR_TO_EN: Record<string, string> = {};
for (const [en, ar] of Object.entries(DEPT_EN_TO_AR)) {
  if (!DEPT_AR_TO_EN[ar]) {
    DEPT_AR_TO_EN[ar] = en.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}

// ============================================================================
// 3. Comprehensive Hospitality Job Titles Dictionary
// ============================================================================
export const TITLE_EN_TO_AR: Record<string, string> = {
  // Executive & Cluster Management
  "general manager": "المدير العام",
  "cluster general manager": "المدير العام للمجموعة",
  "hotel manager": "مدير الفندق",
  "resident manager": "مدير الفندق المقيم",
  "assistant general manager": "مساعد المدير العام",
  "executive assistant manager": "مساعد المدير التنفيذي",
  "director of operations": "مدير العمليات",
  "hotel financial controller": "المراقب المالي للفندق",
  "financial controller": "المدير المالي",
  "director of finance": "مدير الإدارة المالية",
  "cluster director of sales & marketing": "مدير المبيعات والتسويق للمجموعة",
  "senior sales manager": "مدير مبيعات أول",
  "learning and development manager": "مدير التدريب والتطوير",
  "employees housing manager": "مدير سكن العاملين",
  "housing manager": "مدير سكن العاملين",
  "housing supervisor": "مشرف سكن العاملين",
  "housing attendant": "عامل سكن العاملين",
  "logistics manager": "مدير الخدمات اللوجستية",
  "taal avenue operation manager": "مدير تشغيل تال أفينيو",
  "area hygiene and sustainability ssh manager": "مدير الصحة والاستدامة بالمنطقة",
  "central laundry manager": "مدير المغسلة المركزية",

  // HR & Administration
  "director of hr": "مدير الموارد البشرية",
  "hr manager": "مدير الموارد البشرية",
  "asst. human resources manager": "مساعد مدير الموارد البشرية",
  "assistant human resources manager": "مساعد مدير الموارد البشرية",
  "hr officer": "مسؤول موارد بشرية",
  "hr coordinator": "منسق موارد بشرية",
  "personnel officer": "مسؤول شؤون العاملين",
  "training manager": "مدير التدريب",

  // Front Office & Guest Experience
  "front office manager": "مدير المكاتب الأمامية",
  "assistant front office manager": "مساعد مدير المكاتب الأمامية",
  "front desk supervisor": "مشرف استقبال",
  "front desk agent": "موظف استقبال",
  receptionist: "موظف استقبال",
  "night auditor": "مراجع ليلي",
  "night manager": "مدير الفترة الليلية",
  "duty manager": "المدير المناوب",
  concierge: "كونسيرج",
  "bell captain": "رئيس حاملي الحقائب",
  bellman: "حامل حقائب",
  doorman: "بواب",
  "guest relations manager": "مدير علاقات النزلاء",
  "guest relations officer": "مسؤول علاقات النزلاء",
  "guest service center officer expat": "مسؤول مركز خدمة النزلاء",
  "guest experience & quality supervisor": "مشرف تجربة وجودة النزلاء",
  "quality & guest service manager expat": "مدير الجودة وخدمة النزلاء",
  "master butler trainer": "مدرب كبار الضيوف (ماستر باتلر)",
  "telephone operator": "موظف سنترال",

  // Entertainment, Animation & Arts
  animation: "فريق الأنيميشن والترفيه",
  singer: "مطرب / مغني",
  "mozza art": "فنان استعراضي / فن وموسيقى",
  "ssh assistant entertainment manager": "مساعد مدير الترفيه",
  "sports & entertainment manager": "مدير الرياضة والترفيه",
  "recreation manager": "مدير الترفيه والأنشطة",
  lifeguard: "منقذ شاطئ ومسبح",
  "pool attendant": "عامل حمام سباحة",

  // Housekeeping
  "executive housekeeper": "مدير الإشراف الداخلي",
  "assistant executive housekeeper": "مساعد مدير الإشراف الداخلي",
  "housekeeping supervisor": "مشرف إشراف داخلي",
  "floor supervisor": "مشرف أدوار",
  "room attendant": "عامل تجهيز غرف",
  "public area supervisor": "مشرف مناطق عامة",
  "public area attendant": "عامل مناطق عامة",
  "linen runner": "عامل بياضات ومفروشات",
  "order taker": "أوردر تيكر",
  "laundry manager": "مدير المغسلة",
  "laundry supervisor": "مشرف مغسلة",
  "laundry attendant": "عامل مغسلة",
  presser: "مكوجي",
  tailor: "ترزي",

  // Food & Beverage Service
  "director of food & beverage": "مدير قطاع الأغذية والمشروبات",
  "f&b manager": "مدير الأغذية والمشروبات",
  "assistant food & beverage manager": "مساعد مدير الأغذية والمشروبات",
  "assistant f&b manager": "مساعد مدير الأغذية والمشروبات",
  "restaurant manager": "مدير مطعم",
  "restaurant supervisor": "مشرف مطعم",
  captain: "كابتن صالة",
  waiter: "مضيف / ويتر",
  waitress: "مضيفة",
  server: "مضيف",
  busboy: "مساعد مضيف",
  "bar manager": "مدير البار",
  bartender: "بارتندر",
  barista: "باريستا",
  "room service supervisor": "مشرف خدمة الغرف",
  "room service waiter": "مضيف خدمة الغرف",

  // Kitchen / Culinary & Stewarding
  "executive chef": "الشيف العمومي",
  "executive chef expat": "الشيف التنفيذي (أجنبي)",
  "executive sous chef": "مساعد الشيف التنفيذي",
  "sous chef": "سوس شيف",
  "chef de partie": "شيف دي بارتي",
  "demi chef de partie": "ديمي شيف دي بارتي",
  "demi chef": "ديمي شيف",
  "commis i": "كومي أول",
  "commis ii": "كومي ثان",
  "commis iii": "كومي ثالث",
  commis: "طاهي مبتدئ / كومي",
  cook: "طباخ",
  "italian chef": "شيف إيطالي",
  "indian chef expat": "شيف هندي (أجنبي)",
  "turkish chef tal": "شيف تركي",
  "pastry chef": "شيف حلواني",
  "cluster pastry chef": "شيف حلواني المجموعة",
  baker: "خباز",
  butcher: "جزار",
  "chief stewarding": "رئيس قسم الستيوارد",
  "chief steward": "رئيس قسم الستيوارد",
  "assistant chief steward": "مساعد رئيس قسم الستيوارد",
  "steward supervisor": "مشرف ستيوارد",
  steward: "عامل نظافة مطبخ / ستيوارد",

  // Engineering & Maintenance
  "director of engineering": "مدير الإدارة الهندسية",
  "chief engineer": "رئيس المهندسين",
  "assistant chief engineer": "مساعد رئيس المهندسين",
  "maintenance supervisor": "مشرف صيانة",
  "electrical engineer": "مهندس كهرباء",
  "mechanical engineer": "مهندس ميكانيكا",
  electrician: "فني كهرباء",
  plumber: "فني سباكة",
  "hvac technician": "فني تبريد وتكييف",
  "ac technician": "فني تكييف وتبريد",
  carpenter: "فني نجارة",
  painter: "فني نقاشة",
  mason: "فني بناء ومحارة",
  "boiler technician": "فني غلايات",
  "kitchen technician": "فني معدات مطابخ",
  "general technician": "فني صيانة عامة",

  // Security & Safety
  "director of security": "مدير قطاع الأمن",
  "security manager": "مدير الأمن",
  "asst. security manager": "مساعد مدير الأمن",
  "assistant security manager": "مساعد مدير الأمن",
  "security supervisor": "مشرف أمن",
  "security officer": "فرد أمن",
  "security guard": "حارس أمن",
  "cctv operator": "مشغل كاميرات مراقبة",
  "safety officer": "مسؤول السلامة والصحة المهنية",

  // IT & Systems
  "cluster it manager": "مدير تكنولوجيا المعلومات للمجموعة",
  "it manager": "مدير تكنولوجيا المعلومات",
  "asst.information & technology manager": "مساعد مدير تكنولوجيا المعلومات",
  "asst. information & technology manager": "مساعد مدير تكنولوجيا المعلومات",
  "it supervisor": "مشرف تكنولوجيا المعلومات",
  "it officer": "مسؤول تكنولوجيا المعلومات",
  "it specialist": "أخصائي نظم معلومات",
  "network engineer": "مهندس شبكات",

  // Finance & Accounts
  "chief accountant": "رئيس الحسابات",
  "general accountant": "محاسب عام",
  accountant: "محاسب",
  "income auditor": "مراجع إيرادات",
  "accounts payable": "محاسب موردين",
  "accounts receivable": "محاسب عملاء",
  paymaster: "محاسب رواتب",
  "cost controller": "مراقب تكاليف",
  "general cashier": "أمين الخزينة العامة",
  cashier: "أمين صندوق / كاشير",
  "purchasing manager": "مدير المشتريات",
  "purchasing officer": "مسؤول مشتريات",
  storekeeper: "أمين مخزن",
  "receiving clerk": "أمين استلام بضائع",

  // Transportation
  "transportation manager": "مدير النقل والحركة",
  "head driver": "سائق أول / مسؤول الحركة",
  driver: "سائق",
  "bus driver": "سائق حافلة",
};

export const TITLE_AR_TO_EN: Record<string, string> = {};
for (const [en, ar] of Object.entries(TITLE_EN_TO_AR)) {
  if (!TITLE_AR_TO_EN[ar]) {
    TITLE_AR_TO_EN[ar] = en.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
}

// ============================================================================
// 4. Robust Phonetic Algorithm: Latin -> Clean Arabic
// GUARANTEE: The output will NEVER contain any English/Latin letters [a-zA-Z]
// ============================================================================
export function phoneticLatinToAr(word: string): string {
  if (!word) return "";
  let w = word.toLowerCase().trim();

  // Multi-character substitutions (ordered by length)
  const digraphs: [RegExp, string][] = [
    [/^abdel[\s-]*/g, "عبد ال"],
    [/^abd[\s-]+el[\s-]*/g, "عبد ال"],
    [/^abd[\s-]+al[\s-]*/g, "عبد ال"],
    [/^el[\s-]*/g, "ال"],
    [/^al[\s-]*/g, "ال"],
    [/shch/g, "شتش"],
    [/khv/g, "خف"],
    [/tch/g, "تش"],
    [/sch/g, "ش"],
    [/sh/g, "ش"],
    [/kh/g, "خ"],
    [/th/g, "ث"],
    [/gh/g, "غ"],
    [/ph/g, "ف"],
    [/ch/g, "تش"],
    [/zh/g, "ج"],
    [/ts/g, "تس"],
    [/tz/g, "تس"],
    [/ya/g, "يا"],
    [/yu/g, "يو"],
    [/ia/g, "يا"],
    [/io/g, "يو"],
    [/iu/g, "يو"],
    [/ee/g, "ي"],
    [/oo/g, "و"],
    [/ou/g, "و"],
    [/aa/g, "ا"],
    [/ei/g, "ي"],
    [/ai/g, "اي"],
    [/ay/g, "اي"],
    [/ey/g, "ي"],
    [/ck/g, "ك"],
    [/qu/g, "كو"],
    [/ov$/g, "وف"],
    [/ev$/g, "يف"],
    [/in$/g, "ين"],
    [/ko$/g, "كو"],
    [/ka$/g, "كا"],
  ];

  for (const [regex, rep] of digraphs) {
    w = w.replace(regex, rep);
  }

  // Single character phonetic mapping
  const charMap: Record<string, string> = {
    a: "ا",
    b: "ب",
    c: "ك",
    d: "د",
    e: "ي",
    f: "ف",
    g: "ج",
    h: "ه",
    i: "ي",
    j: "ج",
    k: "ك",
    l: "ل",
    m: "م",
    n: "ن",
    o: "و",
    p: "ب",
    q: "ق",
    r: "ر",
    s: "س",
    t: "ت",
    u: "و",
    v: "ف",
    w: "و",
    x: "كس",
    y: "ي",
    z: "ز",
  };

  let result = "";
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    if (charMap[ch]) {
      if (result === "" && (ch === "e" || ch === "i" || ch === "a" || ch === "o" || ch === "u")) {
        result += "ا";
      } else if (result.endsWith("ا") && ch === "a") {
        // Skip duplicate 'a'
      } else {
        result += charMap[ch];
      }
    } else {
      result += ch;
    }
  }

  // Final check: Remove any stray English letters to guarantee 100% Arabic
  result = result.replace(/[a-zA-Z]/g, "");
  return result;
}

// ============================================================================
// 5. High-Level Helper Functions
// ============================================================================
export function hasArabic(text: string | null | undefined): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text ?? "");
}

export function hasEnglish(text: string | null | undefined): boolean {
  return /[a-zA-Z]/.test(text ?? "");
}

export function transliterateNameToken(token: string, targetLang: "ar" | "en"): string {
  if (!token || !token.trim()) return "";
  const cleaned = token.trim();

  if (targetLang === "ar") {
    const lower = cleaned.toLowerCase();
    if (NAME_EN_TO_AR[lower]) return NAME_EN_TO_AR[lower];
    const noHyphen = lower.replace(/[\-_]/g, " ");
    if (NAME_EN_TO_AR[noHyphen]) return NAME_EN_TO_AR[noHyphen];
    return phoneticLatinToAr(cleaned);
  } else {
    if (NAME_AR_TO_EN[cleaned]) return NAME_AR_TO_EN[cleaned];
    const norm = cleaned.replace(/[أإآ]/g, "ا");
    if (NAME_AR_TO_EN[norm]) return NAME_AR_TO_EN[norm];
    // Fallback capital
    return cleaned;
  }
}

export function transliterateName(fullName: string | null | undefined, targetLang: "ar" | "en"): string {
  if (!fullName || !fullName.trim()) return "";
  const cleaned = fullName.trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  return tokens.map((t) => transliterateNameToken(t, targetLang)).join(" ");
}

export function translateDepartment(dept: string | null | undefined, targetLang: "ar" | "en"): string {
  if (!dept || !dept.trim()) return "";
  const cleaned = dept.trim();
  const lower = cleaned.toLowerCase();

  if (targetLang === "ar") {
    if (DEPT_EN_TO_AR[lower]) return DEPT_EN_TO_AR[lower];
    // Partial check
    for (const [en, ar] of Object.entries(DEPT_EN_TO_AR)) {
      if (lower.includes(en)) return ar;
    }
    return transliterateName(cleaned, "ar");
  } else {
    if (DEPT_AR_TO_EN[cleaned]) return DEPT_AR_TO_EN[cleaned];
    for (const [ar, en] of Object.entries(DEPT_AR_TO_EN)) {
      if (cleaned.includes(ar)) return en;
    }
    return cleaned;
  }
}

export function translateJobTitle(title: string | null | undefined, targetLang: "ar" | "en"): string {
  if (!title || !title.trim()) return "";
  const cleaned = title.trim();
  const lower = cleaned.toLowerCase();

  if (targetLang === "ar") {
    if (TITLE_EN_TO_AR[lower]) return TITLE_EN_TO_AR[lower];

    // Compound word substitution
    const wordSubs: [RegExp, string][] = [
      [/\bcluster\b/gi, "للمجموعة"],
      [/\bgeneral manager\b/gi, "المدير العام"],
      [/\bassistant\b/gi, "مساعد"],
      [/\basst\.?\b/gi, "مساعد"],
      [/\bexecutive\b/gi, "تنفيذي"],
      [/\bmanager\b/gi, "مدير"],
      [/\bsupervisor\b/gi, "مشرف"],
      [/\bofficer\b/gi, "مسؤول"],
      [/\bcoordinator\b/gi, "منسق"],
      [/\bspecialist\b/gi, "أخصائي"],
      [/\btechnician\b/gi, "فني"],
      [/\bengineer\b/gi, "مهندس"],
      [/\battendant\b/gi, "عامل"],
      [/\bchef\b/gi, "شيف"],
      [/\bcook\b/gi, "طباخ"],
      [/\bdriver\b/gi, "سائق"],
      [/\bexpat\b/gi, "(أجنبي)"],
      [/\bsenior\b/gi, "أول"],
      [/\bdirector\b/gi, "مدير قطاع"],
      [/\bhead\b/gi, "رئيس"],
      [/\bcontroller\b/gi, "مراقب"],
      [/\bauditor\b/gi, "مراجع"],
      [/\bsecurity\b/gi, "أمن"],
      [/\boperations?\b/gi, "العمليات"],
      [/\bquality\b/gi, "الجودة"],
      [/\btrainer\b/gi, "مدرب"],
    ];

    let translated = lower;
    let anyMatched = false;
    for (const [reg, arWord] of wordSubs) {
      if (reg.test(translated)) {
        translated = translated.replace(reg, arWord);
        anyMatched = true;
      }
    }

    if (anyMatched && !hasEnglish(translated)) {
      return translated.trim();
    }

    // Direct lookup in dept or fallback transliteration
    return transliterateName(cleaned, "ar");
  } else {
    if (TITLE_AR_TO_EN[cleaned]) return TITLE_AR_TO_EN[cleaned];
    return cleaned;
  }
}

// ============================================================================
// Room Categories Translation Dictionaries
// ============================================================================
export const ROOM_CLASSIFICATION_EN_TO_AR: Record<string, string> = {
  standard: "قياسية",
  deluxe: "ديلوكس",
  "deluxe room": "غرفة ديلوكس",
  superior: "سوبيريور",
  "superior room": "غرفة سوبيريور",
  "family suite": "جناح عائلي",
  suite: "جناح",
  "junior suite": "جناح جونيور",
  "executive suite": "جناح تنفيذي",
  staff: "سكن موظفين",
  supervisor: "سكن مشرفين",
  management: "سكن إدارة",
  executive: "تنفيذي",
  vip: "كبار الشخصيات VIP",
};
export const ROOM_CLASSIFICATION_AR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(ROOM_CLASSIFICATION_EN_TO_AR).map(([en, ar]) => [ar, en.charAt(0).toUpperCase() + en.slice(1)])
);

export const ROOM_TYPE_EN_TO_AR: Record<string, string> = {
  single: "غرفة مفردة",
  "single room": "غرفة مفردة",
  double: "غرفة مزدوجة",
  "double room": "غرفة مزدوجة",
  triple: "غرفة ثلاثية",
  "triple room": "غرفة ثلاثية",
  quad: "غرفة رباعية",
  "quad room": "غرفة رباعية",
  suite: "جناح",
  studio: "ستوديو",
  dormitory: "سكن جماعي",
  dorm: "سكن جماعي",
};
export const ROOM_TYPE_AR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(ROOM_TYPE_EN_TO_AR).map(([en, ar]) => [ar, en.charAt(0).toUpperCase() + en.slice(1)])
);

export const BED_TYPE_EN_TO_AR: Record<string, string> = {
  "single bed": "سرير مفرد",
  single: "سرير مفرد",
  "twin bed": "سرير توأم",
  twin: "سرير توأم",
  "queen bed": "سرير كوين",
  queen: "سرير كوين",
  "king bed": "سرير كينج",
  king: "سرير كينج",
  "bunk bed": "سرير بطابقين",
  bunk: "سرير بطابقين",
};
export const BED_TYPE_AR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(BED_TYPE_EN_TO_AR).map(([en, ar]) => [ar, en.charAt(0).toUpperCase() + en.slice(1)])
);

export const ROOM_VIEW_EN_TO_AR: Record<string, string> = {
  "sea view": "إطلالة على البحر",
  "pool view": "إطلالة على حمام السباحة",
  "garden view": "إطلالة على الحديقة",
  "mountain view": "إطلالة جبلية",
  "back view": "إطلالة خلفية",
  "tal view": "إطلالة على التل",
  "street view": "إطلالة على الشارع",
  "city view": "إطلالة على المدينة",
  "internal view": "إطلالة داخلية",
  "lake view": "إطلالة على البحيرة",
};
export const ROOM_VIEW_AR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(ROOM_VIEW_EN_TO_AR).map(([en, ar]) => [ar, en.charAt(0).toUpperCase() + en.slice(1)])
);

export function translateLookup(
  category: string,
  value: string | null | undefined,
  targetLang: "ar" | "en"
): string {
  if (!value || !value.trim()) return "";
  const cleaned = value.trim();
  const lower = cleaned.toLowerCase();

  if (category === "department") return translateDepartment(cleaned, targetLang);
  if (category === "job_title") return translateJobTitle(cleaned, targetLang);

  if (category === "room_classification") {
    if (targetLang === "ar") {
      return ROOM_CLASSIFICATION_EN_TO_AR[lower] || cleaned;
    } else {
      return ROOM_CLASSIFICATION_AR_TO_EN[cleaned] || cleaned;
    }
  }

  if (category === "room_type") {
    if (targetLang === "ar") {
      return ROOM_TYPE_EN_TO_AR[lower] || cleaned;
    } else {
      return ROOM_TYPE_AR_TO_EN[cleaned] || cleaned;
    }
  }

  if (category === "bed_type") {
    if (targetLang === "ar") {
      return BED_TYPE_EN_TO_AR[lower] || cleaned;
    } else {
      return BED_TYPE_AR_TO_EN[cleaned] || cleaned;
    }
  }

  if (category === "room_view") {
    if (targetLang === "ar") {
      return ROOM_VIEW_EN_TO_AR[lower] || cleaned;
    } else {
      return ROOM_VIEW_AR_TO_EN[cleaned] || cleaned;
    }
  }

  return cleaned;
}

/**
 * Enriches any profile payload with full bidirectional translation:
 * - Fills missing or English-filled Arabic names
 * - Fills missing Arabic job title
 * - Fills missing Arabic department
 */
export function enrichProfileBilingual(profile: Record<string, any>): Record<string, any> {
  const p = { ...profile };

  const fnEn = String(p.firstName || "").trim();
  const lnEn = String(p.lastName || "").trim();
  const tnEn = String(p.thirdName || "").trim();
  const foEn = String(p.fourthName || "").trim();

  let fnAr = String(p.firstNameAr || "").trim();
  let lnAr = String(p.lastNameAr || "").trim();
  let tnAr = String(p.thirdNameAr || "").trim();
  let foAr = String(p.fourthNameAr || "").trim();

  // If Arabic is missing or contains English letters -> translate from English
  const arNameNeedsFix = !fnAr || hasEnglish(fnAr) || !lnAr || hasEnglish(lnAr);
  if (arNameNeedsFix && (fnEn || lnEn)) {
    if (hasArabic(fnEn)) {
      // Default field has Arabic text
      fnAr = fnEn;
      lnAr = lnEn;
      tnAr = tnEn;
      foAr = foEn;
    } else {
      fnAr = transliterateName(fnEn, "ar");
      lnAr = transliterateName(lnEn, "ar");
      tnAr = tnEn ? transliterateName(tnEn, "ar") : "";
      foAr = foEn ? transliterateName(foEn, "ar") : "";
    }
  }

  // If English is missing but Arabic is provided
  if (!fnEn && fnAr && hasArabic(fnAr)) {
    p.firstName = transliterateName(fnAr, "en");
    p.lastName = transliterateName(lnAr, "en");
    if (tnAr) p.thirdName = transliterateName(tnAr, "en");
    if (foAr) p.fourthName = transliterateName(foAr, "en");
  }

  p.firstNameAr = fnAr;
  p.lastNameAr = lnAr;
  p.thirdNameAr = tnAr;
  p.fourthNameAr = foAr;

  // Department bilingual enrichment
  let dept = String(p.department || "").trim();
  let deptAr = String(p.departmentAr || "").trim();

  if (hasArabic(dept) && !deptAr) {
    deptAr = dept;
    dept = translateDepartment(deptAr, "en");
  } else if (!dept && deptAr) {
    dept = translateDepartment(deptAr, "en");
  } else if ((!deptAr || hasEnglish(deptAr)) && dept) {
    deptAr = translateDepartment(dept, "ar");
  }
  p.department = dept;
  p.departmentAr = deptAr;

  // Job Title bilingual enrichment
  let job = String(p.jobTitle || "").trim();
  let jobAr = String(p.jobTitleAr || "").trim();

  if (hasArabic(job) && !jobAr) {
    jobAr = job;
    job = translateJobTitle(jobAr, "en");
  } else if (!job && jobAr) {
    job = translateJobTitle(jobAr, "en");
  } else if ((!jobAr || hasEnglish(jobAr)) && job) {
    jobAr = translateJobTitle(job, "ar");
  }
  p.jobTitle = job;
  p.jobTitleAr = jobAr;

  return p;
}
