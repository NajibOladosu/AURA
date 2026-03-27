export interface EmergencyNumbers {
  police: string;
  ambulance: string;
  fire: string;
}

export interface EmergencyNumberInfo extends EmergencyNumbers {
  countryName: string;
  notes?: string;
}

const CACHE_KEY = 'aura_emergency_cache';

// Comprehensive emergency number data for all UN-recognised countries
// Sources: emergencynumberapi.com, Wikipedia, national government sites
export const EMERGENCY_DATA: Record<string, EmergencyNumberInfo> = {
  AD: { countryName: 'Andorra', police: '110', ambulance: '116', fire: '118' },
  AE: { countryName: 'United Arab Emirates', police: '999', ambulance: '998', fire: '997' },
  AF: { countryName: 'Afghanistan', police: '119', ambulance: '112', fire: '119' },
  AG: { countryName: 'Antigua and Barbuda', police: '911', ambulance: '911', fire: '911' },
  AL: { countryName: 'Albania', police: '129', ambulance: '127', fire: '128' },
  AM: { countryName: 'Armenia', police: '102', ambulance: '103', fire: '101' },
  AO: { countryName: 'Angola', police: '113', ambulance: '112', fire: '115' },
  AR: { countryName: 'Argentina', police: '911', ambulance: '107', fire: '100' },
  AT: { countryName: 'Austria', police: '133', ambulance: '144', fire: '122' },
  AU: { countryName: 'Australia', police: '000', ambulance: '000', fire: '000' },
  AZ: { countryName: 'Azerbaijan', police: '102', ambulance: '103', fire: '101' },
  BA: { countryName: 'Bosnia and Herzegovina', police: '122', ambulance: '124', fire: '123' },
  BB: { countryName: 'Barbados', police: '211', ambulance: '511', fire: '311' },
  BD: { countryName: 'Bangladesh', police: '999', ambulance: '999', fire: '999' },
  BE: { countryName: 'Belgium', police: '101', ambulance: '100', fire: '100' },
  BF: { countryName: 'Burkina Faso', police: '17', ambulance: '112', fire: '18' },
  BG: { countryName: 'Bulgaria', police: '166', ambulance: '150', fire: '160' },
  BH: { countryName: 'Bahrain', police: '999', ambulance: '999', fire: '999' },
  BI: { countryName: 'Burundi', police: '113', ambulance: '112', fire: '118' },
  BJ: { countryName: 'Benin', police: '117', ambulance: '112', fire: '118' },
  BN: { countryName: 'Brunei', police: '993', ambulance: '991', fire: '995' },
  BO: { countryName: 'Bolivia', police: '110', ambulance: '118', fire: '119' },
  BR: { countryName: 'Brazil', police: '190', ambulance: '192', fire: '193' },
  BS: { countryName: 'Bahamas', police: '911', ambulance: '911', fire: '911' },
  BT: { countryName: 'Bhutan', police: '113', ambulance: '112', fire: '110' },
  BW: { countryName: 'Botswana', police: '999', ambulance: '997', fire: '998' },
  BY: { countryName: 'Belarus', police: '102', ambulance: '103', fire: '101' },
  BZ: { countryName: 'Belize', police: '911', ambulance: '911', fire: '911' },
  CA: { countryName: 'Canada', police: '911', ambulance: '911', fire: '911' },
  CD: { countryName: 'DR Congo', police: '112', ambulance: '112', fire: '118' },
  CF: { countryName: 'Central African Republic', police: '117', ambulance: '112', fire: '118' },
  CG: { countryName: 'Republic of Congo', police: '117', ambulance: '112', fire: '118' },
  CH: { countryName: 'Switzerland', police: '117', ambulance: '144', fire: '118' },
  CI: { countryName: "Côte d'Ivoire", police: '111', ambulance: '185', fire: '180' },
  CL: { countryName: 'Chile', police: '133', ambulance: '131', fire: '132' },
  CM: { countryName: 'Cameroon', police: '117', ambulance: '112', fire: '118' },
  CN: { countryName: 'China', police: '110', ambulance: '120', fire: '119' },
  CO: { countryName: 'Colombia', police: '112', ambulance: '125', fire: '119' },
  CR: { countryName: 'Costa Rica', police: '911', ambulance: '911', fire: '911' },
  CU: { countryName: 'Cuba', police: '106', ambulance: '104', fire: '105' },
  CV: { countryName: 'Cape Verde', police: '132', ambulance: '130', fire: '131' },
  CY: { countryName: 'Cyprus', police: '199', ambulance: '199', fire: '199' },
  CZ: { countryName: 'Czech Republic', police: '158', ambulance: '155', fire: '150' },
  DE: { countryName: 'Germany', police: '110', ambulance: '112', fire: '112' },
  DJ: { countryName: 'Djibouti', police: '17', ambulance: '351040', fire: '18' },
  DK: { countryName: 'Denmark', police: '114', ambulance: '112', fire: '112' },
  DM: { countryName: 'Dominica', police: '999', ambulance: '999', fire: '999' },
  DO: { countryName: 'Dominican Republic', police: '911', ambulance: '911', fire: '911' },
  DZ: { countryName: 'Algeria', police: '17', ambulance: '14', fire: '14' },
  EC: { countryName: 'Ecuador', police: '911', ambulance: '911', fire: '911' },
  EE: { countryName: 'Estonia', police: '112', ambulance: '112', fire: '112' },
  EG: { countryName: 'Egypt', police: '122', ambulance: '123', fire: '180' },
  ER: { countryName: 'Eritrea', police: '113', ambulance: '114', fire: '115' },
  ES: { countryName: 'Spain', police: '091', ambulance: '061', fire: '080' },
  ET: { countryName: 'Ethiopia', police: '991', ambulance: '907', fire: '939' },
  FI: { countryName: 'Finland', police: '112', ambulance: '112', fire: '112' },
  FJ: { countryName: 'Fiji', police: '917', ambulance: '911', fire: '910' },
  FM: { countryName: 'Micronesia', police: '911', ambulance: '911', fire: '911' },
  FR: { countryName: 'France', police: '17', ambulance: '15', fire: '18' },
  GA: { countryName: 'Gabon', police: '1730', ambulance: '1300', fire: '18' },
  GB: { countryName: 'United Kingdom', police: '999', ambulance: '999', fire: '999' },
  GD: { countryName: 'Grenada', police: '911', ambulance: '434', fire: '911' },
  GE: { countryName: 'Georgia', police: '112', ambulance: '112', fire: '112' },
  GH: { countryName: 'Ghana', police: '191', ambulance: '193', fire: '192' },
  GM: { countryName: 'Gambia', police: '117', ambulance: '116', fire: '118' },
  GN: { countryName: 'Guinea', police: '122', ambulance: '112', fire: '118' },
  GQ: { countryName: 'Equatorial Guinea', police: '114', ambulance: '112', fire: '115' },
  GR: { countryName: 'Greece', police: '100', ambulance: '166', fire: '199' },
  GT: { countryName: 'Guatemala', police: '110', ambulance: '125', fire: '122' },
  GW: { countryName: 'Guinea-Bissau', police: '117', ambulance: '112', fire: '118' },
  GY: { countryName: 'Guyana', police: '911', ambulance: '913', fire: '912' },
  HN: { countryName: 'Honduras', police: '911', ambulance: '195', fire: '198' },
  HR: { countryName: 'Croatia', police: '192', ambulance: '194', fire: '193' },
  HT: { countryName: 'Haiti', police: '114', ambulance: '115', fire: '116' },
  HU: { countryName: 'Hungary', police: '107', ambulance: '104', fire: '105' },
  ID: { countryName: 'Indonesia', police: '110', ambulance: '118', fire: '113' },
  IE: { countryName: 'Ireland', police: '999', ambulance: '999', fire: '999' },
  IL: { countryName: 'Israel', police: '100', ambulance: '101', fire: '102' },
  IN: { countryName: 'India', police: '100', ambulance: '108', fire: '101', notes: 'National 112 also works. Some states vary.' },
  IQ: { countryName: 'Iraq', police: '104', ambulance: '115', fire: '115' },
  IR: { countryName: 'Iran', police: '110', ambulance: '115', fire: '125' },
  IS: { countryName: 'Iceland', police: '112', ambulance: '112', fire: '112' },
  IT: { countryName: 'Italy', police: '113', ambulance: '118', fire: '115' },
  JM: { countryName: 'Jamaica', police: '119', ambulance: '110', fire: '110' },
  JO: { countryName: 'Jordan', police: '911', ambulance: '911', fire: '911' },
  JP: { countryName: 'Japan', police: '110', ambulance: '119', fire: '119' },
  KE: { countryName: 'Kenya', police: '999', ambulance: '999', fire: '999' },
  KG: { countryName: 'Kyrgyzstan', police: '102', ambulance: '103', fire: '101' },
  KH: { countryName: 'Cambodia', police: '117', ambulance: '119', fire: '118' },
  KI: { countryName: 'Kiribati', police: '999', ambulance: '994', fire: '996' },
  KM: { countryName: 'Comoros', police: '17', ambulance: '773', fire: '18' },
  KN: { countryName: 'Saint Kitts and Nevis', police: '911', ambulance: '911', fire: '911' },
  KP: { countryName: 'North Korea', police: '112', ambulance: '119', fire: '119' },
  KR: { countryName: 'South Korea', police: '112', ambulance: '119', fire: '119' },
  KW: { countryName: 'Kuwait', police: '112', ambulance: '112', fire: '112' },
  KZ: { countryName: 'Kazakhstan', police: '102', ambulance: '103', fire: '101' },
  LA: { countryName: 'Laos', police: '191', ambulance: '195', fire: '190' },
  LB: { countryName: 'Lebanon', police: '112', ambulance: '140', fire: '175' },
  LC: { countryName: 'Saint Lucia', police: '911', ambulance: '911', fire: '911' },
  LI: { countryName: 'Liechtenstein', police: '117', ambulance: '144', fire: '118' },
  LK: { countryName: 'Sri Lanka', police: '119', ambulance: '110', fire: '111' },
  LR: { countryName: 'Liberia', police: '911', ambulance: '911', fire: '911' },
  LS: { countryName: 'Lesotho', police: '123', ambulance: '112', fire: '122' },
  LT: { countryName: 'Lithuania', police: '112', ambulance: '112', fire: '112' },
  LU: { countryName: 'Luxembourg', police: '113', ambulance: '112', fire: '112' },
  LV: { countryName: 'Latvia', police: '112', ambulance: '112', fire: '112' },
  LY: { countryName: 'Libya', police: '1515', ambulance: '115', fire: '113' },
  MA: { countryName: 'Morocco', police: '19', ambulance: '15', fire: '15' },
  MC: { countryName: 'Monaco', police: '17', ambulance: '15', fire: '18' },
  MD: { countryName: 'Moldova', police: '902', ambulance: '903', fire: '901' },
  ME: { countryName: 'Montenegro', police: '122', ambulance: '124', fire: '123' },
  MG: { countryName: 'Madagascar', police: '117', ambulance: '112', fire: '118' },
  MH: { countryName: 'Marshall Islands', police: '911', ambulance: '911', fire: '911' },
  MK: { countryName: 'North Macedonia', police: '192', ambulance: '194', fire: '193' },
  ML: { countryName: 'Mali', police: '17', ambulance: '15', fire: '18' },
  MM: { countryName: 'Myanmar', police: '199', ambulance: '192', fire: '191' },
  MN: { countryName: 'Mongolia', police: '102', ambulance: '103', fire: '101' },
  MR: { countryName: 'Mauritania', police: '17', ambulance: '101', fire: '118' },
  MT: { countryName: 'Malta', police: '112', ambulance: '112', fire: '112' },
  MU: { countryName: 'Mauritius', police: '999', ambulance: '114', fire: '115' },
  MV: { countryName: 'Maldives', police: '119', ambulance: '102', fire: '118' },
  MW: { countryName: 'Malawi', police: '997', ambulance: '998', fire: '999' },
  MX: { countryName: 'Mexico', police: '911', ambulance: '911', fire: '911' },
  MY: { countryName: 'Malaysia', police: '999', ambulance: '999', fire: '994' },
  MZ: { countryName: 'Mozambique', police: '119', ambulance: '117', fire: '198' },
  NA: { countryName: 'Namibia', police: '10111', ambulance: '211111', fire: '2032270' },
  NE: { countryName: 'Niger', police: '17', ambulance: '15', fire: '18' },
  NG: { countryName: 'Nigeria', police: '112', ambulance: '112', fire: '112' },
  NI: { countryName: 'Nicaragua', police: '118', ambulance: '128', fire: '115' },
  NL: { countryName: 'Netherlands', police: '112', ambulance: '112', fire: '112' },
  NO: { countryName: 'Norway', police: '112', ambulance: '113', fire: '110' },
  NP: { countryName: 'Nepal', police: '100', ambulance: '102', fire: '101' },
  NR: { countryName: 'Nauru', police: '110', ambulance: '111', fire: '112' },
  NZ: { countryName: 'New Zealand', police: '111', ambulance: '111', fire: '111' },
  OM: { countryName: 'Oman', police: '9999', ambulance: '9999', fire: '9999' },
  PA: { countryName: 'Panama', police: '911', ambulance: '911', fire: '911' },
  PE: { countryName: 'Peru', police: '105', ambulance: '106', fire: '116' },
  PG: { countryName: 'Papua New Guinea', police: '000', ambulance: '111', fire: '110' },
  PH: { countryName: 'Philippines', police: '911', ambulance: '911', fire: '911' },
  PK: { countryName: 'Pakistan', police: '15', ambulance: '1122', fire: '16', notes: 'Some provinces use different ambulance numbers' },
  PL: { countryName: 'Poland', police: '997', ambulance: '999', fire: '998' },
  PT: { countryName: 'Portugal', police: '112', ambulance: '112', fire: '112' },
  PW: { countryName: 'Palau', police: '911', ambulance: '911', fire: '911' },
  PY: { countryName: 'Paraguay', police: '911', ambulance: '911', fire: '911' },
  QA: { countryName: 'Qatar', police: '999', ambulance: '999', fire: '999' },
  RO: { countryName: 'Romania', police: '112', ambulance: '112', fire: '112' },
  RS: { countryName: 'Serbia', police: '192', ambulance: '194', fire: '193' },
  RU: { countryName: 'Russia', police: '102', ambulance: '103', fire: '101' },
  RW: { countryName: 'Rwanda', police: '112', ambulance: '912', fire: '111' },
  SA: { countryName: 'Saudi Arabia', police: '999', ambulance: '911', fire: '998' },
  SB: { countryName: 'Solomon Islands', police: '999', ambulance: '999', fire: '999' },
  SC: { countryName: 'Seychelles', police: '999', ambulance: '151', fire: '999' },
  SD: { countryName: 'Sudan', police: '999', ambulance: '333', fire: '998' },
  SE: { countryName: 'Sweden', police: '112', ambulance: '112', fire: '112' },
  SG: { countryName: 'Singapore', police: '999', ambulance: '995', fire: '995' },
  SI: { countryName: 'Slovenia', police: '113', ambulance: '112', fire: '112' },
  SK: { countryName: 'Slovakia', police: '158', ambulance: '155', fire: '150' },
  SL: { countryName: 'Sierra Leone', police: '999', ambulance: '999', fire: '019' },
  SM: { countryName: 'San Marino', police: '113', ambulance: '118', fire: '115' },
  SN: { countryName: 'Senegal', police: '17', ambulance: '15', fire: '18' },
  SO: { countryName: 'Somalia', police: '888', ambulance: '111', fire: '555' },
  SR: { countryName: 'Suriname', police: '115', ambulance: '113', fire: '110' },
  SS: { countryName: 'South Sudan', police: '777', ambulance: '999', fire: '998' },
  ST: { countryName: 'São Tomé and Príncipe', police: '112', ambulance: '112', fire: '112' },
  SV: { countryName: 'El Salvador', police: '911', ambulance: '132', fire: '913' },
  SY: { countryName: 'Syria', police: '112', ambulance: '110', fire: '113' },
  SZ: { countryName: 'Eswatini', police: '999', ambulance: '977', fire: '933' },
  TD: { countryName: 'Chad', police: '17', ambulance: '2251-2727', fire: '18' },
  TG: { countryName: 'Togo', police: '101', ambulance: '8200', fire: '118' },
  TH: { countryName: 'Thailand', police: '191', ambulance: '1669', fire: '199' },
  TJ: { countryName: 'Tajikistan', police: '102', ambulance: '103', fire: '101' },
  TL: { countryName: 'Timor-Leste', police: '112', ambulance: '110', fire: '115' },
  TM: { countryName: 'Turkmenistan', police: '02', ambulance: '03', fire: '01' },
  TN: { countryName: 'Tunisia', police: '197', ambulance: '190', fire: '198' },
  TO: { countryName: 'Tonga', police: '922', ambulance: '933', fire: '911' },
  TR: { countryName: 'Turkey', police: '155', ambulance: '112', fire: '110' },
  TT: { countryName: 'Trinidad and Tobago', police: '999', ambulance: '811', fire: '990' },
  TV: { countryName: 'Tuvalu', police: '911', ambulance: '911', fire: '911' },
  TZ: { countryName: 'Tanzania', police: '112', ambulance: '114', fire: '115' },
  UA: { countryName: 'Ukraine', police: '102', ambulance: '103', fire: '101' },
  UG: { countryName: 'Uganda', police: '999', ambulance: '112', fire: '112' },
  US: { countryName: 'United States', police: '911', ambulance: '911', fire: '911' },
  UY: { countryName: 'Uruguay', police: '911', ambulance: '105', fire: '104' },
  UZ: { countryName: 'Uzbekistan', police: '102', ambulance: '103', fire: '101' },
  VA: { countryName: 'Vatican City', police: '112', ambulance: '118', fire: '115' },
  VC: { countryName: 'Saint Vincent and the Grenadines', police: '911', ambulance: '911', fire: '911' },
  VE: { countryName: 'Venezuela', police: '171', ambulance: '171', fire: '171' },
  VN: { countryName: 'Vietnam', police: '113', ambulance: '115', fire: '114' },
  VU: { countryName: 'Vanuatu', police: '111', ambulance: '112', fire: '113' },
  WS: { countryName: 'Samoa', police: '994', ambulance: '996', fire: '995' },
  YE: { countryName: 'Yemen', police: '194', ambulance: '191', fire: '191' },
  ZA: { countryName: 'South Africa', police: '10111', ambulance: '10177', fire: '10177' },
  ZM: { countryName: 'Zambia', police: '999', ambulance: '991', fire: '993' },
  ZW: { countryName: 'Zimbabwe', police: '995', ambulance: '994', fire: '993' },
};

// Sub-national overrides — applied when region string contains the key (case-insensitive)
export const REGIONAL_OVERRIDES: Record<string, Record<string, Partial<EmergencyNumbers>>> = {
  IN: {
    'Delhi': { ambulance: '102' },
    'Punjab': { ambulance: '112' },
    'Jharkhand': { ambulance: '104' },
    'Kerala': { ambulance: '112' },
    'Tamil Nadu': { ambulance: '108' },
    'Karnataka': { ambulance: '108' },
    'Andhra': { ambulance: '108' },
    'Telangana': { ambulance: '108' },
  },
  PK: {
    'Punjab': { ambulance: '1122' },
    'Sindh': { ambulance: '115' },
    'Khyber': { ambulance: '115' },
  },
  AU: {
    'New South Wales': { police: '000', ambulance: '000', fire: '000' },
    'Victoria': { police: '000', ambulance: '000', fire: '000' },
  },
  CA: {
    'Quebec': { police: '911', ambulance: '911', fire: '911' },
  },
  US: {
    // All US states use 911
  },
};

// Sorted country list for the manual selector dropdown
export const COUNTRY_LIST: { code: string; name: string }[] = Object.entries(EMERGENCY_DATA)
  .map(([code, info]) => ({ code, name: info.countryName }))
  .sort((a, b) => a.name.localeCompare(b.name));

const FALLBACK: EmergencyNumberInfo = {
  countryName: 'International',
  police: '112',
  ambulance: '112',
  fire: '112',
  notes: 'International emergency number — works in most countries',
};

export function resolveEmergencyNumbers(
  countryCode: string | null,
  region?: string | null
): EmergencyNumberInfo {
  if (!countryCode) {
    const cached = getCachedEmergencyNumbers();
    return cached ?? FALLBACK;
  }

  const code = countryCode.toUpperCase();
  const base = EMERGENCY_DATA[code];

  if (!base) {
    const cached = getCachedEmergencyNumbers();
    return cached ?? FALLBACK;
  }

  let result: EmergencyNumberInfo = { ...base };

  // Apply regional overrides
  if (region && REGIONAL_OVERRIDES[code]) {
    for (const [regionKey, overrides] of Object.entries(REGIONAL_OVERRIDES[code])) {
      if (region.toLowerCase().includes(regionKey.toLowerCase())) {
        result = { ...result, ...overrides };
        break;
      }
    }
  }

  // Cache for offline use
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(result));
  } catch {
    // localStorage unavailable — ignore
  }

  return result;
}

export function getCachedEmergencyNumbers(): EmergencyNumberInfo | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? (JSON.parse(cached) as EmergencyNumberInfo) : null;
  } catch {
    return null;
  }
}

export { FALLBACK as EMERGENCY_FALLBACK };
