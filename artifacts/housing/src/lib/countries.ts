// @ts-nocheck
/**
 * World Countries & Nationalities Database
 * Comprehensive list of 195+ sovereign states & territories with:
 * - English & Arabic country names
 * - English & Arabic demonyms (nationalities)
 * - ISO Alpha-2 codes & Flag emojis
 * - Canonical storage value (e.g. 'Egyptian', 'Saudi')
 */

export interface Country {
  code: string;
  nameEn: string;
  nameAr: string;
  demonymEn: string;
  demonymAr: string;
  flag: string;
  value: string;
  popular?: boolean;
}

export const ALL_COUNTRIES: Country[] = [
  {
    "code": "EG",
    "nameEn": "Egypt",
    "nameAr": "مصر",
    "demonymEn": "Egyptian",
    "demonymAr": "مصري",
    "popular": true,
    "flag": "🇪🇬",
    "value": "Egyptian"
  },
  {
    "code": "SA",
    "nameEn": "Saudi Arabia",
    "nameAr": "المملكة العربية السعودية",
    "demonymEn": "Saudi",
    "demonymAr": "سعودي",
    "popular": true,
    "flag": "🇸🇦",
    "value": "Saudi"
  },
  {
    "code": "AE",
    "nameEn": "United Arab Emirates",
    "nameAr": "الإمارات العربية المتحدة",
    "demonymEn": "Emirati",
    "demonymAr": "إماراتي",
    "popular": true,
    "flag": "🇦🇪",
    "value": "Emirati"
  },
  {
    "code": "JO",
    "nameEn": "Jordan",
    "nameAr": "الأردن",
    "demonymEn": "Jordanian",
    "demonymAr": "أردني",
    "popular": true,
    "flag": "🇯🇴",
    "value": "Jordanian"
  },
  {
    "code": "KW",
    "nameEn": "Kuwait",
    "nameAr": "الكويت",
    "demonymEn": "Kuwaiti",
    "demonymAr": "كويتي",
    "popular": true,
    "flag": "🇰🇼",
    "value": "Kuwaiti"
  },
  {
    "code": "BH",
    "nameEn": "Bahrain",
    "nameAr": "البحرين",
    "demonymEn": "Bahraini",
    "demonymAr": "بحريني",
    "popular": true,
    "flag": "🇧🇭",
    "value": "Bahraini"
  },
  {
    "code": "QA",
    "nameEn": "Qatar",
    "nameAr": "قطر",
    "demonymEn": "Qatari",
    "demonymAr": "قطري",
    "popular": true,
    "flag": "🇶🇦",
    "value": "Qatari"
  },
  {
    "code": "OM",
    "nameEn": "Oman",
    "nameAr": "عمان",
    "demonymEn": "Omani",
    "demonymAr": "عماني",
    "popular": true,
    "flag": "🇴🇲",
    "value": "Omani"
  },
  {
    "code": "LB",
    "nameEn": "Lebanon",
    "nameAr": "لبنان",
    "demonymEn": "Lebanese",
    "demonymAr": "لبناني",
    "popular": true,
    "flag": "🇱🇧",
    "value": "Lebanese"
  },
  {
    "code": "SY",
    "nameEn": "Syria",
    "nameAr": "سوريا",
    "demonymEn": "Syrian",
    "demonymAr": "سوري",
    "popular": true,
    "flag": "🇸🇾",
    "value": "Syrian"
  },
  {
    "code": "PS",
    "nameEn": "Palestine",
    "nameAr": "فلسطين",
    "demonymEn": "Palestinian",
    "demonymAr": "فلسطيني",
    "popular": true,
    "flag": "🇵🇸",
    "value": "Palestinian"
  },
  {
    "code": "IQ",
    "nameEn": "Iraq",
    "nameAr": "العراق",
    "demonymEn": "Iraqi",
    "demonymAr": "عراقي",
    "popular": true,
    "flag": "🇮🇶",
    "value": "Iraqi"
  },
  {
    "code": "SD",
    "nameEn": "Sudan",
    "nameAr": "السودان",
    "demonymEn": "Sudanese",
    "demonymAr": "سوداني",
    "popular": true,
    "flag": "🇸🇩",
    "value": "Sudanese"
  },
  {
    "code": "YE",
    "nameEn": "Yemen",
    "nameAr": "اليمن",
    "demonymEn": "Yemeni",
    "demonymAr": "يمني",
    "popular": true,
    "flag": "🇾🇪",
    "value": "Yemeni"
  },
  {
    "code": "LY",
    "nameEn": "Libya",
    "nameAr": "ليبيا",
    "demonymEn": "Libyan",
    "demonymAr": "ليبي",
    "popular": true,
    "flag": "🇱🇾",
    "value": "Libyan"
  },
  {
    "code": "TN",
    "nameEn": "Tunisia",
    "nameAr": "تونس",
    "demonymEn": "Tunisian",
    "demonymAr": "تونسي",
    "popular": true,
    "flag": "🇹🇳",
    "value": "Tunisian"
  },
  {
    "code": "DZ",
    "nameEn": "Algeria",
    "nameAr": "الجزائر",
    "demonymEn": "Algerian",
    "demonymAr": "جزائري",
    "popular": true,
    "flag": "🇩🇿",
    "value": "Algerian"
  },
  {
    "code": "MA",
    "nameEn": "Morocco",
    "nameAr": "المغرب",
    "demonymEn": "Moroccan",
    "demonymAr": "مغربي",
    "popular": true,
    "flag": "🇲🇦",
    "value": "Moroccan"
  },
  {
    "code": "MR",
    "nameEn": "Mauritania",
    "nameAr": "موريتانيا",
    "demonymEn": "Mauritanian",
    "demonymAr": "موريتاني",
    "flag": "🇲🇷",
    "value": "Mauritanian"
  },
  {
    "code": "SO",
    "nameEn": "Somalia",
    "nameAr": "الصومال",
    "demonymEn": "Somali",
    "demonymAr": "صومالي",
    "flag": "🇸🇴",
    "value": "Somali"
  },
  {
    "code": "DJ",
    "nameEn": "Djibouti",
    "nameAr": "جيبوتي",
    "demonymEn": "Djiboutian",
    "demonymAr": "جيبوتي",
    "flag": "🇩🇯",
    "value": "Djiboutian"
  },
  {
    "code": "KM",
    "nameEn": "Comoros",
    "nameAr": "جزر القمر",
    "demonymEn": "Comorian",
    "demonymAr": "قمري",
    "flag": "🇰🇲",
    "value": "Comorian"
  },
  {
    "code": "IN",
    "nameEn": "India",
    "nameAr": "الهند",
    "demonymEn": "Indian",
    "demonymAr": "هندي",
    "popular": true,
    "flag": "🇮🇳",
    "value": "Indian"
  },
  {
    "code": "PH",
    "nameEn": "Philippines",
    "nameAr": "الفلبين",
    "demonymEn": "Filipino",
    "demonymAr": "فلبيني",
    "popular": true,
    "flag": "🇵🇭",
    "value": "Filipino"
  },
  {
    "code": "PK",
    "nameEn": "Pakistan",
    "nameAr": "باكستان",
    "demonymEn": "Pakistani",
    "demonymAr": "باكستاني",
    "popular": true,
    "flag": "🇵🇰",
    "value": "Pakistani"
  },
  {
    "code": "BD",
    "nameEn": "Bangladesh",
    "nameAr": "بنغلاديش",
    "demonymEn": "Bangladeshi",
    "demonymAr": "بنغالي",
    "popular": true,
    "flag": "🇧🇩",
    "value": "Bangladeshi"
  },
  {
    "code": "NP",
    "nameEn": "Nepal",
    "nameAr": "نيبال",
    "demonymEn": "Nepalese",
    "demonymAr": "نيبالي",
    "flag": "🇳🇵",
    "value": "Nepalese"
  },
  {
    "code": "LK",
    "nameEn": "Sri Lanka",
    "nameAr": "سريلانكا",
    "demonymEn": "Sri Lankan",
    "demonymAr": "سريلانكي",
    "flag": "🇱🇰",
    "value": "Sri Lankan"
  },
  {
    "code": "GB",
    "nameEn": "United Kingdom",
    "nameAr": "المملكة المتحدة",
    "demonymEn": "British",
    "demonymAr": "بريطاني",
    "popular": true,
    "flag": "🇬🇧",
    "value": "British"
  },
  {
    "code": "US",
    "nameEn": "United States",
    "nameAr": "الولايات المتحدة",
    "demonymEn": "American",
    "demonymAr": "أمريكي",
    "popular": true,
    "flag": "🇺🇸",
    "value": "American"
  },
  {
    "code": "DE",
    "nameEn": "Germany",
    "nameAr": "ألمانيا",
    "demonymEn": "German",
    "demonymAr": "ألماني",
    "popular": true,
    "flag": "🇩🇪",
    "value": "German"
  },
  {
    "code": "FR",
    "nameEn": "France",
    "nameAr": "فرنسا",
    "demonymEn": "French",
    "demonymAr": "فرنسي",
    "popular": true,
    "flag": "🇫🇷",
    "value": "French"
  },
  {
    "code": "IT",
    "nameEn": "Italy",
    "nameAr": "إيطاليا",
    "demonymEn": "Italian",
    "demonymAr": "إيطالي",
    "popular": true,
    "flag": "🇮🇹",
    "value": "Italian"
  },
  {
    "code": "RU",
    "nameEn": "Russia",
    "nameAr": "روسيا",
    "demonymEn": "Russian",
    "demonymAr": "روسي",
    "popular": true,
    "flag": "🇷🇺",
    "value": "Russian"
  },
  {
    "code": "UA",
    "nameEn": "Ukraine",
    "nameAr": "أوكرانيا",
    "demonymEn": "Ukrainian",
    "demonymAr": "أوكراني",
    "popular": true,
    "flag": "🇺🇦",
    "value": "Ukrainian"
  },
  {
    "code": "TR",
    "nameEn": "Turkey",
    "nameAr": "تركيا",
    "demonymEn": "Turkish",
    "demonymAr": "تركي",
    "popular": true,
    "flag": "🇹🇷",
    "value": "Turkish"
  },
  {
    "code": "AL",
    "nameEn": "Albania",
    "nameAr": "ألبانيا",
    "demonymEn": "Albanian",
    "demonymAr": "ألباني",
    "flag": "🇦🇱",
    "value": "Albanian"
  },
  {
    "code": "AD",
    "nameEn": "Andorra",
    "nameAr": "أندورا",
    "demonymEn": "Andorran",
    "demonymAr": "أندوري",
    "flag": "🇦🇩",
    "value": "Andorran"
  },
  {
    "code": "AT",
    "nameEn": "Austria",
    "nameAr": "النمسا",
    "demonymEn": "Austrian",
    "demonymAr": "نمساوي",
    "flag": "🇦🇹",
    "value": "Austrian"
  },
  {
    "code": "BY",
    "nameEn": "Belarus",
    "nameAr": "بيلاروسيا",
    "demonymEn": "Belarusian",
    "demonymAr": "بيلاروسي",
    "flag": "🇧🇾",
    "value": "Belarusian"
  },
  {
    "code": "BE",
    "nameEn": "Belgium",
    "nameAr": "بلجيكا",
    "demonymEn": "Belgian",
    "demonymAr": "بلجيكي",
    "flag": "🇧🇪",
    "value": "Belgian"
  },
  {
    "code": "BA",
    "nameEn": "Bosnia and Herzegovina",
    "nameAr": "البوسنة والهرسك",
    "demonymEn": "Bosnian",
    "demonymAr": "بوسني",
    "flag": "🇧🇦",
    "value": "Bosnian"
  },
  {
    "code": "BG",
    "nameEn": "Bulgaria",
    "nameAr": "بلغاريا",
    "demonymEn": "Bulgarian",
    "demonymAr": "بلغاري",
    "flag": "🇧🇬",
    "value": "Bulgarian"
  },
  {
    "code": "HR",
    "nameEn": "Croatia",
    "nameAr": "كرواتيا",
    "demonymEn": "Croatian",
    "demonymAr": "كرواتي",
    "flag": "🇭🇷",
    "value": "Croatian"
  },
  {
    "code": "CY",
    "nameEn": "Cyprus",
    "nameAr": "قبرص",
    "demonymEn": "Cypriot",
    "demonymAr": "قبرصي",
    "flag": "🇨🇾",
    "value": "Cypriot"
  },
  {
    "code": "CZ",
    "nameEn": "Czech Republic",
    "nameAr": "التشيك",
    "demonymEn": "Czech",
    "demonymAr": "تشيكي",
    "flag": "🇨🇿",
    "value": "Czech"
  },
  {
    "code": "DK",
    "nameEn": "Denmark",
    "nameAr": "الدنمارك",
    "demonymEn": "Danish",
    "demonymAr": "دنماركي",
    "flag": "🇩🇰",
    "value": "Danish"
  },
  {
    "code": "EE",
    "nameEn": "Estonia",
    "nameAr": "إستونيا",
    "demonymEn": "Estonian",
    "demonymAr": "إستوني",
    "flag": "🇪🇪",
    "value": "Estonian"
  },
  {
    "code": "FI",
    "nameEn": "Finland",
    "nameAr": "فنلندا",
    "demonymEn": "Finnish",
    "demonymAr": "فنلندي",
    "flag": "🇫🇮",
    "value": "Finnish"
  },
  {
    "code": "GE",
    "nameEn": "Georgia",
    "nameAr": "جورجيا",
    "demonymEn": "Georgian",
    "demonymAr": "جورجي",
    "flag": "🇬🇪",
    "value": "Georgian"
  },
  {
    "code": "GR",
    "nameEn": "Greece",
    "nameAr": "اليونان",
    "demonymEn": "Greek",
    "demonymAr": "يوناني",
    "flag": "🇬🇷",
    "value": "Greek"
  },
  {
    "code": "HU",
    "nameEn": "Hungary",
    "nameAr": "المجر",
    "demonymEn": "Hungarian",
    "demonymAr": "مجري",
    "flag": "🇭🇺",
    "value": "Hungarian"
  },
  {
    "code": "IS",
    "nameEn": "Iceland",
    "nameAr": "آيسلندا",
    "demonymEn": "Icelandic",
    "demonymAr": "آيسلندي",
    "flag": "🇮🇸",
    "value": "Icelandic"
  },
  {
    "code": "IE",
    "nameEn": "Ireland",
    "nameAr": "أيرلندا",
    "demonymEn": "Irish",
    "demonymAr": "أيرلندي",
    "flag": "🇮🇪",
    "value": "Irish"
  },
  {
    "code": "KZ",
    "nameEn": "Kazakhstan",
    "nameAr": "كازاخستان",
    "demonymEn": "Kazakhstani",
    "demonymAr": "كازاخستاني",
    "flag": "🇰🇿",
    "value": "Kazakhstani"
  },
  {
    "code": "XK",
    "nameEn": "Kosovo",
    "nameAr": "كوسوفو",
    "demonymEn": "Kosovar",
    "demonymAr": "كوسوفي",
    "flag": "🇽🇰",
    "value": "Kosovar"
  },
  {
    "code": "LV",
    "nameEn": "Latvia",
    "nameAr": "لاتفيا",
    "demonymEn": "Latvian",
    "demonymAr": "لاتفي",
    "flag": "🇱🇻",
    "value": "Latvian"
  },
  {
    "code": "LI",
    "nameEn": "Liechtenstein",
    "nameAr": "ليختنشتاين",
    "demonymEn": "Liechtensteiner",
    "demonymAr": "ليختنشتايني",
    "flag": "🇱🇮",
    "value": "Liechtensteiner"
  },
  {
    "code": "LT",
    "nameEn": "Lithuania",
    "nameAr": "ليتوانيا",
    "demonymEn": "Lithuanian",
    "demonymAr": "ليتواني",
    "flag": "🇱🇹",
    "value": "Lithuanian"
  },
  {
    "code": "LU",
    "nameEn": "Luxembourg",
    "nameAr": "لوكسمبورغ",
    "demonymEn": "Luxembourgish",
    "demonymAr": "لوكسمبورغي",
    "flag": "🇱🇺",
    "value": "Luxembourgish"
  },
  {
    "code": "MT",
    "nameEn": "Malta",
    "nameAr": "مالطا",
    "demonymEn": "Maltese",
    "demonymAr": "مالطي",
    "flag": "🇲🇹",
    "value": "Maltese"
  },
  {
    "code": "MD",
    "nameEn": "Moldova",
    "nameAr": "مولدوفا",
    "demonymEn": "Moldovan",
    "demonymAr": "مولدوفي",
    "flag": "🇲🇩",
    "value": "Moldovan"
  },
  {
    "code": "MC",
    "nameEn": "Monaco",
    "nameAr": "موناكو",
    "demonymEn": "Monegasque",
    "demonymAr": "موناكي",
    "flag": "🇲🇨",
    "value": "Monegasque"
  },
  {
    "code": "ME",
    "nameEn": "Montenegro",
    "nameAr": "الجبل الأسود",
    "demonymEn": "Montenegrin",
    "demonymAr": "مونتينيغري",
    "flag": "🇲🇪",
    "value": "Montenegrin"
  },
  {
    "code": "NL",
    "nameEn": "Netherlands",
    "nameAr": "هولندا",
    "demonymEn": "Dutch",
    "demonymAr": "هولندي",
    "flag": "🇳🇱",
    "value": "Dutch"
  },
  {
    "code": "MK",
    "nameEn": "North Macedonia",
    "nameAr": "مقدونيا الشمالية",
    "demonymEn": "Macedonian",
    "demonymAr": "مقدوني",
    "flag": "🇲🇰",
    "value": "Macedonian"
  },
  {
    "code": "NO",
    "nameEn": "Norway",
    "nameAr": "النرويج",
    "demonymEn": "Norwegian",
    "demonymAr": "نرويجي",
    "flag": "🇳🇴",
    "value": "Norwegian"
  },
  {
    "code": "PL",
    "nameEn": "Poland",
    "nameAr": "بولندا",
    "demonymEn": "Polish",
    "demonymAr": "بولندي",
    "flag": "🇵🇱",
    "value": "Polish"
  },
  {
    "code": "PT",
    "nameEn": "Portugal",
    "nameAr": "البرتغال",
    "demonymEn": "Portuguese",
    "demonymAr": "برتغالي",
    "flag": "🇵🇹",
    "value": "Portuguese"
  },
  {
    "code": "RO",
    "nameEn": "Romania",
    "nameAr": "رومانيا",
    "demonymEn": "Romanian",
    "demonymAr": "روماني",
    "flag": "🇷🇴",
    "value": "Romanian"
  },
  {
    "code": "SM",
    "nameEn": "San Marino",
    "nameAr": "سان مارينو",
    "demonymEn": "Sammarinese",
    "demonymAr": "سان ماريني",
    "flag": "🇸🇲",
    "value": "Sammarinese"
  },
  {
    "code": "RS",
    "nameEn": "Serbia",
    "nameAr": "صربيا",
    "demonymEn": "Serbian",
    "demonymAr": "صربي",
    "flag": "🇷🇸",
    "value": "Serbian"
  },
  {
    "code": "SK",
    "nameEn": "Slovakia",
    "nameAr": "سلوفاكيا",
    "demonymEn": "Slovak",
    "demonymAr": "سلوفاكي",
    "flag": "🇸🇰",
    "value": "Slovak"
  },
  {
    "code": "SI",
    "nameEn": "Slovenia",
    "nameAr": "سلوفينيا",
    "demonymEn": "Slovenian",
    "demonymAr": "سلوفيني",
    "flag": "🇸🇮",
    "value": "Slovenian"
  },
  {
    "code": "ES",
    "nameEn": "Spain",
    "nameAr": "إسبانيا",
    "demonymEn": "Spanish",
    "demonymAr": "إسباني",
    "flag": "🇪🇸",
    "value": "Spanish"
  },
  {
    "code": "SE",
    "nameEn": "Sweden",
    "nameAr": "السويد",
    "demonymEn": "Swedish",
    "demonymAr": "سويدي",
    "flag": "🇸🇪",
    "value": "Swedish"
  },
  {
    "code": "CH",
    "nameEn": "Switzerland",
    "nameAr": "سويسرا",
    "demonymEn": "Swiss",
    "demonymAr": "سويسري",
    "flag": "🇨🇭",
    "value": "Swiss"
  },
  {
    "code": "VA",
    "nameEn": "Vatican City",
    "nameAr": "الفاتيكان",
    "demonymEn": "Vatican",
    "demonymAr": "فاتيكاني",
    "flag": "🇻🇦",
    "value": "Vatican"
  },
  {
    "code": "AF",
    "nameEn": "Afghanistan",
    "nameAr": "أفغانستان",
    "demonymEn": "Afghan",
    "demonymAr": "أفغاني",
    "flag": "🇦🇫",
    "value": "Afghan"
  },
  {
    "code": "AM",
    "nameEn": "Armenia",
    "nameAr": "أرمينيا",
    "demonymEn": "Armenian",
    "demonymAr": "أرميني",
    "flag": "🇦🇲",
    "value": "Armenian"
  },
  {
    "code": "AZ",
    "nameEn": "Azerbaijan",
    "nameAr": "أذربيجان",
    "demonymEn": "Azerbaijani",
    "demonymAr": "أذربيجاني",
    "flag": "🇦🇿",
    "value": "Azerbaijani"
  },
  {
    "code": "BT",
    "nameEn": "Bhutan",
    "nameAr": "بوتان",
    "demonymEn": "Bhutanese",
    "demonymAr": "بوتاني",
    "flag": "🇧🇹",
    "value": "Bhutanese"
  },
  {
    "code": "BN",
    "nameEn": "Brunei",
    "nameAr": "بروناي",
    "demonymEn": "Bruneian",
    "demonymAr": "بروناوي",
    "flag": "🇧🇳",
    "value": "Bruneian"
  },
  {
    "code": "KH",
    "nameEn": "Cambodia",
    "nameAr": "كمبوديا",
    "demonymEn": "Cambodian",
    "demonymAr": "كمبودي",
    "flag": "🇰🇭",
    "value": "Cambodian"
  },
  {
    "code": "CN",
    "nameEn": "China",
    "nameAr": "الصين",
    "demonymEn": "Chinese",
    "demonymAr": "صيني",
    "popular": true,
    "flag": "🇨🇳",
    "value": "Chinese"
  },
  {
    "code": "ID",
    "nameEn": "Indonesia",
    "nameAr": "إندونيسيا",
    "demonymEn": "Indonesian",
    "demonymAr": "إندونيسي",
    "flag": "🇮🇩",
    "value": "Indonesian"
  },
  {
    "code": "IR",
    "nameEn": "Iran",
    "nameAr": "إيران",
    "demonymEn": "Iranian",
    "demonymAr": "إيراني",
    "flag": "🇮🇷",
    "value": "Iranian"
  },
  {
    "code": "JP",
    "nameEn": "Japan",
    "nameAr": "اليابان",
    "demonymEn": "Japanese",
    "demonymAr": "ياباني",
    "flag": "🇯🇵",
    "value": "Japanese"
  },
  {
    "code": "KG",
    "nameEn": "Kyrgyzstan",
    "nameAr": "قيرغيزستان",
    "demonymEn": "Kyrgyzstani",
    "demonymAr": "قيرغيزي",
    "flag": "🇰🇬",
    "value": "Kyrgyzstani"
  },
  {
    "code": "LA",
    "nameEn": "Laos",
    "nameAr": "لاوس",
    "demonymEn": "Laotian",
    "demonymAr": "لاوسي",
    "flag": "🇱🇦",
    "value": "Laotian"
  },
  {
    "code": "MY",
    "nameEn": "Malaysia",
    "nameAr": "ماليزيا",
    "demonymEn": "Malaysian",
    "demonymAr": "ماليزي",
    "flag": "🇲🇾",
    "value": "Malaysian"
  },
  {
    "code": "MV",
    "nameEn": "Maldives",
    "nameAr": "المالديف",
    "demonymEn": "Maldivian",
    "demonymAr": "مالديفي",
    "flag": "🇲🇻",
    "value": "Maldivian"
  },
  {
    "code": "MN",
    "nameEn": "Mongolia",
    "nameAr": "منغوليا",
    "demonymEn": "Mongolian",
    "demonymAr": "منغولي",
    "flag": "🇲🇳",
    "value": "Mongolian"
  },
  {
    "code": "MM",
    "nameEn": "Myanmar",
    "nameAr": "ميانمار",
    "demonymEn": "Burmese",
    "demonymAr": "بورمي",
    "flag": "🇲🇲",
    "value": "Burmese"
  },
  {
    "code": "KP",
    "nameEn": "North Korea",
    "nameAr": "كوريا الشمالية",
    "demonymEn": "North Korean",
    "demonymAr": "كوري شمالي",
    "flag": "🇰🇵",
    "value": "North Korean"
  },
  {
    "code": "KR",
    "nameEn": "South Korea",
    "nameAr": "كوريا الجنوبية",
    "demonymEn": "South Korean",
    "demonymAr": "كوري جنوبي",
    "flag": "🇰🇷",
    "value": "South Korean"
  },
  {
    "code": "SG",
    "nameEn": "Singapore",
    "nameAr": "سنغافورة",
    "demonymEn": "Singaporean",
    "demonymAr": "سنغافوري",
    "flag": "🇸🇬",
    "value": "Singaporean"
  },
  {
    "code": "TW",
    "nameEn": "Taiwan",
    "nameAr": "تايوان",
    "demonymEn": "Taiwanese",
    "demonymAr": "تايواني",
    "flag": "🇹🇼",
    "value": "Taiwanese"
  },
  {
    "code": "TJ",
    "nameEn": "Tajikistan",
    "nameAr": "طاجيكستان",
    "demonymEn": "Tajik",
    "demonymAr": "طاجيكي",
    "flag": "🇹🇯",
    "value": "Tajik"
  },
  {
    "code": "TH",
    "nameEn": "Thailand",
    "nameAr": "تايلاند",
    "demonymEn": "Thai",
    "demonymAr": "تايلاندي",
    "flag": "🇹🇭",
    "value": "Thai"
  },
  {
    "code": "TL",
    "nameEn": "Timor-Leste",
    "nameAr": "تيمور الشرقية",
    "demonymEn": "Timorese",
    "demonymAr": "تيموري",
    "flag": "🇹🇱",
    "value": "Timorese"
  },
  {
    "code": "TM",
    "nameEn": "Turkmenistan",
    "nameAr": "تركمانستان",
    "demonymEn": "Turkmen",
    "demonymAr": "تركماني",
    "flag": "🇹🇲",
    "value": "Turkmen"
  },
  {
    "code": "UZ",
    "nameEn": "Uzbekistan",
    "nameAr": "أوزبكستان",
    "demonymEn": "Uzbek",
    "demonymAr": "أوزبكي",
    "flag": "🇺🇿",
    "value": "Uzbek"
  },
  {
    "code": "VN",
    "nameEn": "Vietnam",
    "nameAr": "فيتنام",
    "demonymEn": "Vietnamese",
    "demonymAr": "فيتنامي",
    "flag": "🇻🇳",
    "value": "Vietnamese"
  },
  {
    "code": "AO",
    "nameEn": "Angola",
    "nameAr": "أنغولا",
    "demonymEn": "Angolan",
    "demonymAr": "أنغولي",
    "flag": "🇦🇴",
    "value": "Angolan"
  },
  {
    "code": "BJ",
    "nameEn": "Benin",
    "nameAr": "بنين",
    "demonymEn": "Beninese",
    "demonymAr": "بنيني",
    "flag": "🇧🇯",
    "value": "Beninese"
  },
  {
    "code": "BW",
    "nameEn": "Botswana",
    "nameAr": "بوتسوانا",
    "demonymEn": "Motswana",
    "demonymAr": "بوتسواني",
    "flag": "🇧🇼",
    "value": "Motswana"
  },
  {
    "code": "BF",
    "nameEn": "Burkina Faso",
    "nameAr": "بوركينا فاسو",
    "demonymEn": "Burkinabe",
    "demonymAr": "بوركيني",
    "flag": "🇧🇫",
    "value": "Burkinabe"
  },
  {
    "code": "BI",
    "nameEn": "Burundi",
    "nameAr": "بوروندي",
    "demonymEn": "Burundian",
    "demonymAr": "بوروندي",
    "flag": "🇧🇮",
    "value": "Burundian"
  },
  {
    "code": "CV",
    "nameEn": "Cabo Verde",
    "nameAr": "الرأس الأخضر",
    "demonymEn": "Cape Verdean",
    "demonymAr": "رأس أخضري",
    "flag": "🇨🇻",
    "value": "Cape Verdean"
  },
  {
    "code": "CM",
    "nameEn": "Cameroon",
    "nameAr": "الكاميرون",
    "demonymEn": "Cameroonian",
    "demonymAr": "كاميروني",
    "flag": "🇨🇲",
    "value": "Cameroonian"
  },
  {
    "code": "CF",
    "nameEn": "Central African Republic",
    "nameAr": "جمهورية أفريقيا الوسطى",
    "demonymEn": "Central African",
    "demonymAr": "أفريقي أوسطي",
    "flag": "🇨🇫",
    "value": "Central African"
  },
  {
    "code": "TD",
    "nameEn": "Chad",
    "nameAr": "تشاد",
    "demonymEn": "Chadian",
    "demonymAr": "تشادي",
    "flag": "🇹🇩",
    "value": "Chadian"
  },
  {
    "code": "CD",
    "nameEn": "DR Congo",
    "nameAr": "جمهورية الكونغو الديمقراطية",
    "demonymEn": "Congolese",
    "demonymAr": "كونغولي",
    "flag": "🇨🇩",
    "value": "Congolese"
  },
  {
    "code": "CG",
    "nameEn": "Republic of the Congo",
    "nameAr": "جمهورية الكونغو",
    "demonymEn": "Congolese",
    "demonymAr": "كونغولي",
    "flag": "🇨🇬",
    "value": "Congolese"
  },
  {
    "code": "CI",
    "nameEn": "Ivory Coast",
    "nameAr": "ساحل العاج",
    "demonymEn": "Ivorian",
    "demonymAr": "إيفواري",
    "flag": "🇨🇮",
    "value": "Ivorian"
  },
  {
    "code": "GQ",
    "nameEn": "Equatorial Guinea",
    "nameAr": "غينيا الاستوائية",
    "demonymEn": "Equatorial Guinean",
    "demonymAr": "غيني استوائي",
    "flag": "🇬🇶",
    "value": "Equatorial Guinean"
  },
  {
    "code": "ER",
    "nameEn": "Eritrea",
    "nameAr": "إريتريا",
    "demonymEn": "Eritrean",
    "demonymAr": "إريتري",
    "flag": "🇪🇷",
    "value": "Eritrean"
  },
  {
    "code": "SZ",
    "nameEn": "Eswatini",
    "nameAr": "إسواتيني",
    "demonymEn": "Swazi",
    "demonymAr": "سوازي",
    "flag": "🇸🇿",
    "value": "Swazi"
  },
  {
    "code": "ET",
    "nameEn": "Ethiopia",
    "nameAr": "إثيوبيا",
    "demonymEn": "Ethiopian",
    "demonymAr": "إثيوبي",
    "flag": "🇪🇹",
    "value": "Ethiopian"
  },
  {
    "code": "GA",
    "nameEn": "Gabon",
    "nameAr": "الغابون",
    "demonymEn": "Gabonese",
    "demonymAr": "غابوني",
    "flag": "🇬🇦",
    "value": "Gabonese"
  },
  {
    "code": "GM",
    "nameEn": "Gambia",
    "nameAr": "غامبيا",
    "demonymEn": "Gambian",
    "demonymAr": "غامبي",
    "flag": "🇬🇲",
    "value": "Gambian"
  },
  {
    "code": "GH",
    "nameEn": "Ghana",
    "nameAr": "غانا",
    "demonymEn": "Ghanaian",
    "demonymAr": "غاني",
    "flag": "🇬🇭",
    "value": "Ghanaian"
  },
  {
    "code": "GN",
    "nameEn": "Guinea",
    "nameAr": "غينيا",
    "demonymEn": "Guinean",
    "demonymAr": "غيني",
    "flag": "🇬🇳",
    "value": "Guinean"
  },
  {
    "code": "GW",
    "nameEn": "Guinea-Bissau",
    "nameAr": "غينيا بيساو",
    "demonymEn": "Bissau-Guinean",
    "demonymAr": "غيني بيساوي",
    "flag": "🇬🇼",
    "value": "Bissau-Guinean"
  },
  {
    "code": "KE",
    "nameEn": "Kenya",
    "nameAr": "كينيا",
    "demonymEn": "Kenyan",
    "demonymAr": "كيني",
    "flag": "🇰🇪",
    "value": "Kenyan"
  },
  {
    "code": "LS",
    "nameEn": "Lesotho",
    "nameAr": "ليسوتو",
    "demonymEn": "Mosotho",
    "demonymAr": "ليوتوي",
    "flag": "🇱🇸",
    "value": "Mosotho"
  },
  {
    "code": "LR",
    "nameEn": "Liberia",
    "nameAr": "ليبيريا",
    "demonymEn": "Liberian",
    "demonymAr": "ليبيري",
    "flag": "🇱🇷",
    "value": "Liberian"
  },
  {
    "code": "MG",
    "nameEn": "Madagascar",
    "nameAr": "مدغشقر",
    "demonymEn": "Malagasy",
    "demonymAr": "مدغشقري",
    "flag": "🇲🇬",
    "value": "Malagasy"
  },
  {
    "code": "MW",
    "nameEn": "Malawi",
    "nameAr": "مالاوي",
    "demonymEn": "Malawian",
    "demonymAr": "مالاوي",
    "flag": "🇲🇼",
    "value": "Malawian"
  },
  {
    "code": "ML",
    "nameEn": "Mali",
    "nameAr": "مالي",
    "demonymEn": "Malian",
    "demonymAr": "مالي",
    "flag": "🇲🇱",
    "value": "Malian"
  },
  {
    "code": "MU",
    "nameEn": "Mauritius",
    "nameAr": "موريشيوس",
    "demonymEn": "Mauritian",
    "demonymAr": "موريشيوسي",
    "flag": "🇲🇺",
    "value": "Mauritian"
  },
  {
    "code": "MZ",
    "nameEn": "Mozambique",
    "nameAr": "موزمبيق",
    "demonymEn": "Mozambican",
    "demonymAr": "موزمبيقي",
    "flag": "🇲🇿",
    "value": "Mozambican"
  },
  {
    "code": "NA",
    "nameEn": "Namibia",
    "nameAr": "ناميبيا",
    "demonymEn": "Namibian",
    "demonymAr": "ناميبي",
    "flag": "🇳🇦",
    "value": "Namibian"
  },
  {
    "code": "NE",
    "nameEn": "Niger",
    "nameAr": "النيجر",
    "demonymEn": "Nigerien",
    "demonymAr": "نيجري",
    "flag": "🇳🇪",
    "value": "Nigerien"
  },
  {
    "code": "NG",
    "nameEn": "Nigeria",
    "nameAr": "نيجيريا",
    "demonymEn": "Nigerian",
    "demonymAr": "نيجيري",
    "flag": "🇳🇬",
    "value": "Nigerian"
  },
  {
    "code": "RW",
    "nameEn": "Rwanda",
    "nameAr": "رواندا",
    "demonymEn": "Rwandan",
    "demonymAr": "رواندي",
    "flag": "🇷🇼",
    "value": "Rwandan"
  },
  {
    "code": "ST",
    "nameEn": "Sao Tome and Principe",
    "nameAr": "ساو تومي وبرينسيبي",
    "demonymEn": "Sao Tomean",
    "demonymAr": "ساوتومي",
    "flag": "🇸🇹",
    "value": "Sao Tomean"
  },
  {
    "code": "SN",
    "nameEn": "Senegal",
    "nameAr": "السنغال",
    "demonymEn": "Senegalese",
    "demonymAr": "سنغالي",
    "flag": "🇸🇳",
    "value": "Senegalese"
  },
  {
    "code": "SC",
    "nameEn": "Seychelles",
    "nameAr": "سيشل",
    "demonymEn": "Seychellois",
    "demonymAr": "سيشلي",
    "flag": "🇸🇨",
    "value": "Seychellois"
  },
  {
    "code": "SL",
    "nameEn": "Sierra Leone",
    "nameAr": "سيراليون",
    "demonymEn": "Sierra Leonean",
    "demonymAr": "سيراليوني",
    "flag": "🇸🇱",
    "value": "Sierra Leonean"
  },
  {
    "code": "ZA",
    "nameEn": "South Africa",
    "nameAr": "جنوب أفريقيا",
    "demonymEn": "South African",
    "demonymAr": "جنوب أفريقي",
    "flag": "🇿🇦",
    "value": "South African"
  },
  {
    "code": "SS",
    "nameEn": "South Sudan",
    "nameAr": "جنوب السودان",
    "demonymEn": "South Sudanese",
    "demonymAr": "جنوب سوداني",
    "flag": "🇸🇸",
    "value": "South Sudanese"
  },
  {
    "code": "TZ",
    "nameEn": "Tanzania",
    "nameAr": "تنزانيا",
    "demonymEn": "Tanzanian",
    "demonymAr": "تنزاني",
    "flag": "🇹🇿",
    "value": "Tanzanian"
  },
  {
    "code": "TG",
    "nameEn": "Togo",
    "nameAr": "توغو",
    "demonymEn": "Togolese",
    "demonymAr": "توغولي",
    "flag": "🇹🇬",
    "value": "Togolese"
  },
  {
    "code": "UG",
    "nameEn": "Uganda",
    "nameAr": "أوغندا",
    "demonymEn": "Ugandan",
    "demonymAr": "أوغندي",
    "flag": "🇺🇬",
    "value": "Ugandan"
  },
  {
    "code": "ZM",
    "nameEn": "Zambia",
    "nameAr": "زامبيا",
    "demonymEn": "Zambian",
    "demonymAr": "زامبي",
    "flag": "🇿🇲",
    "value": "Zambian"
  },
  {
    "code": "ZW",
    "nameEn": "Zimbabwe",
    "nameAr": "زيمبابوي",
    "demonymEn": "Zimbabwean",
    "demonymAr": "زيمبابوي",
    "flag": "🇿🇼",
    "value": "Zimbabwean"
  },
  {
    "code": "CA",
    "nameEn": "Canada",
    "nameAr": "كندا",
    "demonymEn": "Canadian",
    "demonymAr": "كندي",
    "popular": true,
    "flag": "🇨🇦",
    "value": "Canadian"
  },
  {
    "code": "MX",
    "nameEn": "Mexico",
    "nameAr": "المكسيك",
    "demonymEn": "Mexican",
    "demonymAr": "مكسيكي",
    "flag": "🇲🇽",
    "value": "Mexican"
  },
  {
    "code": "AG",
    "nameEn": "Antigua and Barbuda",
    "nameAr": "أنتيغوا وبربودا",
    "demonymEn": "Antiguan",
    "demonymAr": "أنتيغوي",
    "flag": "🇦🇬",
    "value": "Antiguan"
  },
  {
    "code": "BS",
    "nameEn": "Bahamas",
    "nameAr": "جزر البهاما",
    "demonymEn": "Bahamian",
    "demonymAr": "باهامي",
    "flag": "🇧🇸",
    "value": "Bahamian"
  },
  {
    "code": "BB",
    "nameEn": "Barbados",
    "nameAr": "باربادوس",
    "demonymEn": "Barbadian",
    "demonymAr": "باربادوسي",
    "flag": "🇧🇧",
    "value": "Barbadian"
  },
  {
    "code": "BZ",
    "nameEn": "Belize",
    "nameAr": "بليز",
    "demonymEn": "Belizean",
    "demonymAr": "بليزي",
    "flag": "🇧🇿",
    "value": "Belizean"
  },
  {
    "code": "CR",
    "nameEn": "Costa Rica",
    "nameAr": "كوستاريكا",
    "demonymEn": "Costa Rican",
    "demonymAr": "كوستاريكي",
    "flag": "🇨🇷",
    "value": "Costa Rican"
  },
  {
    "code": "CU",
    "nameEn": "Cuba",
    "nameAr": "كوبا",
    "demonymEn": "Cuban",
    "demonymAr": "كوبي",
    "flag": "🇨🇺",
    "value": "Cuban"
  },
  {
    "code": "DM",
    "nameEn": "Dominica",
    "nameAr": "دومينيكا",
    "demonymEn": "Dominican",
    "demonymAr": "دومينيكي",
    "flag": "🇩🇲",
    "value": "Dominican"
  },
  {
    "code": "DO",
    "nameEn": "Dominican Republic",
    "nameAr": "جمهورية الدومينيكان",
    "demonymEn": "Dominican",
    "demonymAr": "دومينيكاني",
    "flag": "🇩🇴",
    "value": "Dominican"
  },
  {
    "code": "SV",
    "nameEn": "El Salvador",
    "nameAr": "السلفادور",
    "demonymEn": "Salvadoran",
    "demonymAr": "سلفادوري",
    "flag": "🇸🇻",
    "value": "Salvadoran"
  },
  {
    "code": "GD",
    "nameEn": "Grenada",
    "nameAr": "غرينادا",
    "demonymEn": "Grenadian",
    "demonymAr": "غرينادي",
    "flag": "🇬🇩",
    "value": "Grenadian"
  },
  {
    "code": "GT",
    "nameEn": "Guatemala",
    "nameAr": "غواتيمالا",
    "demonymEn": "Guatemalan",
    "demonymAr": "غواتيمالي",
    "flag": "🇬🇹",
    "value": "Guatemalan"
  },
  {
    "code": "HT",
    "nameEn": "Haiti",
    "nameAr": "هايتي",
    "demonymEn": "Haitian",
    "demonymAr": "هايتي",
    "flag": "🇭🇹",
    "value": "Haitian"
  },
  {
    "code": "HN",
    "nameEn": "Honduras",
    "nameAr": "هندوراس",
    "demonymEn": "Honduran",
    "demonymAr": "هندوراسي",
    "flag": "🇭🇳",
    "value": "Honduran"
  },
  {
    "code": "JM",
    "nameEn": "Jamaica",
    "nameAr": "جامايكا",
    "demonymEn": "Jamaican",
    "demonymAr": "جامايكي",
    "flag": "🇯🇲",
    "value": "Jamaican"
  },
  {
    "code": "NI",
    "nameEn": "Nicaragua",
    "nameAr": "نيكاراغوا",
    "demonymEn": "Nicaraguan",
    "demonymAr": "نيكاراغوي",
    "flag": "🇳🇮",
    "value": "Nicaraguan"
  },
  {
    "code": "PA",
    "nameEn": "Panama",
    "nameAr": "بنما",
    "demonymEn": "Panamanian",
    "demonymAr": "بنمي",
    "flag": "🇵🇦",
    "value": "Panamanian"
  },
  {
    "code": "KN",
    "nameEn": "Saint Kitts and Nevis",
    "nameAr": "سانت كيتس ونيفيس",
    "demonymEn": "Kittitian",
    "demonymAr": "كيتسي",
    "flag": "🇰🇳",
    "value": "Kittitian"
  },
  {
    "code": "LC",
    "nameEn": "Saint Lucia",
    "nameAr": "سانت لوسيا",
    "demonymEn": "Saint Lucian",
    "demonymAr": "سانت لوسي",
    "flag": "🇱🇨",
    "value": "Saint Lucian"
  },
  {
    "code": "VC",
    "nameEn": "Saint Vincent and the Grenadines",
    "nameAr": "سانت فنسنت والغرينادين",
    "demonymEn": "Vincentian",
    "demonymAr": "فنسنتي",
    "flag": "🇻🇨",
    "value": "Vincentian"
  },
  {
    "code": "TT",
    "nameEn": "Trinidad and Tobago",
    "nameAr": "ترينيداد وتوباغو",
    "demonymEn": "Trinidadian",
    "demonymAr": "ترينيدادي",
    "flag": "🇹🇹",
    "value": "Trinidadian"
  },
  {
    "code": "AR",
    "nameEn": "Argentina",
    "nameAr": "الأرجنتين",
    "demonymEn": "Argentine",
    "demonymAr": "أرجنتيني",
    "flag": "🇦🇷",
    "value": "Argentine"
  },
  {
    "code": "BO",
    "nameEn": "Bolivia",
    "nameAr": "بوليفيا",
    "demonymEn": "Bolivian",
    "demonymAr": "بوليفي",
    "flag": "🇧🇴",
    "value": "Bolivian"
  },
  {
    "code": "BR",
    "nameEn": "Brazil",
    "nameAr": "البرازيل",
    "demonymEn": "Brazilian",
    "demonymAr": "برازيلي",
    "flag": "🇧🇷",
    "value": "Brazilian"
  },
  {
    "code": "CL",
    "nameEn": "Chile",
    "nameAr": "تشيلي",
    "demonymEn": "Chilean",
    "demonymAr": "تشيلي",
    "flag": "🇨🇱",
    "value": "Chilean"
  },
  {
    "code": "CO",
    "nameEn": "Colombia",
    "nameAr": "كولومبيا",
    "demonymEn": "Colombian",
    "demonymAr": "كولومبي",
    "flag": "🇨🇴",
    "value": "Colombian"
  },
  {
    "code": "EC",
    "nameEn": "Ecuador",
    "nameAr": "الإكوادور",
    "demonymEn": "Ecuadorian",
    "demonymAr": "إكوادوري",
    "flag": "🇪🇨",
    "value": "Ecuadorian"
  },
  {
    "code": "GY",
    "nameEn": "Guyana",
    "nameAr": "غيانا",
    "demonymEn": "Guyanese",
    "demonymAr": "غياني",
    "flag": "🇬🇾",
    "value": "Guyanese"
  },
  {
    "code": "PY",
    "nameEn": "Paraguay",
    "nameAr": "باراغواي",
    "demonymEn": "Paraguayan",
    "demonymAr": "باراغواياني",
    "flag": "🇵🇾",
    "value": "Paraguayan"
  },
  {
    "code": "PE",
    "nameEn": "Peru",
    "nameAr": "بيرو",
    "demonymEn": "Peruvian",
    "demonymAr": "بيروفي",
    "flag": "🇵🇪",
    "value": "Peruvian"
  },
  {
    "code": "SR",
    "nameEn": "Suriname",
    "nameAr": "سورينام",
    "demonymEn": "Surinamese",
    "demonymAr": "سورينامي",
    "flag": "🇸🇷",
    "value": "Surinamese"
  },
  {
    "code": "UY",
    "nameEn": "Uruguay",
    "nameAr": "أوروغواي",
    "demonymEn": "Uruguayan",
    "demonymAr": "أوروغواياني",
    "flag": "🇺🇾",
    "value": "Uruguayan"
  },
  {
    "code": "VE",
    "nameEn": "Venezuela",
    "nameAr": "فنزويلا",
    "demonymEn": "Venezuelan",
    "demonymAr": "فنزويلي",
    "flag": "🇻🇪",
    "value": "Venezuelan"
  },
  {
    "code": "AU",
    "nameEn": "Australia",
    "nameAr": "أستراليا",
    "demonymEn": "Australian",
    "demonymAr": "أسترالي",
    "flag": "🇦🇺",
    "value": "Australian"
  },
  {
    "code": "NZ",
    "nameEn": "New Zealand",
    "nameAr": "نيوزيلندا",
    "demonymEn": "New Zealander",
    "demonymAr": "نيوزيلندي",
    "flag": "🇳🇿",
    "value": "New Zealander"
  },
  {
    "code": "FJ",
    "nameEn": "Fiji",
    "nameAr": "فيجي",
    "demonymEn": "Fijian",
    "demonymAr": "فيجي",
    "flag": "🇫🇯",
    "value": "Fijian"
  },
  {
    "code": "KI",
    "nameEn": "Kiribati",
    "nameAr": "كيريباتي",
    "demonymEn": "I-Kiribati",
    "demonymAr": "كيريباتي",
    "flag": "🇰🇮",
    "value": "I-Kiribati"
  },
  {
    "code": "MH",
    "nameEn": "Marshall Islands",
    "nameAr": "جزر مارشال",
    "demonymEn": "Marshallese",
    "demonymAr": "مارشالي",
    "flag": "🇲🇭",
    "value": "Marshallese"
  },
  {
    "code": "FM",
    "nameEn": "Micronesia",
    "nameAr": "ميكرونيزيا",
    "demonymEn": "Micronesian",
    "demonymAr": "ميكرونيزي",
    "flag": "🇫🇲",
    "value": "Micronesian"
  },
  {
    "code": "NR",
    "nameEn": "Nauru",
    "nameAr": "ناورو",
    "demonymEn": "Nauruan",
    "demonymAr": "ناوروي",
    "flag": "🇳🇷",
    "value": "Nauruan"
  },
  {
    "code": "PW",
    "nameEn": "Palau",
    "nameAr": "بالاو",
    "demonymEn": "Palauan",
    "demonymAr": "بالاوي",
    "flag": "🇵🇼",
    "value": "Palauan"
  },
  {
    "code": "PG",
    "nameEn": "Papua New Guinea",
    "nameAr": "بابوا غينيا الجديدة",
    "demonymEn": "Papua New Guinean",
    "demonymAr": "بابوي",
    "flag": "🇵🇬",
    "value": "Papua New Guinean"
  },
  {
    "code": "WS",
    "nameEn": "Samoa",
    "nameAr": "ساموا",
    "demonymEn": "Samoan",
    "demonymAr": "ساموي",
    "flag": "🇼🇸",
    "value": "Samoan"
  },
  {
    "code": "SB",
    "nameEn": "Solomon Islands",
    "nameAr": "جزر سليمان",
    "demonymEn": "Solomon Islander",
    "demonymAr": "سليماني",
    "flag": "🇸🇧",
    "value": "Solomon Islander"
  },
  {
    "code": "TO",
    "nameEn": "Tonga",
    "nameAr": "تونغا",
    "demonymEn": "Tongan",
    "demonymAr": "تونغي",
    "flag": "🇹🇴",
    "value": "Tongan"
  },
  {
    "code": "TV",
    "nameEn": "Tuvalu",
    "nameAr": "توفالو",
    "demonymEn": "Tuvaluan",
    "demonymAr": "توفالوي",
    "flag": "🇹🇻",
    "value": "Tuvaluan"
  },
  {
    "code": "VU",
    "nameEn": "Vanuatu",
    "nameAr": "فانواتو",
    "demonymEn": "Ni-Vanuatu",
    "demonymAr": "فانواتي",
    "flag": "🇻🇺",
    "value": "Ni-Vanuatu"
  }
];

/**
 * Top frequently used nationalities in Middle East hospitality
 */
export const POPULAR_COUNTRIES: Country[] = ALL_COUNTRIES.filter((c) => c.popular);

/**
 * Helper to find country by value, demonym, name, or code
 */
export function findCountry(query?: string | null): Country | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  return ALL_COUNTRIES.find(
    (c) =>
      c.value.toLowerCase() === q ||
      c.code.toLowerCase() === q ||
      c.nameEn.toLowerCase() === q ||
      c.nameAr.toLowerCase() === q ||
      c.demonymEn.toLowerCase() === q ||
      c.demonymAr.toLowerCase() === q
  );
}

/**
 * Format nationality for display according to current language
 */
export function formatNationality(
  val?: string | null,
  isArabic: boolean = true
): string {
  if (!val) return '';
  const country = findCountry(val);
  if (!country) return val; // Custom or manual value
  if (isArabic) {
    return `${country.flag} ${country.demonymAr} (${country.demonymEn})`;
  }
  return `${country.flag} ${country.demonymEn} (${country.demonymAr})`;
}

/**
 * Get country flag emoji by nationality/country value
 */
export function getCountryFlag(val?: string | null): string {
  if (!val) return '🌐';
  const country = findCountry(val);
  return country ? country.flag : '🌐';
}
