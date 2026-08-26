/* data-countries.js
   Ten southern African states. Institutions, electoral systems, seat weights and
   party landscapes are modelled on the real thing; all *people* are invented.
   Numeric values are simulation parameters, tuned for play, not published statistics.

   inst.*  0-100 : judiciary  = independence of courts
                   media      = press freedom / plurality
                   electoral  = integrity of the count
                   security   = influence of army & intelligence over politics
                   patronage  = how normal it is to buy loyalty
                   ethnic     = salience of region/language in voting
                   incumbency = structural advantage of holding office
*/
(function () {
  'use strict';

  var DEFAULT_MINISTRIES = [
    { id: 'fin',    name: 'Finance',                     w: 10, kind: 'money'   },
    { id: 'home',   name: 'Home Affairs',                w: 8,  kind: 'power'   },
    { id: 'def',    name: 'Defence & Security',          w: 9,  kind: 'power'   },
    { id: 'foreign',name: 'Foreign Affairs',             w: 7,  kind: 'prestige'},
    { id: 'mines',  name: 'Mines & Energy',              w: 9,  kind: 'money'   },
    { id: 'local',  name: 'Local Government',            w: 8,  kind: 'machine' },
    { id: 'health', name: 'Health',                      w: 6,  kind: 'service' },
    { id: 'edu',    name: 'Education',                   w: 6,  kind: 'service' },
    { id: 'agric',  name: 'Agriculture & Lands',         w: 7,  kind: 'machine' },
    { id: 'infra',  name: 'Transport & Public Works',    w: 8,  kind: 'money'   },
    { id: 'trade',  name: 'Trade & Industry',            w: 6,  kind: 'money'   },
    { id: 'youth',  name: 'Youth, Sport & Culture',      w: 3,  kind: 'service' },
    { id: 'labour', name: 'Labour & Social Welfare',     w: 5,  kind: 'service' },
    { id: 'water',  name: 'Water & Environment',         w: 4,  kind: 'service' },
    { id: 'ict',    name: 'Communications & ICT',        w: 5,  kind: 'power'   }
  ];

  function T(o) { // terminology with sane defaults
    return Object.assign({
      meeting: 'public meeting', meetingPl: 'public meetings',
      primary: 'party primary', conference: 'national congress',
      assembly: 'National Assembly', mp: 'Member of Parliament', mpShort: 'MP',
      council: 'council', councillor: 'Councillor',
      region: 'region', regionPl: 'regions',
      leaderTitle: 'Party President', deputyTitle: 'Party Deputy President',
      sg: 'Secretary-General', exec: 'National Executive Committee', execShort: 'NEC',
      hos: 'President', hosFull: 'President of the Republic',
      deputyHos: 'Vice-President', minister: 'Minister', deputyMin: 'Assistant Minister',
      cabinet: 'Cabinet', constituency: 'constituency', ward: 'ward', branch: 'branch',
      chief: 'chief', youthWing: 'Youth League', elder: 'elder'
    }, o || {});
  }

  var C = {};

  /* ============================ BOTSWANA ============================ */
  C.BW = {
    id: 'BW', name: 'Botswana', adj: 'Motswana', flag: '🇧🇼', capital: 'Gaborone',
    cur: { code: 'BWP', sym: 'P' }, accent: '#6cb0d8',
    system: 'parl', hard: 3, startYear: 2026, nextElection: 2029, houseTerm: 5,
    termLimit: 2, presTerm: 5,
    tagline: 'Diamonds, decorum and the quiet knife',
    brief: 'A stable parliamentary republic where the National Assembly elects the President. ' +
           'Courts work, the count is trusted, and almost nobody shouts. The fighting happens ' +
           'inside the party — at Bulela Ditswe primaries and at congress — long before the ballot.',
    notes: ['Assembly elects the President', 'Diamond-dependent budget', 'Primaries decide everything'],
    house: { name: 'National Assembly', seats: 61, elected: 61, method: 'fptp' },
    inst: { judiciary: 78, media: 64, electoral: 80, security: 30, patronage: 42, ethnic: 34, incumbency: 55 },
    econ: { growth: 2.4, inflation: 3.4, unemployment: 27, debt: 26, reserves: 9.5, gdppc: 7300,
            staple: 'diamonds', staplePrice: 100, informal: 30 },
    issues: ['youth unemployment', 'diamond revenue', 'water security', 'land servicing', 'the public wage bill'],
    regions: [
      { id: 'gab', name: 'Greater Gaborone', seats: 9,  bias: { UDC: 1.45, BCP: 1.2, BDP: .6,  BPF: .3, AP: 1.4 } },
      { id: 'se',  name: 'South East',       seats: 4,  bias: { UDC: 1.25, BCP: 1.1, BDP: .8,  BPF: .3, AP: 1.1 } },
      { id: 'sou', name: 'Southern',         seats: 6,  bias: { UDC: 1.5,  BCP: .8,  BDP: .75, BPF: .2, AP: .8 } },
      { id: 'kwe', name: 'Kweneng',          seats: 9,  bias: { UDC: 1.4,  BCP: .9,  BDP: .8,  BPF: .3, AP: 1.0 } },
      { id: 'kgt', name: 'Kgatleng',         seats: 3,  bias: { UDC: 1.1,  BCP: 1.0, BDP: 1.0, BPF: .5, AP: .9 } },
      { id: 'cen', name: 'Central',          seats: 17, bias: { UDC: .7,   BCP: .9,  BDP: 1.3, BPF: 2.6, AP: .7 } },
      { id: 'ne',  name: 'North East',       seats: 5,  bias: { UDC: .8,   BCP: 1.5, BDP: 1.0, BPF: 1.0, AP: .8 } },
      { id: 'nw',  name: 'North West',       seats: 5,  bias: { UDC: .9,   BCP: 1.3, BDP: 1.1, BPF: .5, AP: .7 } },
      { id: 'kgl', name: 'Kgalagadi & Ghanzi',seats: 3, bias: { UDC: .9,   BCP: .9,  BDP: 1.4, BPF: .4, AP: .6 } }
    ],
    parties: [
      { id: 'UDC', abbr: 'UDC', name: 'Umbrella for Democratic Change', color: '#e14c4c', ideo: 'social democratic, coalition of opposition parties', vote: 37, gov: true,  machine: 55, kind: 'ruling' },
      { id: 'BDP', abbr: 'BDP', name: 'Botswana Democratic Party',      color: '#3f7bd0', ideo: 'conservative, the old governing establishment',      vote: 24, gov: false, machine: 78, kind: 'opposition' },
      { id: 'BCP', abbr: 'BCP', name: 'Botswana Congress Party',        color: '#3fa86b', ideo: 'centre-left, technocratic',                          vote: 22, gov: false, machine: 48, kind: 'opposition' },
      { id: 'BPF', abbr: 'BPF', name: 'Botswana Patriotic Front',       color: '#d8a53f', ideo: 'regional, built on Central District loyalties',      vote: 11, gov: false, machine: 40, kind: 'opposition' },
      { id: 'AP',  abbr: 'AP',  name: 'Alliance for Progressives',      color: '#8f6cc8', ideo: 'urban reformist',                                    vote: 6,  gov: false, machine: 26, kind: 'opposition' }
    ],
    terms: T({ meeting: 'kgotla meeting', meetingPl: 'kgotla meetings', primary: 'Bulela Ditswe primary',
      conference: 'party congress', deputyMin: 'Assistant Minister', chief: 'kgosi', elder: 'kgosana',
      youthWing: 'Youth Wing', ward: 'ward' }),
    media: ['Mmegi', 'The Botswana Guardian', 'Sunday Standard', 'Btv News', 'Duma FM'],
    names: {
      first: ['Kagiso','Tebogo','Boitumelo','Mpho','Lesego','Onkgopotse','Gaone','Kabelo','Bonolo','Keabetswe','Tshepo','Goitseone','Masego','Refilwe','Odirile','Katlego','Neo','Oratile','Thato','Mmoloki'],
      last: ['Molefe','Baruti','Sebina','Dintwe','Motshegwa','Ramoroka','Selepeng','Mothibi','Tshukudu','Moatlhodi','Phologolo','Segokgo','Mmusi','Rankgomo','Letsholo','Gaeitsewe']
    }
  };

  /* ========================== SOUTH AFRICA ========================== */
  C.ZA = {
    id: 'ZA', name: 'South Africa', adj: 'South African', flag: '🇿🇦', capital: 'Pretoria / Cape Town',
    cur: { code: 'ZAR', sym: 'R' }, accent: '#3fa86b',
    system: 'parl', hard: 4, startYear: 2026, nextElection: 2029, houseTerm: 5,
    termLimit: 2, presTerm: 5,
    tagline: 'Branches, slates and the long knives of conference',
    brief: 'Closed-list proportional representation: you never face voters directly, you face the ' +
           'party list committee. Power is won in branch general meetings, regional conferences and ' +
           'the national conference. The courts are strong, the press is loud, and coalitions now decide everything.',
    notes: ['Closed-list PR — the list is the ballot', 'Coalition arithmetic', 'Strong courts and press'],
    house: { name: 'National Assembly', seats: 400, elected: 400, method: 'pr', threshold: 0.25 },
    inst: { judiciary: 80, media: 82, electoral: 84, security: 38, patronage: 62, ethnic: 46, incumbency: 45 },
    econ: { growth: 1.1, inflation: 4.6, unemployment: 32, debt: 76, reserves: 5.5, gdppc: 6500,
            staple: 'platinum & coal', staplePrice: 100, informal: 28 },
    issues: ['unemployment', 'electricity supply', 'crime', 'municipal collapse', 'corruption', 'immigration'],
    regions: [
      { id: 'gp',  name: 'Gauteng',       seats: 104, bias: { ANC: .95, DA: 1.15, EFF: 1.25, MK: .85, IFP: .3,  PA: .5,  FFP: .8, ASA: 1.6 } },
      { id: 'kzn', name: 'KwaZulu-Natal', seats: 76,  bias: { ANC: .6,  DA: .7,   EFF: .5,  MK: 3.2,  IFP: 3.4, PA: .3,  FFP: .3, ASA: .4 } },
      { id: 'wc',  name: 'Western Cape',  seats: 48,  bias: { ANC: .55, DA: 2.3,  EFF: .35, MK: .1,   IFP: .05, PA: 3.4, FFP: .7, ASA: .6 } },
      { id: 'ec',  name: 'Eastern Cape',  seats: 44,  bias: { ANC: 1.4, DA: .7,   EFF: 1.0, MK: .5,   IFP: .1,  PA: .3,  FFP: .3, ASA: .5 } },
      { id: 'lp',  name: 'Limpopo',       seats: 40,  bias: { ANC: 1.5, DA: .35,  EFF: 1.9, MK: .3,   IFP: .05, PA: .1,  FFP: .3, ASA: .4 } },
      { id: 'mp',  name: 'Mpumalanga',    seats: 32,  bias: { ANC: 1.45,DA: .5,   EFF: 1.3, MK: .5,   IFP: .1,  PA: .1,  FFP: .5, ASA: .4 } },
      { id: 'nw',  name: 'North West',    seats: 28,  bias: { ANC: 1.3, DA: .55,  EFF: 1.4, MK: .3,   IFP: .1,  PA: .2,  FFP: .6, ASA: .4 } },
      { id: 'fs',  name: 'Free State',    seats: 20,  bias: { ANC: 1.3, DA: .7,   EFF: 1.3, MK: .3,   IFP: .05, PA: .2,  FFP: .8, ASA: .4 } },
      { id: 'nc',  name: 'Northern Cape', seats: 8,   bias: { ANC: 1.2, DA: 1.1,  EFF: 1.0, MK: .2,   IFP: .05, PA: 1.1, FFP: .9, ASA: .3 } }
    ],
    parties: [
      { id: 'ANC', abbr: 'ANC', name: 'African National Congress',  color: '#3fa86b', ideo: 'broad church liberation movement', vote: 39, gov: true,  machine: 85, kind: 'ruling' },
      { id: 'DA',  abbr: 'DA',  name: 'Democratic Alliance',        color: '#3f7bd0', ideo: 'liberal, market-oriented',         vote: 22, gov: true,  machine: 70, kind: 'coalition' },
      { id: 'MK',  abbr: 'MK',  name: 'uMkhonto weSizwe Party',     color: '#1f6b52', ideo: 'nativist populist',                vote: 14, gov: false, machine: 45, kind: 'opposition' },
      { id: 'EFF', abbr: 'EFF', name: 'Economic Freedom Fighters',  color: '#d4453f', ideo: 'radical left, nationalisation',    vote: 9,  gov: false, machine: 55, kind: 'opposition' },
      { id: 'IFP', abbr: 'IFP', name: 'Inkatha Freedom Party',      color: '#d8a53f', ideo: 'traditionalist, KZN-rooted',       vote: 4,  gov: true,  machine: 42, kind: 'coalition' },
      { id: 'PA',  abbr: 'PA',  name: 'Patriotic Alliance',         color: '#8f6cc8', ideo: 'communitarian populist',           vote: 3,  gov: true,  machine: 30, kind: 'coalition' },
      { id: 'FFP', abbr: 'FF+', name: 'Freedom Front Plus',         color: '#c8a06c', ideo: 'minority rights conservative',     vote: 2,  gov: true,  machine: 28, kind: 'coalition' },
      { id: 'ASA', abbr: 'ASA', name: 'ActionSA',                   color: '#4fb5a8', ideo: 'urban anti-corruption',            vote: 3,  gov: false, machine: 26, kind: 'opposition' }
    ],
    terms: T({ meeting: 'community imbizo', meetingPl: 'imbizos', primary: 'list conference',
      conference: 'national conference', deputyMin: 'Deputy Minister', region: 'province', regionPl: 'provinces',
      exec: 'National Executive Committee', chief: 'inkosi', youthWing: 'Youth League',
      deputyHos: 'Deputy President', council: 'municipal council' }),
    media: ['News24', 'Daily Maverick', 'the SABC', 'eNCA', 'the Sunday Times', 'Newzroom Afrika'],
    names: {
      first: ['Sipho','Thandi','Bongani','Nomsa','Lerato','Musa','Zanele','Themba','Ayanda','Nokuthula','Sizwe','Palesa','Lwazi','Refilwe','Mandla','Busisiwe','Kagiso','Nonhlanhla','Vusi','Ntombi','Pieter','Michelle','Ashwin','Fatima'],
      last: ['Nkosi','Dlamini','Mokoena','Ndlovu','Khumalo','Mahlangu','Sithole','Mabaso','Radebe','Mthembu','Ngcobo','Booysen','Adams','Naidoo','Pillay','van der Merwe','Jacobs','du Plessis','Sekgobela','Maluleke']
    }
  };

  /* ============================ ZIMBABWE ============================ */
  C.ZW = {
    id: 'ZW', name: 'Zimbabwe', adj: 'Zimbabwean', flag: '🇿🇼', capital: 'Harare',
    cur: { code: 'ZWG', sym: 'Z$' }, accent: '#d8a53f',
    system: 'pres', hard: 5, startYear: 2026, nextElection: 2028, houseTerm: 5,
    termLimit: 2, presTerm: 5, runoff: true,
    tagline: 'The party, the securocrats, and everyone else',
    brief: 'A directly elected executive presidency won on 50% plus one. But the count is contested, ' +
           'the security services are a faction in their own right, and the ruling party primary is ' +
           'more dangerous than the general election. Liberation credentials still open doors.',
    notes: ['50%+1 with a run-off', 'Security services are a faction', 'Primaries decide safe seats'],
    house: { name: 'National Assembly', seats: 210, elected: 210, method: 'fptp' },
    inst: { judiciary: 32, media: 30, electoral: 34, security: 82, patronage: 80, ethnic: 52, incumbency: 82 },
    econ: { growth: 2.0, inflation: 32, unemployment: 20, debt: 96, reserves: 1.2, gdppc: 1600,
            staple: 'gold, platinum & lithium', staplePrice: 100, informal: 76 },
    issues: ['currency instability', 'sanctions', 'electricity', 'the informal economy', 'land tenure', 'emigration'],
    regions: [
      { id: 'har', name: 'Harare',              seats: 29, bias: { ZPF: .5,  CCC: 2.2, MDC: 1.4, ZAPU: .3 } },
      { id: 'byo', name: 'Bulawayo',            seats: 12, bias: { ZPF: .35, CCC: 2.3, MDC: 1.3, ZAPU: 2.6 } },
      { id: 'man', name: 'Manicaland',          seats: 26, bias: { ZPF: 1.1, CCC: 1.0, MDC: 1.0, ZAPU: .2 } },
      { id: 'mac', name: 'Mashonaland Central', seats: 18, bias: { ZPF: 1.7, CCC: .35, MDC: .5,  ZAPU: .1 } },
      { id: 'mae', name: 'Mashonaland East',    seats: 23, bias: { ZPF: 1.5, CCC: .55, MDC: .7,  ZAPU: .1 } },
      { id: 'maw', name: 'Mashonaland West',    seats: 22, bias: { ZPF: 1.5, CCC: .6,  MDC: .7,  ZAPU: .1 } },
      { id: 'mas', name: 'Masvingo',            seats: 26, bias: { ZPF: 1.3, CCC: .8,  MDC: .9,  ZAPU: .2 } },
      { id: 'mtn', name: 'Matabeleland North',  seats: 13, bias: { ZPF: .9,  CCC: 1.3, MDC: 1.0, ZAPU: 2.8 } },
      { id: 'mts', name: 'Matabeleland South',  seats: 13, bias: { ZPF: .9,  CCC: 1.2, MDC: 1.0, ZAPU: 2.8 } },
      { id: 'mid', name: 'Midlands',            seats: 28, bias: { ZPF: 1.3, CCC: .9,  MDC: .9,  ZAPU: .8 } }
    ],
    parties: [
      { id: 'ZPF',  abbr: 'ZANU-PF', name: 'Zimbabwe African National Union – Patriotic Front', color: '#3fa86b', ideo: 'liberation-nationalist, patronage-driven', vote: 52, gov: true,  machine: 92, kind: 'ruling' },
      { id: 'CCC',  abbr: 'CCC',     name: 'Citizens Coalition for Change', color: '#d4d43f', ideo: 'urban reformist opposition', vote: 32, gov: false, machine: 38, kind: 'opposition' },
      { id: 'MDC',  abbr: 'MDC-A',   name: 'Movement for Democratic Change Alliance', color: '#d4453f', ideo: 'social democratic, older opposition tradition', vote: 11, gov: false, machine: 30, kind: 'opposition' },
      { id: 'ZAPU', abbr: 'ZAPU',    name: 'Zimbabwe African People’s Union', color: '#3f7bd0', ideo: 'regionalist, Matabeleland grievance', vote: 5, gov: false, machine: 22, kind: 'opposition' }
    ],
    terms: T({ meeting: 'rally', meetingPl: 'rallies', primary: 'party primary election',
      conference: 'national people’s conference', exec: 'Politburo', execShort: 'Politburo',
      leaderTitle: 'First Secretary & President of the Party', sg: 'National Political Commissar',
      deputyMin: 'Deputy Minister', chief: 'chief', youthWing: 'Youth League', elder: 'war veteran' }),
    media: ['The Herald', 'NewsDay', 'ZBC', 'ZimLive', 'Studio 7'],
    names: {
      first: ['Tendai','Farai','Rutendo','Tapiwa','Munashe','Nyasha','Tinashe','Chipo','Rudo','Takudzwa','Sibusiso','Nkosana','Thandeka','Kudzai','Simbarashe','Anesu','Tafadzwa','Vimbai'],
      last: ['Moyo','Ncube','Sibanda','Dube','Mhlanga','Nyandoro','Madziva','Chikafu','Gwenzi','Mataruse','Rusike','Chidembo','Marimo','Nyoni','Zimuto','Mangwiro']
    }
  };

  /* ============================= ZAMBIA ============================= */
  C.ZM = {
    id: 'ZM', name: 'Zambia', adj: 'Zambian', flag: '🇿🇲', capital: 'Lusaka',
    cur: { code: 'ZMW', sym: 'K' }, accent: '#e0873f',
    system: 'pres', hard: 4, startYear: 2026, nextElection: 2026, houseTerm: 5,
    termLimit: 2, presTerm: 5, runoff: true,
    tagline: 'Copper, debt, and a country that changes its mind',
    brief: 'Zambia actually turns governments out — three peaceful handovers and counting. The ' +
           'presidency is directly elected on 50% plus one, the courts mostly hold, and the price of ' +
           'copper decides more budgets than any minister does. Regional blocs are hard and stable.',
    notes: ['Real alternation of power', '50%+1 presidential', 'Copper price runs the budget'],
    house: { name: 'National Assembly', seats: 156, elected: 156, method: 'fptp' },
    inst: { judiciary: 58, media: 54, electoral: 66, security: 40, patronage: 64, ethnic: 62, incumbency: 60 },
    econ: { growth: 3.6, inflation: 13, unemployment: 13, debt: 98, reserves: 3.6, gdppc: 1400,
            staple: 'copper', staplePrice: 100, informal: 70 },
    issues: ['debt restructuring', 'mealie-meal prices', 'load-shedding', 'mining taxes', 'youth unemployment'],
    regions: [
      { id: 'lus', name: 'Lusaka',        seats: 18, bias: { UPND: 1.2, PF: 1.2, MMD: .7, SP: 1.6, TON: .6 } },
      { id: 'cop', name: 'Copperbelt',    seats: 22, bias: { UPND: 1.0, PF: 1.7, MMD: .8, SP: 1.4, TON: .4 } },
      { id: 'cen', name: 'Central',       seats: 14, bias: { UPND: 1.0, PF: 1.2, MMD: 1.0,SP: .8,  TON: .5 } },
      { id: 'eas', name: 'Eastern',       seats: 19, bias: { UPND: .5,  PF: 1.9, MMD: 1.2,SP: .7,  TON: .3 } },
      { id: 'lua', name: 'Luapula',       seats: 14, bias: { UPND: .5,  PF: 2.1, MMD: .7, SP: .6,  TON: .2 } },
      { id: 'muc', name: 'Muchinga',      seats: 10, bias: { UPND: .5,  PF: 2.0, MMD: .7, SP: .6,  TON: .2 } },
      { id: 'nor', name: 'Northern',      seats: 14, bias: { UPND: .5,  PF: 2.0, MMD: .7, SP: .6,  TON: .2 } },
      { id: 'nwe', name: 'North-Western', seats: 11, bias: { UPND: 2.1, PF: .4,  MMD: .8, SP: .7,  TON: .6 } },
      { id: 'sou', name: 'Southern',      seats: 17, bias: { UPND: 2.6, PF: .2,  MMD: .5, SP: .5,  TON: 1.4 } },
      { id: 'wes', name: 'Western',       seats: 17, bias: { UPND: 1.7, PF: .5,  MMD: .8, SP: .8,  TON: 1.1 } }
    ],
    parties: [
      { id: 'UPND', abbr: 'UPND', name: 'United Party for National Development', color: '#3f7bd0', ideo: 'liberal-reformist, business-friendly', vote: 45, gov: true,  machine: 62, kind: 'ruling' },
      { id: 'PF',   abbr: 'PF',   name: 'Patriotic Front',                       color: '#3fa86b', ideo: 'populist, infrastructure-and-patronage', vote: 34, gov: false, machine: 66, kind: 'opposition' },
      { id: 'MMD',  abbr: 'MMD',  name: 'Movement for Multi-Party Democracy',    color: '#d8a53f', ideo: 'the old liberalising party, much diminished', vote: 8, gov: false, machine: 34, kind: 'opposition' },
      { id: 'SP',   abbr: 'SP',   name: 'Socialist Party',                       color: '#d4453f', ideo: 'left, land-labour-justice',              vote: 8,  gov: false, machine: 24, kind: 'opposition' },
      { id: 'TON',  abbr: 'NDC',  name: 'National Democratic Congress',          color: '#8f6cc8', ideo: 'breakaway regional vehicle',             vote: 5,  gov: false, machine: 20, kind: 'opposition' }
    ],
    terms: T({ meeting: 'community rally', meetingPl: 'rallies', primary: 'party adoption',
      conference: 'general conference', deputyHos: 'Vice-President', deputyMin: 'Deputy Minister',
      region: 'province', regionPl: 'provinces', chief: 'chief', youthWing: 'Youth League' }),
    media: ['the Zambia Daily Mail', 'News Diggers', 'ZNBC', 'Mwebantu', 'Radio Phoenix'],
    names: {
      first: ['Mwansa','Chanda','Bwalya','Mulenga','Nsofwa','Mutale','Chileshe','Lubasi','Namakau','Thandiwe','Mwaka','Kondwani','Chishimba','Musonda','Lombe','Nkonde'],
      last: ['Mulenga','Banda','Phiri','Zulu','Tembo','Mwale','Chanda','Sikazwe','Musonda','Nkhata','Mubita','Simumba','Chibwe','Hamweemba','Namuyamba','Lungwe']
    }
  };

  /* ============================= NAMIBIA ============================ */
  C.NA = {
    id: 'NA', name: 'Namibia', adj: 'Namibian', flag: '🇳🇦', capital: 'Windhoek',
    cur: { code: 'NAD', sym: 'N$' }, accent: '#4fb5a8',
    system: 'pres', hard: 4, startYear: 2026, nextElection: 2029, houseTerm: 5,
    termLimit: 2, presTerm: 5, runoff: true,
    tagline: 'A liberation movement that never lost',
    brief: 'A directly elected President and a purely proportional Assembly, so the party list is the ' +
           'career. One movement has governed since independence and the north votes for it in blocks. ' +
           'Institutions are decent; the real contest is the movement’s own congress.',
    notes: ['Pure national-list PR', 'Dominant liberation movement', 'Congress is the real election'],
    house: { name: 'National Assembly', seats: 96, elected: 96, method: 'pr', threshold: 0 },
    inst: { judiciary: 72, media: 78, electoral: 74, security: 36, patronage: 52, ethnic: 58, incumbency: 68 },
    econ: { growth: 3.2, inflation: 4.8, unemployment: 36, debt: 66, reserves: 4.3, gdppc: 4900,
            staple: 'uranium, diamonds & offshore oil', staplePrice: 100, informal: 34 },
    issues: ['youth unemployment', 'land reform', 'offshore oil', 'green hydrogen', 'housing'],
    regions: [
      { id: 'kho', name: 'Khomas (Windhoek)', seats: 16, bias: { SWP: .8,  IPC: 1.7, PDM: 1.2, LPM: 1.2, AR: 2.2 } },
      { id: 'oha', name: 'Ohangwena',         seats: 12, bias: { SWP: 1.8, IPC: .5,  PDM: .2,  LPM: .3,  AR: .3 } },
      { id: 'omu', name: 'Omusati',           seats: 12, bias: { SWP: 1.8, IPC: .5,  PDM: .2,  LPM: .3,  AR: .3 } },
      { id: 'osh', name: 'Oshana',            seats: 9,  bias: { SWP: 1.4, IPC: 1.1, PDM: .3,  LPM: .4,  AR: .6 } },
      { id: 'oik', name: 'Oshikoto',          seats: 9,  bias: { SWP: 1.6, IPC: .8,  PDM: .3,  LPM: .4,  AR: .4 } },
      { id: 'kav', name: 'Kavango East & West',seats: 12,bias: { SWP: 1.5, IPC: .8,  PDM: .5,  LPM: .5,  AR: .4 } },
      { id: 'ero', name: 'Erongo',            seats: 9,  bias: { SWP: .9,  IPC: 1.5, PDM: 1.1, LPM: 1.3, AR: 1.4 } },
      { id: 'zam', name: 'Zambezi',           seats: 5,  bias: { SWP: 1.2, IPC: .8,  PDM: 1.3, LPM: .6,  AR: .4 } },
      { id: 'otj', name: 'Otjozondjupa & Omaheke', seats: 6, bias: { SWP: .8, IPC: .9, PDM: 1.9, LPM: 1.0, AR: .5 } },
      { id: 'har', name: 'Hardap & ǂKaras', seats: 6, bias: { SWP: .7, IPC: .9, PDM: 1.4, LPM: 2.6, AR: .6 } }
    ],
    parties: [
      { id: 'SWP', abbr: 'SWAPO', name: 'SWAPO Party of Namibia',        color: '#3fa86b', ideo: 'liberation movement, statist', vote: 53, gov: true,  machine: 86, kind: 'ruling' },
      { id: 'IPC', abbr: 'IPC',   name: 'Independent Patriots for Change',color: '#3f7bd0', ideo: 'reformist breakaway',          vote: 24, gov: false, machine: 34, kind: 'opposition' },
      { id: 'PDM', abbr: 'PDM',   name: 'Popular Democratic Movement',   color: '#d8a53f', ideo: 'conservative, older opposition',vote: 8,  gov: false, machine: 30, kind: 'opposition' },
      { id: 'LPM', abbr: 'LPM',   name: 'Landless People’s Movement',color: '#d4453f', ideo: 'land restitution, southern base',vote: 8, gov: false, machine: 24, kind: 'opposition' },
      { id: 'AR',  abbr: 'AR',    name: 'Affirmative Repositioning',     color: '#8f6cc8', ideo: 'urban youth, housing',          vote: 7,  gov: false, machine: 22, kind: 'opposition' }
    ],
    terms: T({ meeting: 'community meeting', meetingPl: 'community meetings', primary: 'list nomination',
      conference: 'party congress', exec: 'Central Committee', execShort: 'CC',
      deputyMin: 'Deputy Minister', chief: 'traditional leader', elder: 'struggle veteran' }),
    media: ['The Namibian', 'New Era', 'NBC', 'Windhoek Observer', 'Namibian Sun'],
    names: {
      first: ['Nangolo','Ndapewa','Taimi','Hilma','Petrus','Selma','Immanuel','Ndeshi','Tuyakula','Fillemon','Rauna','Sakaria','Kandiwapa','Lukas','Frieda','Elifas'],
      last: ['Shikongo','Amutenya','Nghidinwa','Iipumbu','Haufiku','Shilongo','Nakale','Uupindi','Gawanas','Kambala','Hausiku','Shivute','Nekwaya','Tjivikua']
    }
  };

  /* ============================= MALAWI ============================= */
  C.MW = {
    id: 'MW', name: 'Malawi', adj: 'Malawian', flag: '🇲🇼', capital: 'Lilongwe',
    cur: { code: 'MWK', sym: 'MK' }, accent: '#d4453f',
    system: 'pres', hard: 3, startYear: 2026, nextElection: 2030, houseTerm: 5,
    termLimit: 2, presTerm: 5, runoff: true,
    tagline: 'Three regions, one fertiliser subsidy, endless coalitions',
    brief: 'Region decides almost everything: North, Centre, South. The presidency needs an absolute ' +
           'majority, which forces alliances nobody believes in. The courts once annulled a presidential ' +
           'election here — they are the most independent institution in the country, and the most feared.',
    notes: ['Regional bloc voting', '50%+1 with a re-run', 'Courts have annulled an election'],
    house: { name: 'National Assembly', seats: 193, elected: 193, method: 'fptp' },
    inst: { judiciary: 74, media: 62, electoral: 62, security: 34, patronage: 72, ethnic: 74, incumbency: 55 },
    econ: { growth: 2.2, inflation: 28, unemployment: 21, debt: 88, reserves: 1.0, gdppc: 640,
            staple: 'tobacco & tea', staplePrice: 100, informal: 84 },
    issues: ['forex shortages', 'fertiliser subsidy', 'fuel queues', 'donor confidence', 'maize prices'],
    regions: [
      { id: 'nor', name: 'Northern Region', seats: 33, bias: { MCP: .7,  DPP: .6,  UTM: 1.9, UDF: .5, AFD: 1.6 } },
      { id: 'cen', name: 'Central Region',  seats: 72, bias: { MCP: 2.3, DPP: .4,  UTM: .8,  UDF: .5, AFD: .5 } },
      { id: 'sou', name: 'Southern Region', seats: 88, bias: { MCP: .45, DPP: 1.9, UTM: .8,  UDF: 1.9,AFD: .6 } }
    ],
    parties: [
      { id: 'MCP', abbr: 'MCP', name: 'Malawi Congress Party',            color: '#3fa86b', ideo: 'the old one-party machine, reinvented', vote: 34, gov: true,  machine: 70, kind: 'ruling' },
      { id: 'DPP', abbr: 'DPP', name: 'Democratic Progressive Party',     color: '#3f7bd0', ideo: 'southern-based, business-aligned',      vote: 32, gov: false, machine: 64, kind: 'opposition' },
      { id: 'UTM', abbr: 'UTM', name: 'UTM Party',                        color: '#d8a53f', ideo: 'reformist, youth-facing',               vote: 15, gov: true,  machine: 32, kind: 'coalition' },
      { id: 'UDF', abbr: 'UDF', name: 'United Democratic Front',          color: '#e0873f', ideo: 'the party that ended one-party rule',   vote: 11, gov: false, machine: 30, kind: 'opposition' },
      { id: 'AFD', abbr: 'AFORD',name: 'Alliance for Democracy',          color: '#8f6cc8', ideo: 'northern regional vehicle',             vote: 8,  gov: false, machine: 20, kind: 'opposition' }
    ],
    terms: T({ meeting: 'whistle-stop rally', meetingPl: 'whistle-stop rallies', primary: 'party primary',
      conference: 'national convention', exec: 'National Executive Committee',
      deputyHos: 'Vice-President', deputyMin: 'Deputy Minister', chief: 'Traditional Authority',
      region: 'region', regionPl: 'regions', youthWing: 'Youth League' }),
    media: ['the Nation', 'the Daily Times', 'MBC', 'Zodiak Radio', 'Nyasa Times'],
    names: {
      first: ['Chikondi','Thoko','Mphatso','Tamandani','Yamikani','Limbani','Chisomo','Takondwa','Madalitso','Grace','Blessings','Chimwemwe','Alinafe','Dalitso'],
      last: ['Banda','Phiri','Mwale','Nyirenda','Chirwa','Gondwe','Mkandawire','Msiska','Kaunda','Chipeta','Mvula','Kamanga','Nkhoma','Zgambo']
    }
  };

  /* =========================== MOZAMBIQUE =========================== */
  C.MZ = {
    id: 'MZ', name: 'Mozambique', adj: 'Mozambican', flag: '🇲🇿', capital: 'Maputo',
    cur: { code: 'MZN', sym: 'MT' }, accent: '#3fa86b',
    system: 'pres', hard: 4, startYear: 2026, nextElection: 2029, houseTerm: 5,
    termLimit: 2, presTerm: 5,
    tagline: 'Gas in the north, a war that will not end, a party that will not leave',
    brief: 'The liberation party has never lost, provincial lists are decided in Maputo, and the ' +
           'northern gas fields sit beside an insurgency. Elections are followed by protests and ' +
           'disputed counts. Portuguese is the language of the state; the vote is not.',
    notes: ['Provincial-list PR', 'Insurgency in the north', 'Disputed counts and street protest'],
    house: { name: 'Assembly of the Republic', seats: 250, elected: 250, method: 'pr', threshold: 5 },
    inst: { judiciary: 34, media: 38, electoral: 32, security: 70, patronage: 83, ethnic: 56, incumbency: 89 },
    econ: { growth: 4.2, inflation: 6.5, unemployment: 25, debt: 92, reserves: 3.8, gdppc: 620,
            staple: 'LNG, coal & aluminium', staplePrice: 100, informal: 82 },
    issues: ['the Cabo Delgado insurgency', 'gas revenues', 'hidden debts', 'youth protest', 'cyclones'],
    regions: [
      { id: 'nam', name: 'Nampula',      seats: 45, bias: { FRE: .8,  REN: 1.3, POD: 1.7, MDM: .9 } },
      { id: 'zam', name: 'Zambézia',seats: 45, bias: { FRE: .8,  REN: 1.5, POD: 1.5, MDM: .9 } },
      { id: 'cab', name: 'Cabo Delgado', seats: 22, bias: { FRE: 1.2, REN: 1.0, POD: 1.1, MDM: .7 } },
      { id: 'sof', name: 'Sofala',       seats: 22, bias: { FRE: .6,  REN: 2.0, POD: 1.2, MDM: 2.4 } },
      { id: 'tet', name: 'Tete',         seats: 22, bias: { FRE: 1.0, REN: 1.3, POD: 1.1, MDM: .8 } },
      { id: 'man', name: 'Manica',       seats: 15, bias: { FRE: .8,  REN: 1.8, POD: 1.0, MDM: 1.1 } },
      { id: 'nia', name: 'Niassa',       seats: 15, bias: { FRE: 1.3, REN: .9,  POD: .9,  MDM: .6 } },
      { id: 'inh', name: 'Inhambane',    seats: 15, bias: { FRE: 1.6, REN: .6,  POD: .7,  MDM: .6 } },
      { id: 'gaz', name: 'Gaza',         seats: 15, bias: { FRE: 2.1, REN: .3,  POD: .5,  MDM: .4 } },
      { id: 'map', name: 'Maputo Province', seats: 16, bias: { FRE: 1.7, REN: .5, POD: .9, MDM: .6 } },
      { id: 'mac', name: 'Maputo City',  seats: 18, bias: { FRE: 1.2, REN: .7,  POD: 1.6, MDM: 1.0 } }
    ],
    parties: [
      { id: 'FRE', abbr: 'FRELIMO', name: 'Frente de Libertação de Moçambique', color: '#3fa86b', ideo: 'liberation party, in power since independence', vote: 48, gov: true,  machine: 90, kind: 'ruling' },
      { id: 'POD', abbr: 'PODEMOS', name: 'Partido Óptimo para o Desenvolvimento',        color: '#d8a53f', ideo: 'vehicle of the youth protest wave',            vote: 24, gov: false, machine: 26, kind: 'opposition' },
      { id: 'REN', abbr: 'RENAMO',  name: 'Resistência Nacional Moçambicana',        color: '#d4453f', ideo: 'former insurgency, now the old opposition',     vote: 20, gov: false, machine: 44, kind: 'opposition' },
      { id: 'MDM', abbr: 'MDM',     name: 'Movimento Democrático de Moçambique',     color: '#3f7bd0', ideo: 'municipal reformist, Beira-rooted',            vote: 8,  gov: false, machine: 22, kind: 'opposition' }
    ],
    terms: T({ meeting: 'comício', meetingPl: 'comícios', primary: 'list placement',
      conference: 'party congress', exec: 'Political Commission', execShort: 'CP',
      assembly: 'Assembly of the Republic', deputyHos: 'Prime Minister', deputyMin: 'Deputy Minister',
      region: 'province', regionPl: 'provinces', chief: 'régulo', youthWing: 'Youth Organisation' }),
    media: ['Notícias', 'Savana', 'TVM', '@Verdade', 'Carta de Moçambique'],
    names: {
      first: ['Jaime','Celso','Inácio','Rosária','Amélia','Bento','Anastácia','Nelson','Domingos','Isaura','Adelino','Glória','Ossufo','Telma'],
      last: ['Macuácua','Sitoe','Manjate','Muianga','Tembe','Nhaca','Chirindza','Massingue','Bila','Cossa','Mabote','Chivale','Namburete','Mucavele']
    }
  };

  /* ============================= LESOTHO ============================ */
  C.LS = {
    id: 'LS', name: 'Lesotho', adj: 'Mosotho', flag: '🇱🇸', capital: 'Maseru',
    cur: { code: 'LSL', sym: 'M' }, accent: '#3f7bd0',
    system: 'parl', hard: 2, startYear: 2026, nextElection: 2027, houseTerm: 5,
    termLimit: 0, presTerm: 5,
    tagline: 'Coalitions that last eighteen months',
    brief: 'A constitutional monarchy: the King reigns, the Prime Minister governs, and nobody ever ' +
           'wins outright. Mixed-member proportional representation guarantees hung parliaments, so ' +
           'the real skill is coalition arithmetic — and surviving the army’s opinions.',
    notes: ['Mixed-member proportional', 'Easy to become PM, very hard to stay', 'Army has intervened before'],
    house: { name: 'National Assembly', seats: 120, elected: 80, method: 'mmp', listSeats: 40 },
    inst: { judiciary: 60, media: 62, electoral: 68, security: 62, patronage: 66, ethnic: 22, incumbency: 40 },
    econ: { growth: 2.4, inflation: 5.6, unemployment: 30, debt: 60, reserves: 5.0, gdppc: 1100,
            staple: 'textiles, water & diamonds', staplePrice: 100, informal: 55 },
    issues: ['SACU receipts', 'textile jobs', 'the water royalty', 'youth migration', 'political instability'],
    regions: [
      { id: 'mas', name: 'Maseru',        seats: 19, bias: { RFP: 1.4, DC: .9,  ABC: 1.0, AD: 1.0, BAP: .8, LCD: .9 } },
      { id: 'ler', name: 'Leribe',        seats: 13, bias: { RFP: 1.1, DC: 1.0, ABC: 1.3, AD: .8,  BAP: 1.4,LCD: 1.0 } },
      { id: 'ber', name: 'Berea',         seats: 11, bias: { RFP: 1.2, DC: 1.0, ABC: 1.1, AD: .9,  BAP: 1.0,LCD: 1.0 } },
      { id: 'maf', name: 'Mafeteng',      seats: 9,  bias: { RFP: 1.0, DC: 1.3, ABC: .8,  AD: 1.1, BAP: .8, LCD: 1.1 } },
      { id: 'moh', name: "Mohale's Hoek", seats: 7,  bias: { RFP: .9,  DC: 1.4, ABC: .8,  AD: 1.1, BAP: .7, LCD: 1.2 } },
      { id: 'qut', name: 'Quthing',       seats: 5,  bias: { RFP: .8,  DC: 1.4, ABC: .8,  AD: 1.2, BAP: .7, LCD: 1.2 } },
      { id: 'qac', name: "Qacha's Nek",   seats: 3,  bias: { RFP: .9,  DC: 1.3, ABC: .9,  AD: 1.1, BAP: .7, LCD: 1.1 } },
      { id: 'mok', name: 'Mokhotlong',    seats: 4,  bias: { RFP: .9,  DC: 1.0, ABC: 1.4, AD: .8,  BAP: 1.2,LCD: .9 } },
      { id: 'tha', name: 'Thaba-Tseka',   seats: 4,  bias: { RFP: .9,  DC: 1.2, ABC: 1.1, AD: .9,  BAP: .9, LCD: 1.0 } },
      { id: 'but', name: 'Butha-Buthe',   seats: 5,  bias: { RFP: 1.0, DC: 1.0, ABC: 1.3, AD: .8,  BAP: 1.3,LCD: .9 } }
    ],
    parties: [
      { id: 'RFP', abbr: 'RFP', name: 'Revolution for Prosperity',   color: '#d8a53f', ideo: 'business-led reformist newcomer', vote: 33, gov: true,  machine: 40, kind: 'ruling' },
      { id: 'DC',  abbr: 'DC',  name: 'Democratic Congress',         color: '#3fa86b', ideo: 'congress tradition, southern base', vote: 20, gov: false, machine: 52, kind: 'opposition' },
      { id: 'ABC', abbr: 'ABC', name: 'All Basotho Convention',      color: '#3f7bd0', ideo: 'northern-rooted, once dominant',   vote: 16, gov: true,  machine: 48, kind: 'coalition' },
      { id: 'AD',  abbr: 'AD',  name: 'Alliance of Democrats',       color: '#8f6cc8', ideo: 'kingmaker centrist',               vote: 12, gov: true,  machine: 30, kind: 'coalition' },
      { id: 'BAP', abbr: 'BAP', name: 'Basotho Action Party',        color: '#e0873f', ideo: 'ABC breakaway',                    vote: 10, gov: false, machine: 26, kind: 'opposition' },
      { id: 'LCD', abbr: 'LCD', name: 'Lesotho Congress for Democracy', color: '#d4453f', ideo: 'the old congress machine',      vote: 9,  gov: false, machine: 30, kind: 'opposition' }
    ],
    terms: T({ meeting: 'pitso', meetingPl: 'lipitso', primary: 'constituency nomination',
      conference: 'national conference', hos: 'Prime Minister', hosFull: 'Prime Minister',
      deputyHos: 'Deputy Prime Minister', leaderTitle: 'Party Leader', deputyTitle: 'Deputy Leader',
      chief: 'principal chief', region: 'district', regionPl: 'districts', youthWing: 'Youth League' }),
    media: ['the Lesotho Times', 'Public Eye', 'MoAfrika FM', 'Newsday', 'Sunday Express'],
    names: {
      first: ['Thabo','Mpho','Lineo','Retšelisitsoe','Palesa','Teboho','Nthabiseng','Motlatsi','Lehlohonolo','Mamello','Karabo','Puseletso','Tsepo','Nthati'],
      last: ['Mohapi','Sekhonyana','Ramaili','Motaung','Lebona','Makhele','Ntsukunyane','Phamotse','Sello','Mosuoe','Tlali','Rapapa','Nthimotse','Khoabane']
    }
  };

  /* ============================ ESWATINI ============================ */
  C.SZ = {
    id: 'SZ', name: 'Eswatini', adj: 'Swati', flag: '🇸🇿', capital: 'Mbabane / Lobamba',
    cur: { code: 'SZL', sym: 'E' }, accent: '#8f6cc8',
    system: 'monarchy', hard: 3, startYear: 2026, nextElection: 2028, houseTerm: 5,
    termLimit: 0, presTerm: 5,
    tagline: 'There is a ceiling, and it wears a crown',
    brief: 'Political parties cannot contest elections. You are nominated at a chiefdom meeting, ' +
           'elected from a Tinkhundla constituency, and appointed to anything above that by the King. ' +
           'The highest office you can ever hold is Prime Minister — and you will not choose when you leave it.',
    notes: ['No party politics — individual merit', 'Appointed and dismissed by the King', 'Ceiling: Prime Minister'],
    house: { name: 'House of Assembly', seats: 73, elected: 59, method: 'nonparty' },
    inst: { judiciary: 30, media: 24, electoral: 40, security: 76, patronage: 70, ethnic: 12, incumbency: 70 },
    econ: { growth: 2.6, inflation: 4.4, unemployment: 34, debt: 42, reserves: 3.2, gdppc: 4100,
            staple: 'sugar & SACU receipts', staplePrice: 100, informal: 42 },
    issues: ['SACU receipts', 'youth unemployment', 'political reform', 'HIV programmes', 'sugar prices'],
    regions: [
      { id: 'hho', name: 'Hhohho',    seats: 14, bias: { IND: 1 } },
      { id: 'man', name: 'Manzini',   seats: 17, bias: { IND: 1 } },
      { id: 'shi', name: 'Shiselweni',seats: 14, bias: { IND: 1 } },
      { id: 'lub', name: 'Lubombo',   seats: 14, bias: { IND: 1 } }
    ],
    parties: [
      { id: 'IND', abbr: 'IND', name: 'Independent (Tinkhundla)', color: '#d8a53f', ideo: 'no party contests elections; members stand as individuals', vote: 100, gov: true, machine: 50, kind: 'ruling' }
    ],
    terms: T({ meeting: 'chiefdom meeting', meetingPl: 'chiefdom meetings', primary: 'chiefdom nomination',
      conference: 'Sibaya (People’s Parliament)', hos: 'Prime Minister', hosFull: 'Prime Minister',
      deputyHos: 'Deputy Prime Minister', assembly: 'House of Assembly',
      leaderTitle: 'Prime Minister', exec: 'Cabinet', constituency: 'inkhundla',
      chief: 'chief', region: 'region', regionPl: 'regions', youthWing: 'regional youth council' }),
    media: ['the Times of Eswatini', 'the Eswatini Observer', 'EBIS radio', 'Swaziland News'],
    names: {
      first: ['Sipho','Thandi','Nomcebo','Mduduzi','Phesheya','Lindiwe','Bhekithemba','Zodwa','Sanele','Nokwanda','Sabelo','Temaswati'],
      last: ['Dlamini','Shongwe','Nkambule','Simelane','Magagula','Hlophe','Gamedze','Vilakati','Zwane','Matsebula','Mamba','Ginindza']
    }
  };

  /* ============================== ANGOLA ============================ */
  C.AO = {
    id: 'AO', name: 'Angola', adj: 'Angolan', flag: '🇦🇴', capital: 'Luanda',
    cur: { code: 'AOA', sym: 'Kz' }, accent: '#d4453f',
    system: 'pres', hard: 5, startYear: 2026, nextElection: 2027, houseTerm: 5,
    termLimit: 2, presTerm: 5,
    tagline: 'Oil, the party, and the head of the list',
    brief: 'There is no separate presidential ballot: whoever tops the winning party’s national list ' +
           'becomes President. So the only election that matters is the one inside the party. Oil pays ' +
           'for the state, Luanda swings hard against the government, and the countryside does not.',
    notes: ['No separate presidential vote', 'Top of the winning list wins', 'Oil-financed state'],
    house: { name: 'National Assembly', seats: 220, elected: 220, method: 'pr', threshold: 0 },
    inst: { judiciary: 30, media: 32, electoral: 36, security: 74, patronage: 84, ethnic: 44, incumbency: 84 },
    econ: { growth: 2.8, inflation: 22, unemployment: 33, debt: 74, reserves: 6.5, gdppc: 2800,
            staple: 'oil', staplePrice: 100, informal: 78 },
    issues: ['fuel subsidy reform', 'oil decline', 'youth unemployment', 'Chinese debt', 'diversification'],
    regions: [
      { id: 'lua', name: 'Luanda',            seats: 63, bias: { MPLA: .6,  UNITA: 1.9, PRS: .5, FNLA: .7, CASA: 1.4 } },
      { id: 'ben', name: 'Benguela',          seats: 22, bias: { MPLA: .9,  UNITA: 1.4, PRS: .5, FNLA: .6, CASA: 1.0 } },
      { id: 'hua', name: 'Huambo',            seats: 18, bias: { MPLA: .7,  UNITA: 2.0, PRS: .4, FNLA: .5, CASA: .9 } },
      { id: 'hui', name: 'Huíla',        seats: 20, bias: { MPLA: 1.0, UNITA: 1.3, PRS: .5, FNLA: .5, CASA: .9 } },
      { id: 'cus', name: 'Cuanza Sul',        seats: 12, bias: { MPLA: 1.2, UNITA: 1.0, PRS: .5, FNLA: .6, CASA: .8 } },
      { id: 'bie', name: 'Bié',          seats: 12, bias: { MPLA: .8,  UNITA: 1.9, PRS: .4, FNLA: .5, CASA: .8 } },
      { id: 'uig', name: 'Uíge',         seats: 14, bias: { MPLA: 1.3, UNITA: .7,  PRS: .4, FNLA: 2.6,CASA: .7 } },
      { id: 'mal', name: 'Malanje',           seats: 9,  bias: { MPLA: 1.5, UNITA: .8,  PRS: .5, FNLA: .8, CASA: .7 } },
      { id: 'cab', name: 'Cabinda',           seats: 6,  bias: { MPLA: 1.1, UNITA: 1.0, PRS: .5, FNLA: .6, CASA: 1.5 } },
      { id: 'zai', name: 'Zaire',             seats: 4,  bias: { MPLA: 1.4, UNITA: .7,  PRS: .4, FNLA: 2.2,CASA: .7 } },
      { id: 'ben2',name: 'Bengo & Cuanza Norte', seats: 8, bias: { MPLA: 1.6, UNITA: .7, PRS: .4, FNLA: .8, CASA: .6 } },
      { id: 'mox', name: 'Moxico & Cuando Cubango', seats: 9, bias: { MPLA: 1.0, UNITA: 1.6, PRS: .5, FNLA: .4, CASA: .7 } },
      { id: 'nam', name: 'Namibe & Cunene',   seats: 11, bias: { MPLA: 1.2, UNITA: 1.1, PRS: .5, FNLA: .4, CASA: .8 } },
      { id: 'lun', name: 'Lundas',            seats: 12, bias: { MPLA: 1.0, UNITA: 1.0, PRS: 3.2,FNLA: .4, CASA: .7 } }
    ],
    parties: [
      { id: 'MPLA',  abbr: 'MPLA',  name: 'Movimento Popular de Libertação de Angola', color: '#d4453f', ideo: 'ruling since independence, oil-financed', vote: 46, gov: true,  machine: 92, kind: 'ruling' },
      { id: 'UNITA', abbr: 'UNITA', name: 'União Nacional para a Independência Total de Angola', color: '#3fa86b', ideo: 'former insurgency, now the main opposition', vote: 42, gov: false, machine: 52, kind: 'opposition' },
      { id: 'PRS',   abbr: 'PRS',   name: 'Partido de Renovação Social', color: '#3f7bd0', ideo: 'Lundas regional party',    vote: 5, gov: false, machine: 20, kind: 'opposition' },
      { id: 'FNLA',  abbr: 'FNLA',  name: 'Frente Nacional de Libertação de Angola', color: '#d8a53f', ideo: 'northern historic movement', vote: 4, gov: false, machine: 18, kind: 'opposition' },
      { id: 'CASA',  abbr: 'CASA',  name: 'CASA–CE', color: '#8f6cc8', ideo: 'urban civic coalition', vote: 3, gov: false, machine: 16, kind: 'opposition' }
    ],
    terms: T({ meeting: 'comício', meetingPl: 'comícios', primary: 'list placement',
      conference: 'party congress', exec: 'Political Bureau', execShort: 'Bureau',
      deputyHos: 'Vice-President', deputyMin: 'Secretary of State',
      region: 'province', regionPl: 'provinces', chief: 'soba', youthWing: 'Youth Movement' }),
    media: ['Jornal de Angola', 'TPA', 'Novo Jornal', 'Rádio Ecélsior', 'Folha 8'],
    names: {
      first: ['João','Manuel','Esperança','Domingos','Adão','Rosa','Carlos','Ana Paula','Higino','Teresa','Alberto','Luzia','Bento','Ndala'],
      last: ['Baptista','Kiala','Muandumba','Cassule','Malaquias','Kambwa','Sebastião','Panzo','Quibato','Muxito','Kapalandanda','Chivukuvuku','Bengui','Sanjombe']
    }
  };

  // ---- finalise ----
  Object.keys(C).forEach(function (k) {
    var c = C[k];
    c.ministries = c.ministries || DEFAULT_MINISTRIES.map(function (m) { return Object.assign({}, m); });
    c.totalSeats = c.regions.reduce(function (a, r) { return a + r.seats; }, 0);
    c.partyById = {};
    c.parties.forEach(function (p) { c.partyById[p.id] = p; });
    c.regionById = {};
    c.regions.forEach(function (r) { r.share = r.seats / c.totalSeats; c.regionById[r.id] = r; });
  });

  RZ.COUNTRIES = C;
  RZ.COUNTRY_ORDER = ['BW', 'ZA', 'ZM', 'NA', 'ZW', 'MW', 'LS', 'MZ', 'AO', 'SZ'];
  RZ.MINISTRIES = DEFAULT_MINISTRIES;
})();
