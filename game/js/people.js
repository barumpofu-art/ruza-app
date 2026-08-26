/* people.js — invented politicians, and the backgrounds a career can start from. */
(function () {
  'use strict';

  var BACKGROUNDS = [
    { id: 'union', name: 'Trade unionist', ico: '🔧',
      desc: 'Fifteen years as a shop steward. You can read a wage agreement and you can hold a hall.',
      stats: { oratory: 12, grit: 10, charisma: 6, integrity: 6 },
      standing: { grassroots: 18, party: 10, business: -8 }, money: .8,
      note: 'The most reliable route into a liberation or congress party.' },
    { id: 'lawyer', name: 'Advocate', ico: '⚖️',
      desc: 'A commercial practice, a human rights case that made your name, and a fee note nobody could pay.',
      stats: { intellect: 16, oratory: 8, cunning: 6 },
      standing: { media: 10, business: 8, intl: 6, grassroots: -6 }, money: 3.5,
      note: 'Money and credibility. Very little idea how a ward works.' },
    { id: 'teacher', name: 'Schoolteacher', ico: '📐',
      desc: 'Twenty years, four schools, and about two thousand former pupils who now vote.',
      stats: { intellect: 10, charisma: 8, integrity: 12, grit: 6 },
      standing: { grassroots: 20, party: 6 }, money: .6,
      note: 'The classic constituency machine: everyone knows your name already.' },
    { id: 'soldier', name: 'Former officer', ico: '🎖️',
      desc: 'A commission, a border deployment, and friends who are now generals.',
      stats: { grit: 16, cunning: 8, integrity: 4 },
      standing: { security: 30, grassroots: 4, media: -8 }, money: 1.2,
      note: 'In some countries this is the shortest route of all. In others it is a liability.' },
    { id: 'business', name: 'Businessperson', ico: '💼',
      desc: 'Transport, retail or construction. You know exactly what a licence is worth.',
      stats: { cunning: 12, charisma: 6, integrity: -8 },
      standing: { business: 26, party: 6, grassroots: -4 }, money: 8,
      note: 'You can self-fund. Everyone will assume you are buying something.' },
    { id: 'activist', name: 'Student activist', ico: '✊',
      desc: 'Expelled once, arrested twice, and the youth structures still sing your song.',
      stats: { oratory: 14, grit: 10, integrity: 8, intellect: 4 },
      standing: { grassroots: 14, media: 8, security: -10, business: -6 }, money: .2,
      note: 'Fame comes fast. So does a security file.' },
    { id: 'journalist', name: 'Journalist', ico: '📰',
      desc: 'A decade of by-lines and a contacts book that frightens people.',
      stats: { intellect: 10, cunning: 12, oratory: 6 },
      standing: { media: 28, party: -6, grassroots: -4 }, money: .7,
      note: 'You know where everything is buried, including things about your own side.' },
    { id: 'doctor', name: 'Doctor', ico: '🩺',
      desc: 'District hospital, then a specialisation, then a decade of watching the system fail.',
      stats: { intellect: 14, integrity: 14, grit: 6 },
      standing: { grassroots: 12, media: 8, intl: 4 }, money: 2.5,
      note: 'Trusted on sight. Trusted people are underestimated.' },
    { id: 'pastor', name: 'Church leader', ico: '✝️',
      desc: 'A congregation of four thousand and a radio slot on Sunday mornings.',
      stats: { oratory: 16, charisma: 12, integrity: 4 },
      standing: { grassroots: 22, media: 6, business: 4 }, money: 1.6,
      note: 'The pulpit is the largest unregulated campaign platform in the region.' },
    { id: 'royal', name: 'From a chiefly house', ico: '👑',
      desc: 'Your grandfather allocated the land everybody is standing on.',
      stats: { charisma: 10, cunning: 6, grit: 4 },
      standing: { grassroots: 24, party: 4, media: -4 }, money: 2,
      note: 'Unbeatable in one district. Deeply resented in the next one.' },
    { id: 'diaspora', name: 'Diaspora returnee', ico: '🌍',
      desc: 'Twelve years abroad, a professional qualification, and savings in hard currency.',
      stats: { intellect: 12, cunning: 4, integrity: 8 },
      standing: { intl: 20, business: 10, grassroots: -14 }, money: 5,
      note: 'You will be told you left. You will be told it for thirty years.' },
    { id: 'celeb', name: 'Musician or footballer', ico: '🎤',
      desc: 'Everyone under forty already knows your face. Nobody knows your opinions.',
      stats: { charisma: 18, oratory: 6, intellect: -6 },
      standing: { media: 16, grassroots: 10, party: -8 }, money: 3,
      note: 'Starts with fame, which is the hardest thing to build and the easiest to waste.' },
    { id: 'civil', name: 'Civil servant', ico: '🗂️',
      desc: 'Deputy director in a ministry. You know how a budget is actually moved.',
      stats: { intellect: 12, cunning: 10, grit: 6 },
      standing: { party: 12, business: 4, grassroots: -6 }, money: 1.5,
      note: 'You understand the machine better than the politicians who think they run it.' },
    { id: 'farmer', name: 'Farmer', ico: '🌾',
      desc: 'Cattle, a co-operative chairmanship, and every rural road in the district memorised.',
      stats: { grit: 12, charisma: 6, integrity: 8 },
      standing: { grassroots: 18, business: 8 }, money: 2,
      note: 'Rural seats are cheaper to win and harder to lose.' }
  ];

  var ROLES = [
    'provincial chairperson', 'secretary-general', 'chief whip', 'deputy minister',
    'minister', 'youth league president', 'constituency chairperson', 'businessman-politician',
    'former mayor', 'war veterans’ leader', 'treasurer-general', 'premier',
    'commissar', 'women’s league president', 'backbench organiser'
  ];

  var FACTIONS = [
    { id: 'reform', name: 'The Reformers', ideo: 'audits, term limits and a smaller cabinet' },
    { id: 'machine', name: 'The Structures', ideo: 'discipline, deployment and the membership register' },
    { id: 'radical', name: 'The Radicals', ideo: 'nationalisation, land and generational change' },
    { id: 'old', name: 'The Veterans', ideo: 'the liberation record and the right to rule' },
    { id: 'business', name: 'The Investors', ideo: 'growth first, and a friendly regulatory environment' }
  ];

  function makeName(c) {
    return RZ.pick(c.names.first) + ' ' + RZ.pick(c.names.last);
  }

  function makeNpc(c, opts) {
    opts = opts || {};
    return {
      id: opts.id || ('n' + Math.floor(RZ.rnd() * 1e9).toString(36)),
      name: opts.name || makeName(c),
      role: opts.role || RZ.pick(ROLES),
      regionId: opts.regionId || RZ.pick(c.regions).id,
      partyId: opts.partyId || c.parties[0].id,
      faction: opts.faction || RZ.pick(FACTIONS).id,
      power: opts.power !== undefined ? opts.power : Math.round(RZ.range(25, 70)),
      ambition: Math.round(RZ.range(20, 95)),
      loyalty: Math.round(RZ.range(20, 80)),
      integrity: Math.round(RZ.range(10, 85)),
      alive: true,
      dirt: []
    };
  }

  RZ.BACKGROUNDS = BACKGROUNDS;
  RZ.FACTIONS = FACTIONS;
  RZ.makeName = makeName;
  RZ.makeNpc = makeNpc;
  RZ.bgById = {};
  BACKGROUNDS.forEach(function (b) { RZ.bgById[b.id] = b; });
})();
