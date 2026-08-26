/* data-ladder.js — the career ladder.
   Rungs are ordered. `how` decides which resolver runs when you contest it:
     internal   — a vote of party delegates in your area
     conference — a vote of national delegates at congress
     appoint    — the leader (or the King) chooses; you can only make yourself choosable
     public     — a public ballot you must win (with a party nomination first, if any)
     auto       — falls to you by virtue of another office
*/
(function () {
  'use strict';

  // salary multiplier is applied to a country wage base derived from GDP per head
  var RUNGS = [
    {
      id: 'activist', tier: 0, how: 'auto', ap: 3, sal: 0, cap: 0, reach: 'ward',
      title: { _: 'Party Activist', SZ: 'Community Volunteer' },
      desc: { _: 'Unpaid, unknown, and useful. Carry chairs, fill buses, learn every name in the ward.',
              SZ: 'No parties here. You are known at the chiefdom, or you are nobody.' }
    },
    {
      id: 'branch', tier: 1, how: 'internal', ap: 3, sal: 0, cap: 1, reach: 'ward',
      title: { _: 'Branch Chairperson', ZA: 'Branch Chairperson (BEC)', ZW: 'Cell & Branch Chairperson',
               MZ: 'Cell Secretary', AO: 'Cell Secretary', SZ: 'Chiefdom Development Committee' },
      desc: { _: 'The smallest unit of the party — and the one that counts delegates.',
              SZ: 'The committee that decides which projects the chiefdom asks for.' },
      req: { grassroots: 22 }
    },
    {
      id: 'council', tier: 2, how: 'public', ap: 3, sal: 1.6, cap: 2, reach: 'ward',
      title: { _: 'Councillor', ZA: 'Ward Councillor', LS: 'Community Councillor', SZ: 'Bucopho (Ward Representative)' },
      desc: { _: 'Potholes, water connections, burial fees. Nothing teaches a ward faster.' },
      req: { grassroots: 34, fame: 8 }
    },
    {
      id: 'constit', tier: 3, how: 'internal', ap: 3, sal: 0, cap: 4, reach: 'region',
      title: { _: 'Constituency Chairperson', ZA: 'Regional Executive Chairperson',
               ZW: 'District Coordinating Committee Chair', NA: 'Regional Coordinator',
               MZ: 'District First Secretary', AO: 'Municipal Secretary', SZ: 'Indvuna yeNkhundla' },
      desc: { _: 'You now control a slate of branches — which means you control votes that other people want.',
              SZ: 'You chair the inkhundla. Nominations pass through your hands.' },
      req: { grassroots: 45, party: 30 }
    },
    {
      id: 'mp', tier: 4, how: 'public', ap: 4, sal: 12, cap: 8, reach: 'region',
      title: { _: 'Member of Parliament', MZ: 'Deputy of the Assembly', AO: 'Deputy of the National Assembly',
               SZ: 'Member of the House of Assembly' },
      desc: { _: 'A salary, a constituency office, a vehicle and a microphone. Most careers stop here.' },
      req: { grassroots: 52, party: 38, fame: 22 }
    },
    {
      id: 'depmin', tier: 5, how: 'appoint', ap: 4, sal: 16, cap: 12, reach: 'national',
      title: { _: 'Assistant Minister', ZA: 'Deputy Minister', ZW: 'Deputy Minister', ZM: 'Provincial Minister',
               NA: 'Deputy Minister', MW: 'Deputy Minister', MZ: 'Provincial Governor',
               LS: 'Assistant Minister', AO: 'Secretary of State', SZ: 'Senator (appointed)' },
      desc: { _: 'A ministry you do not run, a budget you do not sign, and your first taste of the machine.',
              SZ: 'The King appoints. You did not apply, and you cannot decline gracefully.' },
      req: { fame: 32, leader: 40 }
    },
    {
      id: 'minister', tier: 6, how: 'appoint', ap: 4, sal: 20, cap: 20, reach: 'national',
      title: { _: 'Cabinet Minister' },
      desc: { _: 'A portfolio, a director-general who knows more than you, and a tender pipeline that knows everyone.' },
      req: { fame: 45, leader: 50, party: 48 }
    },
    {
      id: 'premier', tier: 7, how: 'appoint', ap: 4, sal: 22, cap: 22, reach: 'region', only: ['ZA'],
      title: { _: 'Provincial Premier' },
      desc: { _: 'A province of your own: your own budget, your own police complaints, your own faction.' },
      req: { fame: 50, party: 55, grassroots: 55 }
    },
    {
      id: 'senmin', tier: 8, how: 'appoint', ap: 4, sal: 24, cap: 30, reach: 'national',
      title: { _: 'Senior Cabinet Minister', ZW: 'Minister of State in the Presidency',
               AO: 'Minister of State', SZ: 'Senior Minister' },
      desc: { _: 'Finance, Home Affairs or Security. The portfolios that decide who else eats.' },
      req: { fame: 56, leader: 58, party: 58 }
    },
    {
      id: 'partyexec', tier: 9, how: 'conference', ap: 4, sal: 18, cap: 34, reach: 'national', skip: ['SZ'],
      title: { _: 'Secretary-General of the Party', ZW: 'National Political Commissar',
               NA: 'Secretary-General', MZ: 'Secretary-General', AO: 'Secretary-General',
               LS: 'Secretary-General' },
      desc: { _: 'You keep the membership register. Whoever keeps the register decides who is a delegate.' },
      req: { party: 62, fame: 58 }
    },
    {
      id: 'deputyleader', tier: 10, how: 'conference', ap: 4, sal: 22, cap: 40, reach: 'national',
      title: { _: 'Deputy President of the Party', LS: 'Deputy Leader', SZ: 'Deputy Prime Minister' },
      desc: { _: 'One heartbeat, one reshuffle, one conference away. Also the most watched person in the country.',
              SZ: 'You deputise, you absorb blame, and you wait to be told.' },
      req: { party: 70, fame: 66 }
    },
    {
      id: 'vp', tier: 11, how: 'appoint', ap: 5, sal: 28, cap: 50, reach: 'national', skip: ['SZ', 'LS', 'ZA'],
      title: { _: 'Vice-President of the Republic', MZ: 'Prime Minister', AO: 'Vice-President of the Republic' },
      desc: { _: 'Constitutionally a spare tyre; politically, the succession made visible.' },
      req: { fame: 70, leader: 66, party: 70 }
    },
    {
      id: 'vpza', tier: 11, how: 'appoint', ap: 5, sal: 28, cap: 50, reach: 'national', only: ['ZA'],
      title: { _: 'Deputy President of the Republic' },
      desc: { _: 'Leader of Government Business, chair of every committee nobody wants, heir presumptive.' },
      req: { fame: 70, leader: 66, party: 70 }
    },
    {
      id: 'leader', tier: 12, how: 'conference', ap: 5, sal: 24, cap: 60, reach: 'national', skip: ['SZ'],
      title: { _: 'President of the Party', LS: 'Leader of the Party', ZW: 'First Secretary & President of the Party' },
      desc: { _: 'The conference floor decides. Delegates were bought, bussed and briefed months ago.' },
      req: { party: 78, fame: 76 }
    },
    {
      id: 'hos', tier: 13, how: 'auto', howBy: { SZ: 'appoint' }, ap: 5, sal: 34, cap: 80, reach: 'national',
      title: { _: 'President of the Republic', LS: 'Prime Minister', SZ: 'Prime Minister' },
      desc: { _: 'State House. The motorcade, the 21 guns, and every problem in the country on one desk.',
              SZ: 'Appointed by the King from among the elected members. He may un-appoint you just as quickly.' },
      req: {}
    }
  ];

  function pickText(map, cid) {
    if (!map) return '';
    return map[cid] !== undefined ? map[cid] : map._;
  }

  var _ladderCache = {};
  RZ.ladderFor = function (cid) {
    if (_ladderCache[cid]) return _ladderCache[cid];
    return (_ladderCache[cid] = RUNGS.filter(function (r) {
      if (r.only && r.only.indexOf(cid) < 0) return false;
      if (r.skip && r.skip.indexOf(cid) >= 0) return false;
      return true;
    }).map(function (r, i) {
      return Object.assign({}, r, {
        idx: i,
        how: (r.howBy && r.howBy[cid]) ? r.howBy[cid] : r.how,
        title: pickText(r.title, cid),
        desc: pickText(r.desc, cid)
      });
    }));
  };

  RZ.RUNGS = RUNGS;
})();
