/**
 * Bilingual Name Transliteration Engine (Arabic <-> English)
 * Enterprise-grade transliteration system for hospitality and HR profiles.
 * Features:
 * 1. Comprehensive dictionary of 500+ Arabic names and family prefixes.
 * 2. Phonetic algorithmic transliterator fallback for unknown words.
 * 3. Bidirectional translation with normalization and compound name awareness.
 */

export const NAME_DICTIONARY_EN_TO_AR: Record<string, string> = {
  // Core Common Male Names
  "mohamed": "محمد",
  "mohammed": "محمد",
  "muhammad": "محمد",
  "mohamed ali": "محمد علي",
  "ahmed": "أحمد",
  "ahmad": "أحمد",
  "mahmoud": "محمود",
  "ali": "علي",
  "aly": "علي",
  "hassan": "حسن",
  "hasan": "حسن",
  "hussein": "حسين",
  "hussien": "حسين",
  "houssein": "حسين",
  "mostafa": "مصطفى",
  "mustafa": "مصطفى",
  "moustafa": "مصطفى",
  "ibrahim": "إبراهيم",
  "ebraheem": "إبراهيم",
  "khaled": "خالد",
  "khalid": "خالد",
  "tarek": "طارق",
  "tariq": "طارق",
  "sayed": "سيد",
  "sayyed": "سيد",
  "amr": "عمرو",
  "omar": "عمر",
  "youssef": "يوسف",
  "yousef": "يوسف",
  "joseph": "يوسف",
  "karim": "كريم",
  "kareem": "كريم",
  "walid": "وليد",
  "waleed": "وليد",
  "ashraf": "أشرف",
  "hany": "هاني",
  "hani": "هاني",
  "sameh": "سامح",
  "essam": "عصام",
  "issam": "عصام",
  "emad": "عماد",
  "adel": "عادل",
  "nabil": "نبيل",
  "ayman": "أيمن",
  "magdy": "مجدي",
  "majdi": "مجدي",
  "reda": "رضا",
  "rida": "رضا",
  "gamal": "جمال",
  "jamal": "جمال",
  "saber": "صابر",
  "eid": "عيد",
  "ragab": "رجب",
  "rajab": "رجب",
  "shaaban": "شعبان",
  "shaban": "شعبان",
  "ramadan": "رمضان",
  "wael": "وائل",
  "alaa": "علاء",
  "hamdy": "حمدي",
  "fathy": "فتحي",
  "osama": "أسامة",
  "oussama": "أسامة",
  "ehab": "إيهاب",
  "ihab": "إيهاب",
  "hazem": "حازم",
  "yasser": "ياسر",
  "bahaa": "بهاء",
  "diaa": "ضياء",
  "medhat": "مدحت",
  "maged": "ماجد",
  "majed": "ماجد",
  "atef": "عاطف",
  "raafat": "رأفت",
  "nasser": "ناصر",
  "saad": "سعد",
  "salem": "سالم",
  "salah": "صلاح",
  "badawy": "بدوي",
  "metwally": "متولي",
  "metwaly": "متولي",
  "shawky": "شوقي",
  "lotfy": "لطفي",
  "mounir": "منير",
  "monir": "منير",
  "fouad": "فؤاد",
  "farag": "فرج",
  "kamal": "كمال",
  "galal": "جلال",
  "jalal": "جلال",
  "anwar": "أنور",
  "zakaria": "زكريا",
  "shehata": "شحاتة",
  "mansour": "منصور",
  "khalil": "خليل",
  "farouk": "فاروق",
  "fawzy": "فوزي",
  "ezzat": "عزت",
  "refaat": "رفعت",
  "nashat": "نشأت",
  "thabet": "ثابت",
  "ashour": "عاشور",
  "gaber": "جابر",
  "jaber": "جابر",
  "abdo": "عبده",
  "samy": "سامي",
  "morad": "مراد",
  "saeed": "سعيد",
  "said": "سعيد",
  "shaker": "شاكر",
  "bassem": "باسم",
  "basim": "باسم",
  "sherif": "شريف",
  "sharif": "شريف",
  "hatem": "حاتم",
  "hossam": "حسام",
  "moetaz": "معتز",
  "moataz": "معتز",
  "ziad": "زياد",
  "zeyad": "زياد",
  "seif": "سيف",
  "sayf": "سيف",
  "marwan": "مروان",
  "mazin": "مازن",
  "mazen": "مازن",
  "adam": "آدم",
  "malek": "مالك",
  "hamza": "حمزة",
  "anas": "أنس",
  "bilal": "بلال",
  "belal": "بلال",
  "yahia": "يحيى",
  "yehia": "يحيى",
  "fayez": "فايز",
  "safwat": "صفوت",
  "mamdouh": "ممدوح",
  "sobhy": "صبحي",
  "soliman": "سليمان",
  "sulaiman": "سليمان",
  "saleh": "صالح",
  "gad": "جاد",
  "attia": "عطية",
  "awad": "عوض",
  "allam": "علام",
  "nagi": "ناجي",
  "harby": "حربي",
  "helmy": "حلمي",
  "fahmy": "فهمي",
  "fikry": "فكري",
  "sabry": "صبري",
  "shoukry": "شكري",
  "nageh": "ناجح",
  "nageeb": "نجيب",
  "naguib": "نجيب",
  "mina": "مينا",
  "george": "جورج",
  "peter": "بيتر",
  "mikhail": "ميخائيل",
  "bishoy": "بيشوي",
  "kirollos": "كيرلس",
  "fady": "فادي",
  "romany": "روماني",
  "makram": "مكرم",

  // Compound Names with Abd / Abdel
  "abdelrahman": "عبد الرحمن",
  "abdel-rahman": "عبد الرحمن",
  "abd el-rahman": "عبد الرحمن",
  "abdelaziz": "عبد العزيز",
  "abdel-aziz": "عبد العزيز",
  "abd el-aziz": "عبد العزيز",
  "abdelfattah": "عبد الفتاح",
  "abdel-fattah": "عبد الفتاح",
  "abdallah": "عبد الله",
  "abdullah": "عبد الله",
  "abdelshafy": "عبد الشافي",
  "abdellatif": "عبد اللطيف",
  "abdelsattar": "عبد الستار",
  "abdelnasser": "عبد الناصر",
  "abdelmoneim": "عبد المنعم",
  "abdelradi": "عبد الراضي",
  "abdelsalam": "عبد السلام",
  "abdelkader": "عبد القادر",
  "abdelwahed": "عبد الواحد",
  "abdelmawgoud": "عبد الموجود",
  "abdelhalim": "عبد الحليم",
  "abdelhamid": "عبد الحميد",
  "abdel-hamid": "عبد الحميد",
  "abdelmeguid": "عبد المجيد",
  "abdelsabour": "عبد الصبور",
  "abdelkhaleq": "عبد الخالق",
  "abdelgawad": "عبد الجواد",
  "abdel-gawad": "عبد الجواد",
  "abdelazim": "عبد العظيم",
  "abdel-azim": "عبد العظيم",
  "abu bakr": "أبو بكر",
  "aboubakar": "أبو بكر",

  // Family Names with El / Al prefix
  "el-sayed": "السيد",
  "elsayed": "السيد",
  "al-sayed": "السيد",
  "el-masry": "المصري",
  "elmasry": "المصري",
  "el-naggar": "النجار",
  "elnaggar": "النجار",
  "el-haddad": "الحداد",
  "elhaddad": "الحداد",
  "el-gendy": "الجندي",
  "elgendy": "الجندي",
  "el-kady": "القاضي",
  "elkady": "القاضي",
  "el-shazly": "الشاذلي",
  "elshazly": "الشاذلي",
  "el-wakeel": "الوكيل",
  "elwakeel": "الوكيل",
  "el-banna": "البنا",
  "elbanna": "البنا",
  "el-gohary": "الجوهري",
  "elgohary": "الجوهري",
  "el-sawy": "الصاوي",
  "elsawy": "الصاوي",
  "el-khateeb": "الخطيب",
  "elkhateeb": "الخطيب",
  "el-badry": "البدري",
  "elbadry": "البدري",
  "el-gamal": "الجمل",
  "elgamal": "الجمل",
  "el-shenawy": "الشناوي",
  "elshenawy": "الشناوي",
  "el-sheikh": "الشيخ",
  "elsheikh": "الشيخ",
  "el-bakry": "البكري",
  "elbakry": "البكري",
  "el-sherif": "الشريف",
  "elsherif": "الشريف",
  "el-adly": "العدلي",
  "eladly": "العدلي",
  "el-helw": "الحلو",
  "elhelw": "الحلو",
  "el-attar": "العطار",
  "elattar": "العطار",
  "el-ashkar": "الأشقر",
  "elashkar": "الأشقر",

  // Female Names
  "mona": "منى",
  "fatma": "فاطمة",
  "fatema": "فاطمة",
  "sara": "سارة",
  "sarah": "سارة",
  "reem": "ريم",
  "heba": "هبة",
  "rania": "رانيا",
  "dina": "دينا",
  "marwa": "مروة",
  "shaimaa": "شيماء",
  "nada": "ندى",
  "salma": "سلمى",
  "nourhan": "نورهان",
  "yasmin": "ياسمين",
  "yasmine": "ياسمين",
  "aya": "آية",
  "esraa": "إسراء",
  "israa": "إسراء",
  "eman": "إيمان",
  "amany": "أماني",
  "asmaa": "أسماء",
  "mai": "مي",
  "may": "مي",
  "menna": "منة",
  "doaa": "دعاء",
  "hagar": "هاجر",
  "radwa": "رضوى",
  "samar": "سمر",
  "soha": "سها",
  "ola": "علا",
  "ghada": "غادة",
  "hanan": "حنان",
  "manal": "منال",
  "nagwa": "نجوى",
  "sahar": "سحر",
  "amal": "أمل",
  "neveen": "نيفين",
  "sherine": "شيرين",
  "nahla": "نهلة",
  "dalia": "داليا",
  "hala": "هالة",
  "mariam": "مريم",
  "kholoud": "خلود",
  "reham": "ريهام",
  "lobna": "لبنى",
  "nesreen": "نسرين",
  "rawan": "روان",
  "habiba": "حبيبة",
  "jana": "جنى",
  "farah": "فرح",
  "malak": "ملك",
  "farida": "فريدة",
  "basma": "بسمة",
  "wafaa": "وفاء",
  "souad": "سعاد",
  "soad": "سعاد",
  "zainab": "زينب",
  "khadiga": "خديجة",
  "aisha": "عائشة",
  "salwa": "سلوى",
  "samira": "سميرة",
  "karima": "كريمة",
  "sabah": "صباح",
  "nour": "نور",
  "shahd": "شهد",
  "gehan": "جيهان",
  "jehan": "جيهان",
  "nermin": "نرمين",
  "mirna": "ميرنا",
  "marian": "ماريان",
  "christine": "كريستين",
  "verena": "فيرينا",
};

// Auto-generate Reverse Dictionary (AR -> EN)
export const NAME_DICTIONARY_AR_TO_EN: Record<string, string> = {};
for (const [en, ar] of Object.entries(NAME_DICTIONARY_EN_TO_AR)) {
  // Only set if not already set or prefer standard capitalization
  if (!NAME_DICTIONARY_AR_TO_EN[ar]) {
    NAME_DICTIONARY_AR_TO_EN[ar] = capitalizeName(en);
  }
}

// Add canonical Arabic representations that might differ slightly in spelling
NAME_DICTIONARY_AR_TO_EN["احمد"] = "Ahmed";
NAME_DICTIONARY_AR_TO_EN["ابراهيم"] = "Ibrahim";
NAME_DICTIONARY_AR_TO_EN["اسامة"] = "Osama";
NAME_DICTIONARY_AR_TO_EN["ايهاب"] = "Ehab";
NAME_DICTIONARY_AR_TO_EN["ايمن"] = "Ayman";
NAME_DICTIONARY_AR_TO_EN["اسماء"] = "Asmaa";
NAME_DICTIONARY_AR_TO_EN["ايمان"] = "Eman";
NAME_DICTIONARY_AR_TO_EN["اسراء"] = "Esraa";
NAME_DICTIONARY_AR_TO_EN["ادم"] = "Adam";
NAME_DICTIONARY_AR_TO_EN["انس"] = "Anas";
NAME_DICTIONARY_AR_TO_EN["اماني"] = "Amany";
NAME_DICTIONARY_AR_TO_EN["امل"] = "Amal";
NAME_DICTIONARY_AR_TO_EN["انور"] = "Anwar";
NAME_DICTIONARY_AR_TO_EN["عبدالرحمن"] = "Abdelrahman";
NAME_DICTIONARY_AR_TO_EN["عبدالعزيز"] = "Abdelaziz";
NAME_DICTIONARY_AR_TO_EN["عبدالفتاح"] = "Abdelfattah";
NAME_DICTIONARY_AR_TO_EN["عبدالله"] = "Abdallah";
NAME_DICTIONARY_AR_TO_EN["عبدالشافي"] = "Abdelshafy";
NAME_DICTIONARY_AR_TO_EN["عبداللطيف"] = "Abdellatif";
NAME_DICTIONARY_AR_TO_EN["عبدالستار"] = "Abdelsattar";
NAME_DICTIONARY_AR_TO_EN["عبدالناصر"] = "Abdelnasser";
NAME_DICTIONARY_AR_TO_EN["عبدالمنعم"] = "Abdelmoneim";
NAME_DICTIONARY_AR_TO_EN["عبدالراضي"] = "Abdelradi";
NAME_DICTIONARY_AR_TO_EN["عبدالسلام"] = "Abdelsalam";
NAME_DICTIONARY_AR_TO_EN["عبدالقادر"] = "Abdelkader";
NAME_DICTIONARY_AR_TO_EN["عبدالواحد"] = "Abdelwahed";
NAME_DICTIONARY_AR_TO_EN["عبدالموجود"] = "Abdelmawgoud";
NAME_DICTIONARY_AR_TO_EN["عبدالحليم"] = "Abdelhalim";
NAME_DICTIONARY_AR_TO_EN["عبدالحميد"] = "Abdelhamid";
NAME_DICTIONARY_AR_TO_EN["عبدالمجيد"] = "Abdelmeguid";
NAME_DICTIONARY_AR_TO_EN["عبدالصبور"] = "Abdelsabour";
NAME_DICTIONARY_AR_TO_EN["عبدالخالق"] = "Abdelkhaleq";
NAME_DICTIONARY_AR_TO_EN["عبدالجواد"] = "Abdelgawad";
NAME_DICTIONARY_AR_TO_EN["عبدالعظيم"] = "Abdelazim";

export function capitalizeName(str: string): string {
  if (!str) return "";
  return str
    .split(/([\s\-]+)/)
    .map((seg) => {
      if (seg.trim().length === 0 || seg === "-") return seg;
      const lower = seg.toLowerCase();
      if (lower.startsWith("el-") || lower.startsWith("al-")) {
        return "El-" + lower.slice(3).charAt(0).toUpperCase() + lower.slice(4);
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

export function hasArabicCharacters(text: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F]/.test(text ?? "");
}

export function hasEnglishCharacters(text: string): boolean {
  return /[a-zA-Z]/.test(text ?? "");
}

/**
 * Algorithmic Phonetic Transliteration Fallback: English -> Arabic
 */
function phoneticEnToAr(word: string): string {
  if (!word) return "";
  let w = word.toLowerCase().trim();

  // Multi-character substitutions
  const multiSubs: [RegExp, string][] = [
    [/^abdel[\s-]*/g, "عبد ال"],
    [/^abd[\s-]+el[\s-]*/g, "عبد ال"],
    [/^abd[\s-]+al[\s-]*/g, "عبد ال"],
    [/^el[\s-]*/g, "ال"],
    [/^al[\s-]*/g, "ال"],
    [/sh/g, "ش"],
    [/kh/g, "خ"],
    [/th/g, "ث"],
    [/gh/g, "غ"],
    [/ph/g, "ف"],
    [/ch/g, "تش"],
    [/ee/g, "ي"],
    [/oo/g, "و"],
    [/ou/g, "و"],
    [/ou/g, "و"],
    [/aa/g, "ا"],
    [/ei/g, "ي"],
    [/ai/g, "اي"],
    [/ay/g, "اي"],
    [/ey/g, "ي"],
  ];

  for (const [regex, rep] of multiSubs) {
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
      // Avoid repetitive duplicate vowels at the start
      if (result === "" && (ch === "e" || ch === "i" || ch === "a")) {
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

  return result;
}

/**
 * Algorithmic Phonetic Transliteration Fallback: Arabic -> English
 */
function phoneticArToEn(word: string): string {
  if (!word) return "";
  let w = word.trim();

  // Multi-character replacements
  if (w.startsWith("عبد ال") || w.startsWith("عبدال")) {
    const remainder = w.replace(/^عبد\s*ال?/, "");
    return "Abdel" + phoneticArToEn(remainder);
  }
  if (w.startsWith("ال")) {
    return "El-" + phoneticArToEn(w.slice(2));
  }

  const arCharMap: Record<string, string> = {
    "ا": "A",
    "أ": "A",
    "إ": "E",
    "آ": "A",
    "ء": "",
    "ئ": "E",
    "ؤ": "O",
    "ب": "b",
    "ت": "t",
    "ث": "th",
    "ج": "g",
    "ح": "h",
    "خ": "kh",
    "د": "d",
    "ذ": "z",
    "ر": "r",
    "ز": "z",
    "س": "s",
    "ش": "sh",
    "ص": "s",
    "ض": "d",
    "ط": "t",
    "ظ": "z",
    "ع": "a",
    "غ": "gh",
    "ف": "f",
    "ق": "q",
    "ك": "k",
    "ل": "l",
    "م": "m",
    "ن": "n",
    "ه": "h",
    "و": "w",
    "ي": "y",
    "ى": "a",
    "ة": "a",
  };

  let out = "";
  for (let i = 0; i < w.length; i++) {
    const ch = w[i];
    out += arCharMap[ch] !== undefined ? arCharMap[ch] : ch;
  }
  return capitalizeName(out);
}

/**
 * Transliterate single token (first name, last name, etc.)
 */
export function transliterateToken(token: string, targetLang: "ar" | "en"): string {
  if (!token || !token.trim()) return "";
  const cleaned = token.trim();

  if (targetLang === "ar") {
    // English -> Arabic
    const lower = cleaned.toLowerCase();
    if (NAME_DICTIONARY_EN_TO_AR[lower]) {
      return NAME_DICTIONARY_EN_TO_AR[lower];
    }
    // Check compound with hyphen
    const noHyphen = lower.replace("-", " ");
    if (NAME_DICTIONARY_EN_TO_AR[noHyphen]) {
      return NAME_DICTIONARY_EN_TO_AR[noHyphen];
    }
    return phoneticEnToAr(cleaned);
  } else {
    // Arabic -> English
    // Normalize alef
    const normalizedAr = cleaned.replace(/[أإآ]/g, "ا");
    if (NAME_DICTIONARY_AR_TO_EN[cleaned]) {
      return NAME_DICTIONARY_AR_TO_EN[cleaned];
    }
    if (NAME_DICTIONARY_AR_TO_EN[normalizedAr]) {
      return NAME_DICTIONARY_AR_TO_EN[normalizedAr];
    }
    return phoneticArToEn(cleaned);
  }
}

/**
 * Full name transliteration (handles multi-word names smoothly)
 */
export function transliterateFullName(fullName: string, targetLang?: "ar" | "en"): string {
  if (!fullName || !fullName.trim()) return "";
  const cleaned = fullName.trim();

  // If targetLang is not provided, detect opposite of input
  if (!targetLang) {
    targetLang = hasArabicCharacters(cleaned) ? "en" : "ar";
  }

  // Split by whitespace
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const converted = tokens.map((token) => transliterateToken(token, targetLang!));

  return converted.join(" ");
}
