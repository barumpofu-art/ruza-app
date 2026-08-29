/* data-dialogue.js — the conversations.
   Every scene is a real meeting: somebody with a name, a job and a grievance,
   asking you something in front of other people. The three answers are usually
   the same three temptations — tell them what they want to hear, tell them the
   truth, or tell them nothing — and each has a price.

   Scenes read live state, so the union asks about inflation when inflation is
   the problem, and the elders ask about the borehole in your own district.
*/
(function () {
  'use strict';
  var P = RZ.pick;

  // Every scene calls this, and it used to invent a stranger each time. It now
  // resolves to a member of the cast, so the person who made you promise
  // something in 2029 is the person sitting opposite you in 2031, with the
  // memory of it. Roles that genuinely are a different person every time — the
  // woman at the front of a kgotla, the caller on the phone-in — are listed in
  // RZ.cast.ANON and still get a stranger.
  function who(a, role, org) {
    if (RZ.cast) return RZ.cast.who(a.S, a.C, role, org);
    return { name: RZ.makeName(a.C), role: role, org: org };
  }
  function money(a, m) { return RZ.money(a.wage(m), a.C.cur.sym); }
  // Country terms are stored lower case for use mid-sentence; a job title is not.
  function cap(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
  // A ministry action is one topic; the room is the chair you actually sit in.
  function sitting(a, sceneId) {
    return a.tier() >= 6 && a.tier() <= 8 && !a.P.isPresident &&
      !!(RZ.state && RZ.state.dutySceneId(a.S) === sceneId);
  }
  function cabWho(a, flag, fallbackRole, fallbackOrg) {
    var id = a.S.flags && a.S.flags[flag];
    if (RZ.state && id) return who(a, RZ.state.ministerRole(a.S, id), RZ.state.ministerOrg(id));
    return who(a, fallbackRole, fallbackOrg || '');
  }
  // Two ministers of different kinds arguing: the line is assembled from what
  // their portfolio actually is, not from a named feud. The six or seven
  // pivotal rooms stay authored; this is the rest.
  var KIND_ROW = {
    money: {
      open: 'The numbers are not a mood. They are a constraint, and they are already past the point where this room can pretend otherwise.',
      retort: 'A solvent state is the precondition of everything else on this table. I am not asking for a luxury.',
      ask: 'Give me the line I asked for and I will keep the rating. Fail me and the next budget is written somewhere we do not sit.',
      lose: 'Then I will take the cut, and I will take it in public, and I will say whose idea it was.'
    },
    service: {
      open: 'People do not eat a surplus. They eat a clinic that has drugs in it and a school that has a teacher.',
      retort: 'I have a figure I cannot say in this building. Your constraint is a spreadsheet. Mine is a ward.',
      ask: 'Give me the vote and I will stop having to explain the shortage on the radio.',
      lose: 'Then I will go back to the districts and tell them the minute said no. They already know who sits in this chair.'
    },
    power: {
      open: 'There is no policy if the street is not a street. Everything else in this room assumes a country that is still a country.',
      retort: 'I can keep quiet a province you are about to campaign in. Or I can fail to. That is the whole argument.',
      ask: 'Give me the vote. The rest of you can argue about clinics afterwards.',
      lose: 'Then I will do what I can with what I have, and I will not be the one who has to explain the pictures.'
    },
    machine: {
      open: 'You cannot govern a province you have not paid. The branches are not a mood. They are a payroll.',
      retort: 'The people who deliver the vote are waiting for a transfer. They will not wait politely.',
      ask: 'Give me the transfers and I will deliver the provinces that deliver you.',
      lose: 'Then the provinces will hear it from me, in the order they expect to hear it, and they will remember the date.'
    },
    prestige: {
      open: 'The room next door is full of ambassadors. They are not here to watch us argue about a borehole.',
      retort: 'What we look like from the outside is not decoration. It is the price of the next loan.',
      ask: 'Give me the line that lets me walk into that room without apologising first.',
      lose: 'Then I will go to the reception and smile. I have had practice. So has the country.'
    }
  };
  function rowKind(a, flag) {
    var id = a.S.flags && a.S.flags[flag];
    var kind = (RZ.state && id) ? RZ.state.ministryKind(a.S, id) : 'service';
    return KIND_ROW[kind] || KIND_ROW.service;
  }
  // A briefing is assembled from the same kinds: the worst number on the file
  // picks who speaks first; the other chair is whoever disagrees with them.
  var KIND_BRIEF = {
    money: {
      open: 'The number on top of this folder is a rating. Everything else in this building assumes we still have one.',
      ask: 'Give me the cut and I will keep the Fund in the room. Refuse me and they write the next budget without us.',
      deliver: 'Then I will table the cut tonight, and I will put my name on it.'
    },
    service: {
      open: 'The number on top of this folder is a clinic that has been out of stock since March. People do not eat a surplus.',
      ask: 'Give me the vote. I will stop having to explain a shortage on the radio.',
      deliver: 'Then the box leaves in the morning, and I will be the one who signed it.'
    },
    power: {
      open: 'The number on top of this folder is a street that is no longer a street. Everything else assumes a country that is still a country.',
      ask: 'Give me the deployment. The rest of you can argue about clinics afterwards.',
      deliver: 'Then I will do it quietly, which is the only way this kind of minute survives publication.'
    },
    machine: {
      open: 'The number on top of this folder is a province you have not paid. The branches are not a mood. They are a payroll.',
      ask: 'Give me the transfers. I will deliver the provinces that deliver you.',
      deliver: 'Then the provinces will hear it from me, in the order they expect to hear it.'
    },
    prestige: {
      open: 'The number on top of this folder is what we look like from a balcony in Addis. That is the price of the next loan.',
      ask: 'Give me the line that lets me walk into that room without apologising first.',
      deliver: 'Then I will take the communiqué as written, and I will not add a sentence.'
    }
  };
  function briefKind(a, flag) {
    var id = a.S.flags && a.S.flags[flag];
    var kind = (RZ.state && id) ? RZ.state.ministryKind(a.S, id) : 'service';
    return KIND_BRIEF[kind] || KIND_BRIEF.service;
  }
  function fileWorst(a) {
    if (RZ.state && RZ.state.houseFile) return RZ.state.houseFile(a.S).worst;
    return { k: 'unrest', label: 'Unrest', shown: '—' };
  }
  var KIND_PROJECT = {
    clinic: {
      open: 'The clinic in this district has been a shell since before the last census. People drive past it to die in the next town.',
      ask: 'Give me the box and a nurse. I will stop having to bury people who could have been seen.',
      deliver: 'Then the slab is poured this month, and my name is on the tender, which is the only way this province believes a promise.'
    },
    road: {
      open: 'The road is a rumour for six months of the year. The grain sits. The clinic is a theory.',
      ask: 'Give me the tar. I will give you the turnout that the tar is for.',
      deliver: 'Then I will plant the first peg myself, because that is the photograph this province actually wants.'
    },
    power: {
      open: 'The line stops twenty kilometres short of the shaft. The diesel is the budget. The dark is the politics.',
      ask: 'Give me the electrification. I will give you the output, and the output is the rating.',
      deliver: 'Then the pylons go up in the order the branches expect, which is also the order that keeps this province quiet.'
    },
    housing: {
      open: 'The list is a weapon. Everybody on it has a cousin who voted, and everybody not on it has a cousin who will not.',
      ask: 'Give me the allocation. I will write the names, and I will write them in public.',
      deliver: 'Then the keys go out this quarter, and the names that are not on the list will hear it from me, not from a poster.'
    },
    school: {
      open: 'The secondary school is a primary school with older children in it. That is not a metaphor.',
      ask: 'Give me the classrooms. I will stop sending sixteen-year-olds to sit under a tree.',
      deliver: 'Then I will open it before the next exam, which is the only date this province treats as a promise.'
    }
  };
  function projKind(a) {
    var k = (a.S.flags && a.S.flags.projKind) || 'road';
    return KIND_PROJECT[k] || KIND_PROJECT.road;
  }
  function projLabel(a) {
    var k = (a.S.flags && a.S.flags.projKind) || 'road';
    return (RZ.state && RZ.state.PROJECT_LABEL && RZ.state.PROJECT_LABEL[k]) || k;
  }
  function projRegion(a) {
    var id = a.S.flags && a.S.flags.projRegion;
    if (id && a.C.regionById[id]) return a.C.regionById[id];
    if (RZ.state && RZ.state.hottestRegion) {
      var h = RZ.state.hottestRegion(a.S);
      return { id: h.id, name: h.name };
    }
    return a.C.regions[0];
  }
  var POWER_LINE = {
    china: {
      open: 'I have a road, a mine, and a loan that will outlive this parliament. I do not need a communiqué. I need a signature.',
      ask: 'Give me the concession. I will give you the road. The Fund will not.',
      clause: 'The clause does not appear in your gazette. That is why it can be signed tonight.'
    },
    us: {
      open: 'I have two names on a list, and a clause about your next election. I can move one of those things tonight.',
      ask: 'A published royalty, an independent commission, and I will take two names off. Refuse me and the listing is the next communiqué.',
      clause: 'The democracy clause is not decoration. It is the price of the listing.'
    },
    neighbour: {
      open: 'I did not fly here for solidarity. I flew here for a corridor, a vote in the Organ, and a sentence you will not put in a communiqué.',
      ask: 'Give me the corridor. I will give you the vote. Pretend this is a courtesy call and I will pretend next year.',
      clause: 'A corridor is a fact. A communiqué is a paragraph. I know which one I can take home.'
    }
  };
  function powerLine(a) {
    var id = (a.S.flags && a.S.flags.powerId) || 'neighbour';
    return POWER_LINE[id] || POWER_LINE.neighbour;
  }
  function powerNow(a) {
    if (RZ.state && RZ.state.powerOf) return RZ.state.powerOf(a.S, (a.S.flags && a.S.flags.powerId) || 'neighbour');
    return { id: 'neighbour', name: 'the neighbour', short: 'the capital', envoy: 'the High Commissioner', org: '', want: 'a corridor' };
  }
  function oppParty(a) {
    if (RZ.state && RZ.state.oppositionParty) return RZ.state.oppositionParty(a.S);
    return a.C.parties[1] || a.C.parties[0];
  }
  function otherParty(a) {
    if (RZ.state && RZ.state.otherOppositionParty) return RZ.state.otherOppositionParty(a.S);
    return a.C.parties[2] || a.C.parties[1] || a.C.parties[0];
  }
  function talksOf(a) {
    var t = a.S.flags && a.S.flags.coalitionTalks;
    if (t && t.lead) return t;
    if (RZ.elections && RZ.elections.coalitionOptions) return RZ.elections.coalitionOptions(a.S);
    var c = a.C;
    var g = c.parties[1] || c.parties[0];
    var k = c.parties[2] || c.parties[1] || c.parties[0];
    return {
      lead: a.P.partyId, leadSeats: 0, need: 1, total: 1, hung: true,
      gnu: { id: g.id, abbr: g.abbr, name: g.name, seats: 0 },
      king: { id: k.id, abbr: k.abbr, name: k.name, seats: 0 }
    };
  }
  function gnuOf(a) { return talksOf(a).gnu || otherParty(a); }
  function kingOf(a) { return talksOf(a).king || otherParty(a); }
  function houseCount(a) {
    if (RZ.state && RZ.state.govSeats) {
      return {
        have: RZ.state.govSeats(a.S),
        need: RZ.state.houseNeed(a.S),
        paper: a.S.flags.supplyYear === a.S.date.year,
        minority: !!(RZ.state.minorityLive && RZ.state.minorityLive(a.S))
      };
    }
    return { have: 0, need: 1, paper: false, minority: false };
  }
  function partnerPartyOf(a) {
    var id = a.S.flags && a.S.flags.coalitionPartner;
    if (id && a.C.partyById && a.C.partyById[id]) return a.C.partyById[id];
    if (a.S.partner && a.S.partner.partyId && a.C.partyById[a.S.partner.partyId]) {
      return a.C.partyById[a.S.partner.partyId];
    }
    var t = talksOf(a);
    if (a.S.flags && a.S.flags.coalitionKind === 'king') return t.king || otherParty(a);
    return t.gnu || otherParty(a);
  }
  function quoteOf(a) {
    if (RZ.state && RZ.state.partnerQuote) return RZ.state.partnerQuote(a.S);
    return null;
  }
  function cabWitness(a) {
    if (RZ.state) RZ.state.fillCabinet(a.S);
    var skip = a.S.flags && a.S.flags.leakerId;
    var cab = a.S.cabinet || [];
    var m = null;
    for (var i = 0; i < cab.length; i++) {
      if (cab[i].ministryId !== skip) { m = cab[i]; break; }
    }
    if (m && RZ.state) return who(a, RZ.state.ministerRole(a.S, m.ministryId), RZ.state.ministerOrg(m.ministryId));
    return who(a, 'Minister of Health', '');
  }
  function pickedChair(S) {
    return (S.flags && (S.flags.cabinetPick || S.flags.cabinetCut)) || null;
  }
  // Whatever the ward is most obviously without.
  function pickNeed(a) {
    var n = (RZ.ward && RZ.ward.needs(a.S)) || [];
    return (n.length ? RZ.pick(n) : RZ.ward.KINDS[0]).id;
  }
  function inflation(a) { return RZ.round(a.S.nation.economy.inflation, 1); }
  function unemployment(a) { return Math.round(a.S.nation.economy.unemployment); }

  var SCENES = [

    /* ==================== UNIONS ==================== */
    {
      id: 'union-wages', topic: 'union', weight: 12,
      speaker: function (a) { return who(a, 'General Secretary', 'the public service union'); },
      where: 'A union hall with the windows open',
      settleOn: 'party',
      opening: function (a) {
        return 'She does not offer tea. "You are the fourth politician to sit in that chair this year. ' +
          'The other three are no longer in office, so let us not waste each other\'s time."';
      },
      beats: [
        {
          q: function (a) {
            return '"Inflation is at ' + inflation(a) + '%. Our members got a rise below that, which means they took a cut ' +
              'and were told to be grateful. What is your position on the wage bill — in a number, not a paragraph?"';
        } ,
          answers: [
            { t: 'Above inflation. You have my word.', mood: 3, tag: 'promise',
              run: function (a) {
                a.add('grassroots', a.rng(4, 7)); a.add('business', -a.rng(2, 5));
                a.promise('wages', 'An above-inflation public service wage rise');
                a.remember('You gave me your word on the wage bill', 'promise');
              },
              reply: '"Say that again outside, into a microphone, and I will believe you." She writes the date down.' },
            { t: 'I cannot promise that. I can promise not to lie to you about why.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('party', a.rng(1, 3)); a.add('grassroots', a.rng(0, 2)); },
              reply: '"Hm." She sits back. "That is the first honest answer this room has heard since March."' },
            { t: 'The fiscal position is under review by Treasury.', mood: -3,
              run: function (a) {
                a.add('grassroots', -a.rng(3, 6)); a.add('media', -a.rng(0, 2));
                a.remember('You told a hall full of my members it was under review', 'bad');
              },
              reply: '"Under review." She repeats it to the room and somebody at the back laughs.' }
          ]
        },
        {
          q: '"Second thing. When our people strike — and they will — do you send the police, or do you come and sit with us?"',
          answers: [
            { t: 'I come and sit. Every time.', mood: 3,
              memory: 'You said you would sit with us on every strike', memoryTone: 'promise',
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('security', -a.rng(1, 3)); },
              reply: '"Then we will hold you to it in public, which is the only way anyone is held to anything."' },
            { t: 'I keep the police away from a lawful strike. An unlawful one is not mine to protect.', mood: 1,
              memory: 'You drew the line at a lawful strike', memoryTone: 'flat',
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('security', a.rng(0, 2)); },
              reply: '"A lawyer\'s answer. But you drew the line where the law draws it, and not lower. Noted."' },
            { t: 'Order has to be maintained. That is not negotiable.', mood: -3,
              memory: 'You said order was not negotiable, in a union hall', memoryTone: 'bad',
              run: function (a) { a.add('security', a.rng(3, 6)); a.add('grassroots', -a.rng(4, 8)); a.add('business', a.rng(1, 3)); },
              reply: '"Then we know what you are." She closes her folder.' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: '"We are not endorsing you. But when they come asking, I will say you were straight with us." That is worth more than an endorsement.',
          fair: '"You will hear from us." Which, from her, is neither a threat nor a promise.',
          cool: '"Thank you for your time." The shop stewards are already talking among themselves.',
          hostile: '"You can see yourself out." Somebody holds the door open before you have stood up.'
        }[temp];
      }
    },

    {
      id: 'union-retrench', topic: 'union', weight: 10,
      when: function (a) { return a.S.nation.economy.unemployment > 24; },
      speaker: function (a) { return who(a, 'Shop Steward', 'the mineworkers'); },
      where: 'A room behind the shaft offices',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'He still has his overalls on. "Eight hundred letters went out on Friday. Eight hundred. ' +
          'Unemployment is ' + unemployment(a) + '% and they posted the letters on a Friday so nobody could reach the office until Monday."';
      },
      beats: [
        {
          q: '"Can you stop it? Yes or no. Not what you will look into."',
          answers: [
            { t: 'No. I do not have that power and I will not pretend I do.', mood: 2,
              memory: 'You would not pretend you could stop the letters', memoryTone: 'good',
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"At least you did not stand there and lie." He rubs his face. "Everyone lies in this room."' },
            { t: 'I will stop it.', mood: 1, tag: 'promise',
              memory: 'You promised eight hundred families you would stop the letters', memoryTone: 'promise',
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.promise('retrench', 'To stop eight hundred retrenchments at the mine'); },
              reply: '"Then I am going to tell eight hundred families that." He looks at you a long time. "Do not do this to me."' },
            { t: 'The company has obligations under the law. I will make sure they meet them.', mood: 0,
              memory: 'You talked about severance instead of stopping it', memoryTone: 'flat',
              run: function (a) { a.add('party', a.rng(1, 3)); a.add('business', -a.rng(0, 2)); },
              reply: '"Severance. You are talking about severance." He nods slowly. "That is a smaller thing than what I asked."' }
          ]
        },
        {
          q: function (a) {
            return '"And the ones already gone? There is no work in ' + a.homeName() + '. My brother sits at home and drinks. ' +
              'What do I tell him?"';
          },
          answers: [
            { t: 'Tell him the truth: it will be years, and he should get out of this town.', mood: -1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('grassroots', -a.rng(2, 4)); },
              reply: '"That is honest and it is useless." He is not angry. That is worse.' },
            { t: 'Bring me ten names. I will find ten places, even if I pay for them myself.', mood: 3,
              when: function (a) { return a.P.money > a.wage(3); },
              run: function (a) { a.add('money', -a.wage(3)); a.add('grassroots', a.rng(5, 9)); a.addRegion(a.P.regionId, a.rng(4, 8)); },
              reply: '"Ten." He writes it on his hand. "Ten is not eight hundred. But ten is ten."' },
            { t: 'Tell him his government has not forgotten him.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(4, 7)); },
              reply: 'He laughs, once, with no humour in it, and does not answer.' }
          ]
        }
      ]
    },

    {
      id: 'union-teachers', topic: 'union', weight: 9,
      speaker: function (a) { return who(a, 'President', 'the teachers\' union'); },
      where: 'A staffroom after the last bell',
      settleOn: 'grassroots',
      opening: '"We have sixty-two learners in a Grade 4 class. Sixty-two. I am not going to describe the toilets to you."',
      beats: [
        {
          q: '"Every politician promises schools. Tell me instead what you would cut to pay for them."',
          answers: [
            { t: 'The travel budget, the consultants and half the deputy ministers.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('media', a.rng(2, 4)); a.add('leader', -a.rng(2, 5)); },
              reply: '"Now that is an answer with an enemy in it. Good. Answers without enemies are decoration."' },
            { t: 'Nothing. I would borrow for it. Schools outlive the debt.', mood: 1,
              run: function (a) { a.nation('debt', a.rng(.2, .8)); a.add('grassroots', a.rng(2, 4)); a.add('intl', -a.rng(1, 3)); },
              reply: '"An economist would fight you. A teacher would not." She almost smiles.' },
            { t: 'I would not frame it as cutting. It is about efficiencies.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 5)); a.add('media', -a.rng(1, 3)); },
              reply: '"Efficiencies." She writes the word down and underlines it twice, for later.' }
          ]
        },
        {
          q: '"One more. When a newspaper prints that half our members are absent on a Friday — and it will — ' +
             'do you defend us, or do you join in?"',
          answers: [
            { t: 'I defend the profession and I say the absenteeism is real. Both.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('media', a.rng(1, 3)); a.add('party', a.rng(0, 2)); },
              reply: '"That will please nobody entirely." She nods. "Which is usually the shape of the truth."' },
            { t: 'I defend you. In public, always. We argue in private.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 7)); a.add('media', -a.rng(1, 3)); a.add('stats.integrity', -a.rng(0, 2)); },
              reply: '"Then you will be shouted at on our behalf." She writes your number down herself.' },
            { t: 'I go where the evidence goes, and if it embarrasses you, so be it.', mood: -2,
              run: function (a) { a.add('media', a.rng(2, 5)); a.add('grassroots', -a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Evidence." She caps her pen. "It is always evidence when it is us and context when it is you."' }
          ]
        }
      ]
    },

    /* ==================== THE GROUND ==================== */
    {
      id: 'ground-water', topic: 'walkabout', weight: 12,
      speaker: function (a) { return who(a, 'an elderly woman at the front', ''); },
      where: function (a) { return 'A ' + a.t.meeting + ' under a tree in ' + a.homeName(); },
      settleOn: 'grassroots',
      opening: function (a) {
        return 'She waits until the ' + a.t.elder + 's have finished, then stands without being invited. ' +
          '"You were here before. You said the borehole. That was two rains ago."';
      },
      beats: [
        {
          q: '"So. Is there money for the borehole, or is there not? I am seventy-one and I would like a straight answer while I can still walk to it."',
          answers: [
            { t: 'There is no money this year. I am sorry. I should have told you sooner.', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.addRegion(a.P.regionId, a.rng(1, 3)); a.add('grassroots', -a.rng(0, 2)); },
              reply: '"Eh." She sits down slowly. "You are the first one to say no to my face. That is something."' },
            { t: 'It will be drilled before the next rains. Hold me to it.', mood: 3, tag: 'promise',
              run: function (a) { a.addRegion(a.P.regionId, a.rng(6, 10)); a.add('grassroots', a.rng(3, 6)); a.promise('borehole', 'A borehole for ' + a.homeName() + ', before the next rains'); },
              reply: '"Before the rains." She repeats it loudly, so that everyone hears it, which is exactly what she intended.' },
            { t: 'The application is with the district. These things take a process.', mood: -2,
              run: function (a) { a.addRegion(a.P.regionId, -a.rng(2, 5)); a.add('grassroots', -a.rng(1, 3)); },
              reply: '"The process." Somebody at the back says the word again, mockingly, and there is laughter.' }
          ]
        },
        {
          q: function (a) {
            return '"And the young ones." She points at the back, where twenty men are sitting who should be at work. ' +
              '"They have certificates. They have nothing to do with them."';
          },
          answers: [
            { t: 'I will not insult them with a promise of jobs I cannot make.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('grassroots', a.rng(0, 2)); },
              reply: '"Mm." She looks back at them. "They have heard promises. They have not heard that."' },
            { t: 'Send me three of them on Monday. I will find them something.', mood: 2,
              run: function (a) { a.add('money', -a.wage(1)); a.addRegion(a.P.regionId, a.rng(3, 6)); a.add('grassroots', a.rng(2, 4)); },
              reply: '"Three on Monday." She names them there and then, before you can change your mind.' },
            { t: 'Jobs are coming. The investment is being finalised.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); a.addRegion(a.P.regionId, -a.rng(2, 5)); },
              reply: '"Which investment?" she asks. You do not have the name of one, and the pause is long enough for everyone to notice.' }
          ]
        }
      ]
    },

    {
      id: 'ground-clinic', topic: 'walkabout', weight: 10,
      speaker: function (a) { return who(a, 'a nurse, still in uniform', ''); },
      where: function (a) { return 'The queue outside the clinic in ' + a.homeName(); },
      settleOn: 'grassroots',
      opening: '"I came on my break. I have eleven minutes. There are ninety people in that queue and two of us."',
      beats: [
        {
          q: '"Do you know what we ran out of last month? Gloves. I want you to say the word back to me so I know you heard it."',
          answers: [
            { t: 'Gloves. You ran out of gloves.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('media', a.rng(1, 3)); },
              reply: '"Thank you." Her voice cracks slightly, and she is furious with herself for it.' },
            { t: 'I will raise it with the district health office today.', mood: 0,
              run: function (a) { a.add('capital', a.rng(1, 2)); a.add('grassroots', a.rng(0, 2)); },
              reply: '"The district health office is where the gloves went missing." She checks the time.' },
            { t: 'Supply chains are a national problem, not a local one.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); },
              reply: '"I am aware." She goes back inside without waiting for the rest of your sentence.' }
          ]
        },
        {
          q: '"Four minutes left. The other thing nobody asks: there is no transport for the night shift. ' +
             'I walk home at eleven. Do you know what that road is like?"',
          answers: [
            { t: 'No. Tell me, and I will put it in writing to the district tomorrow.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.addRegion(a.P.regionId, a.rng(3, 6)); a.add('capital', a.rng(1, 3)); },
              reply: 'She tells you. It takes ninety seconds and you do not interrupt once, which she notices.' },
            { t: 'I will pay for a taxi for the night shift out of my own pocket until it is fixed.', mood: 2, tag: 'cost',
              when: function (a) { return a.P.money > a.wage(2); },
              run: function (a) { a.add('money', -a.wage(2)); a.add('grassroots', a.rng(4, 7)); a.addRegion(a.P.regionId, a.rng(4, 7)); a.add('stats.integrity', a.rng(0, 2)); },
              reply: '"For how long?" she asks. You do not have an answer, and she takes the offer anyway.' },
            { t: 'Security is a police matter. I will pass it on.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); a.add('security', a.rng(0, 2)); },
              reply: '"Pass it on." She is already walking back to the queue. "Everything gets passed on."' }
          ]
        }
      ]
    },

    {
      id: 'ground-chief', topic: 'walkabout', weight: 8,
      when: function (a) { return a.C.inst.ethnic > 25; },
      speaker: function (a) { return who(a, cap(a.t.chief), ''); },
      where: function (a) { return 'The ' + a.t.chief + '\'s compound, on the mats'; },
      settleOn: 'grassroots',
      opening: function (a) {
        return 'He lets the silence sit for a while first. "The party sends people here every five years. ' +
          'In between, nobody comes. Why are you here in a year with no election?"';
      },
      beats: [
        {
          q: '"Answer carefully. I have been lied to by better men than you."',
          answers: [
            { t: 'Because I want this seat, and I would rather you knew that than guessed it.', mood: 3,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(5, 9)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Ha!" He slaps his knee. "Ambition, admitted out loud. Sit properly, you will be here a while."' },
            { t: 'Because the people here have been ignored and I am not going to be another one who ignores them.', mood: 1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(2, 5)); },
              reply: '"That is the speech." He waves a hand. "It is a good speech. Now let us talk about the road."' },
            { t: 'I came to pay my respects to you personally.', mood: 0,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(1, 4)); a.add('stats.cunning', a.rng(.4, 1)); },
              reply: '"Flattery." He is unmoved but not displeased. "It works on some of the others."' }
          ]
        },
        {
          q: '"There is land here that the government wants for a project. My people were not asked. Whose side are you on?"',
          answers: [
            { t: 'Yours — and I will say so in the House, on the record.', mood: 3,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(6, 10)); a.add('leader', -a.rng(3, 6)); a.add('business', -a.rng(2, 5)); },
              reply: '"On the record." He nods once. "Then this area is yours, for as long as that stays true."' },
            { t: 'I am on the side of your people being asked. That is not the same as opposing it.', mood: 1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(2, 5)); a.add('stats.intellect', a.rng(.4, 1)); },
              reply: '"A careful man." He considers it. "Careful is not the worst thing to have on our side."' },
            { t: 'The project will bring work. I would urge you not to block it.', mood: -3,
              run: function (a) { a.addRegion(a.P.regionId, -a.rng(4, 8)); a.add('business', a.rng(2, 5)); },
              reply: 'He stops looking at you and looks at the man beside him instead. The meeting is over.' }
          ]
        }
      ]
    },

    /* ==================== THE PRINCIPAL ==================== */
    {
      id: 'leader-loyalty', topic: 'courtleader', weight: 12,
      when: function (a) { return !a.isLeader(); },
      speaker: function (a) {
        return { name: a.S.parties[a.P.partyId].leaderName, role: 'leader of ' + a.C.partyById[a.P.partyId].abbr, org: '' };
      },
      where: 'A study with the curtains half drawn',
      settleOn: 'leader',
      opening: function (a) {
        return 'He does not look up from the paper for a while. "People tell me things about you. ' +
          'Some of them are even true." He puts the paper down. "Sit."';
      },
      beats: [
        {
          q: '"There is a story going around that you want this job. Mine. Do you?"',
          answers: [
            { t: 'One day. Not today, and not against you.', mood: 2,
              run: function (a) { a.add('leader', a.rng(3, 7)); a.add('fame', a.rng(1, 3)); },
              reply: '"Hm." He almost smiles. "The ones who say never are the ones I watch. Ambition I can use."' },
            { t: 'No. I serve where I am deployed.', mood: 0,
              run: function (a) { a.add('leader', a.rng(1, 4)); a.add('stats.cunning', a.rng(.4, 1.2)); },
              reply: '"That is the correct answer." He holds your eye. "It is also what the last three said."' },
            { t: 'Yes. And I think you know I would be good at it.', mood: -2,
              run: function (a) { a.add('leader', -a.rng(4, 9)); a.add('party', a.rng(2, 5)); a.add('fame', a.rng(2, 5)); },
              reply: '"Well." He picks the paper back up. "At least I know where you are standing."' }
          ]
        },
        {
          q: function (a) {
            return '"There is a decision coming that will be unpopular in your ' + a.t.constituency + '. ' +
              'I need to know whether you will defend it or hide."';
          },
          answers: [
            { t: 'I will defend it publicly and tell you privately if I think it is wrong.', mood: 3,
              run: function (a) { a.add('leader', a.rng(4, 8)); a.add('party', a.rng(2, 4)); a.add('grassroots', -a.rng(1, 3)); },
              reply: '"That is the arrangement I want with everybody and get from almost nobody." He writes your name on something.' },
            { t: 'I will not defend something that hurts my people. I will stay quiet.', mood: 0,
              run: function (a) { a.add('leader', -a.rng(1, 4)); a.add('grassroots', a.rng(2, 4)); },
              reply: '"Silence." He weighs it. "Silence I can survive. It is the ones who go on radio that finish me."' },
            { t: 'I will defend it. Whatever it is.', mood: 1,
              run: function (a) { a.add('leader', a.rng(2, 6)); a.add('stats.integrity', -a.rng(1, 3)); a.add('media', -a.rng(0, 2)); },
              reply: '"Whatever it is." He repeats it flatly. "Be careful with that sentence. People have signed terrible things with it."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: '"Come again. Not through the diary — call this number." He writes it himself, which is the whole point of the meeting.',
          fair: '"Thank you for coming." The aide is already at the door with the next appointment.',
          cool: 'He is reading again before you reach the door.',
          hostile: '"Close it behind you." He does not look up.'
        }[temp];
      }
    },

    {
      id: 'leader-reshuffle', topic: 'courtleader', weight: 10,
      when: function (a) { return a.tier() >= 4 && a.inGov() && !a.isLeader(); },
      speaker: function (a) { return who(a, 'the principal\'s chief of staff', ''); },
      where: 'A corridor outside the Cabinet room',
      settleOn: 'leader',
      opening: '"Ninety seconds. He is in there. I am asking, not him, and if you repeat that I will deny it."',
      beats: [
        {
          q: '"If a portfolio came up — a hard one, the kind that ends people — would you take it?"',
          answers: [
            { t: 'Yes. Give me the one nobody wants.', mood: 3,
              run: function (a) { a.add('leader', a.rng(5, 9)); a.add('capital', a.rng(2, 4)); a.add('health', -a.rng(1, 3)); },
              reply: '"Good." She is already walking. "That is going in the note."' },
            { t: 'Yes, if I am given the budget to actually fix it.', mood: 1,
              run: function (a) { a.add('leader', a.rng(2, 5)); a.add('stats.intellect', a.rng(.4, 1)); },
              reply: '"Conditions." She pauses. "He does not love conditions. But he respects arithmetic."' },
            { t: 'I would rather be useful where I am.', mood: -2,
              run: function (a) { a.add('leader', -a.rng(2, 5)); a.add('health', a.rng(2, 4)); },
              reply: '"Understood." The word lands like a door closing.' }
          ]
        },
        {
          q: '"Forty seconds. Last thing, and this is the one he actually asked. If he is wrong about something ' +
             'big, in front of Cabinet — do you say so?"',
          answers: [
            { t: 'In the room, yes. Outside it, never.', mood: 3,
              run: function (a) { a.add('leader', a.rng(4, 8)); a.add('party', a.rng(1, 3)); },
              reply: '"That is the sentence he wanted." She writes it down verbatim. "Nobody says it in that order."' },
            { t: 'I would put it to him privately first. Cabinet is not the place.', mood: 1,
              run: function (a) { a.add('leader', a.rng(2, 5)); a.add('stats.cunning', a.rng(.4, 1.2)); },
              reply: '"Careful." She almost approves. "Careful survives longer than clever, in that room."' },
            { t: 'He is not often wrong.', mood: -3,
              run: function (a) { a.add('leader', -a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3)); },
              reply: 'She stops writing. "He has twenty of those. He is looking for one of the other kind."' }
          ]
        }
      ]
    },

    {
      id: 'leader-deputy', topic: 'courtleader', weight: 9,
      when: function (a) { return a.isLeader() || a.isPresident(); },
      speaker: function (a) { return who(a, 'your deputy', ''); },
      where: 'Your office, door closed, no minute-taker',
      settleOn: 'party',
      opening: '"I asked for this meeting because I would rather say it to your face than have you read it in a column."',
      beats: [
        {
          q: '"The provinces are unhappy. They think you have stopped listening. Have you?"',
          answers: [
            { t: 'Probably. Tell me who to see and I will go this month.', mood: 3,
              run: function (a) { a.add('party', a.rng(4, 8)); a.add('health', -a.rng(2, 4)); },
              reply: '"That is not the answer I prepared for." He puts his list away. "I will make the calls."' },
            { t: 'They are unhappy because I stopped paying them. That is not the same thing.', mood: 0,
              run: function (a) { a.add('party', -a.rng(1, 3)); a.add('stats.integrity', a.rng(1, 3)); a.nation('corruption', -a.rng(.2, .8)); },
              reply: '"Both things are true at once." He shrugs. "That is politics. It does not make them wrong about the listening."' },
            { t: 'Careful. That sounded like the beginning of a campaign.', mood: -3,
              run: function (a) { a.add('party', -a.rng(3, 7)); a.makeRival(); },
              reply: '"It was not." He stands. "It might be now."' }
          ]
        },
        {
          q: '"Then the harder one. They want to know when you go. Not whether. When. ' +
             'If you will not name a date, somebody else will name it for you."',
          answers: [
            { t: 'Two more years, and I will say it publicly. Then I go.', mood: 3,
              run: function (a) { a.add('party', a.rng(5, 9)); a.add('media', a.rng(2, 5)); a.add('leader', -a.rng(1, 4)); a.promise('handover', 'To stand down in two years, said out loud'); },
              reply: '"Then I will defend you for two years and not a day of manoeuvring." He puts out his hand.' },
            { t: 'When the party decides at conference. Not before, not in a corridor.', mood: 1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Constitutional." He accepts it. "It is also the answer of a man who intends to win the conference."' },
            { t: 'I go when I am carried out. Tell them that.', mood: -3,
              run: function (a) { a.add('party', -a.rng(5, 10)); a.add('leader', a.rng(0, 2)); a.makeRival(); a.nation('stability', -a.rng(0, 2)); },
              reply: '"I will tell them." He is at the door. "You have just made me the messenger, which makes me the candidate."' }
          ]
        }
      ]
    },

    /* ==================== PRESS ==================== */
    {
      id: 'press-record', topic: 'media', weight: 12,
      speaker: function (a) { return who(a, 'political editor', P(a.C.media)); },
      where: 'A studio with one camera and no audience',
      settleOn: 'media',
      opening: function (a) {
        return '"We are recording. I am going to ask you three things and I would like you to answer the ones I ask, ' +
          'not the ones you prepared."';
      },
      beats: [
        {
          q: function (a) {
            return '"' + P(a.C.issues).replace(/^./, function (c) { return c.toUpperCase(); }) +
              '. Your party has been in this argument for years. What have you personally changed about it?"';
          },
          answers: [
            { t: 'Name one specific thing you did, with a date.', mood: 3,
              when: function (a) { return a.P.stats.intellect > 45; },
              run: function (a) { a.add('media', a.rng(4, 8)); a.add('fame', a.rng(2, 5)); a.add('stats.intellect', a.rng(.3, 1)); },
              reply: '"That is checkable." She writes it down. "I am going to check it."' },
            { t: 'Honestly? Not enough. Here is why.', mood: 2,
              run: function (a) { a.add('media', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(1, 4)); },
              reply: '"Politicians do not say that." She leans forward for the first time. "Say more."' },
            { t: 'Deflect to the party\'s record.', mood: -3,
              run: function (a) { a.add('media', -a.rng(3, 6)); a.add('party', a.rng(1, 3)); },
              reply: '"I asked about you." She lets the silence run, which on television is unbearable.' }
          ]
        },
        {
          q: function (a) {
            return a.P.dirt.length
              ? '"There is a matter people keep raising about you. I am going to give you one clean chance to address it."'
              : '"Is there anything in your record that you would not want me to find?"';
          },
          answers: [
            { t: 'Address it plainly, now, before someone else frames it.', mood: 3,
              run: function (a) {
                var d = a.P.dirt.filter(function (x) { return !x.exposed; })[0];
                if (d) { a.removeDirt(d.id); a.add('media', a.rng(3, 6)); a.add('party', -a.rng(1, 4)); }
                else { a.add('media', a.rng(2, 4)); }
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"Well." She sits back. "That was not the answer legal advised, was it."' },
            { t: 'Say nothing turns on it and move on quickly.', mood: 0,
              run: function (a) { a.add('media', -a.rng(0, 2)); a.add('stats.cunning', a.rng(.4, 1.2)); },
              reply: '"Mm." She does not push. That usually means she will push later, with paper.' },
            { t: 'Object to the question itself.', mood: -3,
              run: function (a) { a.add('media', -a.rng(4, 8)); a.add('fame', a.rng(1, 4)); },
              reply: '"The question stands." She repeats it word for word, and now it is the clip.' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: '"That was a good interview." From her, unprompted, that is a headline in itself.',
          fair: '"Thank you, that is all." Neutral, which on the evening bulletin is survivable.',
          cool: '"We will run it as recorded." Meaning: unedited, including the pauses.',
          hostile: '"We will use the clip." She does not say which one. You already know.'
        }[temp];
      }
    },

    {
      id: 'press-radio', topic: 'radio', weight: 10,
      speaker: function (a) { return who(a, 'a caller, live on air', ''); },
      where: function (a) { return 'A phone-in on ' + P(a.C.media); },
      settleOn: 'grassroots',
      opening: '"Good morning. I have been trying to get through for two weeks. I am not a politician so I will just say it plainly."',
      beats: [
        {
          q: function (a) {
            return '"My son finished school four years ago. Four years. He has never had a job. Not one day. ' +
              'What is the point of you?"';
          },
          answers: [
            { t: 'Take the question seriously and refuse to give a number you cannot back.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 7)); a.add('media', a.rng(2, 5)); a.add('fame', a.rng(1, 3)); },
              reply: 'A pause on the line. "You are the first one who did not start talking about percentages." The host lets it run.' },
            { t: 'Give him the constituency office number, on air.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(3, 5)); a.add('money', -a.wage(.5)); a.addRegion(a.P.regionId, a.rng(2, 4)); },
              reply: '"I will call it today." He sounds like he means it. So do you, which is the risk.' },
            { t: 'Recite the government\'s youth programme.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); a.add('media', -a.rng(1, 4)); },
              reply: '"He applied to that one. Twice." The host says "we will leave it there" a little too quickly.' }
          ]
        },
        {
          q: function (a) {
            return '"We have another caller. She says the money for ' + P(a.C.issues) + ' was voted for three times ' +
              'and she has never seen it. She wants to know which one of you took it."';
          },
          answers: [
            { t: 'Say plainly that money was stolen, and name the process that will show by whom.', mood: 3,
              run: function (a) { a.add('media', a.rng(3, 6)); a.add('grassroots', a.rng(3, 6)); a.add('party', -a.rng(2, 5)); a.add('leader', -a.rng(1, 4)); },
              reply: 'The host says "he actually answered it" as though reporting an unusual weather event.' },
            { t: 'Say you do not know, and that not knowing is itself the scandal.', mood: 2,
              run: function (a) { a.add('media', a.rng(2, 4)); a.add('stats.integrity', a.rng(1, 3)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"At least he is not pretending," the caller says, and hangs up before the host can thank her.' },
            { t: 'Say the matter is before the appropriate structures.', mood: -3,
              run: function (a) { a.add('media', -a.rng(3, 6)); a.add('grassroots', -a.rng(2, 5)); a.add('party', a.rng(0, 2)); },
              reply: 'There is dead air for two seconds, which on radio is a very long time.' }
          ]
        }
      ]
    },

    /* ==================== MONEY ==================== */
    {
      id: 'money-breakfast', topic: 'fundraise', weight: 12,
      speaker: function (a) { return who(a, 'a construction magnate', ''); },
      where: 'A hotel function room, eleven place settings',
      settleOn: 'business',
      opening: function (a) {
        return 'He waits until the others are talking among themselves. "Let us be adults. You need money. ' +
          'I have money. The only question is what the money is for."';
      },
      beats: [
        {
          q: '"When you are in that chair and my file comes across your desk — what happens?"',
          answers: [
            { t: 'It gets judged on merit. If that is a problem, keep your money.', mood: -1,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.add('business', -a.rng(2, 5)); a.add('money', a.wage(1)); },
              reply: '"Hm." He puts his cheque book away, slowly, so you can see him do it. "Refreshing. Expensive for you."' },
            { t: 'It gets read. Properly. That is more than most of them get.', mood: 2,
              run: function (a) { a.add('money', a.wage(4)); a.add('business', a.rng(3, 6)); },
              reply: '"Read properly." He nods. "You would be amazed how much that is worth on its own."' },
            { t: 'You will find me a friend.', mood: 3,
              run: function (a, convo) { a.add('money', a.wage(9)); a.add('business', a.rng(5, 9)); a.add('stats.integrity', -a.rng(3, 6)); a.dirt('capture', 'A construction financier who was promised more than access', 3); a.owePatron(convo.speaker.name, 7); },
              reply: '"A friend." He writes a number with more digits than you expected, and now you are one.' }
          ]
        },
        {
          q: '"Now the awkward part. I also fund a man in your own party who wants your seat. ' +
             'I am telling you because you would find out. What do you want me to do about it?"',
          answers: [
            { t: 'Nothing. Fund us both. I would rather owe you less.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('business', a.rng(1, 3)); a.add('money', a.wage(2)); },
              reply: '"Interesting." He refills your glass. "Most of them beg. Begging tells me what they are worth."' },
            { t: 'Drop him. Or drop me. I am not sharing a financier with my opponent.', mood: 2,
              run: function (a) { var ok = a.roll('cunning', 50); a.add('business', ok ? a.rng(3, 7) : -a.rng(3, 7)); a.add('money', ok ? a.wage(6) : -a.wage(1)); if (!ok) a.makeRival(); },
              reply: '"An ultimatum, over breakfast." He looks genuinely entertained. "Let us see who blinks."' },
            { t: 'Keep funding him, and tell me what he asks you for.', mood: 3,
              run: function (a) { a.add('money', a.wage(4)); a.add('stats.cunning', a.rng(1, 2)); a.add('stats.integrity', -a.rng(1, 3)); a.dirt('informer', 'A financier who reports on your rivals, and therefore on you', 2); },
              reply: '"Ah." He sits back, delighted. "Now I know exactly what you are, and I prefer it."' }
          ]
        }
      ]
    },

    {
      id: 'money-patron', topic: 'patron', weight: 12,
      speaker: function (a) { return who(a, 'the kingmaker', ''); },
      where: 'A farmhouse veranda, two hours from the capital',
      settleOn: 'business',
      opening: function (a) {
        return 'He asks about your mother by name before anything else. Then: "I have made four ministers. ' +
          'I have unmade two. I do not do it for money — I have money. Do you know why I do it?"';
      },
      beats: [
        {
          q: '"Answer. Why does an old man with everything spend his evenings on people like you?"',
          answers: [
            { t: 'Because you want to be the one who decides, without ever being on a ballot.', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(1, 2)); a.add('money', a.wage(5)); a.add('business', a.rng(2, 5)); },
              reply: 'He laughs for a long time. "You are not stupid. That is a relief, and a slight problem."' },
            { t: 'Because you love the country.', mood: -1,
              run: function (a) { a.add('money', a.wage(2)); a.add('stats.integrity', a.rng(0, 2)); },
              reply: '"That is what the last one said." He sighs. "He believed it too."' },
            { t: 'I would rather not guess. I would rather know your terms.', mood: 1,
              run: function (a, convo) { a.add('money', a.wage(6)); a.add('business', a.rng(3, 6)); a.add('stats.integrity', -a.rng(1, 3)); a.dirt('patron', 'An unwritten obligation to a man who keeps records', 2); a.owePatron(convo.speaker.name, 5); },
              reply: '"No terms." He pats your hand. "Only a memory. Mine is very good."' }
          ]
        },
        {
          q: '"Good. Then one favour, and it is the only one I will ask this year. ' +
             'There is a man in your province I want gone. Not hurt. Gone from politics."',
          answers: [
            { t: 'No. Not the first thing you ask me and not the tenth.', mood: -2,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.add('business', -a.rng(3, 6)); a.add('money', -a.wage(2)); },
              reply: '"No." He tastes the word. "It has been years." He is not angry, which is somehow worse.' },
            { t: 'Tell me what he did. If it is real, I will use it. If not, no.', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(.5, 1.5)); a.add('business', a.rng(1, 4)); a.add('party', a.rng(1, 3)); },
              reply: '"Conditions from a young man." He passes a folder across. "It happens to be real. That is the trouble with me."' },
            { t: 'Consider it done.', mood: 3,
              run: function (a) { a.add('business', a.rng(4, 8)); a.add('money', a.wage(4)); a.add('stats.integrity', -a.rng(3, 6)); a.makeRival(); a.dirt('errand', 'An errand run for a man who never appears on a ballot', 3); },
              reply: '"Done." He pats the table once. "That is how it starts, you know. Always with a small one."' }
          ]
        }
      ]
    },

    /* ==================== PULPIT, YOUTH, BARRACKS, DONORS ==================== */
    {
      id: 'church-pulpit', topic: 'church', weight: 12,
      speaker: function (a) { return who(a, 'the bishop', ''); },
      where: 'A vestry after the second service',
      settleOn: 'grassroots',
      opening: '"I will let you greet the congregation. Before I do, I want to know what I am putting my name near."',
      beats: [
        {
          q: '"This church has buried people because the clinic had nothing. If I stand next to you, what am I telling them?"',
          answers: [
            { t: 'That I will be judged on whether the clinic has drugs next year.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.addRegion(a.P.regionId, a.rng(3, 6)); a.promise('clinic', 'That the district clinic will be stocked within a year'); },
              reply: '"Then I will say exactly that from the pulpit." He means it as a warning as much as a favour.' },
            { t: 'That I came, and that I did not ask you for anything.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Nobody has ever come here and not asked." He studies you. "Come forward."' },
            { t: 'That the church and the party want the same things.', mood: -2,
              run: function (a) { a.add('grassroots', -a.rng(1, 4)); a.add('media', -a.rng(0, 2)); },
              reply: '"They do not." He says it quite gently. "You may sit at the back."' }
          ]
        },
        {
          q: '"And when your party asks this church to say something it does not believe — ' +
             'because it will, in an election year — where will you be standing?"',
          answers: [
            { t: 'Between you and them, and I will lose that argument publicly if I have to.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(2, 5)); },
              reply: '"You will lose it." He says it kindly. "Come. Stand where the congregation can see you."' },
            { t: 'I will keep them away from you rather than fight them in front of you.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(1, 4)); a.add('party', a.rng(1, 3)); a.add('stats.cunning', a.rng(.4, 1.2)); },
              reply: '"Quietly, then." He straightens his stole. "Quiet has kept this building standing through worse."' },
            { t: 'The church should stay out of politics. That protects you as well.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); a.add('party', a.rng(1, 3)); },
              reply: '"We buried them," he says. "That was politics. You may greet the congregation from the floor."' }
          ]
        }
      ]
    },

    {
      id: 'youth-stadium', topic: 'youth', weight: 12,
      speaker: function (a) { return who(a, 'a student leader', ''); },
      where: 'Backstage before a youth rally',
      settleOn: 'fame',
      opening: function (a) {
        return 'She does not shake your hand. "Six thousand people out there. Most of them have never had a job. ' +
          'Before you go on, I want to know if you are going to lie to them."';
      },
      beats: [
        {
          q: function (a) {
            return '"Unemployment is ' + unemployment(a) + '%. Are you going to promise them jobs?"';
          },
          answers: [
            { t: 'No. I am going to tell them how long it will take and what it costs.', mood: 3,
              run: function (a) { a.add('fame', a.rng(3, 6)); a.add('media', a.rng(2, 5)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"They will boo you." She thinks about it. "And then they will remember you. Go."' },
            { t: 'I am going to promise them a fight, not a job.', mood: 2,
              run: function (a) { a.add('fame', a.rng(4, 8)); a.add('grassroots', a.rng(2, 5)); a.add('business', -a.rng(1, 3)); },
              reply: '"That will work today." She holds the curtain open. "Do not make it your whole career."' },
            { t: 'They came to hear hope. I am going to give them hope.', mood: -2,
              run: function (a) { a.add('fame', a.rng(2, 5)); a.add('media', -a.rng(2, 4)); a.add('stats.integrity', -a.rng(1, 3)); },
              reply: '"Hope." She lets go of the curtain. "That is the word the last four used."' }
          ]
        },
        {
          q: '"Last thing. After the rally, some of them go looking for trouble, and somebody always says ' +
             'the leader wanted it. If that happens tonight — what do you do?"',
          answers: [
            { t: 'I say from that stage, before I say anything else, that anyone who does it is not with me.', mood: 3,
              run: function (a) { a.add('fame', a.rng(2, 5)); a.add('security', a.rng(2, 5)); a.add('stats.integrity', a.rng(2, 4)); a.nation('unrest', -a.rng(0, 2)); },
              reply: '"Say it first, not last." She hands you a bottle of water. "They stop listening after four minutes."' },
            { t: 'I go with the police to the station myself and get them out.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('security', -a.rng(1, 4)); a.add('money', -a.wage(1)); },
              reply: '"They would follow you anywhere after that." She frowns. "Including places you do not want them."' },
            { t: 'Young people are angry. That anger is not mine to police.', mood: -3,
              run: function (a) { a.add('fame', a.rng(2, 5)); a.add('security', -a.rng(3, 6)); a.nation('unrest', a.rng(1, 3)); a.dirt('rally', 'A rally that ended in damage, and a speech that did not discourage it', 2); },
              reply: '"That is a sentence people quote at inquiries." She opens the curtain anyway.' }
          ]
        }
      ]
    },

    {
      id: 'barracks-generals', topic: 'securocrats', weight: 12,
      speaker: function (a) { return who(a, 'a general, retired on paper', ''); },
      where: 'A private dining room, no phones on the table',
      settleOn: 'security',
      opening: function (a) {
        return 'The plates are cleared before anyone says anything of substance. Then: ' +
          '"We do not involve ourselves in politics." He lets that sit. "I say that at the start of every one of these dinners."';
      },
      beats: [
        {
          q: '"If there were unrest — serious unrest — what would you expect from us?"',
          answers: [
            { t: 'That you stay in barracks unless the law puts you on the street.', mood: 1,
              run: function (a) { a.add('security', a.rng(1, 4)); a.add('stats.integrity', a.rng(2, 4)); a.add('intl', a.rng(1, 3)); },
              reply: '"The correct answer." A pause. "Correct answers are not always what people say at this table."' },
            { t: 'Restraint. And I would carry the political cost of that restraint myself.', mood: 3,
              run: function (a) { a.add('security', a.rng(4, 8)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: 'He puts down his glass. "Nobody has offered to carry it before. They usually offer it to us."' },
            { t: 'Whatever the situation requires.', mood: -1,
              run: function (a) { a.add('security', a.rng(2, 5)); a.add('stats.integrity', -a.rng(2, 4)); a.nation('coup', a.rng(1, 3)); },
              reply: '"Requires." He repeats it. "That word has done a great deal of damage on this continent."' }
          ]
        },
        {
          q: '"Then the practical matter. The procurement file. It has been sitting for two years ' +
             'and every month it sits, somebody adds a zero. Would you sign it?"',
          answers: [
            { t: 'Not as it stands. Bring it back with an open tender and I will sign that.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('security', -a.rng(1, 4)); a.add('intl', a.rng(2, 4)); a.nation('corruption', -a.rng(.3, 1.2)); },
              reply: '"An open tender." Somebody down the table puts their glass down harder than necessary.' },
            { t: 'I would sign what the service genuinely needs and nothing that is dressed up as need.', mood: 3,
              run: function (a) { a.add('security', a.rng(3, 7)); a.add('stats.intellect', a.rng(.5, 1.5)); a.add('capital', a.rng(1, 3)); },
              reply: '"He has read it," the general says to the table. "Gentlemen, he has actually read it."' },
            { t: 'I would sign it. The service has waited long enough.', mood: 2,
              run: function (a) { a.add('security', a.rng(5, 9)); a.add('stats.integrity', -a.rng(2, 5)); a.nation('corruption', a.rng(.3, 1.2)); a.dirt('procure', 'A defence procurement signed without asking what was in it', 3); },
              reply: '"Good man." The room warms considerably, which is the first thing tonight that should worry you.' }
          ]
        }
      ]
    },

    {
      id: 'donors-fund', topic: 'donors', weight: 12,
      speaker: function (a) { return who(a, 'the Fund\'s resident representative', ''); },
      where: 'A meeting room with bottled water and a deadline',
      settleOn: 'intl',
      opening: function (a) {
        return '"I will be direct, because my board is. Debt is at ' + Math.round(a.S.nation.economy.debt) +
          '% of GDP and the arrears are growing. We can help. Help has conditions."';
      },
      beats: [
        {
          q: '"The fuel subsidy. It is regressive, it is enormous, and removing it will put people on the street. Where do you stand?"',
          answers: [
            { t: 'Remove it — but pay the poorest directly first, and say so publicly before you touch the price.', mood: 3,
              run: function (a) { a.add('intl', a.rng(4, 8)); a.add('stats.intellect', a.rng(.5, 1.5)); a.nation('unrest', a.rng(1, 4)); a.nation('debt', -a.rng(.5, 2)); },
              reply: '"Sequencing." She writes it down. "That is the first time anyone in this building has said it in the right order."' },
            { t: 'Not while inflation is where it is. Come back to me next year.', mood: 0,
              run: function (a) { a.add('intl', -a.rng(1, 3)); a.add('grassroots', a.rng(2, 4)); },
              reply: '"Next year the arrears will be larger." She does not argue further, which is its own answer.' },
            { t: 'Never. It is the only thing keeping people afloat.', mood: -2,
              run: function (a) { a.add('intl', -a.rng(4, 8)); a.add('grassroots', a.rng(3, 6)); a.nation('debt', a.rng(.5, 2)); },
              reply: '"Then we are talking about a much smaller programme." She closes the folder halfway.' }
          ]
        },
        {
          q: function (a) {
            return '"Second condition, and my board cares about it more than the subsidy. The state companies. ' +
              'Nobody has audited them in years. Would you open the books — knowing whose names are in them?"';
          },
          answers: [
            { t: 'Open them, publish them, and let the names fall where they fall.', mood: 3,
              run: function (a) { a.add('intl', a.rng(4, 8)); a.add('media', a.rng(3, 6)); a.add('party', -a.rng(3, 7)); a.nation('corruption', -a.rng(.5, 2)); a.makeRival(); },
              reply: '"You understand that would cost you your own people." She says it as a fact, not a warning.' },
            { t: 'Audit them properly, act on it privately, publish the reforms rather than the names.', mood: 1,
              run: function (a) { a.add('intl', a.rng(2, 5)); a.add('party', a.rng(0, 2)); a.add('stats.cunning', a.rng(.5, 1.5)); a.nation('corruption', -a.rng(.2, .8)); },
              reply: '"Half." She writes it down. "Half is what we usually get, and half is why we keep coming back."' },
            { t: 'The books are a sovereign matter. That is not a condition, it is supervision.', mood: -3,
              run: function (a) { a.add('intl', -a.rng(4, 8)); a.add('party', a.rng(2, 5)); a.add('fame', a.rng(1, 3)); },
              reply: '"Sovereignty." She caps her pen. "It is always sovereignty when it is the accounts."' }
          ]
        }
      ]
    },

    /* ==================== YOUR OWN PEOPLE ==================== */
    {
      id: 'slate-recruit', topic: 'factions', weight: 12,
      speaker: function (a) { return who(a, 'a provincial chairperson', ''); },
      where: 'A guesthouse room booked under someone else\'s name',
      settleOn: 'party',
      opening: function (a) {
        return '"Three provinces are watching you. They have asked me to find out something before they commit, ' +
          'and I am going to ask it badly because there is no good way."';
      },
      beats: [
        {
          q: '"When you get there — and you might — do we get positions, or do we get a thank you?"',
          answers: [
            { t: 'You get positions. Let us be honest about what this is.', mood: 3,
              run: function (a) { a.add('party', a.rng(4, 8)); a.recruitAlly(); a.add('stats.integrity', -a.rng(2, 4)); a.promise('slate', 'Positions for three provincial chairpersons who backed you', { kind: 'cabinet', to: 'The provinces' }); },
              reply: '"Good." He relaxes for the first time. "Now we can actually talk."' },
            { t: 'You get a government that works. Some of you will be in it. Not all.', mood: 1,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('stats.integrity', a.rng(0, 2)); },
              reply: '"Some." He weighs it. "That is more honest than the others and less useful. I will take it back to them."' },
            { t: 'You get a thank you. I am not buying anybody.', mood: -2,
              run: function (a) { a.add('party', -a.rng(2, 5)); a.add('stats.integrity', a.rng(3, 5)); a.add('media', a.rng(1, 3)); },
              reply: '"Then you will lose." He stands. "I hope you are wrong and I am. Truly."' }
          ]
        },
        {
          q: '"And the man currently in the chair. If we go with you, he has to be told something. ' +
             'Do we tell him to his face, or do we let him read it?"',
          answers: [
            { t: 'To his face. I will do it myself, before any of you say a word.', mood: 3,
              run: function (a) { a.add('party', a.rng(3, 6)); a.add('leader', -a.rng(2, 5)); a.add('stats.integrity', a.rng(2, 4)); },
              reply: '"Nobody has ever offered that." He looks at you differently. "It will not go well. Do it anyway."' },
            { t: 'Let him read it. He would have done the same to me.', mood: 1,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', -a.rng(3, 7)); a.add('stats.cunning', a.rng(.5, 1.5)); },
              reply: '"He would." He almost laughs. "That is not a defence, but it is accurate."' },
            { t: 'Tell him nothing. Keep smiling at him until the vote.', mood: -1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('stats.integrity', -a.rng(2, 5)); a.add('leader', a.rng(0, 2)); a.dirt('knife', 'A leader who was smiled at for months while the votes were counted against him', 2); },
              reply: '"That is the way it is usually done." He does not sound pleased about being right.' }
          ]
        }
      ]
    },

    /* ==================== THE CONSTITUENCY ==================== */
    // You have the seat now. Nobody cares what you think; they care whether
    // the clinic exists.
    {
      id: 'lobby-ps', topic: 'lobby', weight: 12,
      when: function (a) { return a.tier() >= 4 && RZ.ward && RZ.ward.needs(a.S).length > 0; },
      speaker: function (a) { return who(a, 'Permanent Secretary', 'the ministry'); },
      where: 'A ministry office with the blinds down',
      settleOn: 'leader',
      opening: function (a) {
        return 'She does not look up from the file for the first thirty seconds, and it is not an accident. ' +
          '"You are the fourth member this week. I will tell you what I told them: the vote is committed to ' +
          'March and there is nothing in it that is not already somebody else\'s."';
      },
      beats: [
        {
          q: function (a) {
            return '"So." She closes the file. "Tell me why your ' + a.t.constituency + ' is different from the ' +
              'other fifty-seven that have asked me this month."';
          },
          answers: [
            { t: 'Bring the figures — enrolment, distance to the nearest clinic, the deaths', mood: 3, tag: 'cost',
              when: function (a) { return a.P.stats.intellect > 42; },
              run: function (a) {
                a.add('capital', -RZ.range(6, 11));
                a.startProject(pickNeed(a), { audited: true });
                a.add('stats.intellect', a.rng(.3, 1));
              },
              reply: '"You have actually read the district health report." She writes something. "Do you know how ' +
                     'rare that is? I will put it in the adjustment estimates. Not the main vote — the adjustment."' },
            { t: 'Remind her which way you voted in March', mood: 1, tag: 'cost',
              when: function (a) { return a.whipped(); },
              run: function (a) {
                a.add('capital', -RZ.range(3, 7));
                a.startProject(pickNeed(a), { rushed: true });
                a.add('party', a.rng(0, 2));
              },
              reply: '"I am aware of how you voted." A pause. "The Minister is also aware." She reaches for a ' +
                     'different folder, the thin one. "It will be in the supplementary."' },
            { t: 'Suggest a contractor who is already known to everybody', mood: 2, tag: 'risk',
              run: function (a) {
                a.add('capital', -RZ.range(2, 5));
                a.startProject(pickNeed(a), { crony: true });
                a.add('stats.integrity', -a.rng(2, 5));
                a.nation('corruption', a.rng(0.3, 1.1));
                if (a.chance(0.4)) a.dirt('wardtender', 'A ward project steered to a contractor you named yourself', 2);
              },
              reply: '"That firm." She does not write it down, which is how you know she will remember it. ' +
                     '"They are on the panel. Fine. It will move quickly."' }
          ]
        },
        {
          q: '"One more thing, and I ask everybody. When it is late and half built and the newspaper rings you — ' +
             'do you blame the ministry?"',
          answers: [
            { t: 'No. I announced it, so I will carry it', mood: 3,
              run: function (a) { a.add('leader', a.rng(2, 6)); a.add('capital', a.rng(1, 3)); },
              reply: '"Then you will be able to ring me again." She stands, which from her is a considerable ' +
                     'courtesy. "Most of them cannot."' },
            { t: 'I will tell the truth about where it stopped', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('leader', -a.rng(0, 2)); },
              reply: '"The truth." She almost smiles. "The truth is usually Treasury, and Treasury does not read ' +
                     'the papers. But go ahead."' },
            { t: 'Yes. That is what the ministry is for', mood: -3,
              run: function (a) { a.add('leader', -a.rng(3, 8)); a.add('media', a.rng(1, 3)); },
              reply: '"At least you are honest about it." She opens the next file. "You will find the process ' +
                     'slower next time."' }
          ]
        }
      ]
    },

    {
      id: 'whip-order', topic: 'whip', weight: 12,
      when: function (a) { return a.tier() >= 4 && !a.isPresident(); },
      speaker: function (a) { return who(a, 'the Chief Whip', ''); },
      where: 'A corridor behind the chamber, ten minutes before the division',
      settleOn: 'party',
      opening: function (a) {
        return 'He is holding the list and he does not need to look at it. "The ' + P(a.C.issues) +
          ' bill. Second reading, division at four." He lets that sit. "Your ' + a.t.constituency +
          ' will hate it. I have read the same polling you have."';
      },
      beats: [
        {
          q: '"So I am going to ask you now, in a corridor, rather than find out at four in front of the cameras. ' +
             'Are you with us?"',
          answers: [
            { t: 'With you. Every time, and you can stop asking', mood: 3,
              run: function (a) {
                a.add('party', a.rng(4, 9)); a.add('leader', a.rng(3, 7));
                a.add('grassroots', -a.rng(3, 8)); a.wardTrust(-RZ.range(4, 9));
                RZ.revolt.whip(a.S, 18, 'gave the whip an open answer');
              },
              reply: '"Good." He marks the list. "Then things will be returned to you. Ring the ministry on ' +
                     'Thursday and use my name."' },
            { t: 'With you on this one. Not on the next one', mood: 1,
              run: function (a) {
                a.add('party', a.rng(2, 5)); a.add('grassroots', -a.rng(1, 4));
                a.wardTrust(-RZ.range(2, 5));
              },
              reply: '"On this one." He writes a different mark. "You will find that a man who negotiates every ' +
                     'division gets asked about every division."' },
            { t: 'No. My people will lose their water rights under clause nine', mood: -3, tag: 'risk',
              run: function (a) {
                var w = a.whipped();
                a.add('party', -RZ.range(w ? 14 : 6, w ? 26 : 13));
                a.add('leader', -RZ.range(w ? 10 : 4, w ? 20 : 10));
                a.add('grassroots', a.rng(5, 11)); a.wardTrust(RZ.range(6, 13));
                a.add('media', a.rng(3, 8));
                if (w) { a.makeRival(); RZ.revolt.unwhip(a.S); }
              },
              reply: function (a) {
                return a.whipped()
                  ? '"You." He goes very still. "You took the money. You took the seat. And now you are going to ' +
                    'cross the floor of the House on a Thursday afternoon." He walks away mid-sentence.'
                  : '"Clause nine." He writes your name down in a different column. "I will tell him it was a ' +
                    'matter of conscience. He will ask me what that is."';
              } }
          ]
        },
        {
          q: function (a) {
            return '"While I have you." He does not put the list away. "There is a member in your ' + a.t.region +
              ' who is going to vote the wrong way and does not know I know. You are closer to him than I am."';
          },
          answers: [
            { t: 'Talk to him. Bring him in yourself', mood: 3,
              run: function (a) {
                a.add('party', a.rng(3, 8)); a.add('leader', a.rng(2, 6));
                a.add('stats.integrity', -a.rng(1, 3)); a.recruitAlly();
              },
              reply: '"That is how it is supposed to work." He finally folds the list. "A whip who has to whip ' +
                     'is a whip who has already failed."' },
            { t: 'Tell him you were asked, and let him decide', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(0, 3)); },
              reply: '"You are going to tell him I asked." He considers it. "Do you know, that might work better. ' +
                     'It certainly makes you a more interesting problem."' },
            { t: 'That is your job, not mine', mood: -2,
              run: function (a) { a.add('party', -a.rng(2, 6)); a.add('leader', -a.rng(1, 4)); },
              reply: '"It is my job." He agrees pleasantly. "And the allocation of committee places is also my job."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'At four o\'clock the bells go and you walk through the lobby he is standing in. He does not look at you, which today means everything is fine.',
          fair: 'The division is called. You vote, the bill passes by eleven, and nobody says anything to you about it afterwards.',
          cool: 'The result is read out at 4:20. Somebody from the whips\' office asks for your diary "for a conversation next week".',
          hostile: 'Your name is read out in the wrong list, aloud, in the chamber. Three members turn around to look at you.'
        }[temp];
      }
    },

    {
      id: 'pac-hearing', topic: 'pac', weight: 12,
      when: function (a) { return a.tier() >= 4; },
      speaker: function (a) { return who(a, 'chief executive', 'the power utility'); },
      where: 'A committee room, televised',
      settleOn: 'media',
      opening: function (a) {
        return 'He arrived with four lawyers and a bound presentation nobody asked for. The cameras are live and ' +
          'he knows exactly where they are. "Honourable members, let me begin by saying that turnaround is a journey."';
      },
      beats: [
        {
          q: function (a) {
            return '"The board is satisfied that the irregular expenditure of ' + money(a, 900) +
              ' has been fully accounted for." He looks at you, because it is your turn. Sixteen seconds of ' +
              'silence would be broadcast.';
          },
          answers: [
            { t: 'Read the invoice numbers back to him, one at a time', mood: 3,
              when: function (a) { return a.P.stats.intellect > 45; },
              run: function (a) {
                a.add('media', a.rng(7, 14)); a.add('fame', a.rng(3, 7));
                a.add('business', -a.rng(3, 8)); a.add('leader', -a.rng(1, 5));
                a.add('capital', -a.rng(2, 5));
                if (a.chance(0.5)) a.digOnRival();
                a.nation('corruption', -a.rng(0.3, 1.2));
              },
              reply: '"I would have to revert on that." Eleven times, in forty minutes. The clip of the eleventh ' +
                     'is on every phone in the country by the evening.' },
            { t: 'Ask him what he earned last year, and wait', mood: 2,
              run: function (a) {
                a.add('media', a.rng(5, 11)); a.add('fame', a.rng(2, 6));
                a.add('business', -a.rng(4, 9));
              },
              reply: 'He tells you. The number is said out loud on live television in a country where the average ' +
                     'household earns less in a decade. His own lawyer closes his eyes.' },
            { t: 'Accept the assurance and move to the next item', mood: -2,
              run: function (a) {
                a.add('media', -a.rng(3, 8)); a.add('business', a.rng(2, 6));
                a.add('capital', a.rng(1, 4));
              },
              reply: '"I am grateful to the honourable member." He is, too. Somebody will remember this on your ' +
                     'behalf, and somebody else will remember it against you.' }
          ]
        },
        {
          q: '"Before we rise." He leans into the microphone. "I would be happy to brief the honourable member ' +
             'privately on the commercial sensitivities. Perhaps over lunch."',
          answers: [
            { t: 'Decline, on the record, into the microphone', mood: 3,
              run: function (a) { a.add('media', a.rng(3, 8)); a.add('stats.integrity', a.rng(2, 5)); a.add('business', -a.rng(2, 6)); },
              reply: '"The honourable member declines," the chair says, enjoying himself. It is the line that runs.' },
            { t: 'Take the lunch. Information is information', mood: 0,
              run: function (a) { a.add('capital', a.rng(2, 6)); a.add('stats.cunning', a.rng(.4, 1.2)); a.add('stats.integrity', -a.rng(1, 4)); if (a.chance(0.35)) a.digOnRival(); },
              reply: 'The restaurant is on the top floor and the bill is not brought to the table. You learn two ' +
                     'genuinely useful things and acquire one obligation you did not price.' },
            { t: 'Say nothing at all and let the offer hang there', mood: 1,
              run: function (a) { a.add('media', a.rng(1, 4)); a.add('stats.cunning', a.rng(.3, 1)); },
              reply: 'The silence runs for four seconds on live television, which is a very long time, and he ' +
                     'fills it himself with something he should not have said.' }
          ]
        }
      ]
    },

    {
      id: 'funeral-saturday', topic: 'funerals', weight: 11,
      when: function (a) { return a.tier() >= 2; },
      speaker: function (a) { return who(a, 'the family spokesman', ''); },
      where: 'Under a tent in the yard, Saturday, before dawn',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'The tent went up on Thursday and the cooking started at three this morning. He was a teacher here ' +
          'for thirty-one years and half the ' + a.t.constituency + ' was in his classroom. ' +
          'The family spokesman finds you before the programme starts.';
      },
      beats: [
        {
          q: function (a) {
            return '"We are short," he says, quietly, so that nobody at the pots can hear him. "The casket is not ' +
              'paid and the groceries for tomorrow are not bought. I am not asking you. I am telling you where we are."';
          },
          answers: [
            { t: 'Pay for it yourself, now, and never mention it', mood: 3, tag: 'cost',
              when: function (a) { return a.P.money > a.wage(2); },
              run: function (a) {
                a.add('money', -a.wage(a.rng(2, 3.5)));
                a.add('grassroots', a.rng(4, 9)); a.wardTrust(RZ.range(5, 10));
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: 'You go to the car and come back and it is done, and he does not thank you because thanking ' +
                     'you would be to say it out loud. Four hundred people will know by Monday anyway.' },
            { t: 'Have the party pay, with a banner', mood: 0,
              run: function (a) {
                a.add('grassroots', a.rng(1, 4)); a.add('party', -a.rng(0, 2));
                a.wardTrust(RZ.range(0, 3));
              },
              reply: 'The groceries arrive at ten with the party logo on every box, and somebody at the back says, ' +
                     'not quietly enough, that even the dead have to campaign now.' },
            { t: 'You cannot. Say so, and stay all day', mood: 2,
              run: function (a) {
                a.add('health', -a.rng(3, 6)); a.add('grassroots', a.rng(2, 5));
                a.wardTrust(RZ.range(2, 6)); a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"I have nothing this month," you tell him, and it is true, and you say it looking at him. ' +
                     'Then you carry chairs until four and dig with the men. He tells that story for years.' }
          ]
        },
        {
          q: function (a) {
            return 'Halfway through the programme your phone goes twice. It is the ' + a.t.conference +
              ' organising committee: the retreat in ' + a.C.capital + ' starts at two and they are asking whether ' +
              'to expect you.';
          },
          answers: [
            { t: 'Stay. Switch the phone off in front of people', mood: 3,
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.wardTrust(RZ.range(4, 9));
                a.add('party', -a.rng(2, 6)); a.add('leader', -a.rng(1, 5));
              },
              reply: 'You turn it off with your thumb, visibly, and put it face down on the plastic chair. ' +
                     'The woman next to you sees you do it. Everybody sees you do it.' },
            { t: 'Go after the burial. Both, badly', mood: 0,
              run: function (a) {
                a.add('health', -a.rng(4, 8)); a.add('party', a.rng(1, 3));
                a.add('grassroots', a.rng(0, 2));
              },
              reply: 'You leave at half past one, before the food, which is the part people notice. You arrive in ' +
                     'the capital at six, after the session that mattered. You have done neither thing.' },
            { t: 'Go now. The retreat decides the list', mood: -3,
              run: function (a) {
                a.add('party', a.rng(3, 8)); a.add('leader', a.rng(2, 6));
                a.add('grassroots', -a.rng(5, 11)); a.wardTrust(-RZ.range(7, 14));
              },
              reply: 'Your car leaves during the second hymn. It is a long driveway and everybody watches the ' +
                     'whole way down it.' }
          ]
        }
      ]
    },

    {
      id: 'ward-crisis', topic: 'wardcrisis', weight: 12,
      when: function (a) { return a.tier() >= 4; },
      speaker: function (a) { return who(a, 'the ward committee chair', ''); },
      where: function (a) { return 'Your constituency office in ' + a.homeName(); },
      settleOn: 'grassroots',
      opening: function (a) {
        return 'They did not make an appointment and there are eleven of them in a room with six chairs. ' +
          'The taps in three wards have been dry for nine days. The council says it is the utility. ' +
          'The utility says it is the council.';
      },
      beats: [
        {
          q: '"We are not asking you to fix the pipe," the chair says. "We are asking you to make somebody fix ' +
             'the pipe. That is what you are for. Is it not?"',
          answers: [
            { t: 'Spend the capital. Go over both of them, today', mood: 3, tag: 'cost',
              when: function (a) { return a.P.capital >= 8; },
              run: function (a) {
                a.add('capital', -RZ.range(8, 14));
                a.wardTrust(RZ.range(6, 12)); a.add('grassroots', a.rng(3, 7));
                a.add('leader', -a.rng(1, 4));
              },
              reply: 'Four calls, one of them to somebody who owes you a great deal and now owes you nothing. ' +
                     'Water tankers on Thursday, the pipe by the following Wednesday.' },
            { t: 'Take them to the council meeting yourself and let them speak', mood: 2,
              run: function (a) {
                a.add('health', -a.rng(2, 5)); a.add('grassroots', a.rng(2, 6));
                a.wardTrust(RZ.range(2, 6)); a.add('party', -a.rng(1, 4));
              },
              reply: 'Eleven people in a public gallery, with the minutes being taken, saying it in their own ' +
                     'words. It takes three weeks longer and it changes what they think they are allowed to do.' },
            { t: 'Tell them honestly that this is a council function', mood: -3,
              run: function (a) {
                a.wardTrust(-RZ.range(8, 15)); a.add('grassroots', -a.rng(4, 9));
                a.remember('You called it a council function while we stood in your office', 'bad');
              },
              reply: '"A council function." The chair stands up. "We will remember that it was a council function." ' +
                     'They file out and the room is very quiet and there are still six empty chairs.' }
          ]
        },
        {
          q: '"And when the tanker comes — because one tanker is coming, not three — which ward does it go to ' +
             'first? You have to say it now, in front of all of us."',
          answers: [
            { t: 'The ward with the clinic and the school', mood: 2,
              run: function (a) { a.wardTrust(RZ.range(2, 6)); a.add('stats.intellect', a.rng(.3, 1)); },
              reply: 'Two of them nod immediately. One of them does not, and he is from the other ward, and he ' +
                     'will remember that you answered without looking at him.' },
            { t: 'The ward that voted for me hardest', mood: -1,
              run: function (a) {
                a.add('grassroots', a.rng(1, 4)); a.wardTrust(-RZ.range(1, 5));
                a.add('stats.integrity', -a.rng(1, 3));
              },
              reply: 'Nobody is surprised and nobody is impressed. It is the answer they expected, which is ' +
                     'exactly the problem with it.' },
            { t: 'You decide. I will take it to them whatever you choose', mood: 3,
              run: function (a) {
                a.wardTrust(RZ.range(4, 9)); a.add('grassroots', a.rng(2, 5));
                a.add('capital', -a.rng(0, 3));
              },
              reply: 'They argue for twenty minutes and settle it themselves, and because they settled it nobody ' +
                     'blames you for it. You have just discovered the most useful thing a committee is for.' }
          ]
        }
      ]
    },

    /* ==================== THE MINISTRY ==================== */
    {
      id: 'reshuffle-rumour', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the President’s chief of staff', ''); },
      where: 'A corridor outside the Cabinet room, unscheduled',
      settleOn: 'leader',
      opening: function (a) {
        return 'She is waiting when you come out, which never happens, and she walks beside you rather than ' +
          'stopping, which is worse. "There is a list," she says. "There is always a list. This one has a date on it."';
      },
      beats: [
        {
          q: function (a) {
            return '"Your name is on it. Not at the top." She keeps walking. "He has been asking who briefed the ' +
              'paper about ' + P(a.C.issues) + '. It was not you. That is not the same as him believing it was not you."';
          },
          answers: [
            { t: 'Go to him today. Not through you, and not through anybody', mood: 3, tag: 'cost',
              run: function (a) {
                a.add('capital', -RZ.range(6, 12)); a.add('leader', a.rng(5, 11));
                a.add('health', -a.rng(1, 4));
              },
              reply: '"He is free at nine." She finally stops. "Go alone, say it in one sentence, and do not bring ' +
                     'a file. Men who bring files look like men who prepared."' },
            { t: 'Find out who did brief the paper, and hand him that', mood: 1, tag: 'risk',
              run: function (a) {
                a.add('stats.cunning', a.rng(.5, 1.5)); a.add('leader', a.rng(1, 5));
                a.makeRival();
                if (a.chance(0.4)) a.dirt('briefing', 'A colleague handed to the President to save your own portfolio', 2);
              },
              reply: '"You are going to give him a name." She considers this without approval or disapproval. ' +
                     '"It will work. It works every time. That is rather the problem with it."' },
            { t: 'Say nothing. If he wants the portfolio he can have it', mood: -2,
              run: function (a) {
                a.add('leader', -RZ.range(4, 10)); a.add('stats.integrity', a.rng(1, 4));
                a.S.flags.reshuffleRisk = true;
              },
              reply: '"Dignity." She starts walking again. "I have watched a great deal of dignity get announced ' +
                     'at ten at night on the state broadcaster."' }
          ]
        },
        {
          q: '"One more thing, because I am the one who writes the note." She stops walking again. ' +
             '"If you are moved — up or sideways — who comes with you? Give me one name."',
          answers: [
            { t: 'My director-general. She is the only reason the ministry works', mood: 3,
              run: function (a) { a.add('leader', a.rng(2, 6)); a.add('capital', a.rng(1, 4)); a.recruitAlly(); },
              reply: '"An official." She writes it down. "Not a cousin, not a fundraiser, not a man from your ' +
                     'branch. He will read that and he will read it correctly."' },
            { t: 'Nobody. Whoever is there is there', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('party', -a.rng(0, 3)); },
              reply: '"Nobody." A short pause. "That is either principle or it is not having anybody, and I ' +
                     'genuinely cannot tell which."' },
            { t: 'The three from my province, obviously', mood: -2,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', -a.rng(3, 8)); a.nation('corruption', a.rng(.2, .9)); },
              reply: '"Three." She does not write it down, which is worse than writing it down. ' +
                     '"He counts, you know. He has always counted."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'The list came out on Friday. You moved sideways to a bigger portfolio, which in this government is the only compliment there is.',
          fair: 'The list came out and your name was not on it at all, which is neither good news nor bad, only news.',
          cool: 'You kept the portfolio and lost the deputy you liked. Nobody explained the connection and there does not have to be one.',
          hostile: 'It was announced at ten at night, between the sport and the weather. Your successor was already in the building.'
        }[temp];
      },
      settles: function (a, temp) {
        if (temp === 'hostile' && RZ.chance(0.55)) a.demote();
        else a.add('leader', { warm: 6, fair: 2, cool: -2, hostile: -8 }[temp]);
      }
    },

    {
      id: 'poisoned-chalice', topic: 'crisis', weight: 0,
      speaker: function (a) { return { name: a.S.nation.presidentName, role: a.t.hos, org: '' }; },
      where: 'The residence, on a Sunday, with the television on mute',
      settleOn: 'leader',
      opening: function (a) {
        return 'He asks about your mother and he means it, and then he does not get to the point for eleven ' +
          'minutes. When he does, he does it while looking at the television.\n\n' +
          '"The airline," he says. "I want you to take the airline."';
      },
      beats: [
        {
          q: function (a) {
            return 'Everybody in the country knows what the airline is: four aircraft, two of which fly, ' +
              'eleven thousand employees, and a debt that is a rounding error away from being the health budget. ' +
              'The last three ministers left politics.\n\n"Well?" he says. "You are the only one I trust with it."';
          },
          answers: [
            { t: 'Take it, and ask for the authority to actually close routes', mood: 3, tag: 'risk',
              run: function (a) {
                a.add('capital', -RZ.range(8, 16)); a.add('leader', a.rng(4, 9));
                a.nation('unrest', a.rng(2, 6)); a.add('grassroots', -a.rng(3, 8));
                a.nation('growth', a.rng(0.2, 0.8));
                a.promise('airline', 'To fix the national airline', { due: 24, to: 'The President' });
              },
              reply: '"Authority." He turns the television off, which he has not done all afternoon. ' +
                     '"You are the first one to ask for that instead of for money. You may have it. ' +
                     'You will not enjoy having it."' },
            { t: 'Take it, and say nothing about what it will cost', mood: 2,
              run: function (a) {
                a.add('leader', a.rng(3, 7)); a.add('capital', -RZ.range(4, 9));
                a.add('media', -a.rng(2, 6));
                a.promise('airline', 'To fix the national airline', { due: 18, to: 'The President' });
              },
              reply: '"Good man." He is already reaching for the remote. The photograph of the two of you shaking ' +
                     'hands is issued that evening, which is the part of this that was always going to happen.' },
            { t: 'Decline. Politely, and in a way he will remember', mood: -3,
              run: function (a) {
                a.add('leader', -RZ.range(8, 16)); a.add('stats.integrity', a.rng(2, 5));
                a.add('capital', a.rng(2, 6));
              },
              reply: 'He does not argue. He asks about your mother again, differently, and then a young man appears ' +
                     'to show you out. You have refused the President of the Republic something in his own house.' }
          ]
        },
        {
          q: '"Anything else?" he says, and it is not really a question, and this is the only moment in the ' +
             'next two years when it will cost him something to say no to you.',
          answers: [
            { t: 'Your signature on the restructuring, before I leave this room', mood: 3, tag: 'risk',
              run: function (a) { a.add('capital', RZ.range(6, 14)); a.add('leader', a.rng(1, 5)); a.S.flags.chaliceSigned = true; },
              reply: 'He looks at you properly for the first time all afternoon. Then he calls for the aide, ' +
                     'and signs it on the arm of the chair, and you both know exactly what you have just done.' },
            { t: 'That when it goes badly you say it was your decision', mood: 2,
              run: function (a) { a.add('leader', a.rng(3, 8)); a.add('media', a.rng(1, 4)); },
              reply: '"When." He notes the word. "Not if." He agrees, and he means it today, which is a ' +
                     'different thing from meaning it in eighteen months.' },
            { t: 'Nothing. I will manage', mood: 0,
              run: function (a) { a.add('stats.grit', a.rng(1, 3)); a.add('capital', -a.rng(0, 3)); },
              reply: '"Good." The television goes back on. You have just been handed eleven thousand employees ' +
                     'and no cover at all, and you said thank you.' }
          ]
        }
      ]
    },

    /* ==================== THE SUCCESSION ==================== */
    {
      id: 'succession-trap', topic: 'crisis', weight: 0,
      speaker: function (a) { return { name: a.S.nation.presidentName, role: a.t.hos, org: '' }; },
      where: 'The presidential aircraft, somewhere over the interior',
      settleOn: 'leader',
      opening: function (a) {
        return 'He has the whole cabin and he has sent everybody else to the back of it. The engines are loud ' +
          'enough that nothing said here is on any record.\n\n' +
          '"They are asking me about the term," he says. "The lawyers say the clause is ambiguous. ' +
          'Everybody knows the clause is not ambiguous."';
      },
      beats: [
        {
          q: '"You are the one who would be next. So I am going to ask you where you are, and I would like the ' +
             'answer you would give somebody else."',
          answers: [
            { t: 'Endorse him, publicly, tomorrow', mood: 3,
              run: function (a) {
                a.add('leader', a.rng(6, 13)); a.add('party', a.rng(2, 6));
                a.add('media', -a.rng(4, 10)); a.add('stats.integrity', -a.rng(3, 7));
                a.S.flags.endorsedThirdTerm = true;
              },
              reply: '"Say it in Setswana as well," he says, "and say it in the north." He is asleep before ' +
                     'the descent. You are not.' },
            { t: 'Tell him the clause is not ambiguous, to his face', mood: 1, tag: 'risk',
              run: function (a) {
                a.add('stats.integrity', a.rng(4, 9)); a.add('media', a.rng(2, 6));
                a.add('leader', -RZ.range(5, 12)); a.add('party', -a.rng(1, 5));
              },
              reply: 'The engines fill a very long silence. "You are the only one who has said that," he says ' +
                     'eventually, "and you have said it where nobody can hear you. I notice both halves of that."' },
            { t: 'Say nothing here, and brief the press when you land', mood: -3, tag: 'risk',
              run: function (a) {
                var ok = a.roll('cunning', 52);
                a.add('media', ok ? a.rng(6, 13) : -a.rng(3, 8));
                a.add('leader', -RZ.range(6, 14));
                if (!ok) { a.dirt('treachery', 'Briefing against the Head of State from inside his own aircraft', 4); a.makeRival(); }
                a.nation('stability', -a.rng(1, 4));
              },
              reply: function (a, convo) {
                return 'You tell him you will think about it, and you are on the phone from the car. ' +
                  'By Thursday the story is everywhere. The only question is whether anybody can prove where ' +
                  'it came from, and there were eleven people on that aircraft.';
              } }
          ]
        },
        {
          q: '"And if it were not me." The engines fill the pause. "If the clause held and I went. ' +
             'Who would you tell the provinces to back?"',
          answers: [
            { t: 'Me. You asked, and I am not going to insult you by pretending', mood: 2,
              run: function (a) { a.add('leader', a.rng(2, 7)); a.add('party', a.rng(3, 8)); a.add('fame', a.rng(1, 4)); },
              reply: 'He laughs, once, genuinely. "At least you did not say you had not thought about it. ' +
                     'Everybody says they have not thought about it. I have never believed one of them."' },
            { t: 'Whoever the conference chooses. That is what it is for', mood: 1,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 4)); a.add('leader', -a.rng(0, 3)); },
              reply: '"The conference." He closes his eyes. "I have controlled four of those. So have you, ' +
                     'from further down the table. Let us not do this part."' },
            { t: 'Name somebody else, and watch his face', mood: -2, tag: 'risk',
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('leader', -a.rng(2, 7)); a.makeRival(); },
              reply: 'He does not react at all, which is itself the reaction, and the name you gave will be in ' +
                     'a ministry within the month with a great deal more to lose than he had this morning.' }
          ]
        }
      ]
    },

    /* ==================== THE PRESIDENCY ==================== */
    {
      id: 'debt-ultimatum', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the Governor of the central bank', ''); },
      where: 'The residence, 6am, before anybody else is awake',
      settleOn: 'intl',
      opening: function (a) {
        return 'He came himself rather than sending it, and he came at six, which tells you everything. ' +
          'He puts one page on the table.\n\n' +
          '"We have ' + RZ.round(a.S.nation.economy.reserves, 1) + ' months of import cover," he says. ' +
          '"Salaries are the twenty-fifth. I can pay them once."';
      },
      beats: [
        {
          q: '"There are two telephone numbers. I am not going to tell you which one to ring, because whichever ' +
             'one you ring, in ten years they will say it was the moment."',
          answers: [
            { t: 'The Fund. Conditions, austerity, and a country that hates you for it', mood: 2,
              run: function (a) {
                a.S.nation.intl.imf = true;
                a.add('intl', RZ.range(10, 20)); a.nation('reserves', RZ.range(2, 4));
                a.nation('debt', -RZ.range(4, 12)); a.nation('inflation', -RZ.range(1, 4));
                a.nation('unrest', RZ.range(10, 22)); a.add('grassroots', -RZ.range(10, 20));
                a.add('stats.integrity', a.rng(1, 4));
                a.legacyMark('tookTheFund');
              },
              reply: '"They will want the fuel subsidy inside ninety days and the wage bill inside a year." ' +
                     'He folds the page. "I will make the call. You will have to make the speech."' },
            { t: 'The other one. Cash by Friday, and they will name their own security', mood: 1, tag: 'risk',
              run: function (a) {
                a.add('money', a.wage(30)); a.nation('reserves', RZ.range(3, 6));
                a.add('intl', -RZ.range(12, 24)); a.add('stats.integrity', -RZ.range(6, 13));
                a.nation('corruption', RZ.range(2, 6));
                a.dirt('concession', 'A strategic asset pledged to a foreign state against an emergency loan', 4);
                a.legacyMark('pledgedTheAssets');
              },
              reply: '"They do not want conditions," he says carefully. "They want the port, and a thirty-year ' +
                     'lease on the corridor. There is no austerity and there is no sovereignty either. ' +
                     'I want it minuted that I said that."' },
            { t: 'Neither. Default, and tell the country why', mood: -1, tag: 'risk',
              run: function (a) {
                a.nation('debt', -RZ.range(15, 30)); a.nation('inflation', RZ.range(8, 20));
                a.add('intl', -RZ.range(15, 30)); a.nation('growth', -RZ.range(2, 5));
                a.add('grassroots', RZ.range(4, 12)); a.add('stats.integrity', a.rng(4, 9));
                a.nation('unrest', RZ.range(4, 12));
                a.legacyMark('defaulted');
              },
              reply: 'He is quiet for a long time. "It has been done," he says. "Twice on this continent. ' +
                     'Both times the man who did it was right and finished." He stands. "I will resign on ' +
                     'Monday, so that it is clearly your decision and not mine."' }
          ]
        },
        {
          q: '"Whichever number you ring, there is still the twenty-fifth." He does not sit down. ' +
             '"Nurses, teachers, soldiers. In that order or a different one. You choose the order."',
          answers: [
            { t: 'Nurses and teachers first. The soldiers can wait a week', mood: 2, tag: 'risk',
              run: function (a) { a.add('grassroots', RZ.range(4, 10)); a.add('security', -RZ.range(6, 14)); a.nation('coup', RZ.range(3, 9)); },
              reply: '"A week." He writes it down without expression. "I will tell the Commander myself. ' +
                     'I would rather he heard it from a banker than read it in a newspaper."' },
            { t: 'Soldiers first. Everything else follows from that', mood: 1,
              run: function (a) { a.add('security', RZ.range(5, 11)); a.nation('coup', -RZ.range(3, 8)); a.add('grassroots', -RZ.range(4, 10)); a.nation('unrest', a.rng(2, 6)); },
              reply: '"That is the answer of a man who intends to still be here in March." He does not say ' +
                     'whether he approves. "It is also, historically, the correct one."' },
            { t: 'Everybody at once, at seventy per cent', mood: 0,
              run: function (a) { a.nation('unrest', RZ.range(3, 8)); a.add('grassroots', -a.rng(2, 6)); a.add('security', -a.rng(2, 6)); a.add('stats.integrity', a.rng(1, 4)); },
              reply: '"Seventy per cent of everybody." He almost smiles. "Then everybody will be angry and ' +
                     'nobody will be desperate. It is not a good answer. It may be the only fair one."' }
          ]
        }
      ]
    },

    {
      id: 'midnight-generals', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the Commander of the Defence Force', ''); },
      where: 'A room at the barracks, twenty past eleven at night',
      settleOn: 'security',
      opening: function (a) {
        return 'They did not come to the residence and they did not ask you to come during office hours. ' +
          'There are four of them and only one is speaking.\n\n' +
          '"The men have not been paid since the fifteenth," he says. "I am telling you before I am asked ' +
          'to tell you by somebody else."';
      },
      beats: [
        {
          q: function (a) {
            return '"Unrest is at ' + Math.round(a.S.nation.society.unrest) + '. My officers are being asked in ' +
              'their own villages why they are still taking orders from you. I would like to be able to give ' +
              'them an answer that is not about the constitution."';
          },
          answers: [
            { t: 'Double the defence vote. Tonight, before you leave this room', mood: 3, tag: 'cost',
              run: function (a) {
                a.add('security', RZ.range(12, 22)); a.nation('coup', -RZ.range(10, 20));
                a.nation('growth', -RZ.range(0.8, 2.2)); a.nation('debt', RZ.range(3, 8));
                a.nation('health', -RZ.range(3, 8)); a.nation('education', -RZ.range(3, 8));
                a.add('media', -a.rng(3, 8));
              },
              reply: 'He does not smile and he does not thank you. He nods once to the man on his left, who ' +
                     'leaves the room, and you understand that the man was leaving either way and the ' +
                     'difference is what he was going to say when he got there.' },
            { t: 'Pay the arrears, and nothing more. Every cent, this week', mood: 1,
              run: function (a) {
                a.add('security', RZ.range(4, 9)); a.nation('coup', -RZ.range(3, 9));
                a.nation('debt', RZ.range(1, 3)); a.add('stats.integrity', a.rng(1, 4));
              },
              reply: '"The arrears." He weighs it. "That is what I asked for, and we both know it is not what ' +
                     'I came for." A pause. "It will hold until the next one."' },
            { t: 'Remind him what the constitution says about this meeting', mood: -3, tag: 'risk',
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 7)); a.add('intl', a.rng(2, 6));
                a.add('security', -RZ.range(10, 20)); a.nation('coup', RZ.range(8, 18));
              },
              reply: '"The constitution." He stands, and the other three stand a half-second after him, which is ' +
                     'the most frightening thing that happens all night. "Thank you for coming, Your Excellency. ' +
                     'At this hour. To a barracks."' }
          ]
        },
        {
          q: '"There is a second thing." He does not sit. "If the crowds come back to the square — and they ' +
             'will — do you want us on the street, or do you want us in the barracks?"',
          answers: [
            { t: 'In the barracks. Whatever happens in that square', mood: 2, tag: 'risk',
              run: function (a) { a.add('stats.integrity', RZ.range(4, 9)); a.add('intl', RZ.range(4, 10)); a.nation('unrest', RZ.range(3, 9)); a.add('security', -a.rng(2, 6)); },
              reply: '"Whatever happens." He wants it said again and you say it again. "Then I will need that ' +
                     'in writing, Your Excellency, and so will you, in about a year."' },
            { t: 'On the street, unarmed, and standing still', mood: 1,
              run: function (a) { a.nation('unrest', -RZ.range(4, 10)); a.add('security', a.rng(2, 6)); a.add('media', -a.rng(1, 5)); a.nation('deaths', a.irange(0, 3)); },
              reply: '"Unarmed." One of the others looks at the floor. "It is a fine distinction at two in the ' +
                     'morning with eight thousand people in front of you, but I will give the order."' },
            { t: 'On the street. Do what is necessary', mood: 3,
              run: function (a) { a.nation('unrest', -RZ.range(10, 20)); a.add('security', RZ.range(6, 13)); a.add('intl', -RZ.range(8, 18)); a.add('media', -RZ.range(6, 14)); a.nation('deaths', a.irange(4, 40)); a.add('stats.integrity', -RZ.range(5, 11)); a.dirt('square', 'An order given at a barracks at midnight, and a count nobody published', 4); },
              reply: 'He nods, and all four of them are gone within a minute, and the room is very quiet, ' +
                     'and you are the only person in it who has to decide what to do tomorrow.' }
          ]
        }
      ]
    },

    /* ==================== WHAT YOU DO ON PURPOSE ==================== */
    {
      id: 'mega-tender', topic: 'megatender', weight: 12,
      when: function (a) { return a.tier() >= 6 && a.inGov(); },
      speaker: function (a) { return who(a, 'the director of procurement', 'your own ministry'); },
      where: 'Your office, with the door closed and the diary blocked',
      settleOn: 'business',
      opening: function (a) {
        return 'The file is four hundred pages and he has flagged eleven of them. It is the largest thing your ' +
          'ministry will sign this year and possibly this decade.\n\n' +
          '"Three bidders qualified," he says. "Technically." He does not open the file.';
      },
      beats: [
        {
          q: '"One of them can actually do the work. One of them is cheaper and cannot. And one of them is a ' +
             'consortium whose directors I would rather you asked me about in a different room."',
          answers: [
            { t: 'Award it to the one who can do the work', mood: 3,
              run: function (a) {
                a.nation('growth', RZ.range(0.4, 1.3)); a.nation('infra', RZ.range(2, 6));
                a.add('intl', a.rng(2, 6)); a.add('media', a.rng(2, 5));
                a.add('party', -a.rng(3, 8)); a.add('business', -a.rng(0, 3));
                a.nation('corruption', -a.rng(0.2, 1));
              },
              reply: '"Then I will need the evaluation minuted properly, because there will be a review." ' +
                     'He almost looks pleased. "There is always a review when nobody was paid."' },
            { t: 'Award it to the consortium, and do not ask', mood: 1, tag: 'risk',
              run: function (a) {
                a.add('money', a.wage(RZ.range(18, 34))); a.add('capital', RZ.range(6, 14));
                a.add('business', a.rng(5, 11)); a.add('stats.integrity', -RZ.range(5, 11));
                a.nation('corruption', RZ.range(1.5, 4)); a.nation('infra', -RZ.range(0, 2));
                a.owePatron(RZ.makeName(a.C), RZ.range(8, 14));
                a.dirt('megatender', 'A national contract awarded to a consortium whose directors were never discussed', 4);
              },
              reply: 'He closes the file without opening it. "I will minute it as a value-for-money determination." ' +
                     'The first payment clears on a Friday afternoon into an account in a different name.' },
            { t: 'Split it. Half to the competent one, half to theirs', mood: 2, tag: 'risk',
              run: function (a) {
                a.add('money', a.wage(RZ.range(6, 14))); a.add('capital', RZ.range(3, 8));
                a.add('party', a.rng(2, 6)); a.add('stats.integrity', -RZ.range(2, 6));
                a.nation('corruption', RZ.range(0.6, 2)); a.nation('infra', RZ.range(0.5, 2.5));
                a.add('stats.cunning', a.rng(.5, 1.5));
              },
              reply: '"A joint venture." He writes it down. "Everybody is paid, the road gets built badly, and ' +
                     'nobody resigns. It is the most common outcome in this building."' }
          ]
        },
        {
          q: '"Last question, and it is the one the unions will ask." He finally opens the file. ' +
             '"Local content. Forty per cent adds nine months and a great deal of money. Do we require it?"',
          answers: [
            { t: 'Require it. Forty per cent, written into the contract', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 8)); a.nation('unemployment', -a.rng(.3, 1.1)); a.add('business', -a.rng(2, 6)); a.add('money', -a.wage(a.rng(0, 3))); },
              reply: '"Nine months longer and four hundred jobs in the district." He writes it in. ' +
                     '"You will be asked about the nine months every one of them."' },
            { t: 'Require it on paper. Waive it quietly at the first delay', mood: 0, tag: 'risk',
              run: function (a) { a.add('stats.cunning', a.rng(.5, 1.5)); a.add('stats.integrity', -a.rng(2, 5)); a.add('business', a.rng(2, 5)); if (a.chance(0.35)) a.dirt('localcontent', 'A local content requirement announced and then quietly waived', 2); },
              reply: '"A variation order in month four." He has clearly done this before. "It will be signed ' +
                     'by a deputy director and it will never have your name on it."' },
            { t: 'No. Build it fast and build it properly', mood: 1,
              run: function (a) { a.nation('infra', a.rng(1, 4)); a.add('business', a.rng(3, 7)); a.add('grassroots', -a.rng(3, 8)); },
              reply: '"The unions will be at the ministry by Thursday." He shrugs. "They will also be driving ' +
                     'on it in two years, which is the argument nobody ever wins with."' }
          ]
        }
      ]
    },

    {
      id: 'central-purge', topic: 'purge', weight: 12,
      when: function (a) { return a.tier() >= 9 && !a.isPresident(); },
      speaker: function (a) { return who(a, 'your organiser', 'the provinces'); },
      where: 'A room with the curtains closed, two days before nominations',
      settleOn: 'party',
      opening: function (a) {
        return 'He has the central committee list, annotated, in three colours. "Forty-one names," he says. ' +
          '"Nineteen are his. Fourteen are yours. Eight will go whichever way the room goes, and the room goes ' +
          'wherever the nineteen tell it to."';
      },
      beats: [
        {
          q: '"We can move on eleven of the nineteen before nominations close. It will cost you, and it will be ' +
             'obvious, and once it starts we cannot stop it halfway."',
          answers: [
            { t: 'All eleven. Do it in one night', mood: 3, tag: 'risk',
              run: function (a) {
                a.add('capital', -RZ.range(22, 38)); a.add('party', RZ.range(10, 20));
                a.add('leader', -RZ.range(8, 18)); a.makeRival(); a.makeRival();
                a.add('stats.cunning', a.rng(1, 3));
                a.S.flags.purgedCentral = true;
              },
              reply: '"One night." He gathers the list. "By Thursday morning your people chair eight of the ' +
                     'eleven subcommittees and nobody will be able to say exactly when it happened."' },
            { t: 'Four. The ones nobody will defend', mood: 2,
              run: function (a) {
                a.add('capital', -RZ.range(9, 17)); a.add('party', RZ.range(4, 9));
                a.add('leader', -RZ.range(2, 7)); a.add('stats.cunning', a.rng(.5, 1.5));
              },
              reply: '"Four is quiet." He nods slowly. "Four is also four, and he has fifteen left. ' +
                     'You are going to have to do this again."' },
            { t: 'None. Win the room on the argument', mood: -1,
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 6)); a.add('media', a.rng(2, 5));
                a.add('party', -a.rng(2, 6));
              },
              reply: 'He puts the list away without a word, and it is the silence of a man who has done this ' +
                     'before with somebody who is no longer in politics.' }
          ]
        },
        {
          q: '"And the eight who swing." He taps the third colour. "They are watching to see what happens to ' +
             'the nineteen. What do I tell them is waiting for them?"',
          answers: [
            { t: 'Positions. Name them, and mean it', mood: 3, tag: 'promise',
              run: function (a) { a.add('party', RZ.range(5, 11)); a.add('stats.integrity', -a.rng(2, 5)); a.promise('centralslate', 'Positions for eight central committee members who swung to you', { kind: 'cabinet', to: 'The central committee' }); },
              reply: '"Then they are yours by Wednesday." He is already dialling. "Eight people have just ' +
                     'stopped being a problem and started being a debt."' },
            { t: 'The truth: that I will not be coming for them', mood: 2,
              run: function (a) { a.add('party', a.rng(2, 6)); a.add('stats.integrity', a.rng(2, 5)); },
              reply: '"Safety." He considers it. "It is a smaller offer and it is one you can actually keep. ' +
                     'Six of the eight will take it. The other two want more than safety."' },
            { t: 'Nothing. Let them work out which way the wind went', mood: 0,
              run: function (a) { a.add('party', a.rng(0, 3)); a.add('stats.cunning', a.rng(.5, 1.5)); },
              reply: '"They will work it out." He puts the phone down. "They will also remember that nobody ' +
                     'asked them, which costs nothing now and something later."' }
          ]
        }
      ]
    },

    {
      id: 'shadow-diplomacy', topic: 'shadowdiplo', weight: 12,
      when: function (a) { return a.tier() >= 10; },
      speaker: function (a) { return who(a, 'a foreign ambassador', ''); },
      where: 'A residence in a capital that is not yours',
      settleOn: 'intl',
      opening: function (a) {
        return 'It is not on either country\'s programme and there are no officials in the room. He pours the ' +
          'wine himself, which is the whole message.\n\n' +
          '"We take an interest in stability," he says, "and stability is usually a person."';
      },
      beats: [
        {
          q: '"So. If there were a difficulty at home — a constitutional difficulty, let us say — what would you ' +
             'want us to have already decided?"',
          answers: [
            { t: 'That the succession is constitutional, whoever it favours', mood: 3,
              run: function (a) {
                a.add('intl', RZ.range(8, 16)); a.add('stats.integrity', a.rng(2, 5));
                a.add('grassroots', -a.rng(2, 6));
              },
              reply: '"That is a principle rather than a request." He refills your glass. "Principles are harder ' +
                     'for us to help with and much harder for anybody to hold against you. Very well."' },
            { t: 'That your government would recognise mine within the week', mood: 2, tag: 'risk',
              run: function (a) {
                a.add('intl', RZ.range(10, 20)); a.add('security', a.rng(2, 6));
                a.add('stats.integrity', -a.rng(2, 6)); a.add('grassroots', -a.rng(3, 8));
                a.dirt('foreignbacking', 'A foreign government sounded out about recognition before any vacancy existed', 3);
              },
              reply: '"Within the week." He writes nothing down, because men in his position never do. ' +
                     '"You understand that a conversation like this has now happened, and cannot un-happen."' },
            { t: 'Nothing. I did not come here for that', mood: 0,
              run: function (a) {
                a.add('intl', a.rng(3, 8)); a.add('stats.integrity', a.rng(2, 5));
              },
              reply: '"Then we will talk about the corridor and the tariff schedule," he says smoothly, ' +
                     '"and both of us will remember that the other question was asked."' }
          ]
        },
        {
          q: '"And in return." He says it lightly, the way it is always said. "There is a vote at the United ' +
             'Nations in November that matters a great deal to us and not at all to you."',
          answers: [
            { t: 'I will look at it on the merits, like everything else', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('intl', -a.rng(0, 4)); },
              reply: '"On the merits." He accepts it without visible disappointment, which means he expected ' +
                     'it and has already decided how much less you are worth.' },
            { t: 'You have the vote. It costs my country nothing', mood: 2, tag: 'risk',
              run: function (a) { a.add('intl', RZ.range(4, 10)); a.add('stats.integrity', -a.rng(2, 6)); a.S.flags.tradedVote = true; },
              reply: '"It costs your country nothing today." He is scrupulously honest about this, which is ' +
                     'the most alarming thing he has said all evening.' },
            { t: 'Ask him what he would do with it, and listen properly', mood: 3,
              run: function (a) { a.add('stats.intellect', a.rng(.5, 1.5)); a.add('intl', a.rng(3, 8)); a.add('stats.cunning', a.rng(.4, 1.2)); },
              reply: 'He tells you, at some length, and by the end of it you understand his government better ' +
                     'than any briefing has ever managed and you have promised nothing at all.' }
          ]
        }
      ]
    },

    {
      id: 'ssa-file', topic: 'ssa', weight: 12,
      when: function (a) { return a.isPresident(); },
      speaker: function (a) { return who(a, 'the Director-General', 'the intelligence service'); },
      where: 'A room in the residence with no windows',
      settleOn: 'security',
      opening: function (a) {
        return 'He brings nothing with him, ever. Whatever he is going to tell you he has already memorised, ' +
          'which is a habit that took him thirty years to acquire and which you find you do not like.\n\n' +
          '"You asked me about a name," he says.';
      },
      beats: [
        {
          q: '"We can establish things about anybody. I want to be clear about what you are instructing, and I ' +
             'want you to be the one who says it."',
          answers: [
            { t: 'Establish it. I am instructing you', mood: 3, tag: 'risk',
              run: function (a) {
                a.digOnRival(); a.digOnRival();
                a.add('security', a.rng(2, 6)); a.add('stats.integrity', -RZ.range(6, 12));
                a.nation('judiciary', -a.rng(1, 4));
                if (a.chance(0.35)) {
                  a.dirt('ssa', 'The intelligence service turned on a domestic political rival, on your instruction', 4);
                  a.nation('unrest', a.rng(3, 9)); a.add('intl', -a.rng(4, 10));
                }
              },
              reply: '"On your instruction." He repeats it back exactly, which is how you learn that somebody ' +
                     'in this room is keeping a record and it is not you.' },
            { t: 'Only what is already lawfully held. Nothing new', mood: 1,
              run: function (a) {
                if (a.chance(0.4)) a.digOnRival();
                a.add('stats.integrity', a.rng(2, 5)); a.add('security', -a.rng(0, 3));
              },
              reply: '"Lawfully held." He looks at you with something that might be respect and might be pity. ' +
                     '"There is less of that than you would hope, Your Excellency."' },
            { t: 'Nothing. And I want that minuted', mood: -1,
              run: function (a) {
                a.add('stats.integrity', RZ.range(4, 9)); a.add('intl', a.rng(2, 6));
                a.add('security', -RZ.range(3, 9)); a.nation('judiciary', a.rng(1, 4));
              },
              reply: '"Minuted." He allows himself the smallest pause. "You are the first one to ask for that. ' +
                     'I will do it, and I will keep my own copy, as I did for the others."' }
          ]
        },
        {
          q: '"And afterwards." He has not moved. "The file. Does it go into the registry, or does it go ' +
             'to you, or does it go nowhere?"',
          answers: [
            { t: 'The registry. Properly, with a number', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(3, 7)); a.nation('judiciary', a.rng(1, 4)); a.add('security', -a.rng(0, 3)); },
              reply: '"With a number." Something in him relaxes very slightly. "Then it can be found by a ' +
                     'commission one day, which is the only reason any of this is survivable."' },
            { t: 'To me. Nowhere else', mood: 1, tag: 'risk',
              run: function (a) { a.add('capital', a.rng(3, 8)); a.add('stats.cunning', a.rng(.5, 1.5)); a.add('stats.integrity', -a.rng(2, 5)); if (a.chance(0.3)) a.dirt('privatefile', 'An intelligence file held personally rather than registered', 3); },
              reply: '"To you." He does not blink. "Then there is one copy, Your Excellency, and there has ' +
                     'never in my thirty years been one copy of anything."' },
            { t: 'Nowhere. It never existed', mood: -1, tag: 'risk',
              run: function (a) { a.nation('judiciary', -a.rng(2, 6)); a.add('stats.integrity', -a.rng(3, 8)); a.add('security', a.rng(1, 5)); },
              reply: '"Nowhere." He says it flatly. "I will destroy it in front of a witness, because a thing ' +
                     'destroyed without a witness has not been destroyed. That witness will remember your name."' }
          ]
        }
      ]
    },

    {
      id: 'delegates-broker', topic: 'delegates', weight: 12,
      speaker: function (a) { return who(a, 'a branch organiser', ''); },
      where: 'A car park behind a hotel, engine running',
      settleOn: 'party',
      opening: function (a) {
        return '"I can deliver forty delegates. I am not going to insult you by pretending they come for free, ' +
          'and you are not going to insult me by pretending you did not know that."';
      },
      beats: [
        {
          q: function (a) { return '"So. Transport and regalia, or transport, regalia and something in the envelope?"'; },
          answers: [
            { t: 'Transport and regalia. Nothing in an envelope.', mood: 0,
              run: function (a) { a.add('money', -a.wage(3)); a.add('party', a.rng(2, 4)); a.add('stats.integrity', a.rng(1, 3)); a.spendOnDelegates(a.rng(3, 6)); },
              reply: '"Then I deliver maybe twenty-five." He shrugs. "I am telling you the truth, which is also free."' },
            { t: 'Whatever it takes. Do not tell me the details.', mood: 2,
              run: function (a) { a.add('money', -a.wage(8)); a.add('party', a.rng(5, 9)); a.spendOnDelegates(a.rng(8, 14)); a.add('stats.integrity', -a.rng(2, 5)); a.dirt('delegates', 'Cash moved through a branch organiser you chose not to question', 2); },
              reply: '"You will not hear the details." He is already dialling. "That is what you are paying for."' },
            { t: 'I am not doing this. Deliver them on the argument or not at all.', mood: -2,
              run: function (a) { a.add('party', -a.rng(1, 4)); a.add('stats.integrity', a.rng(3, 5)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"On the argument." He puts the car in gear. "Good luck. I mean that, and it will not be enough."' }
          ]
        },
        {
          q: '"One more thing, and then I have to drive. The other side came to me on Tuesday ' +
             'with a bigger number. Why should I take yours?"',
          answers: [
            { t: 'Because I will still be here in five years and they will not.', mood: 2,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(.5, 1.5)); },
              reply: '"That is a long-term argument in a short-term business." He thinks. "It has worked on me before."' },
            { t: 'You should not, if it is only about the number. Take theirs.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(0, 3)); a.add('grassroots', a.rng(1, 3)); },
              reply: 'He turns the engine off. "Now why did you go and say that." He is annoyed, and he is still here.' },
            { t: 'Match it. Whatever they offered, add a quarter.', mood: 2, tag: 'cost',
              when: function (a) { return a.P.money > a.wage(6); },
              run: function (a) { a.add('money', -a.wage(6)); a.add('party', a.rng(4, 8)); a.spendOnDelegates(a.rng(6, 11)); a.add('stats.integrity', -a.rng(2, 4)); },
              reply: '"A quarter." He writes nothing down, which is the point. "Then we are agreed and we never met."' }
          ]
        }
      ]
    },


    /* ==================== THE ORDER PAPER ==================== */
    // The whips' count is a room, not a number. Three men who have done this
    // for twenty years telling you what your own side is actually going to do.
    {
      id: 'bill-count', topic: 'billcount', weight: 12,
      when: function (a) { return !!a.S.bill; },
      speaker: function (a) { return who(a, 'Chief Whip', 'the parliamentary caucus'); },
      where: 'The whips’ office, after the House rises',
      settleOn: 'party',
      opening: function (a) {
        var t = RZ.bill.count(a.S);
        // You have now seen the list, whether the meeting goes well or not.
        a.S.bill.counted = true;
        return 'Three of them and one list, gone through name by name since six. He turns it round so ' +
          'you can see it. "' + t.yes + '. You need ' + t.needed + '. ' +
          (t.short ? 'And four of the names in that column will not look me in the eye."' :
                     'Which is a number I have watched evaporate on a Thursday afternoon before."');
      },
      beats: [
        {
          q: function (a) {
            var t = RZ.bill.count(a.S);
            return '"Before we go further. Whose bill is this? Because the caucus thinks it is yours, and a bill ' +
              'that is one member’s is a bill the party can let fail without anybody being blamed. ' +
              (t.short ? 'You are ' + t.short + ' short and you are short alone."' : 'You are barely over and you are over alone."');
          },
          answers: [
            { t: 'It is the party’s bill. Put it in the caucus statement.', mood: 3, tag: 'cost',
              when: function (a) { return a.P.capital >= 6; },
              run: function (a) {
                a.add('capital', -a.rng(5, 10)); a.add('party', a.rng(3, 7)); a.add('fame', -a.rng(1, 4));
                var b = a.S.bill; if (b) b.blocs.forEach(function (x) { if (x.id === 'loyal') x.lean = RZ.clamp(x.lean + RZ.range(10, 22), -95, 95); });
                a.remember('You let me put the party\u2019s name on your bill', 'good');
              },
              reply: '"Then it is the party’s bill and the party’s win, and your name is in paragraph four." ' +
                     'He makes a mark against eleven names on the loyal side without being asked.' },
            { t: 'It is mine. That is the whole point of it.', mood: -1,
              run: function (a) {
                a.add('fame', a.rng(3, 7)); a.add('stats.integrity', a.rng(1, 3)); a.add('party', -a.rng(2, 5));
                a.remember('You wanted your own name on it and you got it', 'flat');
              },
              reply: '"Then it is yours on the way down as well." He does not say it unkindly. He says it the ' +
                     'way a man says a thing he has watched happen four times.' },
            { t: 'It is the leader’s bill. He simply has not been told yet.', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('leader', -a.rng(1, 5)); a.dirt('billclaim', 'Claimed the leader’s backing for a bill he never saw', 3); },
              reply: 'The youngest of the three looks up sharply. The Chief Whip does not. "I will not correct ' +
                     'anybody who repeats that," he says, "and I will not have said it."' }
          ]
        },
        {
          q: '"Now the part you will not like. There are nine members who will vote for anything if their ' +
             'constituency office gets its establishment back. Nine is usually the whole argument. Do I go and see them?"',
          answers: [
            { t: 'Go and see them. Whatever the nine want, find it', mood: 2, tag: 'cost',
              when: function (a) { return a.P.capital >= 10; },
              run: function (a) {
                a.add('capital', -a.rng(10, 18));
                var b = a.S.bill;
                if (b) { var open = b.blocs.filter(function (x) { return !x.pledged; }); if (open.length) { var pick = RZ.pick(open); pick.lean = RZ.clamp(pick.lean + RZ.range(14, 26), -95, 95); if (pick.lean > 55) { pick.pledged = true; pick.how = 'capital'; } } }
                a.add('stats.integrity', -a.rng(0, 2));
              },
              reply: '"Nine offices, nine establishments, and none of it in writing." He is already reaching for ' +
                     'the phone. "This is the part of the job nobody writes a book about."' },
            { t: 'No. If it needs nine bought men it does not deserve to pass', mood: 0,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(1, 4)); a.add('party', -a.rng(1, 4)); },
              reply: 'He puts the list face down. "That is a very good sentence. I will put it on your headstone ' +
                     'next to the bill."' },
            { t: 'See them, and make sure they know exactly who is paying', mood: 1,
              run: function (a) {
                a.add('capital', -a.rng(4, 9)); a.add('fame', a.rng(2, 5));
                var b = a.S.bill;
                if (b) { var open2 = b.blocs.filter(function (x) { return !x.pledged; }); if (open2.length) RZ.pick(open2).lean = RZ.clamp(RZ.pick(open2).lean + RZ.range(6, 14), -95, 95); }
                a.add('leader', -a.rng(0, 3));
              },
              reply: '"They will know." He sighs. "They will also tell people, and one of them will tell a ' +
                     'journalist, and you will have to decide whether you mind."' }
          ]
        }
      ]
    },

    // Summoned in the middle week: somebody who does not sit in the House and
    // has more at stake in the bill than most people who do.
    {
      id: 'bill-lobby', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'Director of Government Affairs', 'the chamber of industry'); },
      where: 'A private dining room, the bill open on the table',
      settleOn: 'business',
      opening: function (a) {
        var b = a.S.bill;
        return 'He has a copy of your bill with four clauses tabbed in yellow. "I have read it properly, which ' +
          'puts me ahead of most of the people voting on it. ' +
          (b ? 'Clause nine is the one that matters and you know it is."' : 'And I would like ten minutes."');
      },
      beats: [
        {
          q: function (a) {
            return '"Here is what I am authorised to say. Take clause nine out, and eleven members who take our ' +
              'calls will find they have always supported the rest of it. Leave it in, and we spend ' +
              money(a, 40) + ' explaining to the country why the bill will cost jobs. Neither of those is a threat. ' +
              'Both of them are Tuesday."';
          },
          answers: [
            { t: 'Take it out. I want the rest of the bill more than clause nine', mood: 3,
              run: function (a) {
                var b = a.S.bill;
                if (b) {
                  b.concessions++;
                  var open = b.blocs.filter(function (x) { return !x.pledged; });
                  if (open.length) { var pk = RZ.pick(open); pk.lean = RZ.clamp(pk.lean + RZ.range(30, 50), -95, 95); if (pk.lean > 45) { pk.pledged = true; pk.how = 'concession'; } }
                }
                a.add('business', a.rng(5, 11)); a.add('grassroots', -a.rng(2, 6));
              },
              reply: '"A sensible man." He closes the folder. "You will be told by your own side that you sold ' +
                     'something. What you sold was a clause that was never going to survive committee."' },
            { t: 'Clause nine is the bill. Spend your money.', mood: -3,
              run: function (a) {
                a.add('business', -a.rng(8, 16)); a.add('grassroots', a.rng(4, 9));
                a.add('stats.integrity', a.rng(1, 4));
                var b = a.S.bill;
                if (b) b.blocs.forEach(function (x) { if (x.id === 'opp' && !x.pledged) x.lean = RZ.clamp(x.lean - RZ.range(4, 12), -95, 95); });
              },
              reply: 'He is not angry. He puts his card on the table anyway. "Then I will see you on the ' +
                     'television. Do keep this. The bill after this one might be one we agree about."' },
            { t: 'Make me an offer that has nothing to do with the bill', mood: 1, tag: 'dirty',
              run: function (a) {
                a.add('money', a.wage(a.rng(6, 16)));
                a.dirt('billmoney', 'Took money from an industry lobby during your own bill', 6);
                a.add('stats.integrity', -a.rng(3, 7));
                var b = a.S.bill;
                if (b) { var o2 = b.blocs.filter(function (x) { return !x.pledged; }); if (o2.length) { var q = RZ.pick(o2); q.lean = RZ.clamp(q.lean + RZ.range(10, 20), -95, 95); } }
              },
              reply: 'A very long pause, and then a small nod, as though you have finally said something he ' +
                     'recognised. "There is a foundation," he says. "It funds constituency work."' }
          ]
        },
        {
          q: '"One more thing, and it is genuinely a favour. When the vote comes, and it goes your way — say ' +
             'something civil about the industry from the floor. Not support. Civil. Can you do that?"',
          answers: [
            { t: 'Yes. It costs me nothing and it costs the bill nothing', mood: 2,
              run: function (a) { a.add('business', a.rng(3, 7)); a.add('grassroots', -a.rng(0, 3)); },
              reply: '"Thank you." He means it, which is somehow worse than if he had not.' },
            { t: 'No. They will read it as an arrangement, because it is one', mood: -1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('business', -a.rng(2, 6)); },
              reply: 'He shrugs on his coat. "You are new. It stops being a virtue somewhere around your ' +
                     'fourth term, and you will not notice the day it does."' },
            { t: 'I will say it, and I will say who asked me to', mood: 0,
              run: function (a) { a.add('media', a.rng(3, 8)); a.add('business', -a.rng(4, 9)); a.add('fame', a.rng(1, 4)); },
              reply: '"That is not a favour, that is an ambush with a delay on it." He almost laughs. "Do it. ' +
                     'It will be good for both of us and neither of us will admit that."' }
          ]
        }
      ]
    },

    // And the one from inside: the faction that shares your party card and
    // wants to know what the bill is really for.
    {
      id: 'bill-faction', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'convenor', 'the other faction in caucus'); },
      where: 'A corridor off the members’ lobby, nobody else within earshot',
      settleOn: 'party',
      opening: function (a) {
        return 'She does not sit down and she does not intend to be seen. "Sixty-nine of us. You have not asked ' +
          'a single one of us for anything, which means either you can count without us or you have not counted."';
      },
      beats: [
        {
          q: '"So ask. Properly, and in a corridor, because that is where these things are actually done. ' +
             'What are you offering sixty-nine people for a bill with your name on it?"',
          answers: [
            { t: 'Two of your people on the committee that implements it', mood: 3, tag: 'cost',
              when: function (a) { return a.P.capital >= 8; },
              run: function (a) {
                a.add('capital', -a.rng(8, 15));
                var b = a.S.bill;
                if (b) b.blocs.forEach(function (x) { if (x.id === 'faction') { x.lean = RZ.clamp(x.lean + RZ.range(22, 40), -95, 95); if (x.lean > 55) { x.pledged = true; x.how = 'capital'; } } });
                a.add('leader', -a.rng(1, 4));
              },
              reply: '"Two named ones, and I choose them." She is already walking. "Then you have sixty-nine ' +
                     'and you did not have to buy them one at a time."' },
            { t: 'Nothing. Vote for it because it is right, or explain why not', mood: -3,
              run: function (a) {
                a.add('stats.integrity', a.rng(2, 5)); a.add('party', -a.rng(3, 8));
                var b = a.S.bill;
                if (b) b.blocs.forEach(function (x) { if (x.id === 'faction' && !x.pledged) x.lean = RZ.clamp(x.lean - RZ.range(8, 18), -95, 95); });
              },
              reply: '"Because it is right." She repeats it back at exactly the speed required to make it sound ' +
                     'ridiculous, and goes to find somebody who wants to trade.' },
            { t: 'Your convenorship, protected, at the next provincial conference', mood: 2,
              run: function (a, convo) {
                a.add('leader', -a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3));
                var b = a.S.bill;
                if (b) b.blocs.forEach(function (x) { if (x.id === 'faction') { x.lean = RZ.clamp(x.lean + RZ.range(16, 32), -95, 95); if (x.lean > 55) { x.pledged = true; x.how = 'capital'; } } });
                a.owePatron(convo.speaker.name, RZ.irange(3, 6));
              },
              reply: 'She stops. "You are offering me something that is not yours to give." A beat. "Which is ' +
                     'the only kind of offer worth anything in this building. Yes."' }
          ]
        },
        {
          q: '"And afterwards? A bill that passes makes the man whose name is on it bigger. Some of us have ' +
             'to live with how much bigger. What happens to us when you are the one they are talking about?"',
          answers: [
            { t: 'Nothing happens to you. I do not need the whole caucus', mood: 2,
              run: function (a) { a.add('party', a.rng(2, 6)); a.add('stats.integrity', a.rng(0, 2)); },
              reply: '"People say that on the way up." She looks at you for a moment too long. "Almost nobody ' +
                     'is still saying it at the top of the stairs."' },
            { t: 'You get bigger with me, or you get nothing. Choose now', mood: -2,
              run: function (a) { a.add('leader', a.rng(2, 6)); a.add('party', -a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3)); },
              reply: '"There he is." She sounds almost relieved. "I was waiting for that one. At least now I ' +
                     'know what I am voting for."' },
            { t: 'Honestly? One of us ends this parliament without a seat', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', a.rng(0, 3)); a.makeRival(); },
              reply: 'A long silence in a corridor with very good acoustics. "Well," she says. "That is the ' +
                     'first true thing anybody has said to me this session."' }
          ]
        }
      ]
    },

    /* ==================== THE OTHER ONE ==================== */
    // The whole race in one room. They are not a villain and they are not a
    // friend; they are the person who wants the job you want, and there is
    // one of it.
    {
      id: 'the-other-one', topic: 'theother', weight: 14,
      when: function (a) { return !!(RZ.contender && RZ.contender.get(a.S) && !RZ.contender.get(a.S).ascended); },
      speaker: function (a) {
        var ct = RZ.contender.get(a.S);
        var sm = RZ.contender.summary(a.S);
        return { name: ct.name, role: sm.title, org: sm.sameParty ? 'the same party card as you' : sm.regionName };
      },
      where: 'A hotel breakfast room, both of you early, neither of you surprised',
      settleOn: 'party',
      opening: function (a) {
        var sm = RZ.contender.summary(a.S);
        return 'They see you before you see them and do not pretend otherwise. "' +
          (sm.gap > 0
            ? 'Sit down. I have been reading about you, which is more than most people in this room have done.'
            : sm.gap < 0
              ? 'Sit down. You are ahead of me. I am aware of the number and so are you.'
              : 'Sit down. We are exactly level, which neither of us finds comfortable.') + '"';
      },
      beats: [
        {
          q: function (a) {
            var sm = RZ.contender.summary(a.S);
            return '"Here is the arithmetic and then we can talk about the weather. There is one ' +
              cap(a.C.terms.hos) + '. There is one ' + cap(a.C.terms.leaderTitle) + '. We are the same age and we ' +
              'joined the same year and there are two of us. ' +
              (sm.relation === 'allied' ? 'We have been friendly. Friendly is not a plan.' :
               sm.relation === 'hostile' ? 'You have already decided what I am. Say it out loud.' :
               'So what is it going to be?') + '"';
          },
          answers: [
            { t: 'Run together. You take the deputy and I take the top', mood: 2,
              when: function (a) { return RZ.contender.canApproach(a.S); },
              run: function (a) {
                RZ.contender.ally(a.S, a);
                a.add('party', a.rng(2, 6));
              },
              reply: '"Deputy." They repeat it the way you repeat a price you have decided to pay. "For now, ' +
                     'and only because your grassroots numbers are better than mine and we both know why."' },
            { t: 'One of us is going to lose. I would rather it were said now', mood: -2,
              run: function (a) {
                RZ.contender.turnHostile(a.S);
                a.add('stats.integrity', a.rng(1, 3)); a.add('leader', a.rng(1, 4));
              },
              reply: '"Good." They fold the napkin. "I dislike the pretending far more than I dislike you. ' +
                     'Now at least we can both stop wasting Sundays."' },
            { t: 'There is no arithmetic. There is only who works harder', mood: 0,
              run: function (a) { a.add('grassroots', a.rng(1, 4)); a.add('health', -a.rng(1, 4)); },
              reply: '"That is the sort of thing people say in the second row." They are not being cruel. ' +
                     '"You will stop saying it. I stopped saying it in March."' }
          ]
        },
        {
          q: function (a) {
            var ct = RZ.contender.get(a.S);
            return '"Second thing, and then I have a car. ' +
              (ct.dirt.length
                ? 'You have been asking about me. I know because three people told me on the same afternoon, ' +
                  'which is how I know they are not really my people. What are you going to do with it?"'
                : 'People will bring you things about me. They will bring me things about you. ' +
                  'Do we use them, or do we agree not to?"');
          },
          answers: [
            { t: 'Nothing. It stays in a drawer and you know it is there', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('leader', a.rng(1, 3)); },
              reply: '"In a drawer." They almost smile. "That is worse than using it and you know that, which ' +
                     'is the first genuinely impressive thing you have done."' },
            { t: 'I will use it the day it is worth more than this conversation', mood: -1,
              run: function (a) {
                RZ.contender.turnHostile(a.S);
                a.add('media', a.rng(1, 4)); a.add('party', -a.rng(1, 4));
              },
              reply: '"Then so will I, and mine is better than yours." They stand. "Enjoy the rest of your breakfast."' },
            { t: 'Use it. Now, across this table, while you can answer it', mood: -3, tag: 'dirty',
              when: function (a) { var ct = RZ.contender.get(a.S); return !!(ct && ct.dirt.length); },
              run: function (a) { RZ.contender.spendFile(a.S, a); },
              reply: 'You say the name of the company and they stop with the cup halfway up. Two weeks later ' +
                     'it is a headline and their people are briefing that it is nothing. It is not nothing, ' +
                     'and it will never again be possible for either of you to be in a room alone.' }
          ]
        }
      ]
    },

    // Summoned the day they are sworn in. The ladder is finished and somebody
    // else is standing on the top of it.
    {
      id: 'contender-throne', topic: 'crisis', weight: 0,
      speaker: function (a) {
        var ct = RZ.contender.get(a.S);
        return { name: ct ? ct.name : 'The President', role: cap(a.C.terms.hos), org: a.C.capital };
      },
      where: 'The office at the end of the corridor, three days after the inauguration',
      settleOn: 'leader',
      opening: function (a) {
        return 'The room has been redecorated already, which tells you something about how long this was ' +
          'planned for. They do not get up. "You came. I did wonder whether you would make me send for you twice."';
      },
      beats: [
        {
          q: '"Let us do this properly. You wanted this office and you did not get it, and there is nothing ' +
             'either of us can do about that now. So: are you in my government, or are you in the country?"',
          answers: [
            { t: 'In your government. Give me something that matters', mood: 3,
              run: function (a) {
                a.add('leader', a.rng(6, 14)); a.add('party', a.rng(3, 8));
                a.add('stats.integrity', -a.rng(1, 4)); a.add('media', -a.rng(2, 6));
                a.S.flags.servingThem = true;
              },
              reply: '"Something that matters." They write one word down. "You will have it by Friday and you ' +
                     'will be photographed accepting it from me, and that photograph is the actual price."' },
            { t: 'In the country. I will oppose you from my own benches', mood: -3,
              run: function (a) {
                a.add('media', a.rng(6, 14)); a.add('grassroots', a.rng(4, 10));
                a.add('leader', -a.rng(8, 16)); a.add('party', -a.rng(4, 10));
                a.S.flags.opposingThem = true;
              },
              reply: '"From your own benches." They nod slowly. "Then I will not have you arrested, because ' +
                     'that is what people expect, and I would rather do the thing they do not expect."' },
            { t: 'Neither. I am going to take it off you', mood: -2,
              run: function (a) {
                a.add('leader', -a.rng(4, 10)); a.add('fame', a.rng(4, 9));
                a.add('stats.cunning', a.rng(1, 3));
                a.S.flags.opposingThem = true;
              },
              reply: 'The first genuine expression of the meeting crosses their face and it is delight. ' +
                     '"There you are," they say. "I was worried you had stopped."' }
          ]
        },
        {
          q: '"One more thing, and it is the only part of this I have thought about properly. Twenty years ago ' +
             'we were both nobody. Do you remember what you wanted it for? Because I have stopped being able to."',
          answers: [
            { t: 'Yes. And I am going to be the one who remembers for both of us', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('grassroots', a.rng(2, 6)); a.legacyMark('rememberedWhy'); },
              reply: 'A very long pause in a room that has just been repainted. "Then write it down somewhere," ' +
                     'they say. "Mine is in a drawer in a house I do not live in any more."' },
            { t: 'No. Neither of us has for a very long time', mood: 1,
              run: function (a) { a.add('stats.integrity', -a.rng(1, 3)); a.add('leader', a.rng(2, 6)); },
              reply: '"No." They seem relieved rather than disappointed. "Good. It is much easier to work with ' +
                     'people who have stopped."' },
            { t: 'I wanted your job. That has not changed since I was nineteen', mood: 0,
              run: function (a) { a.add('fame', a.rng(2, 6)); a.add('leader', -a.rng(1, 4)); a.add('stats.cunning', a.rng(.5, 2)); },
              reply: '"At least it is honest." They stand, finally, and walk you to a door they now own. ' +
                     '"Most people lie about that one and I have never understood why."' }
          ]
        }
      ]
    },

    /* ==================== A BLOC THAT HAS HAD ENOUGH ==================== */
    // Summoned when one of the six has decided you are not on their side. Who
    // walks through the door depends entirely on which one it is, and every
    // answer is somebody else's loss.
    {
      id: 'bloc-deputation', topic: 'crisis', weight: 0,
      speaker: function (a) {
        var id = a.S.flags.blocAngryWho || 'rural';
        var who_ = {
          rural: ['chairperson', 'the smallholders’ association'],
          youth: ['convenor', 'a movement with no office and forty thousand members'],
          labour: ['shop steward', 'the joint federations'],
          traders: ['chairlady', 'the market committee'],
          chiefs: ['senior councillor', 'the council of chiefs'],
          middle: ['chair', 'the ratepayers’ association']
        }[id] || ['chairperson', 'a delegation'];
        return who(a, who_[0], who_[1]);
      },
      where: 'Your constituency office, and they did not telephone first',
      settleOn: 'grassroots',
      opening: function (a) {
        var id = a.S.flags.blocAngryWho || 'rural';
        var b = RZ.blocs.byId[id];
        var pct = Math.round((RZ.blocs.get(a.S, id) || {}).size || 0);
        return 'They have come in a hired minibus and they have brought a list. "' +
          {
            rural: 'The inputs did not arrive and the road is a river again and we have stopped waiting.',
            youth: 'Half the people in this room have never had a job. Not a bad job. Any job.',
            labour: 'Our members have taken a real-terms cut for four years and been thanked for it four times.',
            traders: 'The by-law officers came again on Tuesday and took the stock, and we know who they work for.',
            chiefs: 'You have not been to the chiefdom since the campaign. We noticed. Everybody noticed.',
            middle: 'The rates went up, the lights go off, and the schools our children go to are ours to pay for twice.'
          }[id] + '" ' + pct + ' per cent of this ' + a.t.constituency + ' is ' + b.name.toLowerCase() +
          ', and none of that ' + pct + ' per cent is currently yours.';
      },
      beats: [
        {
          q: function (a) {
            var id = a.S.flags.blocAngryWho || 'rural';
            return '"So say it plainly, in front of everybody, and we will write it down. Are you ours, or are ' +
              'you theirs? Because you cannot be both and you have been trying to be both since ' +
              (a.S.date.year - 1) + '."';
          },
          answers: [
            { t: 'Yours. Say what you need and I will go and fight for it', mood: 3, tag: 'promise',
              run: function (a) {
                var id = a.S.flags.blocAngryWho || 'rural';
                var d = {}; d[id] = RZ.range(16, 26);
                // Everything is a trade. Choosing them is choosing against the
                // two blocs whose money would have paid for it.
                var others = RZ.blocs.BLOCS.filter(function (x) { return x.id !== id; });
                var hit = RZ.pick(others), hit2 = RZ.pick(others);
                d[hit.id] = -RZ.range(4, 10);
                if (hit2.id !== hit.id) d[hit2.id] = -RZ.range(3, 8);
                a.blocs(d);
                a.promise('bloc-' + id, 'What you promised ' + RZ.blocs.byId[id].name.toLowerCase() +
                  ' in front of a room', { due: 8 });
                a.add('capital', -a.rng(3, 8));
                a.remember('You said you were ours, in front of everybody', 'promise');
              },
              reply: 'They write it down and they read it back to you and they make you say yes to the read-back. ' +
                     'That is not a conversation any more. That is a document.' },
            { t: 'Not only yours. I represent everybody in this ' + 'constituency', mood: -1,
              run: function (a) {
                var id = a.S.flags.blocAngryWho || 'rural';
                var d = {}; d[id] = -RZ.range(3, 9);
                a.blocs(d);
                a.add('stats.integrity', a.rng(1, 4)); a.add('media', a.rng(1, 4));
                a.remember('You said you represented everybody, which meant no', 'bad');
              },
              reply: '"Everybody." The chairperson closes the file. "Everybody is what people say when the ' +
                     'answer is no. We are not angry. We are just going to stop coming."' },
            { t: 'Give me two years. I cannot deliver this from where I am', mood: 1,
              run: function (a) {
                var id = a.S.flags.blocAngryWho || 'rural';
                var d = {}; d[id] = RZ.range(3, 9);
                a.blocs(d);
                a.add('party', a.rng(1, 4));
                a.promise('bloc-' + id + '-later', 'Two years, you told them, and they wrote the date down', { due: 24 });
              },
              reply: '"Two years." Somebody at the back does the arithmetic out loud and arrives at the next ' +
                     'election, which is exactly what you were hoping nobody would do.' }
          ]
        },
        {
          q: '"And the other question, which is the one we actually came about. When the money comes — and ' +
             'some money always comes — does it come here first, or does it come here last?"',
          answers: [
            { t: 'First. And I will be photographed saying so', mood: 3, tag: 'cost',
              run: function (a) {
                var id = a.S.flags.blocAngryWho || 'rural';
                var d = {}; d[id] = RZ.range(8, 15);
                RZ.blocs.BLOCS.forEach(function (x) { if (x.id !== id) d[x.id] = -RZ.range(1, 5); });
                a.blocs(d);
                a.add('fame', a.rng(2, 5)); a.add('leader', -a.rng(1, 5));
              },
              reply: 'Photographs are taken. One of them will be printed next to a story about a road that ' +
                     'has not been built, in about three years, and you will remember this room.' },
            { t: 'Where it is needed most. Sometimes that will be you', mood: 0,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', a.rng(1, 3)); },
              reply: '"Sometimes." They nod, unimpressed and not insulted, which is roughly what you deserve.' },
            { t: 'Wherever it buys the most votes. I am being honest with you', mood: -2,
              run: function (a) {
                var id = a.S.flags.blocAngryWho || 'rural';
                var d = {}; d[id] = -RZ.range(2, 8);
                a.blocs(d);
                a.add('stats.integrity', a.rng(3, 6)); a.add('stats.cunning', a.rng(1, 3));
                a.add('media', -a.rng(1, 4));
              },
              reply: 'A long silence, and then the chairperson laughs once, without any warmth in it. ' +
                     '"Then we had better become worth more votes."' }
          ]
        }
      ]
    },

    /* ==================== THE FUNERAL ==================== */
    {
      id: 'funeral-programme', topic: 'funerals', weight: 12,
      speaker: function (a) { return who(a, 'the eldest son of the deceased', ''); },
      where: 'A yard under a tent, the morning of the burial',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'He is not crying. He has been organising since Tuesday and there is no room left in him for it. ' +
          '"They put you on the programme. Item eleven. My mother did not know you."';
      },
      beats: [
        {
          q: '"So what are you going to stand up and say about a woman you never met?"',
          answers: [
            { t: 'Nothing about her. I will read the message from the party and sit down.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Thank you." He looks at you properly for the first time. "The last one spoke for twenty minutes about himself."' },
            { t: 'Tell me about her now and I will say it as though I knew.', mood: 0,
              run: function (a) { a.add('grassroots', a.rng(1, 4)); a.add('stats.charisma', a.rng(.5, 1.5)); },
              reply: 'He talks for four minutes. You will use all of it, and he will know you are using it, and it will still be better than nothing.' },
            { t: 'I will speak about what this ward needs. She would have wanted that.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(4, 8)); a.add('fame', a.rng(0, 2)); a.dirt('funeralspeech', 'A campaign speech delivered over an open grave', 1); },
              reply: '"You do not know what she would have wanted." He walks off to deal with the chairs.' }
          ]
        },
        {
          q: function (a) {
            return '"Second thing. The burial society is ' + money(a, 2) + ' short and the tent people want cash today. ' +
              'People are looking at you because of what you are."';
          },
          answers: [
            { t: 'Cover it. Quietly, through the society, not from me.', mood: 3, tag: 'cost',
              when: function (a) { return a.P.money > a.wage(2); },
              run: function (a) { a.add('money', -a.wage(2)); a.add('grassroots', a.rng(4, 8)); a.add('capital', a.rng(1, 2)); },
              reply: '"Through the society." He nods slowly. "Then nobody has to thank you in public. That is the correct way."' },
            { t: 'I will pay it, and I would like that mentioned from the front.', mood: -1,
              when: function (a) { return a.P.money > a.wage(2); },
              run: function (a) { a.add('money', -a.wage(2)); a.add('grassroots', a.rng(1, 3)); a.add('fame', a.rng(1, 3)); a.add('stats.integrity', -a.rng(1, 3)); },
              reply: '"It will be mentioned." His voice does not change. It is mentioned. Everybody hears exactly what it was.' },
            { t: 'I cannot. I will find someone by this afternoon who can.', mood: 1,
              run: function (a) { var ok = a.roll('charisma', 46); a.add('grassroots', ok ? a.rng(2, 4) : -a.rng(1, 4)); a.add('business', ok ? a.rng(1, 3) : 0); },
              reply: '"By this afternoon." He has heard that sentence at four funerals this year, and he is going to hope anyway.' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'You carried a corner of the coffin, which nobody asked you to do and everybody saw.',
          fair: 'You spoke for ninety seconds and sat down, and afterwards three people you did not know shook your hand.',
          cool: 'You were thanked from the front in the same sentence as the tent hire company.',
          hostile: 'The programme ran long and item eleven was quietly dropped.'
        }[temp];
      }
    },

    /* ==================== THE HOUSE ==================== */
    {
      id: 'house-whip', topic: 'parliament', weight: 12,
      speaker: function (a) { return who(a, 'the Chief Whip', ''); },
      where: 'The whips’ office, ten minutes before division',
      settleOn: 'party',
      opening: function (a) {
        return 'The list is on the desk, face up, so you can see your own name on it. ' +
          '"You have read the bill. I know you have read the bill, because you are the only one who does."';
      },
      beats: [
        {
          q: function (a) {
            return '"Clause nine is indefensible and we are voting for it anyway. Are you in the lobby with us, or are you going to be principled at me?"';
          },
          answers: [
            { t: 'I am in the lobby. Clause nine is not worth a career.', mood: 3,
              run: function (a) { a.add('party', a.rng(4, 8)); a.add('leader', a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3)); },
              reply: '"Good." He ticks you off without looking. "That is the answer of somebody who intends to still be here in ten years."' },
            { t: 'I will abstain, and I will not brief anybody about why.', mood: 0,
              run: function (a) { a.add('party', -a.rng(1, 3)); a.add('stats.integrity', a.rng(1, 3)); a.add('media', a.rng(0, 2)); },
              reply: '"An abstention." He writes something that is not a tick. "You have bought yourself a conscience at the going rate."' },
            { t: 'I am voting against it and I will say why on the floor.', mood: -3,
              run: function (a) { a.add('party', -a.rng(6, 12)); a.add('leader', -a.rng(4, 9)); a.add('media', a.rng(4, 9)); a.add('fame', a.rng(2, 5)); a.add('stats.integrity', a.rng(3, 6)); a.makeRival(); },
              reply: '"Then say it well." He finally looks up. "Because it is the last speech you will make from that bench."' }
          ]
        },
        {
          q: '"While you are here. The committee chair is coming vacant. It is a small thing that becomes a big thing. Do you want it?"',
          answers: [
            { t: 'Yes. And I will run it properly, which you may regret.', mood: 2,
              run: function (a) { a.add('party', a.rng(3, 6)); a.add('leader', a.rng(1, 4)); a.add('fame', a.rng(2, 5)); a.add('stats.intellect', a.rng(1, 2)); },
              reply: '"Properly." He almost smiles. "Everybody says that in this office and nobody has yet done it."' },
            { t: 'Yes, and I will run it the way you need it run.', mood: 3,
              run: function (a) { a.add('party', a.rng(5, 9)); a.add('leader', a.rng(3, 7)); a.add('stats.integrity', -a.rng(2, 4)); a.dirt('committee', 'A committee chaired to protect the executive from its own hearings', 2); },
              reply: '"Now that," he says, "is a useful answer." The word useful is doing a great deal of work.' },
            { t: 'No. Give it to somebody who needs the allowance.', mood: 1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('grassroots', a.rng(1, 3)); a.recruitAlly(); },
              reply: '"I will tell them it was your idea." He will. It will be worth more to you than the chair would have been.' }
          ]
        }
      ]
    },

    /* ==================== THE LIST ==================== */
    {
      id: 'list-committee', topic: 'lobbyList', weight: 14,
      speaker: function (a) { return who(a, 'the chair of the list committee', ''); },
      where: 'A boardroom with the blinds down',
      settleOn: 'party',
      opening: function (a) {
        var meth = a.C.house.method;
        return '"You understand how this works. There is no ward, there is no voter, there is this table. ' +
          (meth === 'pr' || meth === 'mmp'
            ? 'Your name goes at a number, and the number is the whole of your career."'
            : 'We rank the nominees before the branches ever see them, and the branches see what we send them."');
      },
      beats: [
        {
          q: '"Make the case. Not the speech — the case. Why does your name go above the person currently above it?"',
          answers: [
            { t: 'Because I deliver a region you cannot afford to lose.', mood: 2,
              run: function (a) { a.add('party', a.rng(3, 6)); a.addRegion(a.P.regionId, a.rng(2, 5)); },
              reply: '"Numbers." She turns a page. "Numbers are at least checkable, which is more than most people bring."' },
            { t: 'Because I have never once embarrassed this party in public.', mood: 0,
              run: function (a) {
                var clean = a.P.dirt.filter(function (d) { return d.exposed; }).length === 0;
                a.add('party', clean ? a.rng(3, 7) : -a.rng(2, 6));
                a.add('stats.integrity', clean ? a.rng(0, 2) : 0);
              },
              reply: '"Let us see." She has a folder. Everybody at this table has a folder about everybody else at this table.' },
            { t: 'Because you owe me, and we both know for what.', mood: -2,
              run: function (a) { a.add('party', -a.rng(2, 6)); a.add('leader', -a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 2)); a.dirt('listthreat', 'A list place demanded rather than argued for, in front of witnesses', 2); },
              reply: 'The room goes quiet in the particular way a room goes quiet when somebody says the true thing out loud.' }
          ]
        },
        {
          q: function (a) {
            return '"There is a young woman from ' + a.esc(a.homeName()) + ' at forty-one on the draft. She is better than you and she has no structures. What happens to her?"';
          },
          answers: [
            { t: 'Move her up. I will take the lower number.', mood: 3,
              run: function (a) { a.add('party', -a.rng(0, 3)); a.add('grassroots', a.rng(4, 8)); a.add('stats.integrity', a.rng(3, 6)); a.recruitAlly(); a.legacyMark('madeWay'); },
              reply: '"You are the first person to say that in eleven years of me asking it." She writes it down. She writes down who says it.' },
            { t: 'Leave her at forty-one. She has time. I do not.', mood: 0,
              run: function (a) { a.add('party', a.rng(1, 3)); a.add('stats.integrity', -a.rng(0, 2)); },
              reply: '"She has time." A small nod. "Everybody at forty-one has time until the list is published."' },
            { t: 'Take her off. I do not want somebody better behind me.', mood: -3,
              run: function (a) { a.add('party', -a.rng(3, 7)); a.add('stats.cunning', a.rng(1, 3)); a.add('stats.integrity', -a.rng(4, 8)); a.makeRival(); a.dirt('blockedher', 'A candidate removed from a list for being too good', 2); },
              reply: '"Off." She writes that down too. In this room, honesty of that kind is not rewarded. It is filed.' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'The draft list circulated on Friday. You had moved up nine places and nobody has explained why.',
          fair: 'You held your number. In a list conference, holding your number is a win nobody congratulates you for.',
          cool: 'You dropped four places, which is survivable, and everybody who matters noticed.',
          hostile: 'You are on the list. You are on the part of the list that gets read out at the end, quickly.'
        }[temp];
      }
    },

    /* ==================== THE TENDER BOARD ==================== */
    {
      id: 'tender-board', topic: 'tender', weight: 12,
      speaker: function (a) { return who(a, 'a procurement officer', 'the evaluation committee'); },
      where: 'A meeting room with the bid documents still sealed',
      settleOn: 'business',
      opening: function (a) {
        return 'She has worked here for nineteen years and has watched eleven ministers come through that door. ' +
          '"Before you say anything, Honourable — I am going to write down what you ask me for. I always do."';
      },
      beats: [
        {
          q: '"So. What are you asking me for?"',
          answers: [
            { t: 'Nothing. I came to see how the evaluation works, and I will leave.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('stats.intellect', a.rng(1, 2)); a.add('business', -a.rng(0, 2)); },
              reply: '"Then I will write that down as well." For the first time in nineteen years she has to write something new.' },
            { t: 'Score the local bidder fairly. Just fairly. That is all.', mood: 1,
              run: function (a) { a.add('business', a.rng(2, 5)); a.addRegion(a.P.regionId, a.rng(1, 4)); a.add('stats.integrity', -a.rng(0, 2)); },
              reply: '"Fairly." She writes it. "I will note that you asked for fairly, and not for a name."' },
            { t: 'There is a company. I would like it to win.', mood: -3, tag: 'risk',
              run: function (a) {
                a.add('money', a.wage(a.rng(8, 22))); a.add('business', a.rng(4, 9));
                a.add('stats.integrity', -a.rng(4, 8));
                a.dirt('tenderfix', 'A tender directed to a named company in front of a procurement officer who keeps notes', 4);
              },
              reply: 'She writes down the name. She writes down the date, the time, and that you were alone.' }
          ]
        },
        {
          q: '"May I say something out of turn? The last three people who sat there are all still in Cabinet. The two who said no to them are not still in this building."',
          answers: [
            { t: 'Then you are transferred to my office, on the same pay, starting Monday.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(0, 3)); a.recruitAlly(); a.legacyMark('protectedOfficial'); },
              reply: 'She takes a long moment. "People have offered to protect me before. Nobody has ever done it on a Tuesday."' },
            { t: 'I cannot protect you. I can promise not to be the one who moves you.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('business', -a.rng(0, 2)); },
              reply: '"That is a smaller promise than the other one and I believe it more."' },
            { t: 'Then perhaps do not say things out of turn.', mood: -3,
              run: function (a) { a.add('security', a.rng(1, 3)); a.add('stats.integrity', -a.rng(2, 5)); a.nation('corruption', a.rng(.4, 1.4)); },
              reply: 'She closes the file. "Understood, Honourable." Nineteen years of notes are still in her drawer.' }
          ]
        }
      ]
    },

    /* ==================== POLICY ==================== */
    {
      id: 'policy-technocrat', topic: 'policy', weight: 12,
      speaker: function (a) { return who(a, 'a development economist', 'the national university'); },
      where: 'A seminar room with eleven people in it and a projector that will not focus',
      settleOn: 'media',
      opening: function (a) {
        return '"I have read your party’s framework document. All ninety pages. ' +
          'I have three questions and none of them are hostile, which you will find harder than hostile."';
      },
      beats: [
        {
          q: function (a) {
            return '"Your document promises to halve unemployment. It is at ' + unemployment(a) +
              '%. What is the mechanism? Not the aspiration — the mechanism."';
          },
          answers: [
            { t: 'There isn’t one. The document is a wish list and I helped write it.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.add('media', a.rng(3, 7)); a.add('party', -a.rng(3, 7)); a.add('stats.intellect', a.rng(1, 3)); },
              reply: 'Somebody at the back actually laughs. "Thank you. Now we can have a useful hour."' },
            { t: 'Public works, at scale, financed by borrowing we can service.', mood: 2,
              run: function (a) { a.add('stats.intellect', a.rng(2, 4)); a.add('media', a.rng(2, 5)); a.add('business', -a.rng(1, 4)); a.promise('jobs', 'A public works programme at a scale nobody has costed'); },
              reply: '"Servicing." He writes the word on the board and circles it. "That is the whole argument and you have at least found it."' },
            { t: 'Growth. Growth solves it. That is the mechanism.', mood: -2,
              run: function (a) { a.add('business', a.rng(2, 5)); a.add('media', -a.rng(2, 5)); a.add('stats.intellect', -a.rng(0, 2)); },
              reply: '"Growth." He does not write it on the board. "We have had growth for six years. Would you like to see the unemployment series?"' }
          ]
        },
        {
          q: '"Second question. If the modelling says your flagship policy will not work, do you want to be told?"',
          answers: [
            { t: 'Tell me in writing, and I will publish it either way.', mood: 3,
              run: function (a) { a.add('media', a.rng(4, 8)); a.add('intl', a.rng(2, 5)); a.add('stats.intellect', a.rng(1, 3)); a.legacyMark('publishedEvidence'); },
              reply: '"In writing." He looks at his colleagues. "Get it in writing, was the instruction, from a politician."' },
            { t: 'Tell me privately. I will decide what happens to it.', mood: 1,
              run: function (a) { a.add('stats.intellect', a.rng(1, 3)); a.add('media', a.rng(0, 2)); },
              reply: '"Privately." He nods. "That is the honest version of the usual answer, at least."' },
            { t: 'Tell me after the election. Not before.', mood: -3,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('media', -a.rng(3, 7)); a.add('intl', -a.rng(1, 4)); a.add('stats.integrity', -a.rng(2, 4)); },
              reply: 'He puts the cap back on the marker. That is the end of the seminar, whatever the programme says.' }
          ]
        }
      ]
    },

    /* ==================== THE DIASPORA ==================== */
    {
      id: 'diaspora-hall', topic: 'diaspora', weight: 12,
      speaker: function (a) { return who(a, 'a nurse who has been away eleven years', ''); },
      where: 'A hired hall with the heating on too high',
      settleOn: 'intl',
      opening: function (a) {
        return '"There are three hundred of us in this room and between us we send home more money every month ' +
          'than your ministry spends on clinics. We are not asking for a favour. We are asking a question."';
      },
      beats: [
        {
          q: '"Can we vote? Yes or no, and if no, say no."',
          answers: [
            { t: 'No. Your party has blocked it and I have voted for the block.', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.add('intl', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); },
              reply: 'The room makes a sound. "At least he came here to say it to our faces," somebody says, loudly enough.' },
            { t: 'Not yet. I will put my name to the bill and it will fail.', mood: 3,
              run: function (a) { a.add('intl', a.rng(4, 8)); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(2, 6)); a.promise('diasporavote', 'A bill to give the diaspora the vote'); },
              reply: '"It will fail." She nods. "Fine. Fail publicly and we will fund the next attempt."' },
            { t: 'It is under consideration at the highest level.', mood: -3,
              run: function (a) { a.add('intl', -a.rng(3, 7)); a.add('media', -a.rng(1, 4)); },
              reply: 'Three hundred people who left because of sentences like that one look at you.' }
          ]
        },
        {
          q: '"Then the other question. My brother is a doctor here. What is at home for him if he comes back?"',
          answers: [
            { t: 'Honestly? Less money, worse equipment, and work that matters.', mood: 3,
              run: function (a) { a.add('intl', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 4)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"That is the first recruitment pitch I have believed." She half-smiles. "Tell him yourself. He is at the back."' },
            { t: 'A post, a house and a car within ninety days. I will arrange it.', mood: 1,
              run: function (a) { a.add('intl', a.rng(2, 5)); a.add('fame', a.rng(1, 3)); a.promise('returnpost', 'A post, a house and a car within ninety days for a returning doctor'); },
              reply: '"Ninety days." She writes the date on the back of her hand, and she means it as a warning.' },
            { t: 'Frankly, nothing. Tell him to stay and keep sending money.', mood: -1,
              run: function (a) { a.add('intl', a.rng(0, 2)); a.add('stats.integrity', a.rng(1, 3)); a.add('grassroots', -a.rng(2, 5)); a.nation('health', -a.rng(0, 1)); },
              reply: 'She does not argue. That is worse than if she had.' }
          ]
        }
      ]
    },

    /* ==================== THE BOOK ==================== */
    {
      id: 'book-ghost', topic: 'book', weight: 12,
      speaker: function (a) { return who(a, 'a publisher', ''); },
      where: 'A hotel lounge, two coffees, one recorder on the table',
      settleOn: 'media',
      opening: function (a) {
        return '"Everybody in your position writes one of these and almost all of them are unreadable, ' +
          'because they are written to avoid a court case rather than to say anything. Which are we doing?"';
      },
      beats: [
        {
          q: function (a) {
            var d = a.worstDirt();
            return '"Start with the hard one. ' +
              (d ? 'There is a matter — ' + a.esc(d.label.toLowerCase()) + '. Is it in the book?"'
                 : 'There is nothing on your file, which readers will not believe. What do you give them instead?"');
          },
          answers: [
            { t: 'It goes in. My version, in full, before anybody else writes theirs.', mood: 3,
              run: function (a) {
                var d = a.worstDirt();
                if (d && !d.exposed) { a.exposeDirt(d.id); a.add('media', a.rng(5, 10)); a.add('stats.integrity', a.rng(3, 6)); }
                else { a.add('media', a.rng(3, 6)); a.add('stats.integrity', a.rng(1, 3)); }
                a.add('fame', a.rng(4, 9));
              },
              reply: '"Then we have a book." She turns the recorder round to face you. "Most people take three meetings to get there."' },
            { t: 'It stays out, and so does everything near it.', mood: 0,
              run: function (a) { a.add('fame', a.rng(2, 5)); a.add('media', -a.rng(0, 3)); a.add('money', a.wage(a.rng(2, 6))); },
              reply: '"Then it is a career summary with photographs." She shrugs. "Those sell too. To your own branches."' },
            { t: 'It goes in, and it happens to somebody else in the telling.', mood: -2,
              run: function (a) { a.add('fame', a.rng(3, 7)); a.add('stats.cunning', a.rng(1, 3)); a.add('stats.integrity', -a.rng(3, 6)); a.makeRival(); a.dirt('memoirlie', 'A memoir in which somebody else carries what you did', 3); },
              reply: '"I will need that lawyered." She writes a note. "And they will read it, and they will remember."' }
          ]
        },
        {
          q: '"Last thing. Who is this for — the country, the party, or the person who has to decide about you in five years?"',
          answers: [
            { t: 'The country. Even the parts that make me look small.', mood: 3,
              run: function (a) { a.add('media', a.rng(4, 8)); a.add('fame', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 5)); a.legacyMark('honestMemoir'); },
              reply: '"Then write it slowly." She means it as a compliment and as a warning.' },
            { t: 'The person deciding in five years. Obviously.', mood: 1,
              run: function (a) { a.add('leader', a.rng(3, 7)); a.add('party', a.rng(2, 5)); a.add('media', -a.rng(0, 3)); a.add('fame', a.rng(2, 4)); },
              reply: '"At least you know what you are doing." She has published nine of these. She knows what she is doing too.' },
            { t: 'The party. It will be launched at conference.', mood: 1,
              run: function (a) { a.add('party', a.rng(4, 8)); a.add('media', -a.rng(1, 4)); a.spendOnDelegates(a.rng(1, 4)); },
              reply: '"Then we print two thousand and the party buys eighteen hundred." That is the whole business model, said out loud.' }
          ]
        }
      ]
    },

    /* ==================== OPPOSITION RESEARCH ==================== */
    {
      id: 'oppo-investigator', topic: 'oppo', weight: 12,
      speaker: function (a) { return who(a, 'a former police detective', ''); },
      where: 'A parked car outside a shopping centre',
      settleOn: 'party',
      opening: function (a) {
        var r = a.aRival();
        return '"I have four pages on ' + (r ? '<strong>' + a.esc(r.name) + '</strong>' : 'your man') +
          '. Two of them are boring. One of them is a court record. And one of them is about a child."';
      },
      beats: [
        {
          q: '"Do you want all four pages, or three?"',
          answers: [
            { t: 'Three. Burn the fourth in front of me.', mood: 3,
              run: function (a) { var f = a.digOnRival(); a.add('stats.integrity', a.rng(3, 6)); a.add('party', a.rng(1, 3)); },
              reply: 'He does it with the car lighter, which takes an embarrassingly long time. "Most people say all four."' },
            { t: 'All four. I will decide later what I use.', mood: -1,
              run: function (a) { var f = a.digOnRival(); if (f) a.add('stats.cunning', a.rng(1, 3)); a.add('stats.integrity', -a.rng(2, 4)); },
              reply: '"Later." He hands over the envelope. "Nobody has ever decided later. They decide the night before a vote."' },
            { t: 'All four, and go back for a fifth.', mood: -3, tag: 'risk',
              run: function (a) {
                a.digOnRival(); a.add('money', -a.wage(4)); a.add('stats.cunning', a.rng(2, 4));
                a.add('stats.integrity', -a.rng(4, 7));
                if (a.chance(0.4)) a.dirt('investigator', 'A private investigator on retainer, and an invoice trail', 3);
              },
              reply: '"There is always a fifth." He is pleased. That should worry you more than it does.' }
          ]
        },
        {
          q: '"Question for you now. When they hire somebody like me to do the same to you — and they have — what will he find?"',
          answers: [
            { t: 'Nothing. And I intend to keep it that way.', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('media', a.rng(1, 3)); },
              reply: '"Nothing." He nods, entirely unconvinced, which is his professional condition.' },
            { t: 'Enough. Which is why I want to know first.', mood: 2,
              run: function (a) { var d = a.worstDirt(); a.add('stats.cunning', a.rng(1, 3)); a.add('capital', a.rng(1, 2)); if (d) a.add('media', a.rng(0, 2)); },
              reply: '"That is the correct answer." He starts the engine. "Frightened clients are careful clients."' },
            { t: 'Whatever he finds, he can be bought before he files it.', mood: -2,
              run: function (a) { a.add('money', -a.wage(3)); a.add('stats.cunning', a.rng(1, 3)); a.add('stats.integrity', -a.rng(2, 5)); a.dirt('bought', 'A researcher paid to stop researching', 2); },
              reply: '"Sometimes." He pulls out into traffic. "And sometimes he takes both payments."' }
          ]
        }
      ]
    },

    /* ==================== REHABILITATION ==================== */
    {
      id: 'rehab-bishop', topic: 'rehab', weight: 12,
      when: function (a) { return a.P.dirt.some(function (d) { return d.exposed; }); },
      speaker: function (a) { return who(a, 'a bishop', 'the council of churches'); },
      where: 'A vestry that smells of floor polish',
      settleOn: 'grassroots',
      opening: function (a) {
        var d = a.worstDirt();
        return '"They have asked me to sit with you before the service on Sunday. ' +
          'I have agreed, and I want to be clear that I have not agreed to stand next to you afterwards for the photograph."';
      },
      beats: [
        {
          q: function (a) {
            var d = a.worstDirt();
            return '"So. ' + (d ? a.esc(d.label) : 'The matter') + '. In this room, with nobody writing: did you do it?"';
          },
          answers: [
            { t: 'Yes. All of it, and worse than was reported.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(4, 8)); a.clearExposed(1); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); },
              reply: 'He is quiet for a while. "Then on Sunday you will say that, in those words, and I will stand next to you."' },
            { t: 'Some of it. The reporting was worse than the facts.', mood: 1,
              run: function (a) { var ok = a.roll('charisma', 50); a.add('media', ok ? a.rng(2, 5) : -a.rng(2, 5)); if (ok) a.clearExposed(1); },
              reply: '"Some of it." He has heard the arithmetic of some of it many times. "We will see how Sunday goes."' },
            { t: 'No. It was manufactured and you know by whom.', mood: -2,
              run: function (a) { a.add('media', -a.rng(2, 6)); a.add('stats.integrity', -a.rng(1, 4)); a.add('party', a.rng(0, 3)); },
              reply: '"I do not know by whom." He stands. "And I am not going to be the person who says it for you."' }
          ]
        },
        {
          q: '"What are you actually asking the congregation for — forgiveness, or a second term?"',
          answers: [
            { t: 'Forgiveness. The seat is a separate question and I will not raise it.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.add('stats.integrity', a.rng(2, 5)); a.add('fame', a.rng(1, 3)); },
              reply: '"Then come at nine, and sit at the back like everybody else who is asking for something."' },
            { t: 'Both. I am not going to pretend otherwise in a church.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3)); a.add('party', a.rng(0, 2)); },
              reply: 'He almost smiles. "That is at least an honest transaction. God has heard worse in here."' },
            { t: 'A second term. Let us not be sentimental about it.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 7)); a.add('media', -a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 2)); },
              reply: '"Then you do not need me." He opens the vestry door. "You need a rally, and you have confused the two."' }
          ]
        }
      ]
    },

    /* ==================== THE LAST WEEKEND ==================== */
    {
      id: 'campaign-manager', topic: 'campaign', weight: 12,
      when: function (a) { return a.isCampaignSeason(); },
      speaker: function (a) { return who(a, 'your campaign manager', ''); },
      where: 'A campaign office at eleven at night, out of coffee',
      settleOn: 'grassroots',
      opening: function (a) {
        return '"We have money for one more weekend and three places to spend it. ' +
          'I need a decision now, not in the morning, because the buses have to be booked tonight."';
      },
      beats: [
        {
          q: function (a) {
            return '"Option one: ' + a.esc(a.homeName()) + ', where we are already winning. Option two: the ward that hates us. ' +
              'Option three: the radio buy that reaches both and nobody remembers."';
          },
          answers: [
            { t: 'Home. Run the score up where they already love us.', mood: 1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(5, 10)); a.campaignEffort(a.rng(3, 6)); a.add('grassroots', a.rng(2, 5)); a.add('money', -a.wage(3)); },
              reply: '"Safe." She writes it down. "Safe wins seats and it does not win arguments."' },
            { t: 'The ward that hates us. Go and be shouted at.', mood: 3,
              run: function (a) { var ok = a.roll('grit', 48); a.campaignEffort(a.rng(4, 8)); a.add('media', ok ? a.rng(4, 8) : a.rng(1, 3)); a.add('grassroots', ok ? a.rng(3, 6) : -a.rng(1, 4)); a.add('money', -a.wage(4)); a.add('stats.grit', a.rng(1, 2)); },
              reply: '"Good." She is already on the phone. "Wear the old jacket. Not that one."' },
            { t: 'Radio. It is boring and it is the highest return.', mood: 1,
              run: function (a) { a.add('money', -a.wage(5)); a.add('fame', a.rng(3, 6)); a.add('media', a.rng(2, 5)); a.campaignEffort(a.rng(2, 5)); },
              reply: '"Boring and correct." She books it. "Nobody will thank you and the numbers will move."' }
          ]
        },
        {
          q: '"Second decision, and I want you to think before you answer. Do we go negative on them in the last forty-eight hours?"',
          answers: [
            { t: 'No. We finish on what we are for.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(2, 5)); a.campaignEffort(a.rng(1, 3)); },
              reply: '"Then I will write the closing script tonight." She sounds relieved, and she has been doing this for fifteen years.' },
            { t: 'Yes, but only on the record. Nothing personal.', mood: 1,
              run: function (a) { a.campaignEffort(a.rng(2, 5)); a.add('media', a.rng(0, 3)); a.add('stats.cunning', a.rng(1, 2)); },
              reply: '"On the record." She nods. "That is a line people can see you holding, which is worth something on Monday."' },
            { t: 'Yes. Everything we have, on the last night, everywhere.', mood: -2, tag: 'risk',
              run: function (a) {
                a.campaignEffort(a.rng(5, 10)); a.add('money', -a.wage(4));
                a.add('media', -a.rng(2, 6)); a.add('stats.integrity', -a.rng(2, 5));
                if (a.chance(0.45)) a.dirt('smear', 'A last-night campaign that ran on somebody’s family', 3);
              },
              reply: '"On the last night they cannot answer it." She does not look happy about knowing that.' }
          ]
        }
      ]
    },

    /* ==================== THE TIMELINE ==================== */
    {
      id: 'social-comms', topic: 'social', weight: 11,
      speaker: function (a) { return who(a, 'your communications officer, twenty-four years old', ''); },
      where: 'A back office, phone face up between you',
      settleOn: 'media',
      opening: function (a) {
        return '"The post from last night did four hundred thousand. That is the good news. ' +
          'The comments are the news."';
      },
      beats: [
        {
          q: '"They have found a clip of you from 2019 saying the opposite. Do we delete last night’s post, or ride it?"',
          answers: [
            { t: 'Neither. Post the 2019 clip myself and say what changed my mind.', mood: 3,
              run: function (a) { a.add('media', a.rng(4, 9)); a.add('fame', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(0, 3)); },
              reply: 'She is already typing. "That is going to do a million and half of them will be furious in a way that helps."' },
            { t: 'Delete it. Say the account was compromised.', mood: -3,
              run: function (a) { a.add('media', -a.rng(3, 8)); a.add('fame', a.rng(1, 4)); a.add('stats.integrity', -a.rng(2, 5)); a.dirt('deleted', 'A deleted post, a screenshot of it, and a claim nobody believed', 2); },
              reply: '"Everybody has the screenshot." She says it gently, the way you tell someone their fly is undone.' },
            { t: 'Ride it. Say nothing. It dies in two days.', mood: 1,
              run: function (a) { a.add('media', -a.rng(0, 3)); a.add('fame', a.rng(0, 2)); a.add('stats.grit', a.rng(.5, 1.5)); },
              reply: '"Two days," she agrees. "Unless somebody keeps it alive, and somebody usually does."' }
          ]
        },
        {
          q: '"Can I ask something? Do you want to be liked online, or do you want to win an election? Because those are different accounts."',
          answers: [
            { t: 'Win the election. Post less, and never at night.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('media', a.rng(1, 3)); a.add('fame', -a.rng(0, 2)); },
              reply: '"Thank you." She takes the phone off the table. "I will take it off you at nine every night, then."' },
            { t: 'Be liked. Reach is a currency and I intend to spend it.', mood: 1,
              run: function (a) { a.add('fame', a.rng(4, 8)); a.add('media', a.rng(1, 4)); a.add('grassroots', -a.rng(0, 3)); a.add('party', -a.rng(0, 3)); },
              reply: '"Then we go hard and we accept the cost." She is twenty-four and she has already priced the cost.' },
            { t: 'Neither. Run the account for the branches, not the country.', mood: 2,
              run: function (a) { a.add('party', a.rng(3, 6)); a.add('grassroots', a.rng(2, 4)); a.add('fame', -a.rng(0, 2)); a.spendOnDelegates(a.rng(1, 3)); },
              reply: '"Boring, targeted, and it is what actually gets you re-elected." She changes the pinned post while you watch.' }
          ]
        }
      ]
    },

    /* ==================== SECOND MEETINGS ==================== */
    {
      id: 'factions-convenor', topic: 'factions', weight: 11,
      speaker: function (a) { return who(a, 'a faction convenor', ''); },
      where: 'A guest house dining room, booked out for the afternoon',
      settleOn: 'party',
      opening: function (a) {
        var r = a.aRival();
        return '"There are two slates and there is no third slate, whatever people tell you at lunch. ' +
          (r ? '<strong>' + a.esc(r.name) + '</strong> is on one of them. ' : '') +
          'Before conference you will be on one of them too, and it is better to choose than to be allocated."';
      },
      beats: [
        {
          q: '"So which is it? And do not say you are focused on the issues, because I will write that down as the other slate."',
          answers: [
            { t: 'Yours. Wholeheartedly, and I want it known publicly.', mood: 3,
              run: function (a) { a.add('party', a.rng(5, 10)); a.add('leader', -a.rng(2, 6)); a.recruitAlly(); a.makeRival(); },
              reply: '"Publicly." He is pleased and slightly wary. "Publicly means you cannot sell us in March."' },
            { t: 'Yours, quietly. I will not say it in a hall.', mood: 1,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3)); a.add('stats.integrity', -a.rng(0, 2)); },
              reply: '"Quietly." He writes a small mark next to your name. "Quiet people get quiet positions."' },
            { t: 'Neither. I will build my own and you will have to deal with it.', mood: -2,
              run: function (a) { a.add('party', -a.rng(3, 7)); a.add('grassroots', a.rng(2, 5)); a.add('stats.grit', a.rng(1, 3)); a.makeRival(); a.makeRival(); },
              reply: '"Your own." He does not laugh, which is the most alarming part. "Then we will see you at conference."' }
          ]
        },
        {
          q: '"Whichever way you go — what do you want when it is over? Say the position out loud. Everybody here has one and pretending otherwise wastes the afternoon."',
          answers: [
            { t: function (a) { var n = RZ.engine.nextRung(a.S); return n ? 'I want ' + n.title + '. Nothing else.' : 'I want the top job. Nothing else.'; }, mood: 2,
              run: function (a) { a.add('party', a.rng(3, 6)); a.add('leader', -a.rng(0, 3)); a.add('fame', a.rng(1, 3)); },
              reply: '"Good. Now three people in this building know, and one of them will tell your rival by Thursday. That is normal."' },
            { t: 'Nothing. I want the slate to win and I will take what comes.', mood: 1,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', a.rng(1, 4)); a.add('stats.integrity', a.rng(0, 2)); },
              reply: '"Nobody wants nothing." He writes it down anyway. "But it is a good thing to have said in front of witnesses."' },
            { t: 'A ministry, and the province, and my people in the branches.', mood: -1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('leader', -a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 2)); a.promise('slate2', 'Three things demanded of a slate in a room with witnesses'); },
              reply: '"All three." He puts the pen down. "You will get one and you will be told it was all you asked for."' }
          ]
        }
      ]
    },

    {
      id: 'delegates-theirs', topic: 'delegates', weight: 10,
      when: function (a) { return a.rivalCount() > 0; },
      speaker: function (a) {
        var r = a.aRival();
        return { name: RZ.makeName(a.C), role: 'a regional secretary', org: r ? 'currently pledged to ' + r.name : '' };
      },
      where: 'A filling station forecourt on the road out of the capital',
      settleOn: 'party',
      opening: function (a) {
        var r = a.aRival();
        return '"I am pledged. Everybody knows I am pledged. ' +
          (r ? 'I have been ' + a.esc(r.name) + '’s man since before you had a title. ' : '') +
          'And I am standing here talking to you at a petrol station, so draw your own conclusion."';
      },
      beats: [
        {
          q: '"Nineteen delegates. What is your offer, and do not make it money, because I can get money from them."',
          answers: [
            { t: 'A seat at the table when the positions are decided. Named, now.', mood: 3,
              run: function (a) { a.add('party', a.rng(4, 8)); a.spendOnDelegates(a.rng(5, 9)); a.promise('table', 'A named seat at the table for a regional secretary who switched'); },
              reply: '"Named." He repeats it. "Then say the name to me now, in your own voice, so I can hear whether you mean it."' },
            { t: 'Nothing. Come across because you think I am better.', mood: 1,
              run: function (a) { var ok = a.roll('charisma', 55); a.add('party', ok ? a.rng(3, 7) : -a.rng(0, 3)); if (ok) a.spendOnDelegates(a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Nothing." He laughs, once. "You are either very confident or very new."' },
            { t: 'Tell me what he has on you and I will make that go away.', mood: -1,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('party', a.rng(1, 4)); a.spendOnDelegates(a.rng(3, 6)); a.add('stats.integrity', -a.rng(2, 5)); a.dirt('freed', 'A delegate broker released from somebody else’s hold, and now in yours', 2); },
              reply: 'He is quiet for a long moment. "You have done this before." He gets in the car with you.' }
          ]
        },
        {
          q: '"One condition either way. If you lose, do I go back to him, or do I go down with you?"',
          answers: [
            { t: 'Go back to him. I will say I sent you.', mood: 3,
              run: function (a) { a.add('party', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 5)); a.recruitAlly(); },
              reply: '"That is not how any of them answer that." He nods slowly. "It is how the ones who last answer it."' },
            { t: 'You go down with me. That is what pledging means.', mood: 0,
              run: function (a) { a.add('party', a.rng(2, 5)); a.spendOnDelegates(a.rng(2, 4)); a.add('stats.cunning', a.rng(0, 2)); },
              reply: '"Then I want it to be worth going down for." Fair enough, and now the price has gone up.' },
            { t: 'If I lose, none of this conversation happened.', mood: 1,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('party', a.rng(1, 3)); },
              reply: '"It did not happen anyway." He looks at the forecourt camera above your heads. Neither of you mentions it.' }
          ]
        }
      ]
    },

    {
      id: 'barracks-protest', topic: 'securocrats', weight: 10,
      when: function (a) { return a.S.nation.society.unrest > 42; },
      speaker: function (a) { return who(a, 'the Commissioner of Police', ''); },
      where: 'A police headquarters office with the blinds shut at midday',
      settleOn: 'security',
      opening: function (a) {
        return '"There will be twenty thousand of them on Thursday. I have four hundred officers, ' +
          'of whom perhaps ninety have done public order training this decade. I need a political instruction, in writing."';
      },
      beats: [
        {
          q: '"What is my instruction if they come off the route and head for the ministry?"',
          answers: [
            { t: 'Let them arrive. Stand at the gate and let them shout.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.add('media', a.rng(3, 6)); a.add('security', -a.rng(2, 5)); a.nation('unrest', -a.rng(2, 6)); a.legacyMark('letThemMarch'); },
              reply: '"In writing?" You write it. He folds it into his shirt pocket, and something in his shoulders drops.' },
            { t: 'Hold the line, water only, no live rounds under any circumstance.', mood: 2,
              run: function (a) { a.add('security', a.rng(2, 5)); a.add('media', a.rng(1, 3)); a.nation('unrest', -a.rng(1, 4)); },
              reply: '"No live rounds." He writes that down himself, twice, because a second copy has saved men before.' },
            { t: 'Disperse them before they reach the ministry. However you have to.', mood: -3, tag: 'risk',
              run: function (a) {
                a.add('security', a.rng(4, 8)); a.add('grassroots', -a.rng(5, 10)); a.add('media', -a.rng(4, 9));
                a.nation('unrest', a.rng(3, 9));
                if (a.chance(0.5)) { a.nation('deaths', a.irange(1, 6)); a.dirt('publicorder', 'An order to disperse a march, and the people who did not go home', 4); }
              },
              reply: '"However I have to." He does not move. "Honourable, I would like that sentence signed."' }
          ]
        },
        {
          q: '"And the other question nobody asks me. If the order comes from above you, and it is worse than yours — what do I do?"',
          answers: [
            { t: 'Refuse it, in writing, and call me the same hour.', mood: 3,
              run: function (a) { a.add('security', a.rng(3, 6)); a.add('leader', -a.rng(3, 7)); a.add('stats.integrity', a.rng(3, 6)); a.recruitAlly(); },
              reply: '"You understand what you have just made yourself part of." He does not say it as a warning. He says it as a fact.' },
            { t: 'Follow it. And write down who gave it and when.', mood: 2,
              run: function (a) { a.add('security', a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3)); a.add('capital', a.rng(1, 2)); },
              reply: '"A record." He nods. "Records have outlived every man who gave me an order in this room."' },
            { t: 'Follow it. That is what the chain of command is.', mood: -1,
              run: function (a) { a.add('security', a.rng(3, 6)); a.add('leader', a.rng(2, 5)); a.add('stats.integrity', -a.rng(2, 5)); a.nation('coup', a.rng(.3, 1.2)); },
              reply: '"That is what it is," he agrees, and neither of you believes it is a complete answer.' }
          ]
        }
      ]
    },

    {
      id: 'press-hostile', topic: 'media', weight: 10,
      speaker: function (a) { return who(a, 'a talk radio host', RZ.pick(a.C.media)); },
      where: 'A live studio, eight minutes to the news',
      settleOn: 'media',
      opening: function (a) {
        return '"We are live. My first caller is a nurse from your own ' + a.esc(a.t.region) +
          ' who has not been paid since April, and she has been holding for forty minutes."';
      },
      beats: [
        {
          q: '"She wants to know when. Not whether. When."',
          answers: [
            { t: 'I do not know, and I am going to find out and come back on this show.', mood: 3,
              run: function (a) { a.add('media', a.rng(4, 8)); a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4)); a.promise('nursepay', 'To come back on air with a date for unpaid nurses'); },
              reply: '"Same show, same time, next month." He says it to the audience, not to you. Now it is a fixture.' },
            { t: 'By the end of the month. I will put my name to that.', mood: 2,
              run: function (a) { a.add('media', a.rng(2, 5)); a.add('grassroots', a.rng(3, 7)); a.promise('nursepaydate', 'Nurses paid by the end of the month, said on live radio'); },
              reply: '"End of the month." He repeats the date twice, clearly, for the tape.' },
            { t: 'The Treasury process is under way and I will not pre-empt it.', mood: -3,
              run: function (a) { a.add('media', -a.rng(4, 9)); a.add('grassroots', -a.rng(3, 7)); a.add('party', a.rng(0, 2)); },
              reply: 'He lets the silence run for four seconds, which on radio is a very long time, and then goes to the next caller.' }
          ]
        },
        {
          q: function (a) {
            var d = a.worstDirt();
            return d ? '"Before the news. ' + a.esc(d.label) + '. You have never answered it on this station."'
                     : '"Before the news. Everybody in your position has a file. What is in yours?"';
          },
          answers: [
            { t: 'Ask me anything about it. I will stay past the news.', mood: 3,
              run: function (a) { var d = a.worstDirt(); if (d && !d.exposed) a.exposeDirt(d.id); a.add('media', a.rng(4, 9)); a.add('fame', a.rng(3, 6)); a.add('stats.grit', a.rng(1, 3)); },
              reply: '"He is staying past the news," he tells the country, delighted. It is the best forty minutes of his year.' },
            { t: 'I have answered it. Repeatedly. Play the tape.', mood: 0,
              run: function (a) { a.add('media', -a.rng(0, 3)); a.add('fame', a.rng(1, 3)); a.add('stats.cunning', a.rng(0, 2)); },
              reply: '"We have the tape." He plays it. It is worse than you remembered.' },
            { t: 'I am not doing this on air. Take me off.', mood: -3,
              run: function (a) { a.add('media', -a.rng(6, 12)); a.add('fame', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); },
              reply: '"He has taken the headphones off." He describes it, live, in detail, for ninety seconds.' }
          ]
        }
      ]
    },

    {
      id: 'money-mining', topic: 'fundraise', weight: 10,
      speaker: function (a) { return who(a, 'a country manager', 'a mining company'); },
      where: 'A boardroom on the top floor, view of the whole capital',
      settleOn: 'business',
      opening: function (a) {
        return '"Let me save us both an hour. We fund everybody. We funded your predecessor and we will fund your successor. ' +
          'The only question that changes is what we get for it, and the answer is usually nothing, which suits us."';
      },
      beats: [
        {
          q: '"So. What do you need, and what do you imagine we want?"',
          answers: [
            { t: 'I need the campaign funded. You want a phone call answered. Nothing more.', mood: 2,
              run: function (a) { a.add('money', a.wage(a.rng(8, 16))); a.add('business', a.rng(3, 7)); a.add('stats.integrity', -a.rng(0, 2)); },
              reply: '"Answered, not obeyed." He writes the cheque himself, which is a signal in itself.' },
            { t: 'Nothing from you. I came to tell you about the tailings dam.', mood: 3,
              run: function (a) { a.add('business', -a.rng(3, 7)); a.add('media', a.rng(3, 7)); a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(3, 6)); a.nation('infra', a.rng(0, 1)); },
              reply: 'He puts the pen down. "That is the first time anyone has come up here to make our lives harder for free."' },
            { t: 'Everything you can give, and I will not ask about the licence renewal.', mood: -2,
              run: function (a) { a.add('money', a.wage(a.rng(16, 30))); a.add('business', a.rng(5, 10)); a.add('stats.integrity', -a.rng(4, 8)); a.dirt('licence', 'A licence renewal that was never scrutinised, and a donation that was never declared', 3); },
              reply: '"You will not ask." He smiles. "You have understood the arrangement faster than most."' }
          ]
        },
        {
          q: function (a) {
            return '"One more thing. Your ' + a.esc(a.t.region) + ' has our smelter and our dust. ' +
              'If the community sues us, whose side are you on?"';
          },
          answers: [
            { t: 'Theirs. Publicly, and from the first day.', mood: 2,
              run: function (a) { a.add('business', -a.rng(4, 9)); a.addRegion(a.P.regionId, a.rng(4, 8)); a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(3, 5)); },
              reply: '"Then we will fund your opponent as well." He says it without heat. It is simply the arithmetic.' },
            { t: 'Neither. I will not take a side in litigation.', mood: 1,
              run: function (a) { a.add('business', a.rng(1, 4)); a.add('grassroots', -a.rng(1, 4)); },
              reply: function (a) { return '"Neither is a side," he says, "and everybody in your ' + a.esc(a.t.region) + ' will know which one."'; } },
            { t: 'Yours, quietly. And I will need that reflected.', mood: -1,
              run: function (a) { a.add('money', a.wage(a.rng(10, 20))); a.add('business', a.rng(4, 8)); a.add('grassroots', -a.rng(3, 7)); a.add('stats.integrity', -a.rng(3, 6)); a.dirt('smelter', 'A community case quietly opposed on behalf of the company that funds you', 3); },
              reply: '"It will be reflected." Two words, and a career’s worth of leverage handed over in them.' }
          ]
        }
      ]
    },

    {
      id: 'youth-unemployed', topic: 'youth', weight: 10,
      when: function (a) { return a.S.nation.economy.unemployment > 26; },
      speaker: function (a) { return who(a, 'the ' + a.t.youthWing + ' provincial secretary', ''); },
      where: 'A community hall with no chairs, everybody standing',
      settleOn: 'grassroots',
      opening: function (a) {
        return '"Half this room has a degree and ' + unemployment(a) + '% of this country has nothing. ' +
          'They did not come to be told about the pipeline of opportunities. Do not use that phrase."';
      },
      beats: [
        {
          q: '"They want to know why they should join a party at all, when the last three intakes are still waiting."',
          answers: [
            { t: 'Because it is the only door, and I am not going to pretend it is a good one.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(4, 9)); a.add('party', a.rng(1, 4)); a.add('stats.integrity', a.rng(2, 5)); a.recruitAlly(); },
              reply: 'Somebody near the front says "at least he said it." The room does not cheer. The room listens, which is rarer.' },
            { t: 'They should not. Organise outside it and make us come to you.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(3, 7)); a.add('party', -a.rng(4, 8)); a.add('media', a.rng(2, 5)); a.makeRival(); },
              reply: 'The provincial secretary’s face does something complicated. The room, however, has woken up.' },
            { t: 'Because I will get twenty of you placed by December.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.promise('youthjobs', 'Twenty young people placed by December'); a.add('capital', -a.rng(0, 2)); },
              reply: '"Twenty." He counts the room with his eyes. There are two hundred. Everyone does the arithmetic at once.' }
          ]
        },
        {
          q: '"And when the marches start — because they will start — will you be on the platform or in the Cabinet room?"',
          answers: [
            { t: 'On the platform. Whatever it costs me inside.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(5, 10)); a.add('leader', -a.rng(4, 9)); a.add('party', -a.rng(2, 6)); a.add('fame', a.rng(3, 6)); a.makeRival(); },
              reply: 'They believe you, which is the dangerous part, because now you have to be there.' },
            { t: 'In the room. That is where the decision gets made.', mood: 0,
              run: function (a) { a.add('leader', a.rng(2, 5)); a.add('party', a.rng(1, 4)); a.add('grassroots', -a.rng(2, 5)); },
              reply: '"In the room." He nods, unsurprised. "Then bring something out of it, or do not come back here."' },
            { t: 'Neither. I will be wherever it is useful to be that week.', mood: -3,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('grassroots', -a.rng(4, 8)); a.add('stats.integrity', -a.rng(1, 4)); },
              reply: 'The hall empties from the back while you are still speaking, which is the modern form of walking out.' }
          ]
        }
      ]
    },

    {
      id: 'donors-conditions', topic: 'donors', weight: 10,
      speaker: function (a) { return who(a, 'a resident representative', 'a development bank'); },
      where: 'An embassy district office with very good air conditioning',
      settleOn: 'intl',
      opening: function (a) {
        return '"The facility is approved in principle. In principle is doing a lot of work in that sentence, ' +
          'and the work it is doing is called conditionality."';
      },
      beats: [
        {
          q: '"The first condition is an audit of the last three years of procurement. Published. Can you deliver it?"',
          answers: [
            { t: 'Yes, published in full, including the parts about my own ministry.', mood: 3,
              run: function (a) { a.add('intl', a.rng(5, 10)); a.add('media', a.rng(3, 7)); a.add('party', -a.rng(4, 9)); a.nation('corruption', -a.rng(1, 3)); a.legacyMark('publishedAudit'); a.makeRival(); },
              reply: '"Including your own." She writes it into the term sheet in front of you, which is how you know she did not expect it.' },
            { t: 'Yes. Published with the annexes withheld.', mood: 1,
              run: function (a) { a.add('intl', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 2)); },
              reply: '"The annexes are the audit." She says it pleasantly. "But we have all signed worse."' },
            { t: 'No. And I would rather tell you now than in eighteen months.', mood: 2,
              run: function (a) { a.add('intl', -a.rng(1, 4)); a.add('stats.integrity', a.rng(3, 6)); a.add('party', a.rng(2, 5)); },
              reply: '"Thank you." She closes the folder. "Do you know how much of my life is spent discovering this in month nineteen?"' }
          ]
        },
        {
          q: '"Second. Our board will ask me whether this money will still be here in five years or whether it becomes somebody’s house."',
          answers: [
            { t: 'Some of it will become somebody’s house. Build that into the design.', mood: 3,
              run: function (a) { a.add('intl', a.rng(4, 8)); a.add('stats.intellect', a.rng(1, 3)); a.add('party', -a.rng(1, 4)); },
              reply: 'She actually laughs. "I am going to quote you to the board, anonymously, and it will help."' },
            { t: 'Ring-fence it. Separate account, joint signature, published monthly.', mood: 2,
              run: function (a) { a.add('intl', a.rng(3, 7)); a.add('party', -a.rng(2, 5)); a.nation('corruption', -a.rng(.5, 2)); },
              reply: '"Joint signature." She writes it. "Your Treasury will fight this for nine months and then agree."' },
            { t: 'It will be spent as the government of this country decides.', mood: -2,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('intl', -a.rng(3, 7)); },
              reply: '"That is a sovereignty answer." She caps her pen. "It is also, in my experience, a smaller facility."' }
          ]
        }
      ]
    },

    {
      id: 'church-prosperity', topic: 'church', weight: 10,
      speaker: function (a) { return who(a, 'the founder and senior pastor', 'a church of nine thousand'); },
      where: 'An office behind a stage, with a screen showing the offering totals',
      settleOn: 'grassroots',
      opening: function (a) {
        return '"Nine thousand on a Sunday. Three services. I can put you in front of all three, ' +
          'and I want you to understand clearly that I am not doing it because I like you."';
      },
      beats: [
        {
          q: '"What I want is the land at the edge of town rezoned. Say yes and you speak at eleven."',
          answers: [
            { t: 'No. And I would like to speak at eleven anyway.', mood: 2,
              run: function (a) { var ok = a.roll('charisma', 52); a.add('grassroots', ok ? a.rng(3, 7) : -a.rng(0, 3)); a.add('stats.integrity', a.rng(3, 6)); a.add('fame', ok ? a.rng(2, 5) : 0); },
              reply: 'He looks at you for a while. "You may speak at eight. Eight is a smaller service, and it is still nine hundred people."' },
            { t: 'I will look at the file honestly. That is all I will promise.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('fame', a.rng(1, 4)); },
              reply: '"Honestly." He weighs it. "Every politician says honestly and means later. You may speak at nine."' },
            { t: 'Yes. Get me the file reference and it is done.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(5, 10)); a.add('fame', a.rng(3, 7)); a.add('stats.integrity', -a.rng(3, 6)); a.dirt('rezone', 'Land rezoned for a church in exchange for a pulpit', 3); },
              reply: '"Eleven o’clock." He is already writing your name on the running order in marker.' }
          ]
        },
        {
          q: '"When you are up there, are you going to tell them how to vote? Because I do not allow that, and everybody does it."',
          answers: [
            { t: 'No. I will speak about the flood and sit down.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 4)); a.add('fame', a.rng(1, 3)); },
              reply: '"Then you will be invited back." Which, in a church of nine thousand, is the whole prize.' },
            { t: 'Not in words. They will know.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('fame', a.rng(2, 4)); a.add('stats.cunning', a.rng(1, 2)); },
              reply: '"They always know." He is not offended. He has been doing this longer than you have.' },
            { t: 'Yes. That is what I came for and we both know it.', mood: -1,
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.add('media', -a.rng(2, 5)); a.add('stats.integrity', -a.rng(2, 4)); a.dirt('pulpit', 'A pulpit used for a campaign, filmed by three people in the third row', 2); },
              reply: '"At least you are not lying in a church." He stands. "Eleven o’clock. Do not mention my name."' }
          ]
        }
      ]
    },
    /* ==================== ROOMS WITH TWO SIDES IN THEM ====================
       Everything above is somebody asking you something. These are two people
       who have already decided, arguing with each other in front of you,
       where the only way out of the room is to back one of them. Nobody is
       wrong. That is the point.
       ==================================================================== */

    // The cabinet budget room. The oldest argument in government, and the one
    // Suzerain gets right: the money is finite and both of them are correct.
    {
      id: 'cabinet-budget', topic: 'policy', weight: 16,
      when: function (a) { return a.tier() >= 6; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); },
        ward: function (a) { return who(a, 'Minister of Health', ''); }
      },
      where: 'The cabinet room, and the agenda has one item on it',
      settleOn: 'leader',
      opening: function (a) {
        return 'Two folders, one figure, and the Secretary has stopped pretending this will be settled ' +
          'politely. "Minister," he says to the room in general, "you have both read it. Say it to each ' +
          'other rather than to me."';
      },
      beats: [
        {
          argument: [
            { by: 'purse', at: 'ward',
              t: 'Debt service is ' + '31 per cent of revenue and rising. Every clinic you open is borrowed ' +
                 'at eleven per cent from people who will decide next year whether we eat. I am not ' +
                 'against clinics. I am against a downgrade.' },
            { by: 'ward', at: 'purse',
              t: 'Do not do the arithmetic at me. I have four district hospitals running on generators ' +
                 'and a maternal mortality figure I cannot say out loud in this building. Your downgrade ' +
                 'is a number. Mine is a ward with two midwives in it.' },
            { by: 'purse', at: 'ward',
              t: 'And in three years there will be no budget for midwives at all, because the whole ' +
                 'vote will be interest. I am trying to protect the thing you want to spend.' }
          ],
          q: function (a) {
            return '"That is the argument," the Secretary says, and turns to you. "It does not resolve ' +
              'itself and it is not going to. Whose line goes in the estimates?"';
          },
          answers: [
            { t: 'Health. Build the clinics and let the rating agencies write what they like', mood: 1,
              side: 'ward',
              run: function (a) {
                a.nation('health', RZ.range(5, 11)); a.nation('debt', RZ.range(3, 7));
                a.add('intl', -a.rng(4, 9)); a.add('grassroots', a.rng(3, 8));
                a.blocs({ rural: RZ.range(6, 12), labour: RZ.range(4, 9), middle: -RZ.range(3, 8) });
                a.remember('You chose the clinics over the credit rating', 'good');
              },
              reply: 'She does not thank you, which is how you know it mattered. She is already writing ' +
                     'down which four districts, in the order she has been carrying in her head for a year.' },
            { t: 'Treasury. A country that cannot borrow cannot build anything', mood: 1,
              side: 'purse',
              run: function (a) {
                a.nation('debt', -RZ.range(3, 8)); a.nation('health', -RZ.range(2, 6));
                a.add('intl', a.rng(4, 10)); a.add('business', a.rng(3, 8));
                a.blocs({ middle: RZ.range(6, 12), traders: RZ.range(2, 6), labour: -RZ.range(5, 11), rural: -RZ.range(3, 8) });
                a.remember('You chose the credit rating over the clinics', 'bad');
              },
              reply: '"Thank you." He says it to the table rather than to you. Across from him she closes ' +
                     'her folder without a word, and that silence will be quoted back at you.' },
            { t: 'Neither. Halve both and find the difference in the security vote', mood: -1,
              tag: 'risk',
              run: function (a) {
                a.nation('health', a.rng(1, 4)); a.add('security', -a.rng(8, 16));
                a.add('leader', -a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3));
                a.remember('You took it out of the security vote instead', 'flat');
              },
              reply: 'Both of them look up at once, and for the first time this morning they are on the ' +
                     'same side. "You have just made an enemy neither of us would choose," he says.' }
          ]
        },
        {
          argument: [
            { by: 'ward', at: 'purse',
              t: 'One more thing, since we are being honest in front of a witness. Your department has ' +
                 'been briefing that my ministry cannot spend what it is given.' },
            { by: 'purse',
              t: 'Your ministry returned eleven per cent of its capital budget unspent last year. That ' +
                 'is not a briefing. That is a published figure.' }
          ],
          q: '"So which is it," the Secretary says, without looking up. "Is the ministry underfunded, or ' +
             'is it unable? Because the minute goes out at four and it can only say one."',
          answers: [
            { t: 'Underfunded. The capacity problem is what underfunding looks like after five years', mood: 2,
              side: 'ward',
              run: function (a) { a.add('grassroots', a.rng(2, 6)); a.add('business', -a.rng(1, 4)); a.blocs({ labour: RZ.range(4, 9), middle: -RZ.range(1, 5) }); },
              reply: '"After five years." She repeats it slowly, so that the minute-taker gets it exactly.' },
            { t: 'Unable. And the money follows the ministries that can spend it', mood: 2,
              side: 'purse',
              run: function (a) { a.add('intl', a.rng(2, 6)); a.add('grassroots', -a.rng(2, 6)); a.nation('corruption', -RZ.range(0.5, 2)); },
              reply: 'He nods once. She writes something down that is not about the budget, and it will ' +
                     'be about you.' },
            { t: 'Put both in the minute and let the President decide which is true', mood: -2,
              run: function (a) { a.add('leader', -a.rng(3, 8)); a.add('stats.integrity', -a.rng(1, 3)); },
              reply: 'The Secretary puts his pen down. "Minister. He sent you so that he would not have ' +
                     'to be in this room. Sending it back up is not a decision, it is a diary entry."' }
          ]
        }
      ]
    },

    // The vice-president's estimates. Constitutionally you are a spare tyre;
    // this morning you have the chair, and the President has the pen. The
    // ministers have already decided. You have not.
    {
      id: 'estimates-chair', topic: 'budget', weight: 20,
      when: function (a) { return a.tier() >= 11 && !a.P.isPresident; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); },
        spend: function (a) { return who(a, 'Minister of Health', ''); }
      },
      where: 'The cabinet committee on the estimates, and the chair that is yours for the morning',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.estimatesLast;
        if (last && last.rewritten) return 'The President rewrote the estimates';
        if (last && last.stance === 'leak') return 'The minute leaked before it was signed';
        return 'The estimates went up as you wrote them';
      },
      opening: function (a) {
        if (RZ.gov && RZ.gov.beginEstimates) RZ.gov.beginEstimates(a.S);
        var office = cap(a.t.deputyHos);
        return 'The folders are already open. The Secretary has given you the chair and taken the one against the wall, ' +
          'which is how you know whose meeting this is supposed to be. ' +
          a.who('purse').name + ' has a highlighter. ' + a.who('spend').name + ' has a photograph of a ward.\n\n' +
          '"' + office + '," the Secretary says. "The President asked you to settle it. He will read the minute. ' +
          'He will not attend."';
      },
      close: function (a, temp) {
        if (RZ.gov && !a.S.flags.estimatesLast && RZ.gov.sealEstimates) {
          RZ.gov.sealEstimates(a, 'defend');
        }
        var last = a.S.flags.estimatesLast || {};
        if (last.rewritten) {
          return 'The Secretary takes the minute back. "He has written in the margin. The administration line is not ' +
            'what you sent." He does not look at you when he says it.';
        }
        if (last.stance === 'leak') {
          return '"It is already in two newsrooms," the Secretary says. "So it will have to be the document. ' +
            'Congratulations, I suppose."';
        }
        return {
          warm: 'He closes the folder. "I will tell him it was unanimous, which is a kind of lie he prefers."',
          fair: '"It will go up as written." He underlines the date. "Do not expect to be thanked."',
          cool: 'He gathers the copies. "I have chaired worse. I have also chaired better."',
          hostile: 'Nobody shakes your hand. The Minister of Health leaves her photograph on the table, face down.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'purse', at: 'spend',
              t: 'Debt service is thirty-one per cent of revenue and rising. Every clinic you open is borrowed ' +
                 'at eleven per cent from people who will decide next year whether we eat. I am not against clinics. ' +
                 'I am against a downgrade.' },
            { by: 'spend', at: 'purse',
              t: 'Do not do the arithmetic at me. I have four district hospitals running on generators and a ' +
                 'maternal mortality figure I cannot say out loud in this building. Your downgrade is a number. ' +
                 'Mine is a ward with two midwives in it.' },
            { by: 'purse', at: 'spend',
              t: 'And in three years there will be no budget for midwives at all, because the whole vote will be ' +
                 'interest. I am trying to protect the thing you want to spend.' }
          ],
          q: function (a) {
            return '"That is the first argument," the Secretary says, and turns to you. "It does not resolve ' +
              'itself, and it is not going to. Whose line goes in the estimates, ' + cap(a.t.deputyHos) + '?"';
          },
          answers: [
            { t: 'Health. Build the clinics and let the rating agencies write what they like', mood: 1,
              side: 'spend',
              memory: 'You put the clinics above the credit rating, in a room that will remember',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.gov) RZ.gov.tiltEstimates(a.S, 'debtsvc', 'health', 6);
                a.add('grassroots', a.rng(3, 8)); a.add('intl', -a.rng(3, 8));
                if (a.S.nation.intl.imf) a.add('intl', -a.rng(2, 5));
              },
              reply: 'She does not thank you, which is how you know it mattered. She is already writing down ' +
                     'which four districts, in the order she has been carrying in her head for a year.' },
            { t: 'Treasury. A country that cannot borrow cannot build anything', mood: 1,
              side: 'purse',
              memory: 'You chose the credit rating over the clinics, with the Health minister in the room',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.gov) RZ.gov.tiltEstimates(a.S, 'health', 'debtsvc', 6);
                a.add('intl', a.rng(3, 8)); a.add('business', a.rng(2, 6)); a.add('grassroots', -a.rng(3, 7));
              },
              reply: '"Thank you." He says it to the table rather than to you. Across from him she turns the ' +
                     'photograph face down, and that silence will be quoted back at you.' },
            { t: 'Neither. Take it out of the security vote and give a little to both', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.gov) {
                  RZ.gov.tiltEstimates(a.S, 'security', 'health', 3);
                  RZ.gov.tiltEstimates(a.S, 'security', 'debtsvc', 3);
                }
                a.add('security', -a.rng(6, 12)); a.add('leader', -a.rng(1, 4));
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'Both of them look up at once, and for the first time this morning they are on the same side. ' +
                     '"You have just made an enemy neither of us would choose," he says.' }
          ]
        },
        {
          argument: [
            { by: 'spend', at: 'purse',
              t: 'While we are being honest: the wage bill is eating the capital vote. You cannot keep hiring ' +
                 'and then tell me there is nothing left to build a clinic with.' },
            { by: 'purse', at: 'spend',
              t: 'The wage bill is the state. Cut it and you have a riot in the public service by Thursday and ' +
                 'a strike in the clinics you are trying to open. I will not pretend otherwise to make this shorter.' }
          ],
          q: '"Second argument," the Secretary says, without looking up. "The wage bill or the roads. The minute ' +
             'can only carry one of them at the number they arrived with."',
          answers: [
            { t: 'Hold the wage bill. The public service is the government people actually meet', mood: 1,
              side: 'spend',
              run: function (a) {
                if (RZ.gov) RZ.gov.tiltEstimates(a.S, 'infra', 'admin', 5);
                a.add('party', a.rng(2, 6)); a.add('grassroots', a.rng(1, 4));
              },
              reply: 'She nods once. He writes a number in the margin that is not the number on the page.' },
            { t: 'Cut the wage bill. Put it into roads, power, water — things that outlast a payroll', mood: 1,
              side: 'purse',
              run: function (a) {
                if (RZ.gov) RZ.gov.tiltEstimates(a.S, 'admin', 'infra', 5);
                a.add('business', a.rng(3, 7)); a.add('party', -a.rng(3, 8));
              },
              reply: '"Then I will need a sentence for the unions by noon," he says. "I assume you have one."' },
            { t: 'Hold both and take it from social grants. The dead do not vote this year', mood: -2, tag: 'risk',
              run: function (a) {
                if (RZ.gov) {
                  RZ.gov.tiltEstimates(a.S, 'social', 'admin', 3);
                  RZ.gov.tiltEstimates(a.S, 'social', 'infra', 3);
                }
                a.add('grassroots', -a.rng(5, 11)); a.add('stats.cunning', a.rng(1, 4));
                a.add('media', -a.rng(2, 6));
              },
              reply: 'The Secretary puts his pen down. "That is a sentence that will be read back to you on a ' +
                     'platform, in a language you do not speak, by somebody who was in this room."' }
          ]
        },
        {
          argument: [
            { by: 'purse',
              t: function (a) {
                return 'A note has arrived from the office. His province is not in this document. He has a ' +
                  'road. He has always had a road.';
              } },
            { by: 'spend', at: 'purse',
              t: 'If we write his road in, we write somebody else’s clinic out. That is not a note. That is a raid.' }
          ],
          q: function (a) {
            return 'The Secretary holds the paper as if it might go off. "He will read whatever we send. ' +
              'He will also write on it. ' + cap(a.t.deputyHos) + ': do we send it as agreed, or do we make room?"';
          },
          answers: [
            { t: 'Send it as agreed. He asked me to settle it, so it is settled', mood: 2,
              memory: 'You sent the estimates up as cabinet had settled them',
              memoryTone: 'good',
              run: function (a) {
                var v = RZ.gov ? RZ.gov.sealEstimates(a, 'defend') : { rewritten: false };
                if (v.rewritten) {
                  a.add('leader', -a.rng(3, 7)); a.add('party', -a.rng(1, 4));
                } else {
                  a.add('leader', a.rng(3, 7)); a.add('party', a.rng(1, 4));
                }
              },
              reply: function (a) {
                var last = a.S.flags.estimatesLast || {};
                return last.rewritten
                  ? 'The Secretary does not argue. He has seen this before. "Then I will take it up, and I will ' +
                    'bring it back with his handwriting on it."'
                  : 'The Secretary nods, once. "Then I will take it up as written. He does not always like being ' +
                    'reminded that he asked."';
              } },
            { t: 'Make room. It is his road and it is his government', mood: -1,
              side: 'purse',
              memory: 'You made room in the estimates for a road the President wanted',
              memoryTone: 'flat',
              run: function (a) {
                if (RZ.gov) RZ.gov.sealEstimates(a, 'yield');
                a.add('leader', -a.rng(2, 5)); a.add('party', a.rng(2, 6)); a.add('capital', a.rng(1, 4));
              },
              reply: 'She looks at the photograph, then at you, then at nobody. He is already rewriting the line. ' +
                     '"At least we will not pretend it was a committee decision."' },
            { t: 'Send it as agreed, and make sure two editors have the original by four', mood: 0, tag: 'risk',
              memory: 'You leaked the estimates so he could not rewrite them',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.gov) RZ.gov.sealEstimates(a, 'leak');
                a.add('media', a.rng(4, 9)); a.add('leader', -a.rng(5, 11));
                a.add('stats.integrity', -a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 4));
                a.dirt('estimates', 'A briefing that the President was about to rewrite the estimates after cabinet had settled them', 3);
              },
              reply: 'The Secretary closes his eyes for a second. "Then it will have to be the document, because ' +
                     'it will already be in the paper. I hope you like the person you have just become."' }
          ]
        }
      ]
    },

    // Two names. One chair. The Secretary has already decided who is on the
    // paper; you have to decide whether the paper is the list.
    {
      id: 'cabinet-cut', topic: 'reshuffle', weight: 20,
      when: function (a) { return a.P.isPresident || a.tier() >= 12; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        cut: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.choppingBlock(a.S); }
          return cabWho(a, 'cabinetCut', 'Minister of Home Affairs', '');
        },
        rot: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.choppingBlock(a.S); }
          return cabWho(a, 'cabinetRot', 'Minister of Mines & Energy', '');
        }
      },
      where: 'The cabinet office, after ten, with two names already on a pad',
      settleOn: 'leader',
      headline: function (a) {
        if (a.S.flags.cabinetDropped) return 'The list went out at ten';
        return 'The list was a conversation, not a list';
      },
      opening: function (a) {
        if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.choppingBlock(a.S); }
        return 'The Secretary has not sat down. Two folders, two names, and the kettle in the corner has boiled dry.\n\n' +
          '"You asked for a reshuffle," he says. "A reshuffle is two names and a chair, not a mood. ' +
          a.who('cut').name + ' has been briefing. ' + a.who('rot').name + ' has been expensive. ' +
          'The province will have a view about whichever one you pick. That is not a reason not to pick."';
      },
      close: function (a, temp) {
        if (a.S.flags.cabinetDropped) {
          return {
            warm: 'He takes the pad. "I will call them in that order. The one who stays will hear it from me, which is a kindness they will not return."',
            fair: '"It will go out at ten." He underlines both names. "Do not watch the broadcast. You already know what it says."',
            cool: 'He closes the pad on the name you did not pick. "Then that one will still be in the building tomorrow, and so will whatever they have been doing."',
            hostile: 'He does not pick up the pad. "I have written lists for better evenings than this."'
          }[temp];
        }
        return {
          warm: '"Then I will tell them it was never a list." He looks almost relieved, which is how you know it will leak anyway.',
          fair: 'He puts the pad in a drawer rather than in a bin. "For the next time you ask."',
          cool: '"A warning." He repeats it as if tasting it. "Warnings in this building have a way of becoming minutes."',
          hostile: 'He leaves the pad on the table. "Then they will both still be briefing on Sunday, and I will still be the one who has to deny it."'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'cut', at: 'rot',
              t: 'If this is a loyalty conversation, say so. I have sat through three of them and I am still here, which is more than some of the people who started them.' },
            { by: 'rot', at: 'cut',
              t: 'It is not a loyalty conversation. It is an accounts conversation. My ministry has been paying for things the minute did not name, and everybody at this table has used that.' },
            { by: 'cut', at: 'rot',
              t: 'And everybody at this table has a province. Remove me and you will hear from mine before the ink dries.' }
          ],
          q: function (a) {
            return '"That is the beginning of it," the Secretary says, and turns the pad toward you. "Whose name is on the paper?"';
          },
          answers: [
            { t: function (a) {
                return 'The one who has been briefing. ' + a.who('cut').name + ' is off the table tonight';
              }, mood: 1, side: 'rot',
              memory: 'You took the briefing one off the table, in a room with both of them in it',
              memoryTone: 'flat',
              run: function (a) {
                a.S.flags.cabinetPick = a.S.flags.cabinetCut;
                a.add('leader', a.rng(2, 6)); a.add('party', -a.rng(2, 6));
              },
              reply: 'She does not look at you. He does, once, which is worse. The Secretary writes a name and does not look up.' },
            { t: function (a) {
                return 'The expensive one. ' + a.who('rot').name + ' has cost more than a ministry is supposed to cost';
              }, mood: 1, side: 'cut',
              memory: 'You took the expensive one off the table, and called it an accounts conversation',
              memoryTone: 'good',
              run: function (a) {
                a.S.flags.cabinetPick = a.S.flags.cabinetRot;
                a.add('media', a.rng(2, 6)); a.add('party', -a.rng(1, 4));
                a.nation('corruption', -a.rng(0.4, 1.6));
              },
              reply: 'He sits back as if he had been waiting for it. She looks at the Secretary, not at you, and starts calculating a province.' },
            { t: 'Neither. This was a warning, and they have both heard it', mood: -1,
              run: function (a) {
                a.S.flags.cabinetPick = null;
                a.add('party', a.rng(1, 4)); a.add('leader', -a.rng(1, 4));
                if (RZ.state) {
                  var c = RZ.state.byMinistry(a.S, a.S.flags.cabinetCut);
                  var r = RZ.state.byMinistry(a.S, a.S.flags.cabinetRot);
                  if (c) c.loyalty = Math.min(100, c.loyalty + 6);
                  if (r) r.loyalty = Math.min(100, r.loyalty + 4);
                }
              },
              reply: 'The Secretary does not write anything. "A warning," he says. "I will file it under the last three."' }
          ]
        },
        {
          q: '"And who sits there in the morning," the Secretary says, still not looking up. "Because an empty chair is also a decision, and the provinces can count."',
          answers: [
            { t: 'A loyalist. I want someone who will not brief against this building', mood: 1,
              run: function (a) {
                var id = pickedChair(a.S);
                if (RZ.state && id) {
                  RZ.state.dropMinister(a.S, id, { loyalty: 82, competence: 38, corruption: 32 });
                }
                a.add('party', a.rng(2, 6)); a.add('leader', a.rng(1, 4));
                a.add('capital', -4); a.nation('growth', -a.rng(0.05, 0.2));
              },
              reply: '"Loyal." He writes it the way other men write a receipt. "They will not brief. They will also not work, which you will discover in a year."' },
            { t: 'A technocrat. I want the ministry to function', mood: 2,
              run: function (a) {
                var id = pickedChair(a.S);
                if (RZ.state && id) {
                  RZ.state.dropMinister(a.S, id, { loyalty: 44, competence: 81, corruption: 18 });
                }
                a.add('intl', a.rng(2, 6)); a.add('business', a.rng(1, 4));
                a.add('party', -a.rng(3, 8)); a.add('capital', -4);
                a.nation('corruption', -a.rng(0.5, 1.8));
              },
              reply: '"Someone who can do the job." He almost smiles. "The party will call you in the morning. Take the call."' },
            { t: 'Nobody new. Call them in and tell them they were discussed', mood: -1,
              run: function (a) {
                var id = pickedChair(a.S);
                if (RZ.state && id) {
                  var m = RZ.state.byMinistry(a.S, id);
                  if (m) m.loyalty = Math.min(100, m.loyalty + 8);
                }
                a.add('leader', -a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"Discussed." He closes the pad. "I will tell them. They will thank you, and they will not forget that they had to be thanked."' }
          ]
        }
      ]
    },

    // A detail that was said in a room with eight people is in the Sunday paper.
    // The person the paper described without naming is sitting opposite you.
    {
      id: 'cabinet-leak', topic: 'crisis', weight: 0,
      speaker: function (a) {
        if (RZ.state) {
          RZ.state.fillCabinet(a.S);
          if (!(a.S.flags && a.S.flags.leakerId) && a.S.cabinet && a.S.cabinet.length) {
            var worst = a.S.cabinet.slice().sort(function (x, y) { return x.loyalty - y.loyalty; })[0];
            a.S.flags.leakerId = worst.ministryId;
          }
        }
        return cabWho(a, 'leakerId', 'Minister of Home Affairs', '');
      },
      others: {
        sec: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
        wit: function (a) { return cabWitness(a); }
      },
      where: 'A small room off the cabinet office, the Sunday paper on the table',
      settleOn: 'leader',
      headline: function (a) {
        if (a.S.flags.cabinetDropped) return 'The leak sat in the room, and then did not';
        return 'The leak was named, and left the building walking';
      },
      opening: function (a) {
        a.S.scandalRisk = Math.min(2.5, (a.S.scandalRisk || 0) + 0.12);
        return a.them.name + ' is already sitting down. The Sunday paper is on the table, folded to the page, and they have not looked at it.\n\n' +
          '"I did not brief them," they say, which is the first thing the guilty and the innocent both say.';
      },
      close: function (a, temp) {
        return {
          warm: 'The Secretary takes the paper with him. "Then it is a closed matter, which in this building means it will be a closed matter until Thursday."',
          fair: '"I will tell the newsroom we have spoken." He does not say to whom. He never does.',
          cool: 'Nobody offers to walk them out. The paper stays on the table, which is a kind of minute.',
          hostile: 'The Secretary holds the door. "The next one will be more careful about who they sit with. Not about what they say."'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: '_', at: 'sec',
              t: 'A detail that eight people heard is not a briefing. It is a room. If you want to hang someone for a room, hang all eight.' },
            { by: 'sec', at: '_',
              t: 'The paper described a conversation that happened on Thursday, in this building, with a phrasing nobody uses except the person who used it. That is not eight people. That is one.' },
            { by: 'wit', at: '_',
              t: 'I was in that room. I did not say it. I also did not write it down, which is more than I can say for some of us.' }
          ],
          q: '"Somebody in this room talked," the Secretary says, and he is looking at you, not at them. "I am asking you because the paper described them without naming them, which is a courtesy they did not extend to you."',
          answers: [
            { t: 'Fire them tonight. A leak is a resignation they have not written', mood: 1, side: 'sec',
              memory: 'You fired a minister over a Sunday paper, with them in the chair',
              memoryTone: 'flat',
              run: function (a) {
                var id = a.S.flags.leakerId;
                if (RZ.state && id) RZ.state.dropMinister(a.S, id, { loyalty: 74, competence: 48, corruption: 30 });
                a.add('media', a.rng(2, 6)); a.add('party', -a.rng(3, 8));
                a.add('leader', a.rng(1, 4)); a.add('capital', -4);
                a.S.scandalRisk = Math.min(2.5, (a.S.scandalRisk || 0) + 0.08);
              },
              reply: 'They stand up before the Secretary has finished writing. "Then I will hear it on the radio, like everybody else." They do not close the door.' },
            { t: 'Warn them. This is the last time this room hears their phrasing in a paper', mood: 0, side: 'wit',
              run: function (a) {
                if (RZ.state && a.S.flags.leakerId) {
                  var m = RZ.state.byMinistry(a.S, a.S.flags.leakerId);
                  if (m) m.loyalty = Math.min(100, m.loyalty + 12);
                }
                a.add('leader', -a.rng(1, 3)); a.add('party', a.rng(1, 3));
                a.remember('You warned me over a paper instead of firing me', 'flat');
              },
              reply: '"Last time." They repeat it carefully, as if the words themselves were a minute. The Secretary does not look convinced, and does not have to.' },
            { t: 'Promote them. People who have just been promoted do not leak', mood: -1, side: '_', tag: 'risk',
              memory: 'You promoted the leak so it would stop talking',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.state && a.S.flags.leakerId) {
                  var m = RZ.state.byMinistry(a.S, a.S.flags.leakerId);
                  if (m) {
                    m.loyalty = Math.min(100, m.loyalty + 22);
                    m.competence = Math.max(10, m.competence - 6);
                  }
                }
                a.add('party', a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3));
                a.add('stats.integrity', -a.rng(2, 5)); a.add('media', -a.rng(2, 6));
                a.dirt('cabinet-silence', 'A promotion that followed a leak, in that order', 2);
                a.nation('corruption', a.rng(0.3, 1.2));
              },
              reply: 'The Secretary puts the paper down as if it had become heavier. "Then I will find a larger chair. I have done this before. It works until it does not."' }
          ]
        },
        {
          argument: [
            { by: 'wit', at: 'sec',
              t: 'If you fire them, the next one will be more careful about who they sit with, not about what they say. I would like that on the record.' },
            { by: 'sec', at: 'wit',
              t: 'The record is a Sunday paper. I am trying to make sure next Sunday is about something else.' }
          ],
          q: '"One more thing, since we are all still in the building," the Secretary says. "The newsroom will call at four. What do I tell them this meeting was?"',
          answers: [
            { t: 'A routine portfolio discussion. Smile when you say it', mood: -1,
              run: function (a) {
                a.add('media', -a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3));
                a.add('leader', a.rng(0, 2));
              },
              reply: '"Routine." He writes it. "They will print the word in quotation marks, which is how you know it landed."' },
            { t: 'Tell them we found the briefing and it has been dealt with', mood: 2, side: 'sec',
              run: function (a) {
                a.add('media', a.rng(2, 6)); a.add('intl', a.rng(1, 3));
                a.add('party', -a.rng(1, 4)); a.nation('corruption', -a.rng(0.2, 0.8));
              },
              reply: '"Dealt with." He underlines it. "That is a sentence that survives a follow-up, which is the whole job."' },
            { t: 'Tell them nothing. Silence is also a statement, and I prefer it', mood: 0, side: 'wit',
              run: function (a) {
                a.add('media', -a.rng(1, 4)); a.add('stats.integrity', a.rng(1, 3));
                a.S.scandalRisk = Math.min(2.5, (a.S.scandalRisk || 0) + 0.06);
              },
              reply: 'The witness looks at the paper one more time. "Then they will write the silence, which is longer than a quote."' }
          ]
        }
      ]
    },

    // Two of them have already decided, and they have decided opposite things.
    // The argument is assembled from what each ministry actually is.
    {
      id: 'cabinet-row', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        left: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pairRow(a.S); }
          return cabWho(a, 'rowLeft', 'Minister of Finance', 'the Treasury');
        },
        right: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pairRow(a.S); }
          return cabWho(a, 'rowRight', 'Minister of Health', '');
        }
      },
      where: 'The cabinet room, after the agenda, and they have not stood up',
      settleOn: 'leader',
      headline: function (a) {
        if (a.S.flags.rowSettled === 'left') return 'Cabinet came down on one side of the table';
        if (a.S.flags.rowSettled === 'right') return 'Cabinet came down on the other side of the table';
        return 'Cabinet agreed to disagree, on the record';
      },
      opening: function (a) {
        if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pairRow(a.S); }
        return 'The rest of them have left. The Secretary has not, which is how you know this is still a meeting.\n\n' +
          a.who('left').name + ' has not closed their folder. ' + a.who('right').name + ' has closed theirs twice.\n\n' +
          '"They have already decided," the Secretary says. "They have decided opposite things. You are here because a minute cannot say that."';
      },
      close: function (a, temp) {
        return {
          warm: 'They both stand, which is new. The Secretary dates the minute as if it had always been this short.',
          fair: '"It will go in as a decision." He does not say whose. He does not have to, any more.',
          cool: 'The one who lost leaves first. The one who won waits to see if you will walk out with them. You do not.',
          hostile: 'Nobody picks up their folder. The Secretary dates a minute that says the item was deferred, which in this building is a kind of defeat.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'left', at: 'right', t: function (a) { return rowKind(a, 'rowLeft').open; } },
            { by: 'right', at: 'left', t: function (a) { return rowKind(a, 'rowRight').retort; } },
            { by: 'left', at: 'right', t: function (a) { return rowKind(a, 'rowLeft').ask; } }
          ],
          q: '"That is the argument," the Secretary says, and he is not writing yet. "It does not resolve itself. Whose line is the minute?"',
          answers: [
            { t: function (a) { return a.who('left').name + '. Write it their way'; }, mood: 1, side: 'left',
              run: function (a) {
                a.S.flags.rowSettled = 'left';
                a.add('leader', a.rng(1, 4)); a.add('party', -a.rng(0, 3));
                if (RZ.state) {
                  var Lft = RZ.state.byMinistry(a.S, a.S.flags.rowLeft);
                  var Rgt = RZ.state.byMinistry(a.S, a.S.flags.rowRight);
                  if (Lft) Lft.loyalty = Math.min(100, Lft.loyalty + 8);
                  if (Rgt) Rgt.loyalty = Math.max(0, Rgt.loyalty - 10);
                }
              },
              reply: function (a) {
                return a.who('right').name + ' closes the folder a third time, slowly, so that the sound is the minute.';
              } },
            { t: function (a) { return a.who('right').name + '. Write it theirs'; }, mood: 1, side: 'right',
              run: function (a) {
                a.S.flags.rowSettled = 'right';
                a.add('leader', a.rng(1, 4)); a.add('party', -a.rng(0, 3));
                if (RZ.state) {
                  var Lf = RZ.state.byMinistry(a.S, a.S.flags.rowLeft);
                  var Rg = RZ.state.byMinistry(a.S, a.S.flags.rowRight);
                  if (Rg) Rg.loyalty = Math.min(100, Rg.loyalty + 8);
                  if (Lf) Lf.loyalty = Math.max(0, Lf.loyalty - 10);
                }
              },
              reply: function (a) {
                return a.who('left').name + ' looks at the Secretary, not at you. "Then I will need a sentence for my people by noon."';
              } },
            { t: 'Neither. Split the difference and date it as unanimous', mood: -2,
              run: function (a) {
                a.S.flags.rowSettled = 'split';
                a.add('leader', -a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3));
                if (RZ.state) {
                  var aL = RZ.state.byMinistry(a.S, a.S.flags.rowLeft);
                  var aR = RZ.state.byMinistry(a.S, a.S.flags.rowRight);
                  if (aL) aL.loyalty = Math.max(0, aL.loyalty - 4);
                  if (aR) aR.loyalty = Math.max(0, aR.loyalty - 4);
                }
              },
              reply: 'Both of them look at the Secretary. He looks at the page. "Unanimous," he says, "is a word that will be read back to you by whoever lost."' }
          ]
        },
        {
          argument: [
            { by: 'left', t: function (a) { return rowKind(a, 'rowLeft').lose; } },
            { by: 'right', t: function (a) { return rowKind(a, 'rowRight').lose; } }
          ],
          q: '"The one who did not get the minute will want a consolation," the Secretary says. "They always do. It is cheaper than a statement, and it is also how statements start."',
          answers: [
            { t: 'Give the loser a line in the next estimates. Quietly', mood: 1, side: 'left',
              run: function (a) {
                var lost = a.S.flags.rowSettled === 'left' ? a.S.flags.rowRight : a.S.flags.rowLeft;
                if (RZ.state && lost) {
                  var m = RZ.state.byMinistry(a.S, lost);
                  if (m) m.loyalty = Math.min(100, m.loyalty + 6);
                }
                a.add('party', a.rng(1, 4)); a.nation('debt', a.rng(0.4, 1.4));
                a.add('capital', -2);
              },
              reply: '"A line." He writes a number that is not on the page. "Quietly, until the province finds it."' },
            { t: 'Let it stand. A decision that is walked back is not a decision', mood: 2, side: 'right',
              run: function (a) {
                a.add('leader', a.rng(2, 6)); a.add('party', -a.rng(2, 6));
                if (RZ.state) {
                  var lostId = a.S.flags.rowSettled === 'left' ? a.S.flags.rowRight : a.S.flags.rowLeft;
                  var m = lostId && RZ.state.byMinistry(a.S, lostId);
                  if (m) m.loyalty = Math.max(0, m.loyalty - 6);
                }
              },
              reply: 'The Secretary dates it. "Then I will not be asked to find a line, which is the first pleasant thing that has happened this morning."' },
            { t: 'Paper it. A joint statement, both names, nothing decided', mood: -1, tag: 'risk',
              run: function (a) {
                a.add('media', a.rng(1, 4)); a.add('stats.integrity', -a.rng(1, 3));
                a.add('leader', -a.rng(1, 4));
                if (RZ.state) {
                  var bL = RZ.state.byMinistry(a.S, a.S.flags.rowLeft);
                  var bR = RZ.state.byMinistry(a.S, a.S.flags.rowRight);
                  if (bL) bL.loyalty = Math.min(100, bL.loyalty + 3);
                  if (bR) bR.loyalty = Math.min(100, bR.loyalty + 3);
                }
              },
              reply: '"Both names." He has written this statement before. "It will be quoted as if it meant something, which is the risk you just accepted."' }
          ]
        }
      ]
    },

    // The war room, eight weeks out. The person who knows how to win and the
    // person who knows what it costs, and they cannot both be obeyed.
    {
      id: 'war-room', topic: 'campaign', weight: 15,
      speaker: function (a) { return who(a, 'your agent', ''); },
      others: {
        pro: function (a) { return who(a, 'your campaign manager', ''); },
        wallet: function (a) { return who(a, 'a construction magnate', ''); }
      },
      where: 'A back room with the curtains shut and a map on the wall',
      settleOn: 'party',
      opening: function (a) {
        return 'Your agent has put three chairs out and taken the fourth himself. "Before either of you ' +
          'starts," he says, "the candidate is in the room, so say it in front of them."';
      },
      beats: [
        {
          argument: [
            { by: 'pro', at: 'wallet',
              t: 'We are four wards short and eleven days from the printing deadline. I need transport ' +
                 'and I need it paid for on Thursday, and I do not care what colour the money is.' },
            { by: 'wallet',
              t: 'Then say the second half of that sentence properly, because I am the colour. I will ' +
                 'fund the buses. I will do it through the foundation so nothing appears on a return.' },
            { by: 'pro', at: 'wallet',
              t: 'And in four years when somebody goes looking, it is not you who explains it. It is the ' +
                 'person whose name was on the ballot.' }
          ],
          q: function (a) {
            return '"Thursday," your agent says. "Buses or no buses. It is your name, so it is your ' +
              'sentence."';
          },
          answers: [
            { t: 'Take the money. Lose cleanly and you have still lost', mood: 2,
              side: 'wallet', tag: 'risk',
              run: function (a) {
                a.add('money', a.wage(a.rng(8, 20)));
                a.campaignEffort(a.rng(8, 15));
                a.dirt('busmoney', 'Campaign transport paid for by a contractor, through a foundation', 5);
                a.add('stats.integrity', -a.rng(3, 7));
                a.remember('You took the buses and knew exactly what they were', 'bad');
              },
              reply: 'He does not shake your hand on it. "Good," he says, standing. "I dislike people who ' +
                     'need to be asked twice, and I dislike people who pretend afterwards."' },
            { t: 'No. We go into those wards on foot and we go in clean', mood: 2,
              side: 'pro',
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 6)); a.add('health', -a.rng(4, 9));
                a.campaignEffort(a.rng(2, 6)); a.add('business', -a.rng(3, 8));
                a.remember('You turned the money down in front of the man offering it', 'good');
              },
              reply: 'Your manager exhales for the first time since sitting down. "Then I need every ' +
                     'evening you have, including the ones you promised your family."' },
            { t: 'Take it, and put it through the party rather than through me', mood: 0,
              side: 'wallet',
              when: function (a) { return a.P.standing.party >= 30; },
              run: function (a) {
                a.add('money', a.wage(a.rng(4, 11))); a.campaignEffort(a.rng(4, 9));
                a.owePatron(a.who('wallet').name, RZ.irange(4, 9)); a.add('party', -a.rng(1, 5));
                a.remember('You put his money through the party so it would not be yours', 'flat');
              },
              reply: '"Through the party." The magnate smiles at your agent rather than at you. "Then the ' +
                     'party owes me and you owe the party, which is a longer road to the same room."' }
          ]
        },
        {
          argument: [
            { by: 'wallet',
              t: 'And the ward committee in the north. They will want something for the hall.' },
            { by: 'pro',
              t: 'They will want a borehole, and they will say so at the meeting, in front of forty people ' +
                 'with telephones.' }
          ],
          q: '"So do we promise the borehole," your agent asks, "knowing what a promise costs when it is ' +
             'not kept? Or do we go up there and say no to their faces eleven days out?"',
          answers: [
            { t: 'Promise it. And then actually build it', mood: 3, tag: 'cost',
              side: 'pro',
              run: function (a) {
                a.promise('borehole', 'A borehole for the northern ward, promised in front of forty people', { due: 14 });
                a.add('grassroots', a.rng(4, 9)); a.blocs({ rural: RZ.range(5, 11) });
              },
              reply: '"Then I will hold you to it harder than they will," your manager says, "because I ' +
                     'am the one who has to go back up there either way."' },
            { t: 'Promise it and worry about it in December', mood: 1, tag: 'risk',
              side: 'wallet',
              run: function (a) {
                a.promise('borehole', 'A borehole promised eleven days out and not costed', { due: 6 });
                a.add('grassroots', a.rng(5, 11)); a.add('stats.integrity', -a.rng(2, 5));
              },
              reply: 'The magnate approves, which is the clearest possible signal that it was the wrong ' +
                     'answer, and everybody in the room registers it at the same moment.' },
            { t: 'Go up and tell them no, and ask for their vote anyway', mood: 0,
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 7)); a.add('grassroots', -a.rng(2, 6));
                a.wardTrust(RZ.range(3, 8)); a.add('health', -a.rng(2, 5));
              },
              reply: 'Nobody in the room thinks it will work. Your agent writes down the date and the ' +
                     'time, and says: "If it does, I will never doubt you again."' }
          ]
        }
      ]
    },

    // The corridor, when your bill is short. The man who counts and the woman
    // who has sixty-nine votes, and they despise each other's method.
    {
      id: 'whip-corridor', topic: 'whip', weight: 15,
      when: function (a) { return a.tier() >= 4; },
      speaker: function (a) { return who(a, 'the Chief Whip', ''); },
      others: {
        machine: function (a) { return who(a, 'Chief Whip', 'the parliamentary caucus'); },
        faction: function (a) { return who(a, 'convenor', 'the other faction in caucus'); }
      },
      where: 'A corridor off the members’ lobby, with two people who followed you into it',
      settleOn: 'party',
      opening: function (a) {
        return 'They arrived from opposite ends and neither of them is going to be the one who leaves ' +
          'first. "Do not make him tell you the number," the convenor says. "Make him tell you where he ' +
          'got it."';
      },
      beats: [
        {
          argument: [
            { by: 'machine', at: 'faction',
              t: 'The number is the number. I have it name by name and I have had it since Tuesday. What ' +
                 'you have is a mailing list and a grievance.' },
            { by: 'faction', at: 'machine',
              t: 'You have a list of people who tell you what you want at four o’clock and vote the other ' +
                 'way at six. I have sixty-nine who will do what they said, because I am the only person ' +
                 'in this building who ever asked them anything.' },
            { by: 'machine',
              t: 'Sixty-nine who want two committee chairs and a provincial conference postponed. Say the ' +
                 'price out loud in front of them, since we are being candid.' }
          ],
          q: '"Whose count do you run on?" the Whip says, finally looking at you. "Because you cannot ' +
             'work both rooms and you have nine days."',
          answers: [
            { t: 'Yours. The machine has never lost me a vote it promised', mood: 2,
              side: 'machine',
              run: function (a) {
                a.add('party', a.rng(4, 9)); a.add('leader', a.rng(1, 5));
                a.add('grassroots', -a.rng(1, 4));
                a.remember('You ran on his count and said so in front of her', 'good');
              },
              reply: '"Sensible." He does not look at her at all, which is worse than if he had.' },
            { t: 'Hers. Sixty-nine people who mean it beat a hundred who do not', mood: 2,
              side: 'faction',
              run: function (a) {
                a.add('party', -a.rng(2, 6)); a.add('grassroots', a.rng(3, 7));
                a.add('stats.cunning', a.rng(1, 3));
                a.remember('You took her sixty-nine over his list', 'good');
              },
              reply: 'She is already walking, and she is already dialling. Behind you the Whip says, to ' +
                     'nobody: "Then it is her bill now, and you will find that out in about a year."' },
            { t: 'Both. I will pay both prices and let the two of you argue about it afterwards', mood: -2,
              tag: 'cost',
              when: function (a) { return a.P.capital >= 14; },
              run: function (a) {
                a.add('capital', -a.rng(14, 24)); a.add('party', a.rng(2, 5));
                a.add('leader', -a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 4));
              },
              reply: '"Both." They say it at the same time and in the same tone, and it is the only ' +
                     'moment of agreement this corridor will ever see.' }
          ]
        },
        {
          argument: [
            { by: 'faction',
              t: 'And when it passes, whose win is it? Because he will be in the photograph and I will be ' +
                 'in the minutes.' },
            { by: 'machine',
              t: 'It is the party’s win. It is always the party’s win. That is what a party is for.' }
          ],
          q: '"Say whose," she says. "Here, where he can hear it, rather than to a journalist on Sunday."',
          answers: [
            { t: 'The party’s. Both of your names, neither of them first', mood: 1,
              run: function (a) { a.add('party', a.rng(3, 7)); a.add('fame', -a.rng(1, 4)); },
              reply: 'Neither of them is satisfied, which the Whip notes approvingly. "That," he says, ' +
                     '"is the first genuinely leaderly thing you have done."' },
            { t: 'Hers. She did the part nobody wanted to do', mood: 2,
              side: 'faction',
              run: function (a) { a.add('fame', -a.rng(2, 5)); a.add('grassroots', a.rng(2, 6)); a.add('stats.integrity', a.rng(1, 4)); },
              reply: 'She stops walking. It is the first time all session that somebody has said it, and ' +
                     'she does not have anything prepared for it.' },
            { t: 'Mine. I tabled it and I will carry whatever it does', mood: -1,
              side: null,
              run: function (a) { a.add('fame', a.rng(3, 8)); a.add('party', -a.rng(2, 6)); a.add('leader', -a.rng(0, 3)); },
              reply: '"Then carry it," the Whip says. "All of it. Including the part in four years where ' +
                     'somebody reads out what it cost."' }
          ]
        }
      ]
    },

    // The two men who can end you, disagreeing about how. Only at the top.
    {
      id: 'security-table', topic: 'securocrats', weight: 14,
      when: function (a) { return a.tier() >= 11; },
      speaker: function (a) { return who(a, 'the President’s chief of staff', ''); },
      others: {
        soldier: function (a) { return who(a, 'the Commander of the Defence Force', ''); },
        spy: function (a) { return who(a, 'the Director-General', 'the intelligence service'); }
      },
      where: 'A room with no windows and no minutes being taken',
      settleOn: 'security',
      opening: function (a) {
        return 'Neither of them stood when you came in and neither of them will apologise for it. ' +
          '"There is a disagreement," your chief of staff says, "and it has got to the point where it ' +
          'needs a decision rather than another meeting."';
      },
      beats: [
        {
          argument: [
            { by: 'soldier', at: 'spy',
              t: 'His people have been running an operation in the townships for six weeks and did not ' +
                 'tell mine. When it goes wrong — and it will go wrong — it is soldiers who will be ' +
                 'photographed standing over it.' },
            { by: 'spy',
              t: 'It has not gone wrong because you were not told. That is not a coincidence, it is the ' +
                 'method.' },
            { by: 'soldier',
              t: 'The method got a boy killed in June and you wrote it up as a road accident. I read the ' +
                 'file because somebody in your building has a conscience.' }
          ],
          q: '"So," your chief of staff says. "Does the operation continue, and does the Commander get ' +
             'read in? You cannot say yes to both halves and mean them."',
          answers: [
            { t: 'It continues, and it stays compartmented. He does not get read in', mood: 1,
              side: 'spy', tag: 'risk',
              run: function (a) {
                a.add('security', -a.rng(4, 10)); a.nation('unrest', RZ.range(1, 5));
                a.dirt('blackops', 'An operation you authorised that the Defence Force was kept out of', 6);
                a.add('stats.cunning', a.rng(2, 5));
                a.remember('You kept the Commander out of your own operation', 'bad');
              },
              reply: 'The Director-General says nothing at all, which is his version of gratitude. The ' +
                     'Commander stands, straightens his cuffs, and leaves before he is dismissed.' },
            { t: 'It stops today. Everything goes through the Commander', mood: 1,
              side: 'soldier',
              run: function (a) {
                a.add('security', a.rng(5, 12)); a.nation('unrest', -RZ.range(1, 4));
                a.add('intl', a.rng(2, 6)); a.add('stats.integrity', a.rng(2, 5));
                a.remember('You shut his operation down in front of him', 'bad');
              },
              reply: '"Understood." The Director-General closes his folder very carefully. "You will want ' +
                     'to remember that you said it in a room with no minutes."' },
            { t: 'It continues and he is read in, and I will hold both of you to that', mood: 0,
              run: function (a) {
                a.add('security', a.rng(1, 5)); a.add('health', -a.rng(3, 7));
                a.add('leader', a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'Your chief of staff writes nothing down, because there is nothing to write down, ' +
                     'and that is precisely the arrangement you have just made.' }
          ]
        },
        {
          argument: [
            { by: 'spy',
              t: 'While we are here. There is a file on a member of your own cabinet. It is real and it ' +
                 'is not political.' },
            { by: 'soldier',
              t: 'Everything in that building is political. That is what the building is.' }
          ],
          q: '"Do you want to see it," your chief of staff asks, "or do you want it not to exist? Those ' +
             'are genuinely the two options and the second one is available."',
          answers: [
            { t: 'Show me. I would rather know and be responsible for knowing', mood: 2,
              side: 'spy',
              run: function (a) {
                a.dirt('cabfile', 'A file on a member of your own cabinet, and you asked to see it', 3);
                a.add('stats.cunning', a.rng(2, 5)); a.add('leader', -a.rng(1, 4));
              },
              reply: 'It is thinner than you expected and worse than you expected, and by the time you ' +
                     'have finished it you have already decided something you will not admit to.' },
            { t: 'Destroy it. I will not govern out of a filing cabinet', mood: 2,
              side: 'soldier',
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 7)); a.add('security', -a.rng(2, 6));
                a.nation('corruption', -RZ.range(0.5, 2));
              },
              reply: 'The Commander approves and does not hide it. The Director-General says "Of course," ' +
                     'and every person in the room knows that a copy exists.' },
            { t: 'Keep it. Do not show me, and do not lose it', mood: -1, tag: 'risk',
              run: function (a) {
                a.add('stats.integrity', -a.rng(3, 7)); a.add('stats.cunning', a.rng(2, 5));
                a.add('security', a.rng(2, 6));
                a.remember('You had him keep the file and did not read it', 'bad');
              },
              reply: '"Kept." He writes one word on the folder. "That is the arrangement most of your ' +
                     'predecessors chose, and you should know that all of them thought they were the ' +
                     'exception."' }
          ]
        }
      ]
    },


    /* ---- and the same thing at the bottom of the ladder, where most of a
       career is actually spent. An unpaid activist has no budget and no
       portfolio; what they have is which side of a room they stand on, and
       everybody watching remembers it. ---- */

    // The ward committee, the morning after the road flooded again.
    {
      id: 'ward-road', topic: 'walkabout', weight: 15,
      speaker: function (a) { return who(a, 'the ward committee chair', ''); },
      others: {
        elder: function (a) { return who(a, 'the longest-serving committee member', ''); },
        organiser: function (a) { return who(a, 'a youth organiser', 'the ward'); }
      },
      where: 'A yard with eleven plastic chairs and nine people',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'The chair has given up trying to keep the order paper. "They have been at this since ' +
          'six," she says to you, quietly. "You are the one who has not taken a side yet, which is why ' +
          'they both stopped when you walked in."';
      },
      beats: [
        {
          argument: [
            { by: 'elder', at: 'organiser',
              t: 'We write to the councillor. We have written before and it worked before, in 2019, and ' +
                 'I have the reply in my house.' },
            { by: 'organiser', at: 'elder',
              t: 'You have a reply. You do not have a road. Nine people in this yard could not get to ' +
                 'work on Tuesday and one of them has been dismissed for it.' },
            { by: 'elder',
              t: 'And if we block the road they will send the vans, and it will be these same young men ' +
                 'in the vans, not the councillor.' }
          ],
          q: '"So," the chair says. "Letter or barricade. Say which, because whichever you say is what ' +
             'this committee is going to do."',
          answers: [
            { t: 'Block it. Tuesday morning, before the shift', mood: 2,
              side: 'organiser', tag: 'risk',
              run: function (a) {
                a.add('grassroots', a.rng(5, 11)); a.add('party', -a.rng(2, 6));
                a.add('media', a.rng(2, 6)); a.nation('unrest', RZ.range(0.4, 1.6));
                a.blocs({ youth: RZ.range(6, 12), rural: RZ.range(2, 6), middle: -RZ.range(2, 7) });
                a.remember('You told them to block the road', 'good');
              },
              reply: 'He is already on his phone. Behind him the old man folds his letter in half and ' +
                     'then in half again, and does not say anything at all.' },
            { t: 'Write the letter. And I will hand it over myself', mood: 2,
              side: 'elder',
              run: function (a) {
                a.add('party', a.rng(3, 7)); a.add('grassroots', -a.rng(1, 4));
                a.add('stats.integrity', a.rng(1, 3));
                a.blocs({ chiefs: RZ.range(3, 8), youth: -RZ.range(3, 8) });
                a.remember('You chose the letter over the barricade', 'flat');
              },
              reply: '"Myself." The old man repeats the word, satisfied. Across the yard somebody young ' +
                     'says, not quietly enough, that they have heard that before.' },
            { t: 'Both. He writes it, you block the road, and I was never here', mood: -1,
              run: function (a) {
                a.add('stats.cunning', a.rng(2, 5)); a.add('stats.integrity', -a.rng(2, 5));
                a.add('grassroots', a.rng(2, 5)); a.add('party', -a.rng(0, 3));
              },
              reply: 'The chair looks at you for a long moment. "You will go far," she says, and it is ' +
                     'not a compliment, and everybody in the yard understands that it is not.' }
          ]
        },
        {
          argument: [
            { by: 'organiser',
              t: 'And when the councillor comes down here in October with a camera, does he get the ' +
                 'chair at the front?' },
            { by: 'elder',
              t: 'He gets the chair at the front because he is the councillor. That is not respect, it ' +
                 'is arithmetic. He signs the forms.' }
          ],
          q: '"That one is easier," the chair says, "and it is worse. Front chair, or not?"',
          answers: [
            { t: 'He stands at the back with everybody else', mood: 1,
              side: 'organiser',
              run: function (a) { a.add('grassroots', a.rng(3, 7)); a.add('party', -a.rng(3, 8)); a.blocs({ youth: RZ.range(4, 9) }); },
              reply: 'It will get back to him before the afternoon, and everybody in the yard knows that ' +
                     'too, and several of them are pleased about it in a way they will not admit.' },
            { t: 'Front chair. We need him more than he needs us', mood: 1,
              side: 'elder',
              run: function (a) { a.add('party', a.rng(3, 8)); a.add('grassroots', -a.rng(2, 5)); a.add('stats.cunning', a.rng(0, 2)); },
              reply: '"More than he needs us." The old man nods slowly. "Say that part more quietly next ' +
                     'time. It is true and it should not be said in a yard."' },
            { t: 'He can have the chair if he brings the grader with him', mood: 3,
              run: function (a) {
                a.add('grassroots', a.rng(4, 8)); a.add('party', a.rng(1, 4));
                a.promise('road-grader', 'A grader in exchange for the front chair, agreed in a yard', { due: 10 });
              },
              reply: 'Both of them stop. It is the first thing anybody has said this morning that neither ' +
                     'of them had already decided about, and the chair writes it down.' }
          ]
        }
      ]
    },

    // A funeral, and whose funeral it is.
    {
      id: 'funeral-whose', topic: 'funerals', weight: 15,
      speaker: function (a) { return who(a, 'the undertaker', ''); },
      others: {
        family: function (a) { return who(a, 'the deceased’s brother', ''); },
        party: function (a) { return who(a, 'the regional organiser', ''); }
      },
      where: 'A room behind the tent, forty minutes before the programme starts',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'The undertaker has the programme in his hand and a pen he has not put down. "I print ' +
          'this in twenty minutes," he says, "and it says one thing or the other. It cannot say both ' +
          'and I am not going to be the one who decides."';
      },
      beats: [
        {
          argument: [
            { by: 'party', at: 'family',
              t: 'He carried a card for thirty-one years. There is regalia in the van and there are four ' +
                 'busloads on the way. This is a party funeral and the party is already here.' },
            { by: 'family', at: 'party',
              t: 'He was my brother. He was in hospital for nine months and I did not see one of you in ' +
                 'that ward. Now there are four buses.' },
            { by: 'party',
              t: 'That is not fair and you know it is not fair. Half those people are here because he ' +
                 'signed them up in 1994.' }
          ],
          q: '"Whose programme," the undertaker says, "and whose colours on the coffin? You are the one ' +
             'both of them telephoned."',
          answers: [
            { t: 'The family’s. No regalia, no speeches, no buses at the graveside', mood: 2,
              side: 'family',
              run: function (a) {
                a.add('grassroots', a.rng(4, 9)); a.add('party', -a.rng(4, 10));
                a.add('stats.integrity', a.rng(2, 5));
                a.blocs({ chiefs: RZ.range(4, 9), rural: RZ.range(3, 7) });
                a.remember('You sent the buses away from his brother’s funeral', 'good');
              },
              reply: 'The brother does not thank you, because you do not thank people at a funeral. He ' +
                     'puts his hand on your shoulder on the way out, which is the same thing and costs him more.' },
            { t: 'The party’s. He gave it thirty-one years and it should say so', mood: 2,
              side: 'party',
              run: function (a) {
                a.add('party', a.rng(5, 11)); a.add('grassroots', -a.rng(2, 6));
                a.add('fame', a.rng(1, 4));
                a.remember('You gave the party the funeral over the family', 'bad');
              },
              reply: 'The regalia is out of the van before you have finished the sentence. The brother ' +
                     'goes and sits with the women, which is not where he should be sitting.' },
            { t: 'Family at the graveside, party at the hall afterwards', mood: 3,
              run: function (a) {
                a.add('party', a.rng(2, 5)); a.add('grassroots', a.rng(2, 5));
                a.add('stats.cunning', a.rng(1, 3)); a.add('health', -a.rng(2, 5));
              },
              reply: 'The undertaker starts writing before either of them can object, which tells you he ' +
                     'had been hoping somebody would say exactly that for the last half hour.' }
          ]
        },
        {
          argument: [
            { by: 'party',
              t: 'One more thing. Somebody has to speak, and it should be somebody with a future.' },
            { by: 'family',
              t: 'It should be somebody who knew him.' }
          ],
          q: '"There are two minutes on the programme with nobody’s name against them," the undertaker ' +
             'says. "Whose name do I print?"',
          answers: [
            { t: 'His brother’s. He knew him and I did not', mood: 3,
              side: 'family',
              run: function (a) { a.add('grassroots', a.rng(3, 7)); a.add('fame', -a.rng(1, 4)); a.add('stats.integrity', a.rng(2, 4)); },
              reply: 'He says it badly and he stops twice and it is the only part of the morning anybody ' +
                     'still talks about a year later.' },
            { t: 'Mine. And I will say his name more than the party’s', mood: 1,
              side: 'party',
              run: function (a) { a.add('fame', a.rng(4, 9)); a.add('party', a.rng(2, 5)); a.add('grassroots', a.rng(1, 4)); },
              reply: 'You keep to it, roughly. There is one sentence near the end that you did not plan ' +
                     'and that the organiser wrote down.' },
            { t: 'Nobody’s. Two minutes of silence and let the programme run short', mood: 0,
              run: function (a) { a.add('stats.integrity', a.rng(2, 6)); a.add('party', -a.rng(1, 4)); a.add('grassroots', a.rng(1, 5)); },
              reply: 'The undertaker prints it as a blank line. In the tent it lands harder than a speech ' +
                     'and several people look at you rather than at the coffin.' }
          ]
        }
      ]
    },

    // The pulpit, and whether politics is allowed up there.
    {
      id: 'church-vestry', topic: 'church', weight: 14,
      speaker: function (a) { return who(a, 'the church secretary', ''); },
      others: {
        bishop: function (a) { return who(a, 'the bishop', ''); },
        pastor: function (a) { return who(a, 'a street pastor', ''); }
      },
      where: 'The vestry, ten minutes before the second service',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'The secretary is holding the notices and has stopped pretending to read them. "They have ' +
          'had this argument for two years," she says, "and today you are standing in it."';
      },
      beats: [
        {
          argument: [
            { by: 'bishop', at: 'pastor',
              t: 'The pulpit is not a platform. The moment a candidate speaks from it, every person in ' +
                 'that hall who votes the other way stops coming, and they do not come back.' },
            { by: 'pastor', at: 'bishop',
              t: 'And when the water was cut for six weeks, who came? Not the councillor. This hall fed ' +
                 'four hundred people. That was politics and you let me do it from the front.' },
            { by: 'bishop',
              t: 'That was mercy. It becomes politics the moment somebody in it is on a ballot.' }
          ],
          q: '"So do you speak today or do you sit," the secretary says, "because I read the notices in ' +
             'nine minutes and your name is either on them or it is not."',
          answers: [
            { t: 'I sit. And I will keep sitting for as long as I am on a ballot', mood: 2,
              side: 'bishop',
              run: function (a) {
                a.add('stats.integrity', a.rng(3, 6)); a.add('grassroots', -a.rng(2, 5));
                a.add('media', a.rng(1, 4)); a.blocs({ chiefs: RZ.range(3, 8), middle: RZ.range(2, 6) });
                a.remember('You sat down rather than speak from his pulpit', 'good');
              },
              reply: 'The bishop inclines his head about a centimetre. It is the largest gesture he has ' +
                     'made in the whole conversation.' },
            { t: 'I speak. Four hundred people ate here and somebody should say why', mood: 2,
              side: 'pastor', tag: 'risk',
              run: function (a) {
                a.add('grassroots', a.rng(5, 11)); a.add('fame', a.rng(2, 6));
                a.add('media', -a.rng(1, 5)); a.blocs({ youth: RZ.range(4, 9), rural: RZ.range(3, 8), middle: -RZ.range(2, 6) });
                a.remember('You took his pulpit after he told you not to', 'bad');
              },
              reply: 'The street pastor is delighted and does not hide it. The bishop leaves the vestry ' +
                     'before you do, which everybody in the corridor sees.' },
            { t: 'Neither of you decides. I will ask the congregation', mood: -1,
              run: function (a) {
                a.add('stats.integrity', a.rng(1, 4)); a.add('grassroots', a.rng(2, 6));
                a.add('media', a.rng(1, 4)); a.add('party', -a.rng(0, 3));
              },
              reply: 'Both of them start speaking at once. "It is not a democracy," the bishop says, ' +
                     '"it is a church," and for once the pastor does not disagree with him.' }
          ]
        },
        {
          argument: [
            { by: 'pastor',
              t: 'And the roof. It has been the roof for three years and there is money in this ward ' +
                 'that could fix it in a week.' },
            { by: 'bishop',
              t: 'There is money in this ward that comes with a photograph attached, and a roof paid for ' +
                 'like that leaks in a different way.' }
          ],
          q: '"The roof is real," the secretary says, "whatever either of you thinks about the money. Do ' +
             'I take the offer or not?"',
          answers: [
            { t: 'Take it. A dry hall is worth a photograph', mood: 1,
              side: 'pastor', tag: 'risk',
              run: function (a) {
                a.add('grassroots', a.rng(3, 8)); a.add('stats.integrity', -a.rng(1, 4));
                a.dirt('churchroof', 'A church roof paid for by somebody who wanted it known', 2);
              },
              reply: 'It is fixed within the month and there is a small plaque, and the bishop has never ' +
                     'once looked at it.' },
            { t: 'Refuse it. The roof will still be there when it can be paid for properly', mood: 1,
              side: 'bishop',
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('grassroots', -a.rng(1, 4)); a.add('business', -a.rng(1, 4)); },
              reply: '"Properly." The bishop says the word like a man who has waited three years for ' +
                     'somebody else to use it, and will now wait longer.' },
            { t: 'Take it, and put every name who gave on the wall — including mine', mood: 2,
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.add('media', a.rng(2, 5));
                a.add('stats.integrity', a.rng(1, 3)); a.add('fame', a.rng(1, 4));
              },
              reply: 'The secretary writes it down. "Every name," she repeats, "including the ones who ' +
                     'would rather not," and she is smiling for the first time this morning.' }
          ]
        }
      ]
    },

    /* ====================================================================
       1.8.0 ROOMS — the ones the README already named
       ==================================================================== */

    {
      id: 'kraal', topic: 'walkabout', weight: 16,
      speaker: function (a) { return who(a, cap(a.t.chief), a.homeName()); },
      others: {
        headman: function (a) { return who(a, 'the headman', a.homeName()); },
        young: function (a) { return who(a, 'a woman from the ward', ''); }
      },
      where: function (a) {
        return a.C.id === 'BW' ? 'The kgotla, and the logs have already been sat on'
          : a.C.id === 'LS' ? 'The pitso, and the mountain has come down for it'
          : a.C.id === 'SZ' ? 'The chiefdom, under the tree that has always been there'
          : a.C.id === 'AO' || a.C.id === 'MZ' ? 'O régulo sentou-se primeiro, e espera'
          : 'The kraal, and everybody who was asked has come';
      },
      settleOn: 'grassroots',
      opening: function (a) {
        if (a.C.id === 'AO' || a.C.id === 'MZ') {
          return 'O ' + a.t.chief + ' não se levanta. “Sentem-se. A furo e a estrada não cabem os dois neste ano, ' +
            'e vocês dois vão dizê-lo um ao outro, não a mim.”';
        }
        return 'The ' + a.t.chief + ' does not stand. A kettle is going and nobody has poured it. ' +
          '"Sit down," he says. "The borehole and the road to the cattle post do not both fit this year, ' +
          'and the two of you will say so to each other, not to me."';
      },
      beats: [
        {
          argument: [
            { by: 'headman', at: 'young',
              t: function (a) {
                return 'The cattle are walking four hours for water because the last pump died in ' +
                  (a.S.date.year - 3) + '. A road that gets the tanker in is the borehole. She wants a tap ' +
                  'in a yard that is not where the herd is.';
              } },
            { by: 'young', at: 'headman',
              t: function (a) {
                return 'Your tanker serves the post. The clinic queue is women with buckets. ' +
                  unemployment(a) + ' percent of this ward has no work and the girls are still walking. ' +
                  'A tap in the yard is not a luxury. It is why we came.';
              } }
          ],
          q: function (a) {
            return 'The ' + a.t.chief + ' turns the cup in his hands. "I have one letter to sign. Whose name goes on it?"';
          },
          answers: [
            { t: 'The cattle post. The herd is the ward’s income', mood: 1, side: 'headman',
              memory: 'You signed the letter for the cattle post', memoryTone: 'flat',
              run: function (a) {
                a.add('grassroots', a.rng(2, 6)); a.blocs({ chiefs: RZ.range(6, 12), rural: RZ.range(3, 8), youth: -RZ.range(4, 9) });
                a.startProject && a.startProject();
              },
              reply: 'The headman does not thank you. He is already naming which borehole, which is how you know it mattered.' },
            { t: 'The yard taps. The girls have walked enough', mood: 2, side: 'young',
              memory: 'You gave the ward the taps instead of the post', memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', a.rng(4, 9)); a.blocs({ youth: RZ.range(6, 12), rural: RZ.range(2, 6), chiefs: -RZ.range(3, 8) });
                a.wardTrust && a.wardTrust(8);
              },
              reply: 'She does not smile. She writes three streets on the back of a funeral programme and hands it to the clerk.' },
            { t: 'Split it, and I will find the rest from the region', mood: 0, tag: 'risk',
              memory: 'You promised money you would have to go and ask for', memoryTone: 'promise',
              run: function (a) {
                a.promise && a.promise('kraal', 'the rest of the water money', { months: 8 });
                a.add('grassroots', a.rng(1, 4)); a.add('capital', -a.rng(2, 5));
              },
              reply: function (a) {
                return 'The ' + a.t.chief + ' looks at you for a long time. "Then you had better find it. This meeting will still be here."';
              } }
          ]
        },
        {
          argument: [
            { by: 'headman', t: 'And when the letter is signed, who opens the pump? The contractor from town, or the man who has kept this place since your father?' },
            { by: 'young', t: 'The man who has kept this place since her father is why the last pump died. Ask the women in the queue.' }
          ],
          q: '"That is also a name," the old man says. "Write it."',
          answers: [
            { t: 'The man who has always done it', mood: 1, side: 'headman',
              run: function (a) { a.add('grassroots', a.rng(1, 4)); a.blocs({ chiefs: RZ.range(3, 7) }); },
              reply: 'He nods once. That is the whole of the thanks you will get, and it will be remembered.' },
            { t: 'A contractor who can be held to a date', mood: 1, side: 'young', tag: 'risk',
              run: function (a) {
                a.add('business', a.rng(2, 5)); a.add('stats.integrity', -a.rng(0, 2));
                a.blocs({ chiefs: -RZ.range(2, 6), middle: RZ.range(2, 5) });
              },
              reply: 'She has a number already. The headman is looking at the ground, which in this place is an answer.' },
            { t: 'Both. The contractor builds, the headman keeps', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('party', a.rng(1, 3)); },
              reply: 'The kettle finally gets poured. "That," the old man says, "is the first useful thing anybody has said this morning."' }
          ]
        }
      ]
    },

    {
      id: 'sg-midnight', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, a.t.sg, ''); },
      others: {
        chair: function (a) { return who(a, 'a provincial chairperson', ''); },
        youth: function (a) { return who(a, 'the ' + a.t.youthWing + ' secretary', ''); }
      },
      where: 'The residence, after ten, and nobody called ahead',
      settleOn: 'party',
      opening: function (a) {
        return 'The ' + a.t.sg + ' does not sit until you do. Six folders. A provincial chair who drove through the night. ' +
          'The youth secretary is already standing, which is not a courtesy.\n\n' +
          '"Six resolutions," he says. "They are not asking. They are instructing. I would like to know, before I go back ' +
          'to the ' + a.t.execShort + ', whether you are the name in them or the name they are written against."';
      },
      beats: [
        {
          argument: [
            { by: 'chair', at: 'youth',
              t: 'My province put three thousand people on the road for the last conference. The resolution is that the list opens. If it does not open, I cannot promise the road a second time.' },
            { by: 'youth', at: 'chair',
              t: 'The list is not the problem. The problem is that every name on it is older than the country. We did not bring the stadium to watch the same faces take the same seats.' }
          ],
          q: function (a) {
            return 'The ' + a.t.sg + ' looks at you. "I can take one of these back. Not both. Which resolution dies in this room?"';
          },
          answers: [
            { t: 'The list stays closed. I will not be bounced by a province', mood: 1, side: 'youth',
              memory: 'You told a provincial chair the list stays closed', memoryTone: 'bad',
              run: function (a) { a.add('party', a.rng(2, 6)); a.add('leader', a.rng(2, 5)); a.add('grassroots', -a.rng(3, 8)); a.makeRival && a.makeRival(); },
              reply: 'The chair puts his folder down as if it had become heavy. The youth secretary does not look at him.' },
            { t: 'Open the list. If I cannot survive my own structures I should not be in them', mood: 2, side: 'chair',
              memory: 'You opened the list because a province told you to', memoryTone: 'good',
              run: function (a) { a.add('grassroots', a.rng(4, 9)); a.add('party', -a.rng(2, 6)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"Survive," he repeats. "We will see." He is already on the phone before he reaches the door.' },
            { t: 'Take both back. Tell them I will come to the province myself', mood: 0,
              memory: 'You said you would come to the province yourself', memoryTone: 'promise',
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('fame', a.rng(1, 3)); a.promise && a.promise('province', 'a visit to the province that instructed you', { months: 3 }); },
              reply: 'The SG almost smiles. "That is a date in a diary. Make sure it is kept. They will."' }
          ]
        },
        {
          argument: [
            { by: 'youth', t: 'There is a seventh resolution they did not put in the folder. It is about you, and it is not kind.' },
            { by: 'chair', t: 'It is kind enough. It says the structures will not carry a name that will not carry them.' }
          ],
          q: '"I can bury that one," the SG says. "I would like a reason."',
          answers: [
            { t: 'Bury it. I will remember that you did', mood: 1, side: 'chair',
              run: function (a) { a.add('leader', a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3)); a.owePatron && a.owePatron(a.who && a.who('chair') && a.who('chair').name || 'the SG', 6); },
              reply: '"Remembering is a kind of payment," he says. "See that it is."' },
            { t: 'Let it through. I would rather hear it on the floor than in a corridor', mood: 2, side: 'youth',
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); },
              reply: 'The youth secretary looks at you properly for the first time. "Then we will see you at congress."' },
            { t: 'Tell me who wrote it, and I will deal with them myself', mood: -1, tag: 'risk',
              run: function (a) { a.add('stats.cunning', a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3)); a.dirt && a.dirt('slate', 'A provincial resolution you had buried, and the name of who wrote it', 2); },
              reply: 'The SG closes the seventh folder. "That is the answer I was hoping you would not give. I will take it anyway."' }
          ]
        }
      ]
    },

    {
      id: 'live-tv', topic: 'media', weight: 15,
      speaker: function (a) { return who(a, 'the presenter', a.C.media[0]); },
      others: {
        other: function (a) { return who(a, 'the other guest', ''); },
        producer: function (a) { return who(a, 'the producer', a.C.media[0]); }
      },
      where: 'A studio that is colder than it looks on television',
      settleOn: 'media',
      opening: function (a) {
        return 'The floor manager holds up five fingers, then four. The other guest is already powdered. ' +
          'The producer leans in from the dark and says, very quietly, "She is going to ask you if you want the top job. ' +
          'I cannot stop her. I can only tell you she is going to ask."';
      },
      beats: [
        {
          argument: [
            { by: 'other', at: '_',
              t: 'With respect, the country has heard enough from people who will not say whether they are running. Ambition that will not speak its name is just a plot.' },
            { by: 'producer', t: 'We are live in twenty seconds. Do not look at me.' }
          ],
          q: function (a) {
            return 'The presenter turns to you as the light goes red. "Do you want to be ' + a.t.hos + ' of this republic?"';
          },
          answers: [
            { t: 'Yes. And I will say so in a hall, not only on your programme', mood: 2, side: 'other',
              memory: 'You said on live television that you wanted the top job', memoryTone: 'good',
              run: function (a) { a.add('fame', a.rng(6, 12)); a.add('media', a.rng(4, 9)); a.add('leader', -a.rng(4, 10)); a.add('party', -a.rng(2, 6)); },
              reply: 'The other guest smiles with the mouth only. Somewhere a telephone is already ringing in a house that does not like surprises.' },
            { t: 'I serve at the pleasure of the structures. That is the whole answer', mood: 0, side: 'producer',
              memory: 'You hid behind the structures on live television', memoryTone: 'flat',
              run: function (a) { a.add('party', a.rng(2, 6)); a.add('media', -a.rng(2, 6)); a.add('fame', -a.rng(1, 3)); },
              reply: 'She waits just long enough for the silence to become the clip. "Thank you. We will go to a break."' },
            { t: 'No. The country has had enough of people who want it too much', mood: 1,
              memory: 'You said on television that you did not want the top job', memoryTone: 'good',
              run: function (a) { a.add('stats.integrity', a.rng(3, 7)); a.add('grassroots', a.rng(2, 6)); a.add('leader', a.rng(1, 4)); a.legacyMark && a.legacyMark('neverTookIt'); },
              reply: 'The producer, in the dark, puts both hands on top of her head. The other guest has nothing ready, which is the point.' }
          ]
        },
        {
          argument: [
            { by: 'other', t: 'Then let me put a name on it. There is a file. Everybody in this building has heard the number. Would you like to tell the country what it was for?' },
            { by: 'producer', t: 'We did not agree this.' }
          ],
          q: '"Would you?" the presenter says, and does not look at her notes, because she does not need them.',
          answers: [
            { t: 'There is no file. Say it outside and I will see you in court', mood: 1, tag: 'risk',
              run: function (a) { a.add('media', a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3)); a.nation('unrest', a.rng(0, 2)); },
              reply: 'The other guest sits back. The clip will be the denial, which is what denials are for.' },
            { t: 'There was a donation. It was declared. I will say so again, with the receipt', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(3, 7)); a.add('business', -a.rng(1, 4)); },
              reply: '"The receipt," she repeats, for the people at home. "We will hold you to that."' },
            { t: 'I will not launder a rumour on your programme. Next question', mood: 0, side: 'producer',
              run: function (a) { a.add('media', -a.rng(1, 4)); a.add('leader', a.rng(1, 3)); },
              reply: 'The presenter blinks, once. The producer, in the dark, is mouthing thank you.' }
          ]
        }
      ]
    },

    {
      id: 'deputy-sits', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'your chief of staff', ''); },
      others: {
        deputy: function (a) { return who(a, a.t.deputyTitle, ''); },
        sg: function (a) { return who(a, a.t.sg, ''); }
      },
      where: 'Your office, and the chair that is not his',
      settleOn: 'leader',
      opening: function (a) {
        return 'He sits down before he is asked to. The chief of staff is still standing, which is how you know ' +
          'this was not in the diary. The ' + a.t.sg + ' has closed the door with himself on this side of it.\n\n' +
          '"I thought we should talk," the deputy says, "before somebody else talks."';
      },
      beats: [
        {
          argument: [
            { by: 'deputy', at: 'sg',
              t: 'The caucus has numbers. I did not collect them. I also did not send them away. That is the situation. I would rather it was a conversation than a statement.' },
            { by: 'sg', at: 'deputy',
              t: 'A conversation is a statement that has not been typed yet. He sat in that chair. That is already in three phones.' }
          ],
          q: 'Your chief of staff, still standing: "Do I ask him to stand up, or do we pretend this is a briefing?"',
          answers: [
            { t: 'Let him sit. I would rather hear it from him than read it', mood: 1, side: 'deputy',
              memory: 'You let the deputy sit before he was asked', memoryTone: 'flat',
              run: function (a) { a.add('leader', -a.rng(2, 6)); a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3)); },
              reply: 'He does not look relieved. He looks like a man who has started something he cannot now undress.' },
            { t: 'Stand up. This is my office', mood: 2, side: 'sg',
              memory: 'You made the deputy stand up in your own office', memoryTone: 'bad',
              run: function (a) { a.add('leader', a.rng(3, 8)); a.add('party', -a.rng(3, 8)); a.makeRival && a.makeRival(); },
              reply: 'He stands. The SG does not hide that he is pleased. That pleasure will cost you at congress.' },
            { t: 'Both of you sit. If this is a conversation, it has three people in it', mood: 0,
              memory: 'You made the deputy share the room with the SG', memoryTone: 'good',
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', a.rng(1, 3)); },
              reply: 'The chief of staff finally takes a chair. For a moment nobody knows whose meeting this is, which is an improvement.' }
          ]
        },
        {
          argument: [
            { by: 'deputy', t: 'I am not asking you to go. I am asking you to say, in this room, whether you will still be here in a year.' },
            { by: 'sg', t: 'That is a question for the conference, not for a Tuesday.' }
          ],
          q: 'The deputy waits. He has learned, somewhere, not to fill a silence.',
          answers: [
            { t: 'I will be here. Plan accordingly', mood: 2, side: 'sg',
              run: function (a) { a.add('leader', a.rng(3, 7)); a.add('party', -a.rng(1, 4)); },
              reply: 'He nods, once, like a man filing a date. The SG breathes out.' },
            { t: 'I have not decided. That is the honest answer', mood: 1, side: 'deputy',
              run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('leader', -a.rng(2, 6)); },
              reply: '"Honest," he says. "Then we will both make plans, and one of them will be a waste."' },
            { t: 'If the structures want me gone they can say so on the floor, not in my chair', mood: 0, tag: 'risk',
              run: function (a) { a.add('grassroots', a.rng(2, 6)); a.add('party', -a.rng(2, 6)); a.add('fame', a.rng(1, 4)); },
              reply: 'The SG opens the door. "Then we will see you on the floor." The deputy does not look back.' }
          ]
        }
      ]
    },

    {
      id: 'kitchen-table', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, a.P.gender === 'f' ? 'your husband' : 'your wife', ''); },
      others: {
        kin: function (a) { return who(a, 'your brother', ''); },
        mother: function (a) { return who(a, 'your mother', ''); }
      },
      where: 'The kitchen, and the television is on in the other room with no sound',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'The plate in front of you is the plate from an hour ago. Nobody has eaten. ' +
          'Your mother has her hands around a cup that has gone cold. Your brother is standing, because in this house ' +
          'the person who is about to ask for money always stands.\n\n' +
          (a.P.gender === 'f' ? 'Your husband' : 'Your wife') + ' does not raise their voice. "Sit down and listen. For once."';
      },
      beats: [
        {
          argument: [
            { by: 'kin', at: 'mother',
              t: 'The funeral is on Saturday. Everybody knows who is supposed to carry it. If we do not, they will say the ministry ate it.' },
            { by: 'mother', at: 'kin',
              t: 'The ministry did not eat it. The diary ate it. There is a child in this house who has stopped asking when you will be home.' }
          ],
          q: function (a) {
            return (a.P.gender === 'f' ? 'Your husband' : 'Your wife') + ' looks at you, not at them. "Which of these is the emergency? Because I am tired of living in both."';
          },
          answers: [
            { t: 'I will carry the funeral. That is what the money is for', mood: 1, side: 'kin',
              memory: 'You paid for the funeral from the kitchen', memoryTone: 'good',
              run: function (a) {
                a.add('money', -a.wage(1.6)); a.add('grassroots', a.rng(2, 6));
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, -4);
              },
              reply: 'Your brother sits down. Your mother does not. The plate is still there.' },
            { t: 'The funeral can wait. I am staying in this house tonight', mood: 2, side: 'mother',
              memory: 'You stayed home and let the funeral find its own money', memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', -a.rng(1, 4));
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, 18);
                a.addRaw && a.addRaw('health', 4);
                a.P.health = Math.min(100, a.P.health + 6);
              },
              reply: 'Nobody thanks you. Your mother pours the cup out and fills it again, which in this kitchen is the thanks.' },
            { t: 'I cannot do either properly. That is the truth of the job', mood: -1,
              memory: 'You told your own kitchen the job comes first', memoryTone: 'bad',
              run: function (a) {
                a.add('stats.integrity', a.rng(1, 3));
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, -12);
              },
              reply: 'The television in the other room is still on, with no sound. Somebody has your face on it.' }
          ]
        },
        {
          argument: [
            { by: 'kin', t: 'There is also the shop. I would not ask if it was not going to work this time.' },
            { by: 'mother', t: 'It is going to work the way the last one worked. Do not make this house a bank.' }
          ],
          q: '"He is going to ask you in the car," they say. "I would like you to have an answer before then."',
          answers: [
            { t: 'No. Not the shop. Not this year', mood: 2, side: 'mother',
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('grassroots', -a.rng(0, 2)); },
              reply: 'Your brother looks at the door. He will ask anyway, in the car. At least you said it here first.' },
            { t: 'A loan, with a date, written down', mood: 1, side: 'kin', tag: 'risk',
              run: function (a) { a.add('money', -a.wage(1.2)); a.add('stats.integrity', -a.rng(0, 2)); a.promise && a.promise('shop', 'the shop loan coming back', { months: 6 }); },
              reply: 'Your mother makes a sound that is not a word. Your brother is already smiling, which is the problem.' },
            { t: 'If I pay for a shop I will put my name on the papers', mood: 0,
              run: function (a) { a.add('money', -a.wage(1.4)); a.add('business', a.rng(1, 3)); a.dirt && a.dirt('kinshop', 'A family shop with a minister’s name on the papers', 2); },
              reply: '"Your name on the papers," your mother says. "That is how it starts. I have seen it start."' }
          ]
        }
      ]
    },

    {
      id: 'miners-hall', topic: 'funerals', weight: 14,
      speaker: function (a) { return who(a, 'the shaft steward', ''); },
      others: {
        company: function (a) { return who(a, 'the company man', ''); },
        widow: function (a) { return who(a, 'the widow', ''); }
      },
      where: function (a) {
        return 'A hall with the chairs in rows and a photograph at the front, in ' + a.homeName();
      },
      settleOn: 'grassroots',
      opening: function (a) {
        var staple = (a.C.econ && a.C.econ.staple) || 'the pit';
        return 'The photograph is a young man in a helmet. The hall is full of people who knew him and people ' +
          'who work where he worked. The company man has taken a seat at the back, which is as close as he is allowed.\n\n' +
          'The steward does not shake your hand. "He is the eleventh this year on this shaft. ' +
          staple.charAt(0).toUpperCase() + staple.slice(1) + ' paid for the wreath. We would like you to say something ' +
          'that is not a wreath."';
      },
      beats: [
        {
          argument: [
            { by: 'company', at: 'widow',
              t: 'The inquiry will run. Compensation is a process. I am here to pay respects, not to negotiate in a church.' },
            { by: 'widow', at: 'company',
              t: 'You are in a hall, not a church, and the process is why he is the eleventh. Say the number of the shaft. Just that.' }
          ],
          q: 'The steward looks at you. "You have the microphone. The company does not. That is the only reason you were asked."',
          answers: [
            { t: 'Name the shaft. Name the count. Let them deny it on the record', mood: 2, side: 'widow',
              memory: 'You named the shaft at the funeral', memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', a.rng(5, 11)); a.add('media', a.rng(4, 9)); a.add('business', -a.rng(4, 10));
                a.blocs({ labour: RZ.range(8, 14), rural: RZ.range(3, 7), middle: -RZ.range(2, 6) });
                a.legacyMark && a.legacyMark('namedTheShaft');
              },
              reply: 'The widow does not cry. She nods, once, at the photograph. The company man has his phone out and is not pretending otherwise.' },
            { t: 'This is not the inquiry. Today we bury him', mood: 0, side: 'company',
              memory: 'You would not name the shaft at the funeral', memoryTone: 'bad',
              run: function (a) { a.add('business', a.rng(2, 6)); a.add('grassroots', -a.rng(3, 8)); a.add('media', -a.rng(1, 4)); },
              reply: 'The steward takes the microphone back before you are finished. That is the speech, now, whether you like it or not.' },
            { t: 'I will sit with the family after, and I will not bring a camera', mood: 1,
              memory: 'You sat with the family and left the cameras outside', memoryTone: 'good',
              run: function (a) { a.add('grassroots', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 5)); a.add('fame', -a.rng(1, 3)); },
              reply: 'The widow looks at you as if measuring a person. "After," she says. "Not in here."' }
          ]
        },
        {
          argument: [
            { by: 'company', t: 'If this becomes a campaign stop, the next funeral will not invite the office. I am telling you that as a courtesy.' },
            { by: 'widow', t: 'Invite the office. Do not invite the party colours. There is a difference, and he knew it.' }
          ],
          q: 'A boy at the back has a party shirt on under his jacket. The steward has seen it too.',
          answers: [
            { t: 'Take the shirt off. This is not a rally', mood: 2, side: 'widow',
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('party', -a.rng(1, 3)); a.add('grassroots', a.rng(2, 5)); },
              reply: 'The boy looks at you, then at the photograph, and pulls the jacket closed. It will have to do.' },
            { t: 'The shirt can stay. He was one of ours', mood: 1, side: 'company',
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('grassroots', -a.rng(2, 6)); },
              reply: 'The company man writes something down. The widow is looking at the floor.' },
            { t: 'I will wear the jacket myself and leave the colours in the car', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('media', a.rng(1, 4)); },
              reply: 'The steward almost smiles, which on this face is a rare thing. "Then you can have the microphone back."' }
          ]
        }
      ]
    },

    {
      id: 'collapse-bed', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, a.P.gender === 'f' ? 'your husband' : 'your wife', ''); },
      others: {
        deputy: function (a) { return who(a, a.t.deputyMin, ''); },
        doctor: function (a) { return who(a, 'the doctor', ''); }
      },
      where: 'A side ward with the curtain half drawn',
      settleOn: 'leader',
      opening: function (a) {
        return 'The drip is a sound you will remember. The deputy is already in the chair by the window, which is not ' +
          'a medical decision. The doctor has the chart and is not looking at him.\n\n' +
          (a.P.gender === 'f' ? 'Your husband' : 'Your wife') + ' is standing where the nurse should be. "They are going to ask you to choose. I would like you to hear me first."';
      },
      beats: [
        {
          argument: [
            { by: 'deputy', at: 'doctor',
              t: 'The House sits on Tuesday. If the statement is that you are unwell, the statement after that writes itself. I can hold it for a week. Not two.' },
            { by: 'doctor', at: 'deputy',
              t: 'If the statement is that they are going back to work, I will not sign it. I have signed too many of those and I still see the names.' }
          ],
          q: function (a) {
            return (a.P.gender === 'f' ? 'Your husband' : 'Your wife') + ': "Rest. Hand it over. Or get up and prove them right. Those are the three, and I am tired of pretending there is a fourth."';
          },
          answers: [
            { t: 'I am signing off. Two months. The deputy can hold the desk', mood: 2, side: 'doctor',
              memory: 'You signed off and let the deputy hold the desk', memoryTone: 'good',
              run: function (a) {
                a.S.skipTurns = (a.S.skipTurns || 0) + 1;
                a.P.health = Math.min(100, a.P.health + 18);
                a.add('party', -a.rng(1, 4));
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, 14);
              },
              reply: 'The doctor writes. The deputy does not. That, too, is a kind of statement.' },
            { t: 'I will be in the House on Tuesday. Write that', mood: -1, side: 'deputy', tag: 'risk',
              memory: 'You got up from the ward to make the House', memoryTone: 'bad',
              run: function (a) {
                a.P.health = Math.max(8, a.P.health - 8);
                a.add('leader', a.rng(2, 6)); a.add('party', a.rng(1, 4));
                a.dirt && a.dirt('health', 'A return to work against medical advice that the party has noted', 2);
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, -10);
              },
              reply: 'The deputy almost looks grateful. The person you married does not.' },
            { t: 'Hand it over. Properly. I am not coming back to this chair', mood: 1,
              memory: 'You handed the office over from a hospital bed', memoryTone: 'good',
              run: function (a) {
                a.legacyMark('madeWay'); a.legacyMark('leftOnOwnTerms');
                a.add('stats.integrity', a.rng(4, 8)); a.add('grassroots', a.rng(2, 6));
                a.add('leader', -a.rng(4, 10));
                if (a.demote) a.demote();
              },
              reply: 'The deputy stands up as if the chair had become hot. The doctor closes the chart. Someone, somewhere, is already writing the first paragraph.' }
          ]
        },
        {
          argument: [
            { by: 'deputy', t: 'If you are coming back, I need to know what I am allowed to sign.' },
            { by: 'doctor', t: 'If they are coming back, I need it in writing that I advised against it.' }
          ],
          q: '"Say it so I can tell the nurses," the person you married says. "They keep asking me as if I were the office."',
          answers: [
            { t: 'The deputy signs nothing that cannot wait. I will be back', mood: 1, side: 'deputy',
              run: function (a) { a.add('leader', a.rng(1, 4)); a.add('party', a.rng(1, 3)); },
              reply: 'He nods. The doctor writes the sentence they asked for, slowly, so that it exists.' },
            { t: 'Sign what the House needs. Leave the rest', mood: 0,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('capital', -a.rng(1, 3)); },
              reply: '"The House," he repeats. "Not the tenders. I heard you."' },
            { t: 'Tell the nurses I am a patient. That is the whole briefing', mood: 2, side: 'doctor',
              run: function (a) {
                a.P.health = Math.min(100, a.P.health + 6);
                if (RZ.family && RZ.family.mend) RZ.family.mend(a.S, 8);
              },
              reply: 'For the first time since you woke up, the room is only a room.' }
          ]
        }
      ]
    },

    {
      id: 'contender-slate', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'a provincial secretary', ''); },
      others: {
        ally: function (a) { return who(a, 'your organiser', ''); },
        leak: function (a) { return who(a, 'a journalist', a.C.media[1] || a.C.media[0]); }
      },
      where: 'A side room at the provincial conference, two in the morning',
      settleOn: 'party',
      opening: function (a) {
        var ct = a.S.contender;
        var nm = ct ? ct.name : 'them';
        return 'The count is on a piece of paper that has been folded too many times. ' + nm +
          ' is not in the room. The journalist is, which means the count will be.\n\n' +
          'The provincial secretary puts the paper on the table. "They came within a province. The instruction was not followed. Quite. I would like to know if you want this buried, or printed."';
      },
      beats: [
        {
          argument: [
            { by: 'ally', at: 'leak',
              t: 'If this is printed it makes them. A near-miss with a photograph is a campaign. Bury it and they are still a regional name.' },
            { by: 'leak', at: 'ally',
              t: 'It is already on two phones. Burying it is how you get a worse version. I can spell it right, or I can spell it the way the other newsroom will.' }
          ],
          q: '"Well?" the secretary says. "I have to go back into the hall."',
          answers: [
            { t: 'Print it. Spell it right. They came close and the country should know', mood: 1, side: 'leak',
              memory: 'You let the near-miss go to print', memoryTone: 'flat',
              run: function (a) { a.add('media', a.rng(3, 7)); a.add('fame', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); },
              reply: 'The journalist is already at the door. Your organiser looks at you as if you had just funded the other campaign.' },
            { t: 'Bury it. A near-miss is oxygen', mood: 2, side: 'ally',
              memory: 'You buried the count that would have made them', memoryTone: 'good',
              run: function (a) { a.add('party', a.rng(2, 6)); a.add('stats.cunning', a.rng(1, 3)); a.add('media', -a.rng(1, 3)); },
              reply: 'The secretary folds the paper one more time. "Then I never had it." The journalist does not look convinced.' },
            { t: 'Call them. Tonight. I would rather they hear it from me', mood: 0,
              memory: 'You called them about the count yourself', memoryTone: 'good',
              run: function (a) {
                a.add('stats.integrity', a.rng(2, 5));
                if (a.S.contender && a.S.contender.relation === 'rival') a.S.contender.relation = 'cool';
              },
              reply: 'Your organiser exhales. "That is either statesmanship or a mistake. We will know in the morning."' }
          ]
        },
        {
          argument: [
            { by: 'ally', t: 'There is a second count, from the youth. It is worse for us. If the first one prints, the second one will.' },
            { by: 'leak', t: 'Then give me the first one with your name on the briefing, and I can hold the second until Friday.' }
          ],
          q: 'The secretary is already late for the hall.',
          answers: [
            { t: 'Brief it. My name on it', mood: 1, side: 'leak',
              run: function (a) { a.add('media', a.rng(2, 5)); a.add('fame', a.rng(1, 3)); },
              reply: '"Your name," the journalist says, and writes it, which is the whole of the bargain.' },
            { t: 'Hold both. Friday is still too soon', mood: 1, side: 'ally',
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('media', -a.rng(2, 5)); },
              reply: 'The journalist shrugs, which in this trade is a threat. The secretary has gone.' },
            { t: 'Print the youth count too. I am not afraid of a number', mood: 2,
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('grassroots', a.rng(2, 5)); a.add('party', -a.rng(2, 5)); },
              reply: '"A number," the journalist says. "That is the quote."' }
          ]
        }
      ]
    },

    /* ================================================================
       1.9.0 — THE OFFICE HAS A JOB
       Six ministry rooms, constituency Friday, the ribbon, the manifesto,
       and State of the Nation as a holding-room conversation.
       ================================================================ */

    {
      id: 'duty-clinic', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-clinic'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Health'); },
      others: {
        union: function (a) { return who(a, 'the nurses’ union', ''); },
        tender: function (a) { return who(a, 'the procurement chair', a.P.ministry || 'Health'); }
      },
      where: 'A ministry boardroom with a box of unopened vials on the table',
      settleOn: 'grassroots',
      headline: function () { return 'The ministry sat'; },
      opening: function (a) {
        return 'The box is still sealed. ' + a.who('union').name + ' has a list of clinics that have been ' +
          'out of stock for eleven weeks. ' + a.who('tender').name + ' has a different list, of companies.\n\n' +
          '"Minister," the Director-General says. "We can sign tonight. Or we can wait for a tender that will ' +
          'not award before the rains."';
      },
      close: function (a, temp) {
        return {
          warm: 'She puts the box on a trolley. "Then they go out in the morning."',
          fair: '"We will do what we can with what you signed." She does not thank you.',
          cool: 'The union is already on the stairs. The box has not moved.',
          hostile: 'Nobody picks the box up. It will still be here on Monday.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'union', at: 'tender',
              t: 'Four district hospitals are mixing antibiotics with tap water. I did not come here to watch a process.' },
            { by: 'tender', at: 'union',
              t: 'And I did not come here to sign a sole-source for a cousin. Process is how we still have a country.' }
          ],
          q: '"Minister. The box or the gazette?"',
          answers: [
            { t: 'Open the box. Gazette it afterwards', mood: 2, side: 'union',
              memory: 'You opened the drug box before the tender was gazetted',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'health', 'deliver');
                a.add('grassroots', a.rng(3, 7)); a.add('media', a.rng(1, 4));
              },
              reply: 'She is already cutting the tape. He writes a minute that will be a problem in six months, and he wants you to know it.' },
            { t: 'Gazette it. I will not be the minister who skipped a tender', mood: 1, side: 'tender',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'health', 'show');
                a.add('intl', a.rng(2, 5)); a.add('grassroots', -a.rng(2, 5));
              },
              reply: '"Then I will take the list to the radio," the union says, and she means it.' },
            { t: 'Award it to the company that already has the stock in a warehouse', mood: -2, side: 'tender', tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'health', 'rot');
                a.add('party', a.rng(1, 4));
              },
              reply: 'He does not look surprised. The union looks at the box as if it had already been stolen.' }
          ]
        },
        {
          argument: [
            { by: 'union', t: 'Hours. The clinics close at two because nobody is paid to stay. A box at two o’clock is a box that goes home with a nurse.' },
            { by: '_', t: 'Extended hours are a wage bill. The Treasury has already told me no.' }
          ],
          q: '"So which shortage do we choose to be famous for?"',
          answers: [
            { t: 'Pay them to stay. I will find the line', mood: 2, side: 'union',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'health', 'deliver');
                a.add('party', -a.rng(1, 4));
                if (RZ.ward) RZ.ward.stamp(a.S, 'wages', 'kept');
              },
              reply: '"Find it by Friday," she says. "I have a shop steward who can tell a week from a promise."' },
            { t: 'The hours stay. The box is already a victory', mood: 0, side: '_',
              run: function (a) { a.add('leader', a.rng(1, 3)); a.add('grassroots', -a.rng(1, 3)); },
              reply: 'She nods once, which is not agreement. It is a record.' },
            { t: 'Announce 24-hour clinics and let the rotas catch up', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'health', 'show');
                a.add('fame', a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3));
              },
              reply: '"Then I will be the one they phone at midnight," she says, "when the announcement is the only thing that opened."' }
          ]
        }
      ]
    },

    {
      id: 'duty-school', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-school'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Education'); },
      others: {
        union: function (a) { return who(a, 'the teachers’ union', ''); },
        exam: function (a) { return who(a, 'the examinations board', ''); }
      },
      where: 'A ministry office the week before the papers go out',
      settleOn: 'grassroots',
      headline: function () { return 'The ministry sat'; },
      opening: function (a) {
        return 'There is a brown envelope on the blotter that nobody has opened, which is how you know it has already been opened somewhere else.\n\n' +
          a.who('exam').name + ' will not sit down. ' + a.who('union').name + ' has already sat, which is its own statement.';
      },
      close: function (a, temp) {
        return {
          warm: '"Then the papers go out as printed," she says. "I have not been able to say that in three years."',
          fair: 'The envelope stays. Somebody will have to be the one who opens it on the record.',
          cool: 'The union is already drafting. The board is already leaking.',
          hostile: 'Nobody shakes your hand. The envelope has gone, which is worse.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'exam', at: 'union',
              t: 'A paper is in a WhatsApp group in three provinces. If we reprint, we miss the date. If we do not, the date is a fraud.' },
            { by: 'union', at: 'exam',
              t: 'Reprint. The teachers did not steal it. Do not punish a year of children for a ministry that cannot keep a cupboard locked.' }
          ],
          q: '"Minister. The date or the paper?"',
          answers: [
            { t: 'Reprint. A stolen paper is not an exam', mood: 2, side: 'union',
              memory: 'You reprinted the leaked exam',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'edu', 'deliver');
                a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(2, 5));
              },
              reply: 'He sits, finally. She is already on the phone to the printers, which is how you know she came prepared for you to do the right thing.' },
            { t: 'Sit the date. Investigate after', mood: 0, side: 'exam',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'edu', 'show');
                a.add('leader', a.rng(1, 4)); a.add('media', -a.rng(2, 6));
              },
              reply: '"Then I will not be the one who signs the results," he says.' },
            { t: 'Sit the date, and fire the principal who is in the group', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'edu', 'rot');
                a.add('party', a.rng(2, 5));
              },
              reply: 'The union stands up. "A principal. Of course. Never the cupboard."' }
          ]
        },
        {
          argument: [
            { by: 'union', t: 'Payroll. Three months. I have teachers who are selling airtime in the staff room to get to school.' },
            { by: '_', t: 'Treasury released against the vote last week. If it has not arrived, that is not a policy problem. That is a theft problem.' }
          ],
          q: '"Do we pay them from a line I do not have, or do we wait for a transfer that may be a rumour?"',
          answers: [
            { t: 'Pay them. I will steal the line from somewhere quieter', mood: 2, side: 'union',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'edu', 'deliver');
                if (RZ.ward) RZ.ward.stamp(a.S, 'wages', 'kept');
                a.add('party', -a.rng(1, 3));
              },
              reply: '"Quieter," she repeats. "I will remember that word when they ask me where it came from."' },
            { t: 'Wait for the transfer. I will not raid another vote', mood: 1, side: '_',
              run: function (a) { a.add('intl', a.rng(1, 3)); a.add('grassroots', -a.rng(2, 5)); },
              reply: 'She has heard this before. She came anyway, which is not the same as believing you.' },
            { t: 'Announce that they have been paid. The announcement sometimes moves a transfer', mood: -2, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'edu', 'show');
                a.add('fame', a.rng(1, 4)); a.add('stats.integrity', -a.rng(2, 4));
              },
              reply: '"Sometimes," she says. "And sometimes a teacher reads the announcement in a staff room that has not been paid."' }
          ]
        }
      ]
    },

    {
      id: 'duty-road', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-road'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Works'); },
      others: {
        site: function (a) { return who(a, 'the resident engineer', ''); },
        firm: function (a) { return who(a, 'the contractor', ''); }
      },
      where: 'A site office in a container, the generator louder than anyone',
      settleOn: 'grassroots',
      headline: function () { return 'The ministry sat'; },
      opening: function (a) {
        return 'The chain-link is new. The road behind it is not. ' + a.who('site').name +
          ' has a clipboard that has been rained on. ' + a.who('firm').name + ' has a clean shirt.\n\n' +
          '"Minister," the Director-General says. "He wants another certificate. The engineer will not sign it."';
      },
      close: function (a, temp) {
        return {
          warm: 'The engineer signs, slowly, as if the pen were evidence. The contractor does not smile.',
          fair: '"Then we will measure again on Monday." Nobody looks convinced Monday is a day.',
          cool: 'The generator keeps going. The clipboard stays unsigned.',
          hostile: 'The contractor is already on the phone. The engineer is already walking toward the gate.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'firm', at: 'site',
              t: 'The layer is down. If you do not certify, my people go home and the rain takes the rest. That is not a threat. That is weather.' },
            { by: 'site', at: 'firm',
              t: 'The layer is forty millimetres where it should be sixty. I can count. So can the next audit.' }
          ],
          q: '"Minister. Do I instruct him to sign?"',
          answers: [
            { t: 'Do not sign. Tear it up and relay it', mood: 2, side: 'site',
              memory: 'You refused to certify a thin road',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'deliver');
                a.add('business', -a.rng(2, 5)); a.add('stats.integrity', a.rng(2, 5));
              },
              reply: 'The contractor looks at you as if you had just cost him a month. You have.' },
            { t: 'Sign it. Get the road open before the rains', mood: 0, side: 'firm',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'show');
                a.add('grassroots', a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3));
              },
              reply: 'The engineer puts the clipboard down without signing and waits to see if you will pick it up.' },
            { t: 'Sign it, and put his cousin on the next package', mood: -2, side: 'firm', tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'rot');
                a.add('party', a.rng(2, 6));
              },
              reply: '"His cousin," the engineer says, very quietly, and writes something that is not a certificate.' }
          ]
        },
        {
          argument: [
            { by: 'site', t: 'There is a second package. A feeder to a ward that votes. The spec is honest. The pressure to skip the first package is not.' },
            { by: 'firm', t: 'I can do both if the certificates keep moving. I cannot do both if we relive the millimetres.' }
          ],
          q: '"Which road is this ministry for?"',
          answers: [
            { t: 'Finish this one properly. The other ward can wait', mood: 2, side: 'site',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'deliver');
                if (RZ.ward) RZ.ward.stamp(a.S, 'road', 'kept');
              },
              reply: 'He nods. The contractor is already calculating a claim.' },
            { t: 'Split the crews. Announce both', mood: 0,
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'show');
                a.add('fame', a.rng(2, 4));
              },
              reply: '"Announce," the engineer says. "That word again."' },
            { t: 'Move everything to the ward that votes', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'infra', 'rot');
                a.add('party', a.rng(3, 7)); a.add('grassroots', a.rng(-2, 4));
              },
              reply: 'The Director-General closes her folder. "Then I know which audit I am packing for."' }
          ]
        }
      ]
    },

    {
      id: 'duty-cluster', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-cluster'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Defence'); },
      others: {
        intel: function (a) { return who(a, 'the intelligence brief', ''); },
        police: function (a) { return who(a, 'the police commissioner', ''); }
      },
      where: 'The cluster room, after hours, no phones on the table',
      settleOn: 'security',
      headline: function () { return 'The cluster sat'; },
      opening: function (a) {
        return 'The map is of a province you have campaigned in. Someone has drawn a circle in red pencil around a stadium.\n\n' +
          '"Minister," the Director-General says. "They are coming off the route. The question is whether we meet them before the stadium or inside it."';
      },
      close: function (a, temp) {
        return {
          warm: '"Then I will take the dogs home," the commissioner says, and for once it sounds like a plan rather than a threat.',
          fair: 'The map is folded. Nobody has decided who keeps the red pencil.',
          cool: 'The brief is already being rewritten for a different reader.',
          hostile: 'They leave you with the map. The circle is still there.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'police', at: 'intel',
              t: 'If they reach the stadium we will have a picture. I can live with a picture. I cannot live with a body.' },
            { by: 'intel', at: 'police',
              t: 'Disperse them on the road and you will have both. I have seen this briefing before. So have you.' }
          ],
          q: '"Minister. The road or the stadium?"',
          answers: [
            { t: 'Let them into the stadium. Police the pitch, not the road', mood: 2, side: 'intel',
              memory: 'You let the march reach the stadium',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'security', 'deliver');
                a.add('media', a.rng(1, 4)); a.add('intl', a.rng(2, 5));
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: 'The commissioner does not like it. He likes it less than the other thing, which is as close as he comes to agreement.' },
            { t: 'Stop them on the road. Quietly', mood: 0, side: 'police',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'security', 'show');
                a.nation('unrest', -a.rng(2, 5)); a.add('media', -a.rng(2, 6));
              },
              reply: '"Quietly," he says, as if the word were equipment he could draw from stores.' },
            { t: 'Stop them on the road. However you have to', mood: -2, side: 'police', tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'security', 'rot');
                a.nation('deaths', a.irange(0, 6)); a.add('intl', -a.rng(3, 8));
                a.add('stats.integrity', -a.rng(2, 6));
              },
              reply: 'The brief closes. The commissioner is already standing. The Director-General does not look at you.' }
          ]
        },
        {
          argument: [
            { by: 'intel', t: 'There is a name. A provincial secretary who is funding the buses. If we pick him up, the buses stop. If we pick him up, the province is a story.' },
            { by: 'police', t: 'I can pick him up at three in the morning. I would rather not pick him up at all.' }
          ],
          q: '"Do we want the buses stopped, or the province quiet?"',
          answers: [
            { t: 'Leave him. Watch the money', mood: 2, side: 'intel',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'security', 'deliver');
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: '"Watch," she says. "I can do watch."' },
            { t: 'Bring him in. Quietly, and let him go before the papers', mood: 0, side: 'police',
              run: function (a) { a.add('party', -a.rng(2, 6)); a.add('security', a.rng(2, 5)); },
              reply: 'He nods. She is already calculating who will phone you first.' },
            { t: 'Pick him up and hold him. The buses are the point', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'security', 'rot');
                a.add('party', -a.rng(4, 9)); a.makeRival();
              },
              reply: '"The province is the point," the Director-General says. "You have just made it one."' }
          ]
        }
      ]
    },

    {
      id: 'duty-shaft', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-shaft'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Mines'); },
      others: {
        shaft: function (a) { return who(a, 'the NUM shaft chair', ''); },
        house: function (a) { return who(a, 'the house lawyer', 'the company'); }
      },
      where: 'A lamp room that still smells of last night’s shift',
      settleOn: 'business',
      headline: function () { return 'The ministry sat'; },
      opening: function (a) {
        return 'Someone has put two mugs down and neither of them is for you. The royalty schedule is in a folder that has not been photocopied, which is the whole of the problem.\n\n' +
          '"Minister," the Director-General says. "They want a number in the gazette. The house wants it to stay in the folder."';
      },
      close: function (a, temp) {
        return {
          warm: 'The chair folds the copy into his jacket. "Then I have something to take underground."',
          fair: 'The folder closes. Both of them came for a number. One of them got a sentence.',
          cool: 'The lawyer is already in the car. The chair is already on a bench outside.',
          hostile: 'Nobody finishes the tea. The lamp room goes back to being a lamp room.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'shaft', at: 'house',
              t: 'We have been at this grade for six years. The gold price is not a rumour. The royalty is.' },
            { by: 'house', at: 'shaft',
              t: 'Publish the schedule and the next house that looks at this country will look somewhere else. I am not bluffing. I have the term sheet.' }
          ],
          q: '"Minister. The gazette or the folder?"',
          answers: [
            { t: 'Gazette it. A royalty that cannot be read is a theft', mood: 2, side: 'shaft',
              memory: 'You published the royalty schedule',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'deliver');
                a.add('intl', a.rng(2, 6)); a.add('business', -a.rng(2, 6));
                a.add('stats.integrity', a.rng(2, 5));
              },
              reply: 'The lawyer closes the term sheet without slamming it, which is how you know it was expected.' },
            { t: 'Keep it in the folder. I will not chase a house out of the country', mood: 1, side: 'house',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'show');
                a.add('business', a.rng(3, 7)); a.add('grassroots', -a.rng(2, 6));
              },
              reply: 'The chair looks at the mug that was not for you. "Then I know what I am taking underground."' },
            { t: 'A side letter. Published enough for the union, quiet enough for the house', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'rot');
                a.add('money', a.wage(a.rng(3, 8)));
              },
              reply: 'Both of them look at you with the same face. That is not a compromise. That is a third document.' }
          ]
        },
        {
          argument: [
            { by: 'shaft', t: 'Retrenchments. Eight hundred, they say, after the next shift cycle. We are not asking for a favour. We are asking whether this ministry is in the room when they do it.' },
            { by: 'house', t: 'Eight hundred is the number that keeps the rest. If you block it, the number becomes the rest.' }
          ],
          q: '"Are we here for the eight hundred, or for the mine?"',
          answers: [
            { t: 'No retrenchments this cycle. Find the saving somewhere else', mood: 2, side: 'shaft',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'deliver');
                if (RZ.ward) RZ.ward.stamp(a.S, 'jobs', 'kept');
                a.add('business', -a.rng(3, 7)); a.blocs({ labour: a.rng(4, 9) });
              },
              reply: 'The lawyer is already calculating a force majeure letter. The chair is already calculating a meeting.' },
            { t: 'A freeze on the eight hundred. Review in ninety days', mood: 1,
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'show');
                a.promise('retrench', 'To stop eight hundred retrenchments at the mine', { due: 4 });
              },
              reply: '"Ninety days is a shift cycle," the chair says. "I can count."' },
            { t: 'Let them go. Protect the mine', mood: -1, side: 'house',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'mines', 'rot');
                a.blocs({ labour: -a.rng(5, 11) }); a.add('business', a.rng(3, 7));
              },
              reply: 'The chair stands. He does not take the mug. "Then I will tell them who sat in the lamp room."' }
          ]
        }
      ]
    },

    {
      id: 'duty-list', topic: 'ministry', weight: 20,
      when: function (a) { return sitting(a, 'duty-list'); },
      speaker: function (a) { return who(a, 'Director-General', a.P.ministry || 'Local Government'); },
      others: {
        list: function (a) { return who(a, 'the housing clerk', ''); },
        chief: function (a) { return who(a, cap(a.t.elder), a.homeName()); }
      },
      where: 'A municipal chamber with a printout that has been folded twice',
      settleOn: 'grassroots',
      headline: function () { return 'The ministry sat'; },
      opening: function (a) {
        return 'The printout is longer than the meeting. Names, ID numbers, and in the margin a different handwriting.\n\n' +
          '"Minister," the Director-General says. "The list that was gazetted is not the list that is being allocated. ' +
          a.who('list').name + ' can show you where."';
      },
      close: function (a, temp) {
        return {
          warm: 'The clerk puts the printout in a tray marked for the gazette. It is the first honest tray in the room.',
          fair: 'A new list will be typed. Whether it is a different list is a later question.',
          cool: 'The handwriting in the margin has not been explained. Nobody asked it to be.',
          hostile: 'The printout goes back into a drawer that does not have a label.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'list', at: 'chief',
              t: 'Fourteen names on page four are not on the waiting list at all. They are on a family tree. I can show you the tree.' },
            { by: 'chief', at: 'list',
              t: 'Those fourteen built this municipality. A waiting list is a document. A community is not.' }
          ],
          q: function (a) {
            return '"Minister. The gazette, or the tree?"';
          },
          answers: [
            { t: 'Gazette the waiting list. Take the fourteen off', mood: 2, side: 'list',
              memory: 'You struck family names off a housing list',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'local', 'deliver');
                if (RZ.ward) RZ.ward.stamp(a.S, 'housing', 'kept');
                a.blocs({ youth: a.rng(4, 9), chiefs: -a.rng(3, 8) });
                a.add('stats.integrity', a.rng(2, 5));
              },
              reply: 'The clerk does not smile. She has been waiting to be told to do this for a year, and she knows what it will cost you.' },
            { t: 'Keep the fourteen. They are the municipality', mood: 0, side: 'chief',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'local', 'show');
                a.blocs({ chiefs: a.rng(3, 7), youth: -a.rng(3, 7) });
              },
              reply: '"The municipality," the clerk says, and underlines a name that is not fourteen.' },
            { t: 'A parallel list. Gazette one, allocate the other', mood: -2, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'local', 'rot');
                a.add('party', a.rng(2, 6));
              },
              reply: 'Both of them look at you. The Director-General closes her pen. "That is two frauds. I can only type one."' }
          ]
        },
        {
          argument: [
            { by: 'chief', t: function (a) {
              return 'There is a stand in ' + a.homeName() + ' that has your name whispered against it. I did not put it there. I am telling you it is there.';
            } },
            { by: 'list', t: 'If it is on the list, I can strike it. If you tell me to leave it, I will leave it, and I will remember who told me.' }
          ],
          q: '"Your name is in the margin. What do I do with the margin?"',
          answers: [
            { t: 'Strike it. In front of both of you', mood: 2, side: 'list',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'local', 'deliver');
                a.add('stats.integrity', a.rng(3, 6)); a.add('fame', a.rng(1, 3));
              },
              reply: 'She strikes it. He watches her do it. That is the whole of the meeting, and it will travel.' },
            { t: 'Leave it. I did not put it there and I will not make a theatre of denying it', mood: -1, side: 'chief',
              run: function (a) {
                a.add('stats.cunning', a.rng(1, 3)); a.add('media', -a.rng(1, 4));
                a.dirt('stand', 'A stand in the home ward with your name in the margin', 2);
              },
              reply: 'The clerk does not strike it. She dates the page instead.' },
            { t: 'Put it in my spouse’s name and stop whispering', mood: -3, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyDuty(a, 'local', 'rot');
                a.add('stats.integrity', -a.rng(3, 7));
                a.dirt('stand', 'A stand allocated to your household from a list you signed', 4);
              },
              reply: 'Nobody writes that down. They do not have to.' }
          ]
        }
      ]
    },

    {
      id: 'friday-ward', topic: 'friday', weight: 20,
      when: function (a) { return a.tier() >= 4 && a.tier() <= 8 && !a.P.isPresident; },
      speaker: function (a) { return who(a, 'your organiser', a.C.terms.constituency); },
      others: {
        elder: function (a) { return who(a, a.t.elder, a.homeName()); },
        nurse: function (a) { return who(a, 'the clinic nurse', a.homeName()); }
      },
      where: function (a) { return 'A yard in ' + a.homeName() + ', Friday, the car still hot'; },
      settleOn: 'grassroots',
      headline: function () { return 'You went home'; },
      opening: function (a) {
        if (RZ.ward && RZ.ward.markFriday) RZ.ward.markFriday(a.S);
        var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { a: 'the borehole', b: 'the clinic', job: 'the yard' };
        var rumour = a.S.flags && a.S.flags.inheritance
          ? ' They still talk about ' + a.S.flags.inheritance.name + ' in this ' + m.job + '.\n\n'
          : '';
        return 'The chairs are already out. ' + a.who('elder').name + ' has been here since the morning. ' +
          a.who('nurse').name + ' has a book of names the clinic has run out of.' + rumour +
          '\n\n"You came," your organiser says, as if that were the surprising part. ' +
          m.job.charAt(0).toUpperCase() + m.job.slice(1) + ' is not the capital.';
      },
      close: function (a, temp) {
        return {
          warm: 'You stay until the last taxi. Somebody puts a plate in front of you without asking.',
          fair: 'You are back on the road before dark. They noticed you came. They also noticed you left.',
          cool: 'The nurse closes the book. The elder does not walk you to the car.',
          hostile: 'Somebody took a photograph of the empty chair next to you. It will not need a caption.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'elder', at: 'nurse',
              t: function (a) {
                var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { a: 'a borehole', b: 'the clinic' };
                return 'We have been promised ' + m.a + ' in three different colours of tent. I am tired of tents.';
              } },
            { by: 'nurse', at: 'elder',
              t: function (a) {
                var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { a: 'a borehole', b: 'the clinic' };
                return m.a.charAt(0).toUpperCase() + m.a.slice(1) + ' can wait. I have ' + m.b + ', and a child who needed the vaccine yesterday.';
              } }
          ],
          q: '"They will not both fit in one Friday. Which one are you actually here for?"',
          answers: [
            { t: function (a) {
                var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { b: 'the fridge' };
                return m.b.charAt(0).toUpperCase() + m.b.slice(1) + '. I will ring the ministry on Monday';
              }, mood: 2, side: 'nurse',
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.wardTrust(a.rng(3, 6));
                a.blocs({ rural: a.rng(2, 5), labour: a.rng(1, 4) });
                a.promise('clinic', 'That the district clinic will be stocked within a year');
              },
              reply: 'She writes Monday in the book. The elder watches her do it, which is how a promise becomes public.' },
            { t: function (a) {
                var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { a: 'the borehole' };
                return m.a.charAt(0).toUpperCase() + m.a.slice(1) + '. I said it in this yard before';
              }, mood: 2, side: 'elder',
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.wardTrust(a.rng(3, 6));
                a.blocs({ rural: a.rng(3, 7), chiefs: a.rng(1, 4) });
                a.promise('borehole', 'A borehole for ' + a.homeName() + ', before the next rains');
              },
              reply: 'He nods once. The nurse closes the book on her finger, so she does not lose the page.' },
            { t: 'Both, in the speech. I cannot choose in front of them', mood: -1, tag: 'risk',
              run: function (a) {
                a.add('fame', a.rng(1, 3)); a.wardTrust(-a.rng(1, 3));
                a.add('stats.integrity', -a.rng(0, 2));
              },
              reply: 'Your organiser looks at the empty chair. "That is how we got the three colours of tent."' }
          ]
        },
        {
          argument: [
            { by: 'elder', t: 'There is a funeral tomorrow. Everybody knows who is supposed to carry it. If you are in the capital, they will say so from the podium.' },
            { by: 'nurse', t: 'If you stay, I can take you through the clinic at seven, before anyone has made it a photograph.' }
          ],
          q: '"Tomorrow is Saturday. The capital does not know that."',
          answers: [
            { t: 'I will carry it. Then the clinic at seven', mood: 2, side: 'elder',
              memory: 'You carried a coffin in your own yard on a Saturday',
              memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', a.rng(4, 8)); a.wardTrust(a.rng(4, 8));
                a.add('health', -a.rng(2, 4)); a.add('money', -a.wage(0.4));
              },
              reply: '"Then you are here," he says, which is the only compliment this yard knows how to give.' },
            { t: 'The clinic at seven. I cannot do the funeral', mood: 1, side: 'nurse',
              run: function (a) {
                a.add('grassroots', a.rng(2, 5)); a.wardTrust(a.rng(1, 4));
                a.add('health', -a.rng(1, 2));
              },
              reply: 'The elder does not argue. He will mention the absence from the podium, and that will be the argument.' },
            { t: 'I have to be back. Put my name on the envelope', mood: -2, tag: 'risk',
              memory: 'You put your name on an envelope and left before the funeral',
              memoryTone: 'bad',
              run: function (a) {
                a.add('money', -a.wage(0.6)); a.wardTrust(-a.rng(3, 7));
                a.add('stats.integrity', -a.rng(1, 3));
              },
              reply: 'Your organiser takes the envelope. Nobody looks at you while he does it.' }
          ]
        }
      ]
    },

    {
      id: 'ribbon-day', topic: 'crisis', weight: 8,
      when: function (a) { return a.tier() >= 4 && !!(a.S.flags && a.S.flags.ribbon); },
      speaker: function (a) { return who(a, a.t.elder, a.homeName()); },
      others: {
        rival: function (a) { return who(a, 'the one with the bigger car', a.homeName()); },
        nurse: function (a) { return who(a, 'the person who will actually use it', a.homeName()); }
      },
      where: function (a) {
        var r = a.S.flags.ribbon || {};
        return 'A tent, a ribbon, and ' + (r.name || 'the thing') + ' behind it';
      },
      settleOn: 'grassroots',
      headline: function (a) {
        var r = a.S.flags.ribbon || {};
        return (r.ico ? r.ico + ' ' : '') + cap((r.name || 'the project')) + ' is open';
      },
      opening: function (a) {
        var r = a.S.flags.ribbon || {};
        return 'The ribbon is thinner than the photographs will suggest. ' +
          a.who('rival').name + ' arrived late, in a bigger car, and the elders noticed both things.\n\n' +
          '"It exists," ' + a.them.name + ' says. "That is rarer than a speech. Now: whose name is on the plaque?"';
      },
      close: function (a, temp) {
        a.S.flags.ribbon = null;
        return {
          warm: 'People who did not vote for you came anyway. That is a different category of fact from having promised it.',
          fair: 'The tent comes down before you leave. The thing stays.',
          cool: 'The bigger car leaves first. Somebody took a photograph of that as well.',
          hostile: 'The plaque is already a debate. The thing behind it is not.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'rival', at: 'nurse',
              t: 'I applied for this before you had a title. If the plaque has one name on it, it should not be the late one.' },
            { by: 'nurse', at: 'rival',
              t: 'I do not care whose name is on it if the fridge holds a temperature. Put a committee on it. Put nobody. Leave the electricity on.' }
          ],
          q: '"The plaque is already made. It has a space. What do I tell the man with the drill?"',
          answers: [
            { t: 'My name. I got it here', mood: 0, side: 'rival',
              run: function (a) {
                a.add('fame', a.rng(2, 5)); a.wardTrust(a.rng(-1, 3));
                a.add('stats.integrity', -a.rng(0, 2));
              },
              reply: 'The drill starts. The nurse looks at the fridge instead.' },
            { t: 'No name. The thing is the point', mood: 2, side: 'nurse',
              memory: 'You left the plaque blank',
              memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.wardTrust(a.rng(4, 8));
                a.add('stats.integrity', a.rng(2, 4));
              },
              reply: 'He puts the plaque down. The rival does not know what to do with his hands.' },
            { t: 'Both names. I am not going to war over a piece of brass', mood: 1,
              run: function (a) {
                a.add('party', a.rng(1, 4)); a.wardTrust(a.rng(1, 4));
              },
              reply: '"Both," the rival says, too quickly, which is how you know it was the victory he came for.' }
          ]
        },
        {
          argument: [
            { by: 'nurse', t: 'There is a second site, half-poured, with your name on a sign that nobody has taken down. People drove past it to get here.' },
            { by: 'rival', t: 'If you mention it you gift me the afternoon. If you do not, I will mention it.' }
          ],
          q: '"The abandoned one is visible from here. What do you do with a visible failure on a day of success?"',
          answers: [
            { t: 'Name it. I failed that one. This one exists', mood: 2, side: 'nurse',
              run: function (a) {
                a.add('stats.integrity', a.rng(2, 5)); a.wardTrust(a.rng(2, 5));
                a.add('media', a.rng(1, 4));
              },
              reply: 'The rival had a line prepared. He has to sit down without using it.' },
            { t: 'Do not mention it. Today is for the thing that opened', mood: 0, side: 'rival',
              run: function (a) { a.add('fame', a.rng(1, 3)); a.wardTrust(-a.rng(0, 3)); },
              reply: 'He mentions it. Of course he does. The nurse looks at you, not at him.' },
            { t: 'Promise the second site a date, from this podium', mood: -1, tag: 'risk',
              run: function (a) {
                a.promise('second-site', 'The abandoned site finished, promised from a podium on ribbon day', { due: 10 });
                a.add('grassroots', a.rng(2, 5)); a.add('stats.integrity', -a.rng(1, 3));
              },
              reply: '"A date," your organiser mutters, who had thought the afternoon was over.' }
          ]
        }
      ]
    },

    {
      id: 'manifesto-desk', topic: 'crisis', weight: 8,
      when: function (a) { return a.tier() >= 4 && !(RZ.ward && RZ.ward.hasManifesto(a.S)); },
      speaker: function (a) { return who(a, 'your campaign manager', ''); },
      others: {
        writer: function (a) { return who(a, 'the poster writer', ''); },
        organiser: function (a) { return who(a, 'the branch organiser', a.C.terms.constituency); }
      },
      where: 'A back room, three versions of a poster, none of them finished',
      settleOn: 'grassroots',
      headline: function () { return 'The manifesto has three lines'; },
      opening: function (a) {
        if (RZ.ward) RZ.ward.initManifesto(a.S);
        return 'The printer is waiting for a file. ' + a.who('writer').name + ' has a marker. ' +
          a.who('organiser').name + ' has a ward that will read whatever you put on the taxi.\n\n' +
          '"Three lines," your campaign manager says. "Not a programme. Three things they can hold you to. If you cannot name them now, the count will name them for you."';
      },
      close: function (a, temp) {
        var n = (a.S.manifesto && a.S.manifesto.items && a.S.manifesto.items.length) || 0;
        if (n < 3 && RZ.ward) {
          ['clinic', 'road', 'jobs'].forEach(function (id) { RZ.ward.pickManifesto(a.S, id); });
        }
        return {
          warm: 'The printer starts. Three lines. They will still be on the taxi in four years.',
          fair: 'The file goes. Nobody in the room is sure they are the right three. That is what a manifesto is.',
          cool: 'The marker cap goes back on. The organiser does not look at the poster.',
          hostile: 'They print it anyway. You will be asked about it on a platform, in a language you do not speak.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'organiser', at: 'writer',
              t: 'The clinic. If it is not on the poster, I cannot walk into that yard.' },
            { by: 'writer', at: 'organiser',
              t: 'A clinic is a building. A road is a photograph. I need a photograph.' }
          ],
          q: '"Line one. The ward."',
          answers: [
            { t: 'A clinic that actually has drugs in it', mood: 2, side: 'organiser',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'clinic'); },
              reply: 'She underlines it twice. The writer sighs, and then writes it large, which is the concession.' },
            { t: 'A tarred road out of the ward', mood: 1, side: 'writer',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'road'); },
              reply: 'He already has the photograph in his head. The organiser sits back, which is not agreement.' },
            { t: 'Water that runs more than twice a week', mood: 2,
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'water'); },
              reply: '"Water," the organiser says. "At least it is a thing people drink."' }
          ]
        },
        {
          argument: [
            { by: 'writer', t: 'The young ones do not vote for a borehole. They vote for a job, or they do not vote.' },
            { by: 'organiser', t: 'A school that opens is a job for a teacher and a reason for a parent. Do not invent a public works programme on a poster.' }
          ],
          q: '"Line two. The young."',
          answers: [
            { t: 'A secondary school that opens on time', mood: 2, side: 'organiser',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'school'); },
              reply: 'She writes it. He wants a skyline. He gets a timetable.' },
            { t: 'Work for the young people who have stopped asking', mood: 1, side: 'writer',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'jobs'); },
              reply: 'He grins. She does not. "Stopped asking," she repeats. "That will age."' },
            { t: 'A housing list that is not a family tree', mood: 1,
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'housing'); },
              reply: '"That one," the organiser says, "will make me enemies I already have."' }
          ]
        },
        {
          argument: [
            { by: 'organiser', t: 'Pay the nurses. If you cannot, do not put nurses on the poster.' },
            { by: 'writer', t: 'Light after six. I can shoot that. I cannot shoot a payroll.' }
          ],
          q: '"Line three. The state, as they meet it."',
          answers: [
            { t: 'Nurses and teachers paid on the date they were promised', mood: 2, side: 'organiser',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'wages'); },
              reply: '"A date," she says. "They will bring the calendar."' },
            { t: 'Light that stays on after six', mood: 1, side: 'writer',
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'power'); },
              reply: 'He already has the shot: a kitchen, a child, a bulb. You hope the grid cooperates.' },
            { t: 'The clinic again — stocked, not just built', mood: 1,
              run: function (a) { if (RZ.ward) RZ.ward.pickManifesto(a.S, 'clinic'); },
              reply: 'The manager pinches the bridge of her nose. "Two lines about the same building. Fine. At least you will be asked once."' }
          ]
        }
      ]
    },

    {
      id: 'nation-address', topic: 'address', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); },
        sg: function (a) { return who(a, 'Secretary-General of the Party', ''); }
      },
      where: 'A holding room behind the podium, twenty minutes out',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.sona;
        if (last === 'deliver') return 'You named the clinics';
        if (last === 'unity') return 'You asked the country to wait';
        if (last === 'fight') return 'You named an enemy';
        return 'You addressed the nation';
      },
      opening: function (a) {
        return 'The makeup is already on. The speech in your hand is not the speech on the podium; that one is still being argued in this room.\n\n' +
          a.who('purse').name + ' has a paragraph about fiscal space. ' + a.who('sg').name +
          ' has a paragraph about the provinces. The Secretary has a watch.\n\n' +
          '"Twenty minutes," he says. "The country is already sitting down. What do you actually want to say?"';
      },
      close: function (a, temp) {
        a.S.flags.sonaYear = a.S.date.year;
        return {
          warm: 'The floor manager opens the door. For a moment the holding room is quiet enough to hear the anthem.',
          fair: 'You walk. The speech in your hand is shorter than the one you arrived with. That is usually an improvement.',
          cool: 'They follow you to the wing and no further. The podium is yours, which is not the same as the country.',
          hostile: 'Nobody wishes you luck. The Secretary checks the watch again, as if the nation were a train.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'purse', at: 'sg',
              t: 'If you promise clinics you cannot fund, the rating agencies will write the next speech. I am begging you for one honest paragraph about the debt.' },
            { by: 'sg', at: 'purse',
              t: 'If you open with the debt you have already lost the floor. The provinces did not send people to hear a spreadsheet.' }
          ],
          q: '"The first paragraph. What is this speech for?"',
          answers: [
            { t: 'Delivery. I will name the clinics, the roads, the dates', mood: 2, side: 'sg',
              run: function (a) {
                a.S.flags.sona = 'deliver';
                a.add('grassroots', a.rng(3, 8)); a.add('intl', -a.rng(1, 4));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(2, 6), 3, 95);
              },
              reply: 'The SG folds the debt paragraph away. Finance does not. He will find another door.' },
            { t: 'The books. One honest paragraph, even if they cough', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.sona = 'books';
                a.add('intl', a.rng(3, 8)); a.add('business', a.rng(2, 6));
                a.add('grassroots', -a.rng(2, 6));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(0, 3), 3, 95);
              },
              reply: '"Honest," the SG says, as if it were a dialect he does not speak on television.' },
            { t: 'Both, badly. A sentence of each', mood: -1,
              run: function (a) {
                a.S.flags.sona = 'muddle';
                a.add('media', -a.rng(1, 4));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval - a.rng(0, 3), 3, 95);
              },
              reply: 'The Secretary makes a small noise. He has heard this speech. The country has too.' }
          ]
        },
        {
          argument: [
            { by: 'sg', t: 'There is a province that has not been named in three addresses. They have counted. If you skip them again I will hear about it before you are off the podium.' },
            { by: 'purse', t: 'Naming a province is a line item. The moment you name it, it is in the estimates. I would rather it stayed a greeting.' }
          ],
          q: '"Do we name the province?"',
          answers: [
            { t: 'Name it. Name the road. They have counted', mood: 2, side: 'sg',
              run: function (a) {
                a.add('party', a.rng(3, 7)); a.add('leader', a.rng(1, 4));
                a.addRegion(a.P.regionId, a.rng(1, 3));
              },
              reply: 'Finance writes a number in the margin of a speech that is no longer about numbers.' },
            { t: 'A greeting, not a road. I will not write an estimate on air', mood: 1, side: 'purse',
              run: function (a) { a.add('intl', a.rng(1, 3)); a.add('party', -a.rng(1, 4)); },
              reply: 'The SG looks at the watch with the Secretary. They are on the same side now, against you.' },
            { t: 'Skip them. I am not bargaining with a provincial executive from a podium', mood: -2, tag: 'risk',
              run: function (a) {
                a.add('party', -a.rng(4, 9)); a.makeRival();
              },
              reply: '"Then I will take the call," the SG says. "You will hear it as a statement."' }
          ]
        },
        {
          argument: [
            { by: 'sg', t: 'Last choice. You can ask them to wait, you can name an enemy, or you can sit down after the delivery paragraph and not decorate it.' },
            { by: 'purse', t: 'If you name an enemy I will need a market open on Monday. If you ask them to wait I will need a miracle. Sitting down is underrated.' }
          ],
          q: '"The last beat. The cameras are live in four minutes."',
          answers: [
            { t: 'Sit down after the dates. Do not decorate it', mood: 2, side: 'purse',
              memory: 'You sat down after the dates, on air',
              memoryTone: 'good',
              run: function (a) {
                a.S.flags.sona = 'deliver';
                a.add('media', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 5));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(2, 5), 3, 95);
                a.nation('unrest', -a.rng(1, 4));
              },
              reply: 'The Secretary almost smiles. "Then I will cut the last two pages. They were decoration."' },
            { t: 'Ask the country to wait. One more year', mood: 0, side: 'sg',
              run: function (a) {
                a.S.flags.sona = 'unity';
                a.add('party', a.rng(2, 6)); a.add('grassroots', -a.rng(1, 4));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(0, 3), 3, 95);
              },
              reply: '"Wait," Finance says. "The most expensive word in the language."' },
            { t: 'Name the people who are standing in the way', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.sona = 'fight';
                a.add('fame', a.rng(3, 7)); a.add('media', a.rng(2, 6));
                a.add('party', -a.rng(2, 6)); a.makeRival();
                a.nation('unrest', a.rng(1, 5));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(-1, 4), 3, 95);
              },
              reply: 'The SG looks sick, then interested. That combination is how factions start.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.10.0 — STATE HOUSE
       The briefing is the job. A censure is a room. The summit is a
       corridor, not a communiqué. Rogue State's cabinet-as-toolbox,
       written as meetings.
       ================================================================ */

    {
      id: 'cabinet-brief', topic: 'brief', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        left: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pickBrief(a.S); }
          return cabWho(a, 'briefLeft', 'Minister of Finance', 'the Treasury');
        },
        right: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pickBrief(a.S); }
          return cabWho(a, 'briefRight', 'Minister of Health', '');
        }
      },
      where: 'The cabinet room, before the agenda, with one folder on the table',
      settleOn: 'leader',
      headline: function (a) {
        var q = a.S.flags.houseQuality;
        if (q === 'deliver') return 'The minute funded what the folder asked';
        if (q === 'rot') return 'The briefing became a tender';
        if (q === 'show') return 'The minute was an announcement';
        return 'Cabinet briefed the chair';
      },
      opening: function (a) {
        if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pickBrief(a.S); }
        var w = fileWorst(a);
        var hot = RZ.state && RZ.state.hottestRegion ? RZ.state.hottestRegion(a.S) : { name: 'the provinces' };
        return 'The folder is already open. ' + w.label + ' is the number on top, at ' + w.shown +
          '. ' + hot.name + ' is the province that has been calling since Monday.\n\n' +
          a.who('left').name + ' has a proposal. ' + a.who('right').name + ' has a different one.\n\n' +
          '"The country is this folder," the Secretary says. "You have one minute this month. Whose?"';
      },
      close: function (a, temp) {
        return {
          warm: 'He dates the minute as if it had always been this short. The folder closes.',
          fair: '"It will go in as a decision." He does not say whose. He does not have to, any more.',
          cool: 'The one who lost leaves first. The folder stays. So does the number on top of it.',
          hostile: 'Nobody picks the folder up. The Secretary dates a minute that says the item was noted, which in this building is a kind of defeat.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'left', at: 'right', t: function (a) { return briefKind(a, 'briefLeft').open; } },
            { by: 'right', at: 'left', t: function (a) { return briefKind(a, 'briefRight').open; } },
            { by: 'left', at: 'right', t: function (a) { return briefKind(a, 'briefLeft').ask; } }
          ],
          q: '"That is the file," the Secretary says, and he is not writing yet. "Which number is this month for?"',
          answers: [
            { t: function (a) { return a.who('left').name + '. Their number is the minute'; }, mood: 1, side: 'left',
              run: function (a) {
                a.S.flags.houseSide = 'left';
                a.add('leader', a.rng(1, 3));
              },
              reply: function (a) {
                return a.who('right').name + ' closes their copy, slowly, so that the sound is the decision.';
              } },
            { t: function (a) { return a.who('right').name + '. Write it theirs'; }, mood: 1, side: 'right',
              run: function (a) {
                a.S.flags.houseSide = 'right';
                var swap = a.S.flags.briefLeft;
                a.S.flags.briefLeft = a.S.flags.briefRight;
                a.S.flags.briefRight = swap;
                a.add('leader', a.rng(1, 3));
              },
              reply: function (a) {
                return a.who('left').name + ' looks at the Secretary, not at you. "Then I will need a sentence for my people by noon."';
              } },
            { t: 'Neither. Split the file and date it as unanimous', mood: -2,
              run: function (a) {
                a.S.flags.houseSide = 'split';
                a.add('leader', -a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 3));
              },
              reply: '"Unanimous," he says, "is a word that will be read back to you by whoever lost."' }
          ]
        },
        {
          argument: [
            { by: 'left', t: function (a) { return briefKind(a, 'briefLeft').deliver; } },
            { by: 'right', t: function (a) { return briefKind(a, 'briefRight').ask; } }
          ],
          q: '"A number is not a policy," the Secretary says. "What actually leaves this room?"',
          answers: [
            { t: 'Fund it. Dates, a line, a name on the tender', mood: 2, side: 'left',
              run: function (a) {
                var kind = (RZ.state && a.S.flags.briefLeft) ? RZ.state.ministryKind(a.S, a.S.flags.briefLeft) : 'service';
                a.S.flags.houseKind = kind;
                a.S.flags.houseIntent = 'deliver';
                a.add('capital', -3);
              },
              reply: 'He writes a date. Finance, whoever that currently is, makes a small noise.' },
            { t: 'Announce it. A task team and a summit, on air this week', mood: 0, side: 'right',
              run: function (a) {
                var kind = (RZ.state && a.S.flags.briefLeft) ? RZ.state.ministryKind(a.S, a.S.flags.briefLeft) : 'service';
                a.S.flags.houseKind = kind;
                a.S.flags.houseIntent = 'show';
                a.add('fame', a.rng(1, 3));
              },
              reply: '"A task team." He has written this sentence before. So has the country.' },
            { t: 'The usual cousin. Someone in this room already has a company', mood: -2, tag: 'risk',
              run: function (a) {
                var kind = (RZ.state && a.S.flags.briefLeft) ? RZ.state.ministryKind(a.S, a.S.flags.briefLeft) : 'service';
                a.S.flags.houseKind = kind;
                a.S.flags.houseIntent = 'rot';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'Nobody looks at anybody. That is how you know it is already arranged.' }
          ]
        },
        {
          argument: [
            { by: 'left', t: 'If you sign it, I will be the one they call when it arrives. If you do not, I will be the one they call when it does not.' },
            { by: 'right', t: 'And if you sign it badly, both of us will be in the Sunday paper, and only one of us will still have a chair.' }
          ],
          q: '"The minute. I need a verb."',
          answers: [
            { t: 'Sign it. The country is the folder', mood: 2, side: 'left',
              memory: 'You signed the briefing and put a date on it',
              memoryTone: 'good',
              run: function (a) {
                var kind = a.S.flags.houseKind || 'service';
                var intent = a.S.flags.houseIntent || 'deliver';
                if (RZ.state) RZ.state.applyHouse(a, kind, intent === 'rot' ? 'rot' : 'deliver');
              },
              reply: 'He dates it. The folder is thinner than when you sat down, which is usually an improvement.' },
            { t: 'A statement. I will not write an estimate in this room', mood: 0, side: 'right',
              run: function (a) {
                var kind = a.S.flags.houseKind || 'service';
                if (RZ.state) RZ.state.applyHouse(a, kind, 'show');
              },
              reply: '"A statement." He has a template. The country has heard it.' },
            { t: 'Note it and move on. Next month has a different number', mood: -1, tag: 'risk',
              run: function (a) {
                var kind = a.S.flags.houseKind || 'service';
                if (RZ.state) RZ.state.applyHouse(a, kind, a.S.flags.houseIntent === 'rot' ? 'rot' : 'show');
                a.add('leader', -a.rng(1, 3));
              },
              reply: 'The folder stays open. The number on top of it does not move. He dates a minute that says noted.' }
          ]
        }
      ]
    },

    {
      id: 'house-censure', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the Speaker', a.C.house.name); },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        opp: function (a) { return who(a, 'Leader of the Opposition', ''); }
      },
      where: 'The Speaker’s office, with the bells already ringing',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.censure;
        if (last === 'whip') return 'The House held';
        if (last === 'cut') return 'You gave them a minister';
        if (last === 'dissolve') return 'Parliament dissolved';
        if (last === 'lost') return 'The motion carried';
        return 'A motion was tabled';
      },
      opening: function (a) {
        var parl = a.C.system === 'parl';
        var n = Math.round(a.S.nation.govApproval);
        var h = houseCount(a);
        var count = parl
          ? 'You have ' + h.have + '. You need ' + h.need + '.' +
            (h.paper ? ' There is a paper this year.' : ' There is no paper.')
          : 'Approval is ' + n + '.';
        return (parl
            ? 'The Speaker has not sat down. That is how you know it is not a debate. In this House a motion of no confidence is a vote, and a vote is a chair.\n\n'
            : 'The Clerk has a motion. It cannot remove you. It can make the rest of the term a trial.\n\n') +
          a.who('whip').name + ' has a count. ' + a.who('opp').name + ' has a smile that has been practised.\n\n' +
          '"' + count + '" the Speaker says. "The bells are ringing. What do you actually want to survive?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The bells stop. The Speaker sits, which is the only congratulations this room offers.',
          fair: '"The House has expressed itself." He does not say how. The record will.',
          cool: 'They file out in the order the count predicted. You wait until the door has shut twice.',
          hostile: 'The Speaker looks at the empty chair as if it were already a precedent.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'opp',
              t: 'I have a count. It is not a comfortable count. If you want me to make it comfortable I need something I can take down the corridor.' },
            { by: 'opp', at: 'whip',
              t: 'Comfortable is a word for people who still have a majority. I have the motion, I have the floor, and I have tonight.' }
          ],
          q: '"Do we even have the numbers?"',
          answers: [
            { t: 'Whip it. Every name, every office, until the count holds', mood: 1, side: 'whip',
              run: function (a) {
                a.add('capital', -8); a.add('party', a.rng(2, 6)); a.add('leader', a.rng(1, 4));
                a.S.flags.censurePlan = 'whip';
              },
              reply: 'The Whip writes three names. "These three will cost you. The rest will cost the country."' },
            { t: 'Give them a head. One minister, tonight, before the vote', mood: 0, side: 'opp',
              run: function (a) {
                a.S.flags.censurePlan = 'cut';
                a.add('party', -a.rng(1, 4));
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  RZ.state.choppingBlock(a.S);
                }
              },
              reply: 'The Opposition almost looks disappointed. A scalp is not a government, but it is a headline.' },
            { t: 'Let it run. I am not bargaining with a motion from this office', mood: -2, tag: 'risk',
              run: function (a) {
                a.S.flags.censurePlan = 'stand';
                a.add('leader', a.rng(2, 5)); a.add('party', -a.rng(3, 8));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval - a.rng(2, 6), 3, 95);
              },
              reply: '"Then I will not be asked to find a line," the Whip says, "which is the first honest thing that has happened this morning."' }
          ]
        },
        {
          argument: [
            { by: 'opp', t: 'I can withdraw. I will not withdraw for a statement. I will withdraw for a chair, or for an election, or for nothing.' },
            { by: 'whip', t: 'If you dissolve I have to fight fifty seats in five months with a chest I do not have. If you cut I have to explain a colleague. If you whip I have to live with three people who will never forget the corridor.' }
          ],
          q: '"What is the offer?"',
          answers: [
            { t: 'A chair. The one who has been briefing against me', mood: 1, side: 'opp',
              run: function (a) {
                a.S.flags.censurePlan = 'cut';
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  var block = RZ.state.choppingBlock(a.S);
                  if (block && block.cut) RZ.state.dropMinister(a.S, block.cut.ministryId);
                }
                a.add('leader', a.rng(1, 4)); a.add('party', -a.rng(3, 7));
              },
              reply: function (a) {
                return 'The Whip looks at the door. "Then I will fetch them. They should hear it from you, which is the only courtesy left."';
              } },
            { t: 'Dissolve. Go to the country while we still have a name', mood: 0, side: 'whip',
              run: function (a) {
                a.S.flags.censurePlan = 'dissolve';
                if (a.S.nextElection - a.S.date.year > 0) {
                  var em = RZ.engine.ELECTION_MONTH[a.C.id];
                  a.S.nextElection = a.S.date.month < em - 1 ? a.S.date.year : a.S.date.year + 1;
                  a.S.lastElectionYear = a.S.nextElection - 1;
                  a.S.campaign.season = true;
                }
                a.add('fame', a.rng(2, 5)); a.add('capital', -6);
              },
              reply: '"Parliament dissolved," the Speaker says, as if it were a weather report. The Opposition has stopped smiling.' },
            { t: 'Nothing. The motion proceeds. We will see who blinks', mood: 2,
              run: function (a) {
                a.S.flags.censurePlan = a.S.flags.censurePlan || 'stand';
                a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(1, 4));
              },
              reply: 'The Speaker looks at the clock. "Then the bells mean what they meant when you walked in."' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'Last chance. I can still lose you two names in the lobby. After that I am a spectator.' },
            { by: 'opp', t: 'And I can still read a statement that names the clinics you did not build. After that I am the government-in-waiting, which is a job I have practised.' }
          ],
          q: '"The vote is in twelve minutes. How do you want it to read?"',
          answers: [
            { t: 'Hold. Every name I still have', mood: 2, side: 'whip',
              memory: 'You put the names to a vote in the House',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state && RZ.state.applyCensure) RZ.state.applyCensure(a, 'whip');
              },
              reply: function (a) {
                if (a.S.flags.censure === 'lost') {
                  return 'The Speaker is already walking toward the chamber. The Whip does not follow.';
                }
                return '"Held," the Whip says. The Speaker sits, which is the only congratulations this room offers.';
              } },
            { t: 'Let the scalp be the story. I have already paid', mood: 0, side: 'opp',
              run: function (a) {
                if (RZ.state && RZ.state.applyCensure) RZ.state.applyCensure(a, 'cut');
              },
              reply: '"A scalp is a story," the Opposition says. "A government is a different one. We will write the second next year."' },
            { t: 'The country can decide. I will not sit a House that has already left', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state && RZ.state.applyCensure) RZ.state.applyCensure(a, 'dissolve');
              },
              reply: 'The Speaker opens the door. The bells are louder from here. "Then I will read the proclamation."' }
          ]
        }
      ]
    },

    {
      id: 'sadc-summit', topic: 'summit', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) { return who(a, 'Minister of Foreign Affairs', ''); },
      others: {
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); },
        chair: function (a) { return who(a, 'the Chair of the Organ', 'SADC'); }
      },
      where: 'A corridor outside the plenary, between the communiqué and the cars',
      settleOn: 'intl',
      headline: function (a) {
        var last = a.S.flags.summit;
        if (last === 'corridor') return 'A balcony did more than the communiqué';
        if (last === 'loan') return 'The Fund stayed in the room';
        if (last === 'walk') return 'You issued a statement and left';
        return 'A communiqué was issued';
      },
      opening: function (a) {
        return 'The plenary has already agreed the adjectives. Solidarity, concern, nothing binding.\n\n' +
          a.who('purse').name + ' has a number the Fund would like. ' + a.who('chair').name +
          ' has a corridor, and a sentence that will not appear in the communiqué.\n\n' +
          '"You have eleven minutes," your Foreign Minister says. "The cars are already being brought round. What is this summit actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The Chair walks you to the car. That is the only photograph that will matter.',
          fair: 'A communiqué is issued. Solidarity is expressed. You already knew that part.',
          cool: 'Finance rides in a different car. Foreign does not apologise.',
          hostile: 'Nobody rides with you. The communiqué names the country in a paragraph about concern.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'purse', at: 'chair',
              t: 'If you promise a corridor you cannot fund, the rating is the next communiqué. I am begging you for one honest paragraph about the arrears.' },
            { by: 'chair', at: 'purse',
              t: 'If you open with the arrears you have already lost the floor. Nobody flew here to hear a spreadsheet. There is a sentence I can put in a corridor that is worth three years of this room.' }
          ],
          q: '"The first conversation. Communiqué or corridor?"',
          answers: [
            { t: 'The corridor. Take me to the person who can actually move a listing', mood: 2, side: 'chair',
              run: function (a) {
                a.S.flags.summit = 'corridor';
                a.add('intl', a.rng(3, 8)); a.add('fame', a.rng(1, 3));
              },
              reply: 'Finance does not follow. The Chair already has a door open that was not on the programme.' },
            { t: 'The books. One honest paragraph, even if they cough', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.summit = 'loan';
                a.add('intl', a.rng(2, 6)); a.add('business', a.rng(2, 5));
                a.add('grassroots', -a.rng(1, 3));
              },
              reply: '"Honest," the Chair says, as if it were a dialect this building does not speak on camera.' },
            { t: 'Both, badly. A sentence of each, then the cars', mood: -1,
              run: function (a) {
                a.S.flags.summit = 'muddle';
                a.add('media', -a.rng(1, 3)); a.add('intl', a.rng(0, 2));
              },
              reply: 'Foreign makes a small noise. This is the summit they have all been to.' }
          ]
        },
        {
          argument: [
            { by: 'chair', t: 'I can take two names off a list. I cannot do it for a communiqué. I can do it for a port, a road, or a vote you have not yet been asked for.' },
            { by: 'purse', t: 'A port is a line item. A vote is a hostage. A road we already promised in three State of the Nation addresses and have not built. I would rather keep the listing and the books.' }
          ],
          q: '"What is the sentence in the corridor actually worth?"',
          answers: [
            { t: 'The listing. Two names off, and I will find the road', mood: 2, side: 'chair',
              run: function (a) {
                a.S.flags.summitDeal = 'listing';
                if (a.S.nation.intl.sanctions > 0) {
                  a.S.nation.intl.sanctions = Math.max(0, a.S.nation.intl.sanctions - a.rng(6, 16));
                }
                a.add('intl', a.rng(3, 7)); a.nation('debt', a.rng(0.3, 1.1));
                a.legacyMark('goodDeal');
              },
              reply: '"Two names." The Chair does not write it down. People who write it down are why lists exist.' },
            { t: 'The Fund. Keep them in the room and I will not promise a road I cannot see', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.summitDeal = 'fund';
                a.nation('reserves', a.rng(0.2, 0.7)); a.nation('debt', -a.rng(0.2, 0.8));
                a.add('intl', a.rng(2, 5)); a.add('business', a.rng(2, 6));
              },
              reply: 'The Chair looks at Foreign as if a spreadsheet had just been elected. Finance almost smiles.' },
            { t: 'Nothing binding. A photograph and a concern noted', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.summitDeal = 'photo';
                a.add('fame', a.rng(1, 3)); a.add('grassroots', a.rng(0, 2));
                a.add('intl', -a.rng(1, 4));
              },
              reply: '"Concern noted." The Chair has issued this sentence from this carpet eleven times.' }
          ]
        },
        {
          argument: [
            { by: 'purse', t: 'Last choice. You can sign clean, you can sign the clause they will not publish, or you can walk to the car with a statement.' },
            { by: 'chair', t: 'Clean takes nine months. The clause takes tonight. Walking is underrated, and it is also how listings get longer.' }
          ],
          q: '"The cars are here. What do you sign?"',
          answers: [
            { t: 'Clean. Local beneficiation, a published royalty, a sovereign clause', mood: 2, side: 'purse',
              memory: 'You signed a summit clause that survives publication',
              memoryTone: 'good',
              run: function (a) {
                a.S.flags.summit = 'loan';
                a.add('intl', a.rng(3, 8)); a.add('stats.integrity', a.rng(2, 5));
                a.nation('growth', a.rng(0.1, 0.4));
                a.legacyMark('goodDeal');
              },
              reply: '"Nine months," Foreign says. "Which is how you know it will outlive you."' },
            { t: 'The unpublished clause. Tonight, and sealed', mood: -1, tag: 'risk', side: 'chair',
              run: function (a) {
                a.S.flags.summit = 'corridor';
                a.add('money', a.wage(18)); a.add('business', a.rng(3, 8));
                a.add('stats.integrity', -a.rng(3, 7));
                a.dirt('summit', 'A regional clause signed on terms that were never published', 4);
                a.owePatron(RZ.makeName(a.C), 8);
                a.nation('growth', a.rng(0.2, 0.7));
              },
              reply: '"Sealed." The Chair has a face for this. So do you, now.' },
            { t: 'Walk. A statement from the steps, nothing binding', mood: 1,
              run: function (a) {
                a.S.flags.summit = 'walk';
                a.add('grassroots', a.rng(2, 5)); a.add('media', a.rng(1, 4));
                a.add('intl', -a.rng(2, 6)); a.add('stats.integrity', a.rng(1, 3));
              },
              reply: 'Foreign opens the car. "Then I will issue the concern, and I will not add a sentence."' }
          ]
        }
      ]
    },

    /* ================================================================
       1.11 — a second year in office
       A province, a named power, the opposition as a person, and
       one tax conversation a year. Still meetings. Still not GPS.
       ================================================================ */

    {
      id: 'house-project', topic: 'province', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) {
        if (RZ.state) RZ.state.pickProject(a.S);
        var r = projRegion(a);
        return who(a, 'the Premier of ' + r.name, r.name);
      },
      others: {
        min: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pickProject(a.S); }
          return cabWho(a, 'projMin', 'Minister of Transport & Public Works', '');
        },
        purse: function (a) {
          if (RZ.state) { RZ.state.fillCabinet(a.S); RZ.state.pickProject(a.S); }
          return cabWho(a, 'projPurse', 'Minister of Finance', 'the Treasury');
        }
      },
      where: 'A provincial office with a map on the wall that is out of date',
      settleOn: 'grassroots',
      headline: function (a) {
        var q = a.S.flags.projQuality;
        var r = projRegion(a);
        if (q === 'deliver') return 'A date in ' + r.name;
        if (q === 'rot') return 'A tender in ' + r.name;
        if (q === 'show') return 'A photograph in ' + r.name;
        return 'The hottest province was sat';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.pickProject(a.S);
        var r = projRegion(a);
        var live = RZ.state && RZ.state.liveProject && RZ.state.liveProject(a.S);
        var label = projLabel(a);
        if (live) {
          return 'The map is the same map. ' + label + ' was promised. The ground has moved ' +
            (live.quality === 'rot' ? 'less than the tender.' : 'some of the way.') + '\n\n' +
            a.who('min').name + ' has a progress report that is a photograph. ' + a.who('purse').name +
            ' has a figure that is not a photograph.\n\n' +
            '"You came back," the Premier says. "That is already more than the last one did. What is this visit actually for?"';
        }
        return r.name + ' has been calling since Monday. Support here is the number on the file that is not unrest.\n\n' +
          a.who('min').name + ' wants ' + label + '. ' + a.who('purse').name + ' wants a rating.\n\n' +
          '"This province is not a mood," the Premier says. "It is a turnout. What are you actually going to plant?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The Premier walks you to the car the long way, past the place the thing will stand. That is the only photograph that will matter.',
          fair: 'A date is written. The map is not updated. It will be, or it will not.',
          cool: 'Finance rides in a different car. The Premier does not apologise for the dust.',
          hostile: 'Nobody walks you out. The map stays on the wall, which is where this province has learned to keep its promises.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'min', at: 'purse', t: function (a) { return projKind(a).open; } },
            { by: 'purse', at: 'min', t: 'A province is not a line item until it is. I can fund one of these a year. I cannot fund a tour.' },
            { by: 'min', at: 'purse', t: function (a) { return projKind(a).ask; } }
          ],
          q: function (a) {
            return '"That is the argument," the Premier says, and does not sit. "Is ' +
              projRegion(a).name + ' this year, or is it a paragraph?"';
          },
          answers: [
            { t: function (a) { return 'Plant it. ' + projLabel(a) + ', a date, a name on the tender'; },
              mood: 2, side: 'min',
              run: function (a) {
                a.S.flags.projIntent = 'deliver';
                a.add('grassroots', a.rng(2, 5)); a.add('capital', -2);
              },
              reply: function (a) {
                return a.who('purse').name + ' makes a small noise. The Premier has already started writing a date.';
              } },
            { t: 'A photograph and a task team. The ground can wait', mood: 0, side: 'purse',
              run: function (a) {
                a.S.flags.projIntent = 'show';
                a.add('fame', a.rng(1, 3));
              },
              reply: '"A task team." The Premier has heard this sentence. So has the wall.' },
            { t: 'The usual cousin. Someone in this room already has a company', mood: -2, tag: 'risk',
              run: function (a) {
                a.S.flags.projIntent = 'rot';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'Nobody looks at the map. That is how you know the company already has an address.' }
          ]
        },
        {
          argument: [
            { by: 'min', t: function (a) { return projKind(a).deliver; } },
            { by: 'purse', t: 'If you sign a date you cannot fund, the next briefing will be a censure with a provincial accent. I am begging you for one honest season.' }
          ],
          q: '"What actually leaves this office?"',
          answers: [
            { t: 'The date. Fund it. I will put my name on the first peg', mood: 2, side: 'min',
              run: function (a) {
                a.S.flags.projIntent = 'deliver';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'Finance closes their copy. The Premier underlines a month.' },
            { t: 'A ribbon and a statement. I have a capital to run', mood: 0, side: 'purse',
              run: function (a) {
                a.S.flags.projIntent = 'show';
                a.add('media', a.rng(1, 3));
              },
              reply: '"A ribbon." The Premier has a face for this. It is not a new face.' },
            { t: 'The tender, quietly, to whoever already has the trucks', mood: -2, tag: 'risk',
              run: function (a) {
                a.S.flags.projIntent = 'rot';
              },
              reply: 'The minister who owns the kind of thing this is does not write anything down. They do not have to.' }
          ]
        },
        {
          argument: [
            { by: 'min', t: 'If you sign it I will be the one they call when it arrives. If you do not, I will be the one they call when it does not.' },
            { by: 'purse', t: 'And if you sign it badly, both of us will be in the Sunday paper, and only one of us will still have a chair.' }
          ],
          q: function (a) {
            return '"The minute. I need a verb, and I need it for ' + projRegion(a).name + '."';
          },
          answers: [
            { t: 'Sign it. This province is the country this month', mood: 2, side: 'min',
              memory: 'You planted a date in the hottest province',
              memoryTone: 'good',
              run: function (a) {
                var intent = a.S.flags.projIntent || 'deliver';
                if (RZ.state) RZ.state.applyProject(a, intent === 'rot' ? 'rot' : 'deliver');
              },
              reply: 'He dates it. The map is still wrong. It will be less wrong.' },
            { t: 'A statement from the steps. I will not write an estimate in this dust', mood: 0, side: 'purse',
              run: function (a) {
                if (RZ.state) RZ.state.applyProject(a, 'show');
              },
              reply: '"A statement." The Premier has a template. The province has heard it.' },
            { t: 'Note it. Next month has a different province', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyProject(a, a.S.flags.projIntent === 'rot' ? 'rot' : 'show');
                a.add('grassroots', -a.rng(1, 3));
              },
              reply: 'The map stays. The number on it does not move. He dates a minute that says noted.' }
          ]
        }
      ]
    },

    {
      id: 'great-power', topic: 'embassy', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) { return who(a, 'Minister of Foreign Affairs', ''); },
      others: {
        envoy: function (a) {
          if (RZ.state && !a.S.flags.powerId) RZ.state.pickPower(a.S);
          var p = powerNow(a);
          return who(a, p.envoy, p.org);
        },
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); }
      },
      where: 'A reception room that is not on the programme',
      settleOn: 'intl',
      headline: function (a) {
        var last = a.S.flags.powerDeal;
        var p = powerNow(a);
        if (last === 'deal') return 'A signature with ' + p.short;
        if (last === 'clause') return 'A sealed clause with ' + p.short;
        if (last === 'walk') return 'You issued a statement and left';
        return 'An ambassador was received';
      },
      opening: function (a) {
        if (RZ.state && !a.S.flags.powerId) RZ.state.pickPower(a.S);
        var p = powerNow(a);
        return 'The flags have already been arranged. Solidarity is the word on the press paper.\n\n' +
          a.who('envoy').name + ' wants ' + p.want + '. ' + a.who('purse').name +
          ' wants a rating that survives the signature.\n\n' +
          '"You have fourteen minutes," your Foreign Minister says. "The cars are already being brought round. What is this visit actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The envoy walks you to the car. That is the only photograph that will be sent home.',
          fair: 'A communiqué is issued. Concern is noted. You already knew that part.',
          cool: 'Finance rides in a different car. Foreign does not apologise.',
          hostile: 'Nobody rides with you. The next listing is a paragraph about concern.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'envoy', at: 'purse', t: function (a) { return powerLine(a).open; } },
            { by: 'purse', at: 'envoy', t: 'If you promise a corridor you cannot fund, the rating is the next communiqué. I am begging you for one honest paragraph.' },
            { by: 'envoy', at: 'purse', t: function (a) { return powerLine(a).ask; } }
          ],
          q: '"The first conversation. Signature or statement?"',
          answers: [
            { t: function (a) { return 'The signature. What ' + powerNow(a).short + ' can actually move'; },
              mood: 2, side: 'envoy',
              run: function (a) {
                a.S.flags.powerIntent = 'deal';
                a.add('intl', a.rng(2, 5));
              },
              reply: 'Finance does not follow. The envoy already has a door that was not on the programme.' },
            { t: 'The books. One honest paragraph, even if they cough', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.powerIntent = 'deal';
                a.add('business', a.rng(1, 4));
              },
              reply: '"Honest," the envoy says, as if it were a dialect this building does not speak on camera.' },
            { t: 'A photograph and a concern noted. Then the cars', mood: -1,
              run: function (a) {
                a.S.flags.powerIntent = 'walk';
                a.add('media', a.rng(0, 2));
              },
              reply: 'Foreign makes a small noise. This is the visit they have all been to.' }
          ]
        },
        {
          argument: [
            { by: 'envoy', t: function (a) { return powerLine(a).clause; } },
            { by: 'purse', t: 'A clause that cannot be published is a hostage. A road we already promised in three State of the Nation addresses is a line item. I would rather keep the listing and the books.' }
          ],
          q: function (a) {
            return '"What is the sentence with ' + powerNow(a).short + ' actually worth?"';
          },
          answers: [
            { t: 'The published terms. I will find the road', mood: 2, side: 'purse',
              run: function (a) {
                a.S.flags.powerIntent = 'deal';
                a.add('intl', a.rng(2, 5)); a.add('stats.integrity', a.rng(1, 3));
              },
              reply: 'The envoy does not write it down. People who write it down are why lists exist.' },
            { t: 'The unpublished clause. Tonight, and sealed', mood: -1, tag: 'risk', side: 'envoy',
              run: function (a) {
                a.S.flags.powerIntent = 'clause';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: '"Sealed." The envoy has a face for this. So does Finance, now.' },
            { t: 'Nothing binding. A photograph and a concern noted', mood: -1,
              run: function (a) {
                a.S.flags.powerIntent = 'walk';
                a.add('fame', a.rng(1, 3));
              },
              reply: '"Concern noted." The envoy has issued this sentence from this carpet eleven times.' }
          ]
        },
        {
          argument: [
            { by: 'purse', t: 'Last choice. You can sign clean, you can sign the clause they will not publish, or you can walk to the car with a statement.' },
            { by: 'envoy', t: 'Clean takes nine months. The clause takes tonight. Walking is underrated, and it is also how listings get longer.' }
          ],
          q: '"The cars are here. What do you sign?"',
          answers: [
            { t: 'Clean. Local beneficiation, a published royalty, a sovereign clause', mood: 2, side: 'purse',
              memory: 'You signed a great-power clause that survives publication',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyPower(a, 'deal');
              },
              reply: '"Nine months," Foreign says. "Which is how you know it will outlive you."' },
            { t: 'The unpublished clause. Tonight, and sealed', mood: -1, tag: 'risk', side: 'envoy',
              run: function (a) {
                if (RZ.state) RZ.state.applyPower(a, 'clause');
              },
              reply: '"Sealed." The envoy has a face for this. So do you, now.' },
            { t: 'Walk. A statement from the steps, nothing binding', mood: 1,
              run: function (a) {
                if (RZ.state) RZ.state.applyPower(a, 'walk');
              },
              reply: 'Foreign opens the car. "Then I will issue the concern, and I will not add a sentence."' }
          ]
        }
      ]
    },

    {
      id: 'opp-meet', topic: 'opposition', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        return who(a, 'Leader of the Opposition', '');
      },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        sg: function (a) { return who(a, a.t.sg, a.P.partyId); }
      },
      where: 'A room off the chamber that is not in anybody\'s diary',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.oppDeal;
        if (last === 'deal') return 'A corridor with the Opposition';
        if (last === 'cut') return 'You gave them a minister';
        if (last === 'leak') return 'They left with the file';
        if (last === 'stand') return 'You sent them back to the floor';
        return 'The Opposition was called in';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        var o = a.S.opposition || {};
        return 'They sat down before they were asked to. That is how you know whose meeting this is supposed to be.\n\n' +
          a.who('whip').name + ' has a count. ' + a.who('sg').name + ' has a face for this corridor.\n\n' +
          '"I table. I leak. I primary," ' + (o.name || 'they') + ' say, as if reading a job description. "You asked for me. What is this actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They stand when you stand. That is not affection. It is arithmetic.',
          fair: '"We will see each other on the floor." They do not offer a hand. They do not have to.',
          cool: 'The Whip waits until the door has shut twice. "That is a person who will be in the Sunday paper."',
          hostile: 'They leave first. The Whip does not look at you. The SG does, which is worse.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'sg', t: 'I have a count. If you give them a chair I have to explain a colleague. If you give them nothing I have to live with the floor.' },
            { by: 'sg', at: 'whip', t: 'A chair is a headline. A leak is a career. A primary is a conference. I would rather keep the conference.' }
          ],
          q: '"What do they actually want?"',
          answers: [
            { t: 'A deal. Something they can take down the corridor', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.oppPlan = 'deal';
                a.add('capital', -3);
              },
              reply: 'The SG looks at the door. "Then I will not be the one who has to explain it in the regions."' },
            { t: 'Nothing. I asked them here to look at them', mood: 2, side: 'sg',
              run: function (a) {
                a.S.flags.oppPlan = 'stand';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The Opposition almost smiles. Being looked at is a kind of recognition.' },
            { t: 'Let them talk. I want to know what is in the file', mood: 0,
              run: function (a) {
                a.S.flags.oppPlan = 'file';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: '"The file," the Whip says, "is never smaller for having been asked about."' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'They will take a minister, a commission, or an election. A statement is not one of those things.' },
            { by: 'sg', t: 'A minister is a scalp. An election is a chest I do not have. A commission is how they spend a year in your files. I would rather keep the year.' }
          ],
          q: '"The offer."',
          answers: [
            { t: 'A chair. The one who has been briefing against me', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.oppPlan = 'cut';
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  RZ.state.choppingBlock(a.S);
                }
              },
              reply: 'The SG almost looks disappointed. A scalp is not a government, but it is a headline.' },
            { t: 'A quiet understanding. They stop the motion, I stop the file', mood: 0, side: 'sg',
              run: function (a) {
                a.S.flags.oppPlan = 'deal';
                a.add('party', -a.rng(1, 3));
              },
              reply: 'The Whip writes nothing. People who write this down are why files exist.' },
            { t: 'Nothing. The floor is the floor', mood: 2,
              run: function (a) {
                a.S.flags.oppPlan = 'stand';
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"Then I will not be asked to find a line," the Whip says, "which is the first honest thing that has happened this morning."' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'Last chance. I can still lose you two names in the lobby. After that I am a spectator.' },
            { by: 'sg', t: 'And they can still read a statement that names the clinics you did not build. After that they are the government-in-waiting, which is a job they have practised.' }
          ],
          q: '"How do you want this to read?"',
          answers: [
            { t: 'The deal. I will live with the corridor', mood: 1, side: 'whip',
              memory: 'You sat with the Opposition and came out with a corridor',
              memoryTone: 'good',
              run: function (a) {
                var plan = a.S.flags.oppPlan || 'deal';
                if (RZ.state) RZ.state.applyOpp(a, plan === 'cut' ? 'cut' : 'deal');
              },
              reply: 'They stand. The Whip does not. "That is a person you will meet again."' },
            { t: 'Let them leak. I am not bargaining with a motion from this office', mood: -2, tag: 'risk', side: 'sg',
              run: function (a) {
                if (RZ.state) RZ.state.applyOpp(a, 'leak');
              },
              reply: 'The Opposition looks almost grateful. A file is a career. So is a Sunday paper.' },
            { t: 'Send them back. The House will see who blinks', mood: 2,
              run: function (a) {
                if (RZ.state) RZ.state.applyOpp(a, 'stand');
              },
              reply: 'They leave first. The SG waits until the door has shut twice. "Then the floor means what it meant when they walked in."' }
          ]
        }
      ]
    },

    {
      id: 'opp-table', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the Speaker', a.C.house.name); },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        opp: function (a) {
          if (RZ.state) RZ.state.opposition(a.S);
          return who(a, 'Leader of the Opposition', '');
        }
      },
      where: 'The Speaker’s office, with a private member’s motion already on the order paper',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.oppDeal;
        if (last === 'deal') return 'The motion was withdrawn';
        if (last === 'cut') return 'A minister for a motion';
        if (last === 'leak') return 'The motion became a file';
        if (last === 'stand') return 'The motion proceeded';
        return 'A motion was tabled';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        var o = a.S.opposition || {};
        var n = Math.round(a.S.nation.govApproval);
        return 'The Clerk has a motion that is not a no-confidence. It is worse in its way: it names a clinic, a road, a file, and it will be read.\n\n' +
          a.who('whip').name + ' has a count. ' + (o.name || a.who('opp').name) + ' has the order paper.\n\n' +
          '"Approval is ' + n + '," the Speaker says. "They have tabled. What do you actually want to survive?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The Speaker sits, which is the only congratulations this room offers.',
          fair: '"The House has expressed itself." He does not say how. The record will.',
          cool: 'They file out in the order the count predicted. You wait until the door has shut twice.',
          hostile: 'The Speaker looks at the order paper as if it were already a precedent.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'opp', at: 'whip', t: 'I have the motion, I have the floor, and I have a file that is not yet a newspaper. I can make it one of those things tonight.' },
            { by: 'whip', at: 'opp', t: 'I have a count. It is not a comfortable count. If you want me to make it comfortable I need something I can take down the corridor.' }
          ],
          q: '"Do we even have the numbers?"',
          answers: [
            { t: 'Whip it. Every name, every office, until the count holds', mood: 1, side: 'whip',
              run: function (a) {
                a.add('capital', -6); a.add('party', a.rng(1, 4));
                a.S.flags.oppPlan = 'stand';
              },
              reply: 'The Whip writes three names. "These three will cost you. The rest will cost the country."' },
            { t: 'Give them a head. One minister, tonight, before the reading', mood: 0, side: 'opp',
              run: function (a) {
                a.S.flags.oppPlan = 'cut';
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  RZ.state.choppingBlock(a.S);
                }
              },
              reply: 'The Opposition almost looks disappointed. A scalp is not a government, but it is a headline.' },
            { t: 'Let it run. I am not bargaining with a private member from this office', mood: -2, tag: 'risk',
              run: function (a) {
                a.S.flags.oppPlan = 'leak';
                a.add('leader', a.rng(1, 4)); a.add('party', -a.rng(2, 6));
              },
              reply: '"Then I will not be asked to find a line," the Whip says, "which is the first honest thing that has happened this morning."' }
          ]
        },
        {
          argument: [
            { by: 'opp', t: 'I can withdraw. I will not withdraw for a statement. I will withdraw for a chair, or for a file I do not print, or for nothing.' },
            { by: 'whip', t: 'If they print I have to live with a Sunday. If you cut I have to explain a colleague. If you whip I have to live with three people who will never forget the corridor.' }
          ],
          q: '"What is the offer?"',
          answers: [
            { t: 'A chair. The one who has been briefing against me', mood: 1, side: 'opp',
              run: function (a) {
                a.S.flags.oppPlan = 'cut';
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  var block = RZ.state.choppingBlock(a.S);
                  if (block && block.cut) RZ.state.dropMinister(a.S, block.cut.ministryId);
                }
                a.add('party', -a.rng(2, 6));
              },
              reply: 'The Whip looks at the door. "Then I will fetch them. They should hear it from you."' },
            { t: 'A quiet understanding. The motion dies, the file stays in the drawer', mood: 0, side: 'whip',
              run: function (a) {
                a.S.flags.oppPlan = 'deal';
                a.add('capital', -4);
              },
              reply: 'The Opposition almost nods. A drawer is a kind of power. So is a motion that did not happen.' },
            { t: 'Nothing. The motion proceeds. We will see who blinks', mood: 2,
              run: function (a) {
                a.S.flags.oppPlan = a.S.flags.oppPlan || 'stand';
                a.add('stats.integrity', a.rng(1, 4)); a.add('media', a.rng(1, 3));
              },
              reply: 'The Speaker looks at the clock. "Then the order paper means what it meant when you walked in."' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'Last chance. I can still lose you two names in the lobby. After that I am a spectator.' },
            { by: 'opp', t: 'And I can still read a statement that names the clinics you did not build. After that I am the government-in-waiting, which is a job I have practised.' }
          ],
          q: '"The House sits in twenty minutes. How do you want it to read?"',
          answers: [
            { t: 'Hold. Every name I still have', mood: 2, side: 'whip',
              memory: 'You whipped a private member’s motion and the House held',
              memoryTone: 'good',
              run: function (a) {
                var plan = a.S.flags.oppPlan || 'stand';
                if (RZ.state) RZ.state.applyOpp(a, plan === 'cut' ? 'cut' : (plan === 'deal' ? 'deal' : 'stand'));
                a.add('leader', a.rng(2, 5));
                a.S.nation.govApproval = RZ.clamp(a.S.nation.govApproval + a.rng(0, 3), 3, 95);
              },
              reply: '"Held," the Whip says, or does not say. The Speaker is already walking toward the chamber.' },
            { t: 'Let the scalp be the story. I have already paid', mood: 0, side: 'opp',
              run: function (a) {
                if (RZ.state) RZ.state.applyOpp(a, 'cut');
              },
              reply: '"A scalp is a story," the Opposition says. "A government is a different one. We will write the second next year."' },
            { t: 'Let them print. I will not sit a House that has already left', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyOpp(a, 'leak');
              },
              reply: 'The Speaker opens the door. "Then I will read the motion, and they will read the rest."' }
          ]
        }
      ]
    },

    {
      id: 'tax-package', topic: 'tax', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) { return who(a, 'Secretary to the Cabinet', ''); },
      others: {
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); },
        spend: function (a) { return who(a, 'Minister of Labour & Social Welfare', ''); }
      },
      where: 'The cabinet committee on revenue, once a year, with one folder',
      settleOn: 'intl',
      headline: function (a) {
        var p = a.S.flags.taxPack;
        if (p === 'vat') return 'VAT went up';
        if (p === 'royalty') return 'The royalty was raised';
        if (p === 'holiday') return 'A holiday for the people who already have one';
        if (p === 'none') return 'The package was noted';
        return 'Finance brought a package';
      },
      opening: function (a) {
        if (RZ.gov && RZ.gov.beginTax) RZ.gov.beginTax(a.S);
        return 'The folders are already open. This is the one conversation a year that is about what comes in, not what goes out.\n\n' +
          a.who('purse').name + ' has three packages. ' + a.who('spend').name + ' has a photograph of a wage envelope.\n\n' +
          '"Thirty taxes is a spreadsheet," the Secretary says. "You have one minute. Whose package?"';
      },
      close: function (a, temp) {
        if (RZ.gov && !a.S.flags.taxPack && RZ.gov.applyTax) RZ.gov.applyTax(a, 'none');
        return {
          warm: 'He dates the package as if it had always been this short. The folder closes.',
          fair: '"It will go in as a decision." He does not say whose. He does not have to, any more.',
          cool: 'Labour leaves first. Finance does not apologise. The Secretary underlines the date.',
          hostile: 'Nobody picks the folder up. He dates a minute that says the item was noted, which in this building is a kind of defeat.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'purse', at: 'spend', t: 'VAT is the only tax that actually arrives. A royalty is a negotiation. A holiday is a gift to people who already have an accountant. I am asking for the one that pays.' },
            { by: 'spend', at: 'purse', t: 'VAT is a tax on bread. I have a wage envelope in this photograph and it is already thinner than last year. Your surplus is a till receipt.' },
            { by: 'purse', at: 'spend', t: 'And in three years there will be no wage at all, because the whole vote will be interest. I am trying to protect the thing you want to spend.' }
          ],
          q: '"That is the first argument. It does not resolve itself. Whose package?"',
          answers: [
            { t: 'VAT. The till is the only honest collector in the country', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.taxPick = 'vat';
                a.add('intl', a.rng(1, 4)); a.add('grassroots', -a.rng(1, 3));
              },
              reply: 'Labour puts the photograph face down. Finance almost smiles, which is not a comfort.' },
            { t: 'The royalty. Make the shaft pay for the clinic', mood: 1, side: 'spend',
              run: function (a) {
                a.S.flags.taxPick = 'royalty';
                a.add('grassroots', a.rng(1, 3)); a.add('business', -a.rng(1, 3));
              },
              reply: '"The shaft," Finance says, "has lawyers. Bread does not. I have made a note of the politics."' },
            { t: 'A holiday. Keep the people who already have an accountant in the room', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.taxPick = 'holiday';
                a.add('business', a.rng(2, 5)); a.add('party', -a.rng(1, 3));
              },
              reply: 'Labour looks at the Secretary, not at you. "Then I will need a sentence for my people by noon."' }
          ]
        },
        {
          argument: [
            { by: 'spend', t: 'If you raise VAT I will be the one who has to explain a loaf. If you raise the royalty I will be the one who has to explain a strike. If you give a holiday I will be the one who has to explain why their cousin still has no job.' },
            { by: 'purse', t: 'And if you do none of them I will be the one who has to explain a downgrade. I know which of those sentences I would rather not say on the radio.' }
          ],
          q: '"A package is not a mood. What actually leaves this room?"',
          answers: [
            { t: 'The one I named. Write it as a decision', mood: 2, side: 'purse',
              run: function (a) {
                a.S.flags.taxIntent = 'go';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'He writes a date. Labour makes a small noise.' },
            { t: 'Split it. A little of each, so nobody has a headline', mood: 0, side: 'spend',
              run: function (a) {
                a.S.flags.taxPick = 'vat';
                a.S.flags.taxIntent = 'go';
                a.add('leader', -a.rng(1, 3));
              },
              reply: '"Unanimous," he says, "is a word that will be read back to you by whoever lost."' },
            { t: 'Note it. I will not write a tax in a room with two ministers', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.taxIntent = 'none';
                a.add('media', -a.rng(1, 3));
              },
              reply: 'The Secretary has written this sentence before. So has the country.' }
          ]
        },
        {
          argument: [
            { by: 'purse', t: 'If you sign it I will be the one they call when the till changes. If you do not, I will be the one they call when the rating does.' },
            { by: 'spend', t: 'And if you sign it badly, both of us will be in the Sunday paper, and only one of us will still have a chair.' }
          ],
          q: '"The minute. I need a verb."',
          answers: [
            { t: 'Sign it. The country is this folder, once a year', mood: 2, side: 'purse',
              memory: 'You signed a tax package and put a date on it',
              memoryTone: 'good',
              run: function (a) {
                var pack = a.S.flags.taxIntent === 'none' ? 'none' : (a.S.flags.taxPick || 'vat');
                if (RZ.gov) RZ.gov.applyTax(a, pack);
              },
              reply: 'He dates it. The folder is thinner than when you sat down, which is usually an improvement.' },
            { t: 'A statement. I will not write a rate in this room', mood: 0, side: 'spend',
              run: function (a) {
                if (RZ.gov) RZ.gov.applyTax(a, 'none');
                a.add('fame', a.rng(1, 3));
              },
              reply: '"A statement." He has a template. The country has heard it.' },
            { t: 'Note it and move on. Next year has a different hole', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.gov) RZ.gov.applyTax(a, a.S.flags.taxIntent === 'go' ? (a.S.flags.taxPick || 'vat') : 'none');
                a.add('leader', -a.rng(1, 3));
              },
              reply: 'The folder stays open. The hole in it does not move. He dates a minute that says noted.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.12 — the opposition is a party
       A deal with the leader is a betrayal of their caucus. There is
       always another party that wants the title. In a parliamentary
       system they can come in. Still meetings.
       ================================================================ */

    {
      id: 'opp-split', topic: 'crisis', weight: 0,
      speaker: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        return who(a, 'Leader of the Opposition', '');
      },
      others: {
        hawk: function (a) {
          if (RZ.state) RZ.state.opposition(a.S);
          var pid = a.S.opposition && a.S.opposition.partyId;
          return who(a, 'the Opposition hawk', pid || '');
        },
        whip: function (a) { return who(a, 'your Chief Whip', ''); }
      },
      where: 'Your office, after hours, with a caucus that has already left',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.oppSplit;
        if (last === 'take') return 'The hawk crossed';
        if (last === 'back') return 'You sent the hawk back';
        if (last === 'fight') return 'You let their caucus fight';
        return 'Their caucus walked in';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        var o = a.S.opposition || {};
        var p = oppParty(a);
        var u = Math.round(o.unity || 0);
        return 'The second one sat down without being asked. The first one followed. That is how you know whose split this is.\n\n' +
          a.who('hawk').name + ' has a list of names. ' + (o.name || a.who('_').name) +
          ' has a face for a corridor they already sat.\n\n' +
          '"The ' + (p && p.abbr ? p.abbr : 'party') + ' is at ' + u + '," your Whip says, which is a number, not a government. "What is this actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The hawk stands when you stand. That is not loyalty. It is a calculation about whose office this is tomorrow.',
          fair: '"We will see each other on the floor." Two of them say it. Only one of them will.',
          cool: 'The Whip waits until both doors have shut. "That is a caucus that will be in the Sunday paper."',
          hostile: 'They leave in different cars. The Whip does not look at you. The cars do not wait.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'hawk', at: '_', t: 'You sat a corridor. You did not sit us. A deal with this one is a betrayal of the people who still have to win a ward.' },
            { by: '_', at: 'hawk', t: 'A caucus that walks into this office is not a caucus. It is an application. Sit down.' },
            { by: 'whip', t: 'If you take them I have to explain a defector. If you send them back I have to live with a motion. If you let them fight I have to live with both.' }
          ],
          q: '"Whose meeting is this?"',
          answers: [
            { t: 'The hawk\'s. A chair, and whoever will follow', mood: 1, side: 'hawk',
              run: function (a) {
                a.S.flags.splitPlan = 'take';
                a.add('capital', -3);
              },
              reply: 'The Leader looks at the door. "Then I will not be the one who has to explain it in the regions."' },
            { t: 'The Leader\'s. Send the hawk back to their own corridor', mood: 2, side: '_',
              run: function (a) {
                a.S.flags.splitPlan = 'back';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The hawk almost smiles. Being sent back is a kind of recognition too.' },
            { t: 'Neither. This is not my caucus', mood: 0, side: 'whip',
              run: function (a) {
                a.S.flags.splitPlan = 'fight';
                a.add('media', a.rng(1, 3));
              },
              reply: '"Then I will not be asked to find a line," the Whip says, "which is the first honest thing that has happened this evening."' }
          ]
        },
        {
          argument: [
            { by: 'hawk', t: 'I will cross this week, with whoever is tired of losing. I will not cross for a statement.' },
            { by: '_', t: 'A crossing is a headline. A headline is not a government. I would rather keep the conference.' }
          ],
          q: '"The price."',
          answers: [
            { t: 'They cross. This week, with the names they already have', mood: 1, side: 'hawk',
              run: function (a) {
                a.S.flags.splitPlan = 'take';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'The Whip writes nothing. People who write this down are why crossings fail.' },
            { t: 'A statement that the party is united. I will not be in it', mood: 2, side: '_',
              run: function (a) {
                a.S.flags.splitPlan = 'back';
                a.add('party', a.rng(1, 3));
              },
              reply: '"United." The hawk has a face for this word. So does the Leader, now.' },
            { t: 'Let the Sunday paper have both of them', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.splitPlan = 'fight';
              },
              reply: 'Nobody looks at the Whip. That is how you know the paper already has a slot.' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'Last chance. A defector is a seat. A united opposition is a motion. A fight is both, and it is also a photograph.' },
            { by: 'hawk', t: 'I am already gone. The only question is whose whip I answer on Thursday.' }
          ],
          q: '"How do you want this to read?"',
          answers: [
            { t: 'Take them. I will live with the corridor', mood: 1, side: 'hawk',
              memory: 'You took a hawk out of the opposition and sat them on your side',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applySplit(a, 'take');
              },
              reply: 'They stand. The Leader does not. "That is a person you will have to whip."' },
            { t: 'Send them back. I am not building a government out of a grudge', mood: 2, side: '_',
              run: function (a) {
                if (RZ.state) RZ.state.applySplit(a, 'back');
              },
              reply: 'The hawk leaves first. The Leader waits until the door has shut twice. "Then the conference means what it meant when they walked in."' },
            { t: 'Let them fight. I have a country to run', mood: 0, tag: 'risk', side: 'whip',
              run: function (a) {
                if (RZ.state) RZ.state.applySplit(a, 'fight');
              },
              reply: 'The Whip opens the door. "Then I will not find a line, and they will find the paper."' }
          ]
        }
      ]
    },

    {
      id: 'opp-other', topic: 'oppother', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) {
        var p = otherParty(a);
        var role = p && p.abbr ? 'Leader of ' + p.abbr : 'the other opposition';
        return who(a, role, (p && p.id) || '');
      },
      others: {
        sg: function (a) { return who(a, a.t.sg, a.P.partyId); },
        whip: function (a) { return who(a, 'your Chief Whip', ''); }
      },
      where: 'A side room that the Leader of the Opposition is not in',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.oppOther;
        var p = otherParty(a);
        var n = p && p.abbr ? p.abbr : 'the other party';
        if (last === 'recognize') return 'You named ' + n;
        if (last === 'play') return 'You played them against each other';
        if (last === 'freeze') return 'You left ' + n + ' in the corridor';
        return 'The other party was called in';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        var p = otherParty(a);
        var n = p ? p.name : 'the other party';
        var ab = p && p.abbr ? p.abbr : 'them';
        var o = a.S.opposition || {};
        return 'They sat down as if the title were already theirs. That is the whole politics of a second opposition.\n\n' +
          a.who('sg').name + ' has a face for this corridor. ' + (o.name || 'The Leader') +
          ' is not in it, which is the point.\n\n' +
          '"' + n + ' is not a mood," they say. "' + ab + ' is a count. What is this actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They stand when you stand. Being seen is a kind of office.',
          fair: '"We will see each other on the floor." They do not offer a hand. They do not have to.',
          cool: 'The SG waits until the door has shut twice. "That is a person who wants a nameplate."',
          hostile: 'They leave first. The Whip does not look at you. The SG does, which is worse.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'sg', at: 'whip', t: 'If you name them you un-name the one we already sat. If you freeze them they become a grievance. If you play them you will be in both of their Sunday papers.' },
            { by: 'whip', at: 'sg', t: 'A second opposition is a gift if you do not put it in writing. The Leader hates them more than they hate us. That is the only arithmetic that matters.' }
          ],
          q: '"What do they actually want?"',
          answers: [
            { t: 'The title. Say it. They are the opposition that can still win a ward', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.otherPlan = 'recognize';
                a.add('media', a.rng(1, 3));
              },
              reply: 'The SG looks at the door. "Then I will not be the one who has to explain it to the one who already has the nameplate."' },
            { t: 'Nothing. I asked them here to look at them', mood: 2, side: 'sg',
              run: function (a) {
                a.S.flags.otherPlan = 'freeze';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'They almost smile. Being looked at is a kind of recognition. It is not the title.' },
            { t: 'A knife. I want them in the same photograph as the Leader, arguing', mood: 0, tag: 'risk',
              run: function (a) {
                a.S.flags.otherPlan = 'play';
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: '"A photograph," the Whip says, "is never smaller for having been asked for."' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'They will take a sentence, a committee, or an election. A statement is one of those things if you write the right noun.' },
            { by: 'sg', t: 'A sentence is a headline. A headline is a conference I do not have. I would rather keep the Leader angry at them, not at us.' }
          ],
          q: '"The offer."',
          answers: [
            { t: 'The sentence. They are the opposition this House will have to count', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.otherPlan = 'recognize';
                a.add('capital', -2);
              },
              reply: 'The SG almost looks disappointed. A nameplate is not a government, but it is a headline.' },
            { t: 'A quiet understanding. They keep the Leader busy, I keep the floor', mood: 0, tag: 'risk',
              run: function (a) {
                a.S.flags.otherPlan = 'play';
                a.add('party', -a.rng(1, 3));
              },
              reply: 'The Whip writes nothing. People who write this down are why both of them will quote you.' },
            { t: 'Nothing. The title stays where it is', mood: 2, side: 'sg',
              run: function (a) {
                a.S.flags.otherPlan = 'freeze';
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"Then I will not be asked to find a line," the SG says, "which is the first honest thing that has happened this morning."' }
          ]
        },
        {
          argument: [
            { by: 'sg', t: 'Last chance. I can still tell the Leader this was a courtesy. After that it is a faction.' },
            { by: 'whip', t: 'And they can still tell a room that the opposition is a person you refuse to sit. After that they are a story, which is a job they have practised.' }
          ],
          q: '"How do you want this to read?"',
          answers: [
            { t: 'Name them. I will live with the corridor', mood: 1, side: 'whip',
              memory: 'You named the other opposition and un-named the one you already sit',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyOther(a, 'recognize');
              },
              reply: 'They stand. The SG does not. "That is a person you will meet again, with a nameplate."' },
            { t: 'Play them. Let the two of them spend a year on each other', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applyOther(a, 'play');
              },
              reply: 'The Whip looks at the door. "Then I will not be the one who has to sit the next motion. They will sit each other."' },
            { t: 'Send them back. The title stays with the one who already has it', mood: 2, side: 'sg',
              run: function (a) {
                if (RZ.state) RZ.state.applyOther(a, 'freeze');
              },
              reply: 'They leave first. The SG waits until the door has shut twice. "Then the floor means what it meant when they walked in."' }
          ]
        }
      ]
    },

    {
      id: 'opp-supply', topic: 'supply', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        return who(a, 'Leader of the Opposition', '');
      },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); }
      },
      where: 'A room that is not in the diary, with a letter that is',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.oppSupply;
        if (last === 'chair') return 'A chair for the arithmetic';
        if (last === 'paper') return 'A paper that holds the House';
        if (last === 'walk') return 'You sent the arithmetic back';
        return 'A supply meeting was sat';
      },
      opening: function (a) {
        if (RZ.state) RZ.state.opposition(a.S);
        var o = a.S.opposition || {};
        var n = Math.round(a.S.nation.govApproval);
        return 'The letter is already on the table. Confidence, supply, and a date. The rest is furniture.\n\n' +
          a.who('whip').name + ' has a count. ' + a.who('purse').name + ' has a rating.\n\n' +
          '"Approval is ' + n + '," ' + (o.name || 'they') + ' say. "I can hold a House. I will not hold it for a statement. What is this actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They date the letter as if it had always been this short. The Whip does not smile.',
          fair: '"The House has expressed itself." They do not say how. The arithmetic will.',
          cool: 'Finance leaves first. The Whip does not apologise. The letter stays.',
          hostile: 'Nobody picks the letter up. They date a minute that says the item was noted, which in this building is a kind of defeat.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'purse', t: 'If you give them a chair I have to explain a colleague. If you give them a paper I have to live with a year of them quoting it. If you give them nothing I have to live with Tuesday.' },
            { by: 'purse', at: 'whip', t: 'A chair is a rating. A paper is a rating with a date. Walking is a motion. I know which of those sentences I would rather not say to a fund.' }
          ],
          q: '"The first conversation. Chair, paper, or the door?"',
          answers: [
            { t: 'A chair. The one who has been briefing against me', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.supplyPlan = 'chair';
                a.add('capital', -4);
                if (RZ.state) {
                  RZ.state.fillCabinet(a.S);
                  RZ.state.choppingBlock(a.S);
                }
              },
              reply: 'Finance makes a small noise. The Whip has already started writing a name.' },
            { t: 'A paper. Confidence, supply, a date, nothing else', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.supplyPlan = 'paper';
                a.add('intl', a.rng(1, 3));
              },
              reply: '"A date." They have a face for this. So does the rating.' },
            { t: 'The door. I am not bargaining for a House I already sit', mood: 2,
              run: function (a) {
                a.S.flags.supplyPlan = 'walk';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The Whip almost looks grateful. A door is a kind of count.' }
          ]
        },
        {
          argument: [
            { by: 'purse', t: 'If you sign a year you cannot fund, the next briefing is a censure with a partner\'s accent. I am begging you for one honest season.' },
            { by: 'whip', t: 'And if you do not sign, I am begging you for two names in the lobby. I know which of those I can actually produce.' }
          ],
          q: '"What actually leaves this room?"',
          answers: [
            { t: 'The chair. Fund the year. I will put a name on it', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.supplyPlan = 'chair';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'Finance closes their copy. The Whip underlines a ministry.' },
            { t: 'The paper. I will not write a cabinet in this dust', mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.supplyPlan = 'paper';
                a.add('capital', -2);
              },
              reply: '"A paper." They have a template. The House has heard it, and it sometimes holds.' },
            { t: 'Nothing. The arithmetic is the arithmetic', mood: 0, tag: 'risk',
              run: function (a) {
                a.S.flags.supplyPlan = 'walk';
              },
              reply: 'The letter stays. The number on it does not move.' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'Last chance. I can still lose you two names. After that I am a spectator, and they are the government-in-waiting with a letter.' },
            { by: 'purse', t: 'And if you sign it badly, both of us will be in the Sunday paper, and only one of us will still have a chair.' }
          ],
          q: '"The letter. I need a verb."',
          answers: [
            { t: 'The chair. This House is this year', mood: 1, side: 'whip',
              memory: 'You bought the House with a chair and a date',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applySupply(a, 'chair');
              },
              reply: 'They date it. The Whip does not smile. Finance does not apologise.' },
            { t: 'The paper. Confidence, supply, and I will not write a name', mood: 2, side: 'purse',
              run: function (a) {
                if (RZ.state) RZ.state.applySupply(a, 'paper');
              },
              reply: 'He dates a letter that is thinner than when you sat down, which is usually an improvement.' },
            { t: 'Walk. I will not write a House in a room with two ministers', mood: -1, tag: 'risk',
              run: function (a) {
                if (RZ.state) RZ.state.applySupply(a, 'walk');
              },
              reply: 'The letter stays. They date a minute that says noted, which in this building is how governments fall.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.13 — a hung House is a room
       GNU is sitting with the person who spent the campaign calling
       you a thief. A kingmaker is a chair. Alone is a letter you have
       not written yet. formGovernment still sorts the nights you are
       not in the room.
       ================================================================ */

    {
      id: 'coalition-talks', topic: 'crisis', weight: 0,
      when: function (a) { return !!a.P.isLeader; },
      speaker: function (a) { return who(a, 'the Speaker', a.C.house.name); },
      others: {
        gnu: function (a) {
          var p = gnuOf(a);
          return who(a, 'Leader of the ' + ((p && p.abbr) || 'runner-up'), (p && p.id) || '');
        },
        king: function (a) {
          var p = kingOf(a);
          var g = gnuOf(a);
          if (p && g && p.id === g.id) return who(a, 'the kingmaker', (p && p.id) || '');
          return who(a, 'Leader of the ' + ((p && p.abbr) || 'kingmaker'), (p && p.id) || '');
        },
        whip: function (a) { return who(a, 'your Chief Whip', ''); }
      },
      where: 'A hotel the cameras have already found',
      settleOn: 'leader',
      headline: function (a) {
        var k = a.S.flags.coalitionKind;
        if (k === 'gnu') return 'A government of national unity';
        if (k === 'king') return 'A chair, and a government';
        if (k === 'minor') return 'You formed alone';
        return 'Talks began Monday';
      },
      opening: function (a) {
        var t = talksOf(a);
        var g = gnuOf(a);
        var k = kingOf(a);
        var lead = a.C.partyById[t.lead] || a.C.partyById[a.P.partyId] || a.C.parties[0];
        return 'The count is already on the table. Nobody has a majority, which in this building is a kind of invitation.\n\n' +
          (lead ? lead.abbr : 'You') + ' ' + (t.leadSeats || 0) + ' of ' + (t.need || 0) + '. ' +
          (g && g.abbr ? g.abbr + ' ' + (g.seats || 0) + '. ' : '') +
          (k && k.abbr && (!g || k.id !== g.id) ? k.abbr + ' ' + (k.seats || 0) + '. ' : '') +
          '\n\n' + a.who('gnu').name + ' has a country. ' + a.who('king').name + ' has a chair. ' +
          a.who('whip').name + ' has a count.\n\n' +
          '"I do not sit until somebody has a paper," the Speaker says. "Who are you actually forming with?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They date it as if it had always been this short. The cameras have already been told.',
          fair: '"The House has a government." They do not say which kind. Monday will.',
          cool: 'The Whip does not smile. The Speaker does not apologise. A paper leaves the room.',
          hostile: 'Nobody shakes your hand. They date a minute that says noted, which in this building is how talks fail.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'gnu', at: 'king', t: 'Sit with us and the country looks like a country. The markets, the observers, the people who still vote. That is what a government of national unity is for.' },
            { by: 'king', at: 'gnu', t: 'Sit with us and you keep the chairs. We want one. We will not want the country. You already know which of those you can live with in your own caucus.' }
          ],
          q: '"The first conversation. Who is in the paper?"',
          answers: [
            { t: function (a) { var p = gnuOf(a); return 'Them. ' + ((p && p.abbr) || 'The runner-up') + '. The ones who spent the campaign calling me a thief'; },
              mood: 1, side: 'gnu',
              run: function (a) {
                a.S.flags.coalitionPlan = 'gnu';
                a.add('media', a.rng(1, 3));
              },
              reply: 'The Whip makes a small noise. The smaller paper has already started writing a different minute.' },
            { t: function (a) { var p = kingOf(a); return 'The smaller paper. ' + ((p && p.abbr) || 'A kingmaker') + '. A chair, not a country'; },
              mood: 1, side: 'king',
              run: function (a) {
                a.S.flags.coalitionPlan = 'king';
                a.add('party', a.rng(0, 2));
              },
              reply: '"A chair." They have a face for this. So does the Whip.' },
            { t: 'Nobody. I will write a minority and live with Tuesday', mood: 2, side: 'whip',
              run: function (a) {
                a.S.flags.coalitionPlan = 'minor';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The Whip almost looks grateful. A door is a kind of count.' }
          ]
        },
        {
          argument: [
            { by: 'gnu', t: 'The price is the deputy, a policy, and looking like we did this together. Anything less is a press conference with two podiums and no government.' },
            { by: 'king', t: 'The price is a ministry. One. Dated. We will not be a mood, and we will not be a statement.' },
            { by: 'whip', t: 'The price of sitting alone is every vote from now until the next count. I can count. I cannot invent.' }
          ],
          q: '"What is the price of a government?"',
          answers: [
            { t: 'The country. I will look like I sat with them', mood: 1, side: 'gnu',
              run: function (a) {
                a.S.flags.coalitionPlan = 'gnu';
                a.add('intl', a.rng(1, 3));
              },
              reply: 'The smaller paper closes their copy. The Whip underlines a name they do not like.' },
            { t: 'A chair. I will not write a country in this dust', mood: 1, side: 'king',
              run: function (a) {
                a.S.flags.coalitionPlan = 'king';
                a.add('capital', -2);
              },
              reply: '"A chair." They have a template. The House has heard it, and it sometimes holds.' },
            { t: 'Nothing. The arithmetic is the arithmetic', mood: 0, side: 'whip', tag: 'risk',
              run: function (a) {
                a.S.flags.coalitionPlan = 'minor';
              },
              reply: 'The letter stays. The number on it does not move.' }
          ]
        },
        {
          argument: [
            { by: 'gnu', t: 'Last chance. If you walk out without us, the next call is from someone who will sit with them, and you will read about it in a paper you do not own.' },
            { by: 'king', t: 'And if you sit with them, I will tell every branch you had a majority of your own caucus and gave it away for a photograph.' },
            { by: 'whip', t: 'And if you sit alone I will not apologise for the arithmetic. I will only have to live with it, and so will Tuesday.' }
          ],
          q: '"The Speaker is waiting downstairs. I need a verb."',
          answers: [
            { t: function (a) { var p = gnuOf(a); return 'Sign with ' + ((p && p.abbr) || 'them') + '. A government of national unity'; },
              mood: 1, side: 'gnu',
              memory: 'You sat with the runner-up and called it a country',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.elections) RZ.elections.applyCoalition(a, 'gnu');
              },
              reply: 'They date it. The Whip does not smile. The smaller paper does not apologise.' },
            { t: function (a) { var p = kingOf(a); return 'Sign with ' + ((p && p.abbr) || 'them') + '. They take a chair'; },
              mood: 1, side: 'king',
              memory: 'You bought a House with a chair and a smaller paper',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.elections) RZ.elections.applyCoalition(a, 'king');
              },
              reply: 'He dates a paper that is thinner than when you sat down, which is usually an improvement.' },
            { t: 'Sign alone. The House will have to live with a minority', mood: -1, side: 'whip', tag: 'risk',
              memory: 'You formed alone and called the arithmetic a government',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.elections) RZ.elections.applyCoalition(a, 'minor');
              },
              reply: 'The letter is you. They date a minute that says noted, which in this building is how minorities begin.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.15 — the partner is a person
       GNU is sitting with the one who spent the campaign calling you
       a thief. A kingmaker is a chair. Walking is how you meet Tuesday.
       ================================================================ */

    {
      id: 'gnu-meet', topic: 'partner', weight: 20,
      when: function (a) { return !!a.P.isPresident; },
      speaker: function (a) {
        if (RZ.state && RZ.state.partner) RZ.state.partner(a.S);
        var p = partnerPartyOf(a);
        return who(a, 'Leader of the ' + ((p && p.abbr) || 'partner'), (p && p.id) || '');
      },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        purse: function (a) { return who(a, 'Minister of Finance', 'the Treasury'); }
      },
      where: 'A room with two seals on the notepaper',
      settleOn: 'leader',
      headline: function (a) {
        var last = a.S.flags.partnerDeal;
        if (last === 'policy') return 'A paper that holds the photograph';
        if (last === 'chair') return 'They kept the chair';
        if (last === 'honour') return 'You honoured the quote';
        if (last === 'renege') return 'You reneged on the paper';
        if (last === 'walk' || last === 'dump') return 'They walked';
        return 'The partner sat down';
      },
      opening: function (a) {
        if (RZ.state && RZ.state.partner) RZ.state.partner(a.S);
        var p = partnerPartyOf(a);
        var o = a.S.partner || {};
        var gnu = a.S.flags.coalitionKind !== 'king';
        var q = quoteOf(a);
        var chair = o.chair && RZ.state && RZ.state.ministryName
          ? RZ.state.ministryName(a.S, o.chair) : 'a chair';
        if (q) {
          var line = q.kind === 'bill'
            ? '"' + q.name + ' is on the order paper. I did not sit with you to watch this leave the House."'
            : q.kind === 'tax'
              ? '"October. The package. I will not hold a country for a VAT I have to explain to a fund."'
              : '"The rating is the number. A paper that does not bind the books is a press conference."';
          return 'You dated it. They have it in the bag. The cameras have gone; the quote has not.\n\n' +
            a.who('whip').name + ' has a caucus that will not forgive a second signature. ' +
            a.who('purse').name + ' has a rating.\n\n' + line;
        }
        if (a.S.flags && a.S.flags.twoCentre) {
          return 'You have the country. They have the party. The partner does not know which one they sat with.\n\n' +
            a.who('whip').name + ' has a caucus that already picked a side. ' +
            a.who('purse').name + ' has a rating that has not.\n\n' +
            '"Who am I actually in government with?" they say. "I sat with a party president. I am looking at a motorcade."';
        }
        return (gnu
            ? 'You sat with them and called it a country. The cameras have gone. The notepaper still has two seals.\n\n'
            : 'You bought a House with a chair. They have not forgotten which one.\n\n') +
          a.who('whip').name + ' has a caucus that has not forgiven the photograph. ' +
          a.who('purse').name + ' has a rating.\n\n' +
          '"' + ((p && p.abbr) || 'They') + ' have ' + chair + '," they say. "I will not hold a country for a statement. What is this actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They date it as if it had always been this short. The Whip does not smile.',
          fair: '"The government has expressed itself." They do not say which half. Monday will.',
          cool: 'The Whip leaves first. They do not apologise. The photograph stays.',
          hostile: 'Nobody picks the paper up. They date a minute that says noted, which in this building is how partners walk.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'purse', t: function (a) {
                return quoteOf(a)
                  ? 'If you honour the quote I have to live with a year of them owning the order paper. If you renege I have to live with a walk, and Tuesday after that.'
                  : 'If you give them a policy I have to live with a year of them quoting it. If you give them another chair I have to explain a colleague. If you give them nothing I have to live with a walk, and Tuesday after that.';
              } },
            { by: 'purse', at: 'whip', t: function (a) {
                return quoteOf(a)
                  ? 'A quote is a rating with a date on it. Reneging is a minority. I know which of those sentences I would rather not say to a fund.'
                  : 'A paper is a rating. A chair is a rating with a name. Walking is a minority. I know which of those sentences I would rather not say to a fund.';
              } }
          ],
          q: function (a) {
            return quoteOf(a) ? '"The quote. Do you even mean it?"' : '"The first conversation. Paper, chair, or the door?"';
          },
          answers: [
            { t: function (a) {
                var q = quoteOf(a);
                if (!q) return 'A paper. The country, dated, nothing else';
                if (q.kind === 'bill' && q.hostile) return 'Pull it. The paper you signed is the order paper';
                if (q.kind === 'bill') return 'It stays. You sat with me for this';
                if (q.kind === 'tax') return 'A holiday. The package is yours this year';
                return 'The books. I will look like I sat with them';
              }, mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.partnerPlan = quoteOf(a) ? 'honour' : 'policy';
                a.add('intl', a.rng(1, 3));
              },
              reply: function (a) {
                return quoteOf(a) ? '"The quote." They have a face for this. So does the rating.' : '"A date." They have a face for this. So does the rating.';
              } },
            { t: function (a) {
                return quoteOf(a) ? 'I will not be bound by a sentence' : 'The chair. It stays theirs, and they know it';
              }, mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.partnerPlan = quoteOf(a) ? 'renege' : 'chair';
                if (!quoteOf(a)) a.add('capital', -2);
              },
              reply: function (a) {
                return quoteOf(a)
                  ? 'The Whip almost looks grateful. A sentence is a kind of count.'
                  : 'Finance makes a small noise. The Whip has already started writing a different minute.';
              } },
            { t: function (a) {
                return quoteOf(a) ? 'The door. I am not bargaining for a quote I already dated' : 'The door. I am not bargaining for a photograph I already sat';
              }, mood: 2,
              run: function (a) {
                a.S.flags.partnerPlan = 'walk';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The Whip almost looks grateful. A door is a kind of count.' }
          ]
        },
        {
          argument: [
            { by: 'purse', t: function (a) {
                return quoteOf(a)
                  ? 'If you honour a year you cannot fund, the next briefing is a walk with a partner\'s accent. I am begging you for one honest season.'
                  : 'If you sign a year you cannot fund, the next briefing is a walk with a partner\'s accent. I am begging you for one honest season.';
              } },
            { by: 'whip', t: function (a) {
                return quoteOf(a)
                  ? 'And if you honour it, I am begging you for two names in the lobby when they own the minute. I know which of those I can actually produce.'
                  : 'And if you do not sign, I am begging you for two names in the lobby when they leave. I know which of those I can actually produce.';
              } }
          ],
          q: function (a) {
            return quoteOf(a) ? '"What does the sentence actually bind?"' : '"What actually leaves this room?"';
          },
          answers: [
            { t: function (a) {
                var q = quoteOf(a);
                if (!q) return 'The paper. Confidence, a date, I will look like I sat with them';
                if (q.kind === 'bill') return 'The order paper. I will look like I sat with them';
                if (q.kind === 'tax') return 'The package. I will look like I sat with them';
                return 'The books. I will look like I sat with them';
              }, mood: 1, side: 'purse',
              run: function (a) {
                a.S.flags.partnerPlan = quoteOf(a) ? 'honour' : 'policy';
                a.add('media', a.rng(0, 2));
              },
              reply: 'The Whip underlines a name they do not like. Finance closes their copy.' },
            { t: function (a) {
                return quoteOf(a) ? 'A sentence is not a government' : 'The chair. I will not write a country in this dust';
              }, mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.partnerPlan = quoteOf(a) ? 'renege' : 'chair';
              },
              reply: function (a) {
                return quoteOf(a)
                  ? '"A sentence." They have a template. The House has heard it, and it sometimes holds.'
                  : '"A chair." They have a template. The House has heard it, and it sometimes holds.';
              } },
            { t: 'Nothing. The arithmetic is the arithmetic', mood: 0, tag: 'risk',
              run: function (a) {
                a.S.flags.partnerPlan = 'walk';
              },
              reply: 'The letter stays. The number on it does not move.' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: function (a) {
                return quoteOf(a)
                  ? 'Last chance. If they walk I will not apologise for the quote. I will only have to live with Tuesday, and so will you.'
                  : 'Last chance. If they walk I will not apologise for the arithmetic. I will only have to live with Tuesday, and so will you.';
              } },
            { by: 'purse', t: 'And if you sign it badly, both of us will be in the Sunday paper, and only one of us will still have a chair.' }
          ],
          q: function (a) {
            return quoteOf(a) ? '"The sentence. I need a verb."' : '"The paper. I need a verb."';
          },
          answers: [
            { t: function (a) {
                var q = quoteOf(a);
                if (!q) return 'Sign it. A statement of intent, this year';
                if (q.kind === 'bill' && q.hostile) return 'Pull it. Honour the paper';
                if (q.kind === 'tax') return 'The holiday. Honour the paper';
                return 'Honour it. The paper is the paper';
              }, mood: 1, side: 'purse',
              memory: function (a) {
                return quoteOf(a) ? 'You honoured the quote they pulled from the paper' : 'You sat with the partner and dated the photograph';
              },
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyPartner(a, quoteOf(a) ? 'honour' : 'policy');
              },
              reply: function (a) {
                return quoteOf(a)
                  ? 'They fold the paper. The Whip does not smile. The order paper is already a different minute.'
                  : 'They date it. The Whip does not smile. Finance does not apologise.';
              } },
            { t: function (a) {
                return quoteOf(a) ? 'A sentence is not a government. I will not be bound' : 'The chair stays theirs. I will not write a second name';
              }, mood: 2, side: 'whip',
              run: function (a) {
                if (RZ.state) RZ.state.applyPartner(a, quoteOf(a) ? 'renege' : 'chair');
              },
              reply: function (a) {
                return quoteOf(a)
                  ? 'He dates a paper that is thinner than when you sat down, which is usually an improvement. They do not fold theirs.'
                  : 'He dates a paper that is thinner than when you sat down, which is usually an improvement.';
              } },
            { t: 'Walk. I will not write a country in a room with two seals', mood: -1, tag: 'risk',
              memory: 'The partner walked, and Tuesday began',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.state) RZ.state.applyPartner(a, 'walk');
              },
              reply: 'They take the seal with them. The Whip does not follow. Tuesday is already in the diary.' }
          ]
        }
      ]
    },

    {
      id: 'gnu-caucus', topic: 'crisis', weight: 0,
      speaker: function (a) { return who(a, 'the party hawk', a.P.partyId || ''); },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        partner: function (a) {
          if (RZ.state && RZ.state.partner) RZ.state.partner(a.S);
          var p = partnerPartyOf(a);
          return who(a, 'Leader of the ' + ((p && p.abbr) || 'partner'), (p && p.id) || '');
        }
      },
      where: 'A caucus room that was not in the diary',
      settleOn: 'party',
      headline: function (a) {
        var last = a.S.flags.partnerDeal;
        if (last === 'dump' || last === 'walk') return 'You dumped the partner';
        if (last === 'keep') return 'You kept the photograph';
        return 'The caucus asked you to dump them';
      },
      opening: function (a) {
        if (RZ.state && RZ.state.partner) RZ.state.partner(a.S);
        var p = partnerPartyOf(a);
        var n = Math.round(a.P.standing.party);
        return 'They sat down before they were asked. That is how you know it is not a briefing.\n\n' +
          a.who('whip').name + ' has a count. ' + a.who('partner').name + ' has not been invited, and is here anyway.\n\n' +
          '"The branches are at ' + n + '," the hawk says. "We did not fight them to sit with ' +
          ((p && p.abbr) || 'them') + '. What is this photograph actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'The hawk dates a minute that says the item was noted. For once that is not a defeat.',
          fair: '"The party has expressed itself." They do not say how. The branches will.',
          cool: 'The partner leaves first. The Whip does not apologise. The photograph stays.',
          hostile: 'Nobody shakes your hand. They date a minute that says noted, which in this building is how caucuses walk.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'partner', t: 'If you dump them I have a majority of the caucus and a minority of the House. If you keep them I have the opposite. I would like to know which of those you think I can whip.' },
            { by: 'partner', at: 'whip', t: 'Dump us and you meet Tuesday with a smile you practised on us. Keep us and your hawk will still be here in a month. You already know which of those you signed for.' }
          ],
          q: '"Do we even keep them?"',
          answers: [
            { t: 'Keep them. The country is the photograph', mood: 1, side: 'partner',
              run: function (a) {
                a.S.flags.caucusPlan = 'keep';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The hawk makes a small noise. The Whip has already started counting a different room.' },
            { t: 'Dump them. I will not lose the party for a seal', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.caucusPlan = 'dump';
                a.add('party', a.rng(1, 3));
              },
              reply: 'The partner almost looks unsurprised. A walk is a kind of count they have practised.' },
            { t: 'A statement. I am not dumping a government in this dust', mood: 0,
              run: function (a) {
                a.S.flags.caucusPlan = 'muddle';
                a.add('media', -a.rng(1, 3));
              },
              reply: 'Nobody looks at anybody. That is how you know it is already arranged, badly.' }
          ]
        },
        {
          argument: [
            { by: 'partner', t: 'The price of keeping us is looking like you meant it. Anything less is a press conference with two podiums and no government.' },
            { by: 'whip', t: 'The price of dumping them is every vote from now until the next count. I can count. I cannot invent.' }
          ],
          q: '"What is the price of a caucus?"',
          answers: [
            { t: 'I meant it. They stay. Tell the branches I said so', mood: 1, side: 'partner',
              run: function (a) {
                a.S.flags.caucusPlan = 'keep';
                a.add('media', a.rng(0, 2));
              },
              reply: 'The hawk closes their copy. The Whip underlines a name they do not like.' },
            { t: 'The party. I will not write a country against my own benches', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.caucusPlan = 'dump';
              },
              reply: '"The party." They have a face for this. So does Tuesday.' },
            { t: 'Nothing. I will not be bounced from this office', mood: 2,
              run: function (a) {
                a.S.flags.caucusPlan = 'muddle';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The partner stays in their chair. The hawk does not.' }
          ]
        },
        {
          argument: [
            { by: '_', t: 'Last chance. If you walk out with them, I will tell every branch you had a majority of your own caucus and gave it away for a photograph.' },
            { by: 'partner', t: 'And if you dump us, the next call is from someone who will sit with the other party, and you will read about it in a paper you do not own.' }
          ],
          q: '"The branches are waiting downstairs. I need a verb."',
          answers: [
            { t: 'Keep them. I will look like I sat with them', mood: 1, side: 'partner',
              memory: 'You kept the partner against your own hawk',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyPartner(a, 'keep');
              },
              reply: 'They date it. The hawk does not smile. The Whip does not apologise.' },
            { t: 'Dump them. The party is the party', mood: -1, side: 'whip', tag: 'risk',
              memory: 'You dumped the partner because the caucus asked',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.state) RZ.state.applyPartner(a, 'dump');
              },
              reply: 'They take the seal. Tuesday is already in the diary. The hawk does not follow them out.' },
            { t: 'A statement, then the door. I will not be a mood', mood: 0,
              run: function (a) {
                a.add('party', -a.rng(1, 4));
                a.add('leader', a.rng(0, 2));
                a.S.flags.partnerDeal = 'muddle';
              },
              reply: 'Nobody dates anything. The item is noted, which in this building is how caucuses remember you.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.16 — Saturday is the vote
       Conference year is a room. The SG has the register, a province
       has the buses, and somebody wants the job. Last beat is a count.
       ================================================================ */

    {
      id: 'conference-floor', topic: 'conference', weight: 20,
      when: function (a) { return !!(a.P.isPresident && a.P.isLeader); },
      speaker: function (a) { return who(a, a.t.sg, ''); },
      others: {
        prov: function (a) { return who(a, 'a provincial chairperson', ''); },
        hope: function (a) {
          if (RZ.state && RZ.state.plantChallenger) RZ.state.plantChallenger(a.S);
          var ch = a.S.challenger;
          return who(a, 'the person who wants the job', a.P.partyId || '');
        }
      },
      where: 'A hall that has been this full twice in your life',
      settleOn: 'party',
      headline: function (a) {
        var last = a.S.flags.conference;
        if (last === 'kept') return 'The hall held';
        if (last === 'anoint') return 'You made way';
        if (last === 'lost') return 'The hall recalled you';
        return 'Saturday sat down';
      },
      opening: function (a) {
        if (RZ.state && RZ.state.plantChallenger) RZ.state.plantChallenger(a.S);
        var ch = a.S.challenger || {};
        var gnu = a.S.flags.coalitionKind === 'gnu';
        return 'They did not wait to be asked. That is how you know it is not a briefing.\n\n' +
          a.who('prov').name + ' has buses. ' + a.who('hope').name + ' has a name the branches already use.\n\n' +
          '"The register is closed," the ' + a.t.sg + ' says. "' +
          (ch.name ? ch.name : 'They') + ' are on it. So are you. ' +
          (gnu
            ? 'The photograph is also on it, which is why some of the buses came empty. '
            : '') +
          'What is this conference actually for?"';
      },
      close: function (a, temp) {
        return {
          warm: 'They date a minute that says the item was carried. For once that is not a defeat.',
          fair: '"The conference has expressed itself." They do not say how. The branches will.',
          cool: 'The hopeful leaves first. The SG does not apologise. The register stays.',
          hostile: 'Nobody picks the paper up. They date a minute that says noted, which in this building is how halls recall you.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'prov', at: 'hope', t: 'If they stand I have to live with a year of empty buses. If they anoint I have to live with a president who does not whip. If they dump the photograph I have a hall, and Tuesday after that.' },
            { by: 'hope', at: 'prov', t: 'I am not a mood. I am a count. The branches already have my name on a piece of paper they did not ask you to write.' }
          ],
          q: '"The first conversation. Do you even stand?"',
          answers: [
            { t: 'I stand. The hall is mine until it is not', mood: 1, side: 'prov',
              run: function (a) {
                a.S.flags.conferencePlan = 'keep';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'The SG makes a small mark. The hopeful does not look at you.' },
            { t: 'The buses. I will not pretend the hawk is not the hall', mood: 1, side: 'hope',
              run: function (a) {
                a.S.flags.conferencePlan = 'dump';
                a.add('party', a.rng(1, 3));
              },
              reply: 'Finance is not in this room. The provincial chair almost looks grateful.' },
            { t: 'I will not stand. The country is enough', mood: 0,
              run: function (a) {
                a.S.flags.conferencePlan = 'anoint';
                a.add('media', a.rng(0, 2));
              },
              reply: 'The hopeful has a face for this. So does a motorcade that still runs.' }
          ]
        },
        {
          argument: [
            { by: 'hope', t: 'If you keep the chair and the photograph I will tell every branch you had a majority of your own hall and gave it away for a partner who spent the campaign calling you a thief.' },
            { by: 'prov', t: 'And if you dump them, the rating walks, and so does Tuesday. I can count buses. I cannot invent a House.' }
          ],
          q: '"What actually leaves this hall?"',
          answers: [
            { t: 'I stand, and the photograph stands with me', mood: 1, side: 'prov',
              run: function (a) {
                a.S.flags.conferencePlan = 'keep';
              },
              reply: 'The SG underlines a name they do not like. The hopeful closes their copy.' },
            { t: 'The hawk. I will not lose Saturday for a seal', mood: 1, side: 'hope',
              run: function (a) {
                a.S.flags.conferencePlan = 'dump';
              },
              reply: '"The hawk." They have a template. The hall has heard it, and it sometimes holds.' },
            { t: 'A successor. I will look like I meant to leave', mood: 2,
              run: function (a) {
                a.S.flags.conferencePlan = 'anoint';
                a.add('leader', -a.rng(1, 3));
              },
              reply: 'Nobody looks at anybody. That is how you know it is already arranged, politely.' }
          ]
        },
        {
          argument: [
            { by: '_', t: 'Last chance. The register does not wait, and neither do the buses. I need a verb, and then I will read a number.' },
            { by: 'hope', t: 'And if the number is not yours, the next call is from the Speaker, and you will read about it in a paper you do not own.' }
          ],
          q: '"The paper. I need a verb."',
          answers: [
            { t: 'I stand. Count it', mood: 1, side: 'prov',
              memory: 'You stood at conference and waited for the number',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyConference(a, 'keep');
              },
              reply: 'The SG reads it. The provincial chair does not smile. The hopeful does not apologise.' },
            { t: 'The buses. Dump whatever I have to dump', mood: 2, side: 'hope', tag: 'risk',
              memory: 'You bought the hall with a walk',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.state) RZ.state.applyConference(a, 'dump');
              },
              reply: 'They date a paper that is thinner than when you sat down, which is usually an improvement.' },
            { t: 'Make way. I will not lose a country in this dust', mood: -1,
              memory: 'You made way, and kept the motorcade',
              memoryTone: 'good',
              run: function (a) {
                if (RZ.state) RZ.state.applyConference(a, 'anoint');
              },
              reply: 'They take the register. You keep the house. Saturday is already in someone else\'s diary.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.18 — The SG says the quiet part, once
       ================================================================ */
    {
      id: 'sg-ceiling', topic: 'crisis', weight: 0,
      when: function (a) {
        if (a.P.isPresident) return false;
        if (a.S.flags && a.S.flags.heardTheCeiling) return false;
        var t = a.tier();
        if (t < 3 || t > 11) return false;
        var dirty = (a.P.dirt || []).filter(function (d) { return d.exposed; }).length;
        return (a.P.stats && a.P.stats.integrity >= 58) && dirty === 0;
      },
      speaker: function (a) { return who(a, a.t.sg, ''); },
      others: {
        chair: function (a) { return who(a, 'a provincial chairperson', ''); },
        youth: function (a) { return who(a, 'the ' + a.t.youthWing + ' secretary', ''); }
      },
      where: 'An office with no diary entry and one extra chair',
      settleOn: 'party',
      headline: function () { return 'The SG said how far clean hands go'; },
      opening: function (a) {
        var inh = a.S.flags && a.S.flags.inheritance;
        return 'They did not wait to be asked. The ' + a.t.sg + ' never does, when it is this.\n\n' +
          a.who('chair').name + ' has a province. ' + a.who('youth').name + ' has a stadium.\n\n' +
          (inh ? 'They still talk about ' + inh.name + ' in this building. ' : '') +
          '"I am going to say this once," the ' + a.t.sg + ' says, "so you do not hear it from a list. This organisation does not put a clean pair of hands in that office. I would like to know whether you already knew."';
      },
      close: function (a, temp) {
        a.S.flags.heardTheCeiling = true;
        return {
          warm: 'They date a minute that says you were told. For once that is not a threat.',
          fair: '"You heard me." They do not ask you to repeat it.',
          cool: 'The provincial chair leaves first. The youth secretary does not look at you.',
          hostile: 'Nobody picks the paper up. They date a minute that says noted, which in this building is how careers find their ceiling.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'chair', at: 'youth', t: 'I can deliver a province for a name that will do what a province costs. I cannot deliver one for a saint.' },
            { by: 'youth', at: 'chair', t: 'And I can fill a stadium for a name that still looks unused. I cannot fill one for a man who already smells of the corridor.' }
          ],
          q: '"So. Did you already know?"',
          answers: [
            { t: 'I knew. I came anyway', mood: 1, side: 'chair',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('leader', a.rng(1, 3));
                a.add('stats.integrity', -a.rng(0, 2));
              },
              reply: 'The SG makes a small mark. The youth secretary looks at the door.' },
            { t: 'Then this is as far as I go', mood: 2, side: 'youth',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('stats.integrity', a.rng(2, 5));
                a.add('party', -a.rng(1, 3));
              },
              reply: '"As far as you go." They have a face for this. So does a long career.' },
            { t: 'I will take the office anyway. Watch me', mood: -1, tag: 'risk',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('leader', a.rng(2, 5));
                a.add('stats.cunning', a.rng(1, 3));
              },
              reply: 'The provincial chair almost looks grateful. Ambition is a kind of count.' }
          ]
        },
        {
          argument: [
            { by: 'youth', t: 'If they stay clean they will be a story we tell about the one who would not. If they get dirty they will be us, and the stadium will still come.' },
            { by: 'chair', t: 'And if they pretend they did not hear you, I will have to live with a name that thinks the palace is a prize for virtue.' }
          ],
          q: function (a) {
            return '"I need a verb, and then I will go back to the ' + a.t.execShort + '."';
          },
          answers: [
            { t: 'I heard you. I am not going to pretend I did not', mood: 1, side: 'youth',
              memory: 'The SG told you how far a clean pair of hands goes',
              memoryTone: 'good',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: 'They date it. The chair does not smile. The youth secretary does not apologise.' },
            { t: 'Then I will stop here, while I still look like myself', mood: 2, side: 'chair',
              memory: 'You told the SG this was as far as you would go',
              memoryTone: 'good',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('stats.integrity', a.rng(2, 6));
                a.add('leader', -a.rng(1, 3));
                if (a.legacyMark) a.legacyMark('neverTookIt');
              },
              reply: 'They take the minute. You keep the name. The palace is already someone else\'s diary.' },
            { t: 'I will get dirty when I have to. Not as a performance', mood: 0, tag: 'risk',
              memory: 'You told the SG you would get dirty when you had to',
              memoryTone: 'bad',
              run: function (a) {
                a.S.flags.heardTheCeiling = true;
                a.add('stats.cunning', a.rng(1, 3));
                a.add('party', a.rng(1, 3));
              },
              reply: '"When you have to." They have heard that sentence. The list has too.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.18 — The year has a room, not another month
       ================================================================ */
    {
      id: 'the-year', topic: 'crisis', weight: 0,
      when: function (a) {
        if (a.P.isPresident) return false;
        var t = a.tier();
        return t >= 4 && t <= 12;
      },
      speaker: function (a) { return who(a, a.t.sg, ''); },
      others: {
        elder: function (a) { return who(a, a.t.elder, a.homeName()); },
        rival: function (a) { return who(a, 'the one with the bigger car', a.homeName()); }
      },
      where: function (a) {
        var k = (a.S.flags && a.S.flags.yearKind) || 'funeral';
        return {
          funeral: 'A tent in ' + a.homeName() + ', and a name on a programme',
          list: 'A hall that smells of floor polish and old tea',
          byelection: 'A school that is a polling station on Tuesdays',
          commission: 'A room with a recorder and no windows'
        }[k] || 'A room that was not in the diary';
      },
      settleOn: 'grassroots',
      headline: function (a) {
        var k = (a.S.flags && a.S.flags.yearKind) || 'funeral';
        return {
          funeral: 'You went to the funeral',
          list: 'The list was in the room',
          byelection: 'A by-election with your name on it',
          commission: 'A commission asked you something'
        }[k] || 'The year sat down';
      },
      opening: function (a) {
        if (!a.S.flags.yearKind && RZ.ward && RZ.ward.pickYearKind) a.S.flags.yearKind = RZ.ward.pickYearKind(a.S);
        var k = a.S.flags.yearKind || 'funeral';
        var m = RZ.ward && RZ.ward.fridayMatter ? RZ.ward.fridayMatter(a.S) : { job: 'the ward' };
        var inh = a.S.flags && a.S.flags.inheritance;
        var rum = inh ? ' They still talk about ' + inh.name + ' here.\n\n' : '\n\n';
        if (k === 'list') {
          return 'The names are already on the wall. ' + a.who('rival').name + ' is on it twice.\n\n' +
            rum + '"The list is the ballot in this organisation," the ' + a.t.sg + ' says. "Whose name stays?"';
        }
        if (k === 'byelection') {
          return 'The school is a polling station on Tuesdays. Today it is a fight.\n\n' +
            rum + a.who('elder').name + ' has ' + m.job + '. ' + a.who('rival').name + ' has a bigger car.\n\n' +
            '"Somebody died, or crossed, or went to jail," the ' + a.t.sg + ' says. "The seat is open. Are you in it?"';
        }
        if (k === 'commission') {
          return 'The recorder is already on. That is how you know it is not a briefing.\n\n' +
            rum + '"I am going to ask you about a tender, a list, and a name you used to sit next to," they say. "You may have one of those answers ready. I would like the other two."';
        }
        return 'The programme has your name in the wrong place, which is how you know they expected you.\n\n' +
          rum + a.who('elder').name + ' has been here since the morning. ' + a.who('rival').name + ' arrived in a bigger car.\n\n' +
          '"You came," the organiser does not say. The ' + a.t.sg + ' does. "Carry it, send an envelope, or let them talk."';
      },
      close: function (a, temp) {
        a.S.flags.yearRoom = a.S.date.year;
        return {
          warm: 'The year had a room. You sat in it. That is rarer than a speech.',
          fair: '"The year has expressed itself." They do not say how. The branches will.',
          cool: 'You are back on the road before dark. They noticed you came. They also noticed you left.',
          hostile: 'Somebody took a photograph of the empty chair. It will not need a caption.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'elder', at: 'rival', t: 'If they stay, I have a year I can point to. If they send money, I have an envelope I cannot bury with. If they do neither, I have a podium.' },
            { by: 'rival', at: 'elder', t: 'And if they stay I have to explain a bigger car that arrived late. I know which of those I can actually survive.' }
          ],
          q: '"The first conversation. Are you actually here?"',
          answers: [
            { t: 'I am here. Put me on the programme', mood: 2, side: 'elder',
              run: function (a) {
                a.add('grassroots', a.rng(3, 7)); a.wardTrust && a.wardTrust(a.rng(2, 6));
                a.add('health', -a.rng(1, 3));
              },
              reply: 'The elder nods once. The bigger car is already a problem for somebody else.' },
            { t: 'The envelope. I cannot do the afternoon', mood: 0, side: 'rival',
              run: function (a) {
                a.add('money', -a.wage(0.5)); a.add('grassroots', a.rng(0, 3));
                a.wardTrust && a.wardTrust(-a.rng(0, 2));
              },
              reply: 'Your name is on the envelope. Nobody looks at you while they write it.' },
            { t: 'I have to be back. Put someone else on it', mood: -1, tag: 'risk',
              run: function (a) {
                a.add('leader', a.rng(1, 3)); a.add('grassroots', -a.rng(2, 5));
                a.wardTrust && a.wardTrust(-a.rng(2, 5));
              },
              reply: 'The rival does not hide the smile. The elder does not hide the absence.' }
          ]
        },
        {
          argument: [
            { by: 'rival', t: 'If they take this they will look like they wanted it. If they pass it they will look like they could not. I am comfortable with both of those photographs.' },
            { by: 'elder', t: 'And if they take it badly, I will have to live with a name that came and then left. I know which of those I can actually bury.' }
          ],
          q: '"The year. I need a verb."',
          answers: [
            { t: 'Take it. This is the job this year is', mood: 1, side: 'elder',
              memory: 'You sat the year they put in front of you',
              memoryTone: 'good',
              run: function (a) {
                a.add('grassroots', a.rng(3, 8)); a.add('party', a.rng(1, 4));
                a.S.flags.yearRoom = a.S.date.year;
              },
              reply: 'They date it. The rival does not smile. The elder does not apologise.' },
            { t: 'Share it. I will not be the only name', mood: 0, side: 'rival',
              run: function (a) {
                a.add('party', a.rng(1, 3)); a.add('grassroots', a.rng(1, 3));
                a.S.flags.yearRoom = a.S.date.year;
              },
              reply: '"Shared." They have a template. The year has heard it.' },
            { t: 'Let them talk. I will not be a mood', mood: -1,
              memory: 'You let the year talk without you',
              memoryTone: 'bad',
              run: function (a) {
                a.add('leader', a.rng(0, 2)); a.add('grassroots', -a.rng(2, 6));
                a.S.flags.yearRoom = a.S.date.year;
              },
              reply: 'Nobody picks the programme up. They date a minute that says noted, which in this building is how years remember you.' }
          ]
        }
      ]
    },

    /* ================================================================
       1.19 — The clause is a room. Cabinet can sit it.
       The slider was GPS. Two-thirds is a meeting.
       ================================================================ */
    {
      id: 'amend-table', topic: 'amend', weight: 20,
      when: function (a) {
        return a.inGov() && a.tier() >= 6;
      },
      speaker: function (a) { return who(a, 'Minister of Justice', ''); },
      others: {
        whip: function (a) { return who(a, 'your Chief Whip', ''); },
        opp: function (a) {
          if (RZ.state && RZ.state.opposition) RZ.state.opposition(a.S);
          return who(a, 'Leader of the Opposition', '');
        }
      },
      where: 'A committee room with one folder and a count already written',
      settleOn: 'party',
      headline: function (a) {
        var last = a.S.flags.amendHow;
        if (last === 'whip') return 'You whipped the clause';
        if (last === 'count') return 'You counted the clause';
        if (last === 'bury' || last === 'none') return 'The clause stayed in the folder';
        return 'Justice brought a clause';
      },
      opening: function (a) {
        if (RZ.gov && RZ.gov.beginAmend) RZ.gov.beginAmend(a.S);
        if (RZ.state && RZ.state.opposition) RZ.state.opposition(a.S);
        var bag = a.S.flags.amend || {};
        var sup = RZ.gov ? RZ.gov.assemblySupport(a.S) : { needed: 0, gov: 0, total: 0 };
        var gap = Math.max(0, (sup.needed || 0) - (sup.gov || 0));
        return 'The folders are already open. This is the conversation that is supposed to wait for the palace, and did not.\n\n' +
          a.who('whip').name + ' has a number. ' + a.who('opp').name + ' has a walk they have already priced.\n\n' +
          '"' + (bag.name || 'A clause') + '," Justice says. "Two-thirds is ' + (sup.needed || 0) +
          ' of ' + (sup.total || 0) + '. The benches carry ' + (sup.gov || 0) +
          (gap ? ', which is ' + gap + ' short before anybody on your own side abstains.' : ', which is enough on paper.') +
          ' I need to know whose paper this is."';
      },
      close: function (a, temp) {
        if (RZ.gov && a.S.flags.amend && RZ.gov.applyAmend) RZ.gov.applyAmend(a, 'bury');
        return {
          warm: 'They date a minute that says the House will see it. For once that is not a threat.',
          fair: '"It will go in as a decision." He does not say whose. He does not have to, any more.',
          cool: 'The Whip leaves first. Justice does not apologise. The opposition does not sit down.',
          hostile: 'Nobody picks the folder up. He dates a minute that says the item was noted, which in this building is a kind of defeat.'
        }[temp];
      },
      beats: [
        {
          argument: [
            { by: 'whip', at: 'opp', t: 'I can count a floor for a clause that keeps the machine. I cannot count one for a saint, and I cannot count one for a walk they have already written.' },
            { by: 'opp', at: 'whip', t: 'And I can walk for a clause that makes this office bigger. I cannot walk for one that gives the regions a share you will not be able to take back.' },
            { by: 'whip', t: 'If you table the palace paper I have to explain a third term. If you table the regions I have to explain a smaller purse. If you table nothing I have to explain why we sat.' }
          ],
          q: '"So. Whose paper is this?"',
          answers: [
            { t: 'The one on the folder. Write it as it is', mood: 1, side: 'whip',
              run: function (a) {
                a.S.flags.amendIntent = 'go';
                a.add('leader', a.rng(1, 3));
              },
              reply: 'Justice underlines a date. The opposition makes a small noise.' },
            { t: 'The regions. Give them a share a later president cannot take', mood: 2, side: 'opp',
              run: function (a) {
                var list = RZ.gov ? RZ.gov.amendmentsFor(a) : [];
                var dev = list.filter(function (x) { return x.id === 'devolve'; })[0];
                if (dev) {
                  a.S.flags.amendPick = 'devolve';
                  a.S.flags.amend = { id: dev.id, name: dev.name, blurb: dev.blurb };
                }
                a.S.flags.amendIntent = 'go';
                a.add('grassroots', a.rng(1, 3)); a.add('capital', -a.rng(1, 3));
              },
              reply: '"The regions," the Whip says, "have chairpersons. I have made a note of the politics."' },
            { t: 'Not this year. I will not write a constitution in a room with three people', mood: -1, tag: 'risk', side: 'opp',
              run: function (a) {
                a.S.flags.amendIntent = 'none';
                a.add('media', -a.rng(1, 3));
              },
              reply: 'Justice has written this sentence before. So has the country.' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'The shortfall is not a mood. It is names, and names are bought with constituency offices and a great many flights. I know which of those sentences I would rather not say on the radio.' },
            { by: 'opp', t: 'And if you buy them I will be the one who has to explain a House that was rented. If you count what you have I will be the one who has to explain a miss. I am comfortable with both of those photographs.' }
          ],
          q: '"The count. What actually leaves this room?"',
          answers: [
            { t: 'Whip it. Buy the shortfall', mood: 1, side: 'whip', tag: 'risk',
              run: function (a) {
                if (a.S.flags.amendIntent !== 'none') a.S.flags.amendIntent = 'whip';
                a.add('capital', -a.rng(2, 5));
              },
              reply: 'The Whip writes a list. The opposition looks at the door.' },
            { t: 'Count what we have. I will not rent a House', mood: 2, side: 'opp',
              run: function (a) {
                if (a.S.flags.amendIntent !== 'none') a.S.flags.amendIntent = 'count';
                a.add('stats.integrity', a.rng(1, 3));
              },
              reply: '"Honest," Justice says, which in this building is not always a compliment.' },
            { t: 'Let them sit down. I will not be a number today', mood: -1, side: 'opp',
              run: function (a) {
                a.S.flags.amendIntent = 'none';
                a.add('party', a.rng(1, 3));
              },
              reply: 'The Whip has a template. The country has heard it.' }
          ]
        },
        {
          argument: [
            { by: 'whip', t: 'If you put it to the House I will be the one they call when the division lights go on. If you do not, I will be the one they call when the Sunday paper asks why we sat.' },
            { by: 'opp', t: 'And if you put it badly, both of us will be in that paper, and only one of us will still have a walk.' }
          ],
          q: '"The minute. I need a verb."',
          answers: [
            { t: 'Put it to the House. Two-thirds is a meeting', mood: 2, side: 'whip',
              memory: 'You sat the clause and put it to the House',
              memoryTone: 'good',
              run: function (a) {
                var how = a.S.flags.amendIntent === 'none' ? 'bury'
                        : (a.S.flags.amendIntent === 'whip' ? 'whip' : 'count');
                if (RZ.gov) RZ.gov.applyAmend(a, how);
              },
              reply: 'He dates it. The folder is thinner than when you sat down, which is usually an improvement.' },
            { t: 'A statement. I will not write a constitution in this room', mood: 0, side: 'opp',
              run: function (a) {
                if (RZ.gov) RZ.gov.applyAmend(a, 'bury');
                a.add('fame', a.rng(1, 3));
              },
              reply: '"A statement." He has a template. The country has heard it.' },
            { t: 'Note it and move on. Next year has a different House', mood: -1, tag: 'risk',
              memory: 'You left a clause in the folder',
              memoryTone: 'bad',
              run: function (a) {
                if (RZ.gov) RZ.gov.applyAmend(a, a.S.flags.amendIntent === 'whip' || a.S.flags.amendIntent === 'count'
                  ? a.S.flags.amendIntent : 'bury');
                a.add('leader', -a.rng(1, 3));
              },
              reply: 'The folder stays open. The hole in it does not move. He dates a minute that says noted.' }
          ]
        }
      ]
    }
  ];

  RZ.DIALOGUE = SCENES;
})();
