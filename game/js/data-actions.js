/* data-actions.js — the monthly action deck.
   Each action: { id, ico, name, desc, ap, cost, min/max tier, when, run(a) }
   `a` is the action API built in engine.js.
*/
(function () {
  'use strict';

  var P = RZ.pick;

  function A(o) { return o; }

  // Nobody crosses to a party that cannot win. The best target is the biggest
  // one that is not your own, weighted by whether it is going anywhere.
  function bestRivalParty(a) {
    var others = a.C.parties.filter(function (p) { return p.id !== a.P.partyId; });
    if (!others.length) return null;
    return others.slice().sort(function (x, y) {
      return (a.S.parties[y.id].vote || 0) - (a.S.parties[x.id].vote || 0);
    })[0];
  }

  var ACTIONS = [

    /* ---------------- ground game ---------------- */
    A({
      id: 'walkabout', ico: '👣', ap: 1, tier: [0, 13],
      name: function (a) { return 'Hold a ' + a.t.meeting; },
      desc: function (a) { return 'Sit with people in ' + a.homeName() + ' and listen until it hurts.'; },
      run: function (a) {
        var ok = a.roll('charisma', 45);
        var g = ok ? a.rng(3.5, 6.5) : a.rng(1.2, 3);
        a.add('grassroots', g); a.addRegion(a.P.regionId, g * 1.6);
        a.add('fame', a.rng(.5, 1.6)); a.add('health', -a.rng(1, 3));
        a.add('money', -a.wage(0.12));
        return {
          title: ok
            ? P(['They stayed until sunset', 'A long, useful afternoon', 'The chairs ran out'])
            : P(['A thin turnout', 'Half the chairs stayed empty', 'People came for the tent, not for you']),
          body: ok
            ? P(['You let the ' + a.t.elder + 's speak first and answered every question, including the rude ones. Word travels.',
                 'A woman asked about the borehole. You did not know, said so, and promised to find out by Friday. That answer travelled further than any speech.',
                 'You stayed after the closing prayer, shaking hands until the last taxi left.'])
            : P(['The ' + a.t.meeting + ' was announced late and the rain did the rest.',
                 'People listened politely and went home. Nobody stayed to argue, which is worse.',
                 'You spoke too long. A man checked his phone in the front row and you saw him do it.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    A({
      id: 'funerals', ico: '🕊️', ap: 1, tier: [0, 13],
      name: 'Do the funerals and the weddings',
      desc: 'Every Saturday, three villages. This is the whole job.',
      run: function (a) {
        var g = a.rng(2.5, 5) * (1 + a.P.standing.grassroots / 260);
        a.add('grassroots', g); a.addRegion(a.P.regionId, g * 1.4);
        a.add('fame', a.rng(.6, 1.4)); a.add('health', -a.rng(2, 4));
        a.add('money', -a.wage(0.35));
        return {
          title: P(['Four funerals, one wedding', 'Saturday, and the tents again', 'You carried the coffin']),
          body: P(['You gave the envelope quietly, sat at the back, and left before the food. Nobody forgets who came.',
                   'The family thanked you by name from the podium. Two hundred voters heard it.',
                   'You drove 340km, ate nothing, and were mentioned in three eulogies. This is how seats are held.',
                   'A rival arrived late in a bigger car. The elders noticed both things.']),
          tone: 'good'
        };
      }
    }),

    A({
      id: 'church', ico: '⛪', ap: 1, tier: [0, 13],
      name: 'Work the churches and the ' + '' , // replaced below
      nameFn: true,
      desc: 'Pulpits reach more people on a Sunday than any rally does all year.',
      run: function (a) {
        var ok = a.roll('charisma', 42);
        a.add('grassroots', ok ? a.rng(3, 5.5) : a.rng(1, 2.5));
        a.addRegion(a.P.regionId, ok ? a.rng(3, 6) : a.rng(1, 2));
        a.add('party', a.rng(.4, 1.4));
        if (a.P.stats.integrity > 55) a.add('fame', a.rng(.4, 1.2));
        return {
          title: ok ? P(['The bishop called you forward', 'A word after the offering', 'Prayed for by name'])
                    : P(['A cool reception in the vestry', 'The pastor kept it short']),
          body: ok ? P(['You were introduced as "our son", which in this country is an endorsement in everything but law.',
                        'The congregation prayed for your work. Nine hundred people, one message, no advertising budget.',
                        'You gave a small donation to the roof fund and said nothing political. That was the point.'])
                   : P(['The church has been burned before by politicians and is not queuing up again.',
                        'You were seated, greeted, and never invited to the microphone.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    A({
      id: 'youth', ico: '🏟️', ap: 1, tier: [1, 13],
      name: 'Address a youth rally',
      desc: 'Unemployed, online, and half the electorate.',
      run: function (a) {
        var ok = a.roll('oratory', 48);
        a.add('fame', ok ? a.rng(2.5, 5) : a.rng(.5, 1.5));
        a.add('grassroots', ok ? a.rng(2, 4) : a.rng(0, 1));
        a.add('media', ok ? a.rng(1, 3) : -a.rng(0, 1.5));
        a.add('health', -a.rng(1, 2));
        if (!ok && a.chance(.3)) a.add('media', -a.rng(1, 3));
        return {
          title: ok ? P(['The stadium finished your sentences', 'A clip that will not die', 'They chanted your name'])
                    : P(['Heckled from the terraces', 'A flat forty minutes', 'They wanted jobs, not adjectives']),
          body: ok ? P(['You named the unemployment number out loud and refused to soften it. It is on every phone in the country tonight.',
                        'Forty seconds of that speech is now a sound bite with a beat under it.',
                        'You spoke in the language of the street and got away with it, which is harder than it looks.'])
                   : P(['A young man shouted "we have heard this before" and the crowd agreed with him.',
                        'The sound system failed twice and you never got the room back.',
                        'You promised a task team. They have seen eleven task teams.']),
          tone: ok ? 'good' : 'bad'
        };
      }
    }),

    A({
      id: 'union', ico: '🔧', ap: 1, tier: [1, 13],
      name: 'Meet the unions and the civil servants',
      desc: 'Teachers and nurses are organised, and they vote in blocks.',
      run: function (a) {
        var ok = a.roll('intellect', 44);
        a.add('grassroots', ok ? a.rng(2.5, 5) : a.rng(.5, 2));
        a.add('party', ok ? a.rng(1.5, 3.5) : a.rng(0, 1));
        a.add('business', -a.rng(0, 1.5));
        return {
          title: ok ? P(['The federation will hear you out', 'An understanding, unwritten', 'The shop stewards nodded'])
                    : P(['They have heard the speech before', 'No commitments from the federation']),
          body: ok ? P(['You did the arithmetic on the wage bill in front of them instead of promising the impossible. They respected it.',
                        'The teachers’ union will not endorse you, but it will not campaign against you either. That is worth seats.',
                        'You raised the pension arrears before they did. That bought you a hearing.'])
                   : P(['The general secretary listened, thanked you, and endorsed nobody.',
                        'You were asked about the last salary review and had no answer that survived the room.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    /* ---------------- money ---------------- */
    A({
      id: 'fundraise', ico: '💼', ap: 1, tier: [1, 13],
      name: 'Hold a fundraising breakfast',
      desc: 'Construction, transport and retail money, in a hotel function room.',
      run: function (a) {
        var pull = a.roll('charisma', 40) ? 1 : .45;
        var take = a.wage(3 + a.tier() * 1.6) * pull * (0.6 + a.P.standing.business / 90);
        a.add('money', take); a.add('business', a.rng(2, 5)); a.add('capital', -1);
        var risky = a.C.inst.patronage > 55 && a.chance(.22);
        if (risky) a.dirt('donor', 'An undeclared donation from a firm with state contracts', 2);
        return {
          title: P(['A good room', 'Envelopes at the door', 'They came, and they paid']),
          body: (pull > .8
            ? P(['Eleven firms, one message: you are going somewhere and they would like to be on the invoice.',
                 'The transport association took a whole table. They want the route permits discussed later.',
                 'You spoke for nine minutes and let the food do the rest.'])
            : P(['Thin attendance. Two of the big names sent apologies and juniors.',
                 'You raised something, but the room was watching the door for someone more useful.'])) +
            (risky ? ' One envelope came from a company currently bidding for a state contract. Nobody wrote a receipt.' : ''),
          tone: 'good'
        };
      }
    }),

    A({
      id: 'patron', ico: '🥃', ap: 1, tier: [1, 13],
      name: 'Sit with a kingmaker',
      desc: 'A man with no office, a farm, and everybody’s phone number.',
      run: function (a) {
        var take = a.wage(4 + a.tier() * 2);
        a.add('money', take); a.add('leader', a.rng(2, 5)); a.add('party', a.rng(1, 3));
        a.add('stats.integrity', -a.rng(1.5, 3.5));
        a.dirt('patron', 'A standing obligation to a businessman who expects to be repaid', 2);
        // The obligation is now a line in a ledger that he keeps, and he will
        // come back to it. The bigger the cheque, the sooner.
        a.owePatron(RZ.makeName(a.C), 3 + a.tier() * 0.8);
        return {
          title: P(['Nothing was written down', 'A long lunch at the farm', 'He asked about your mother by name']),
          body: P(['He has funded four ministers and buried two careers. He did not ask for anything today, which is how it always starts.',
                   'The money is real, the terms are unspoken, and the day he calls, you will answer.',
                   'He told you which three people in your own province are already reporting on you. Two of them you had trusted.']),
          tone: 'flat'
        };
      }
    }),

    A({
      id: 'diaspora', ico: '✈️', ap: 1, tier: [3, 13],
      name: 'Fundraise in the diaspora',
      desc: 'Johannesburg, London, Gaborone — wherever your people went to work.',
      run: function (a) {
        a.add('money', a.wage(4 + a.tier())); a.add('intl', a.rng(2, 5));
        a.add('fame', a.rng(1, 2.5)); a.add('health', -a.rng(3, 6)); a.add('grassroots', -a.rng(0, 1.5));
        return {
          title: P(['A hall in the diaspora', 'They queued to shake your hand', 'Homesickness is a fundraising strategy']),
          body: P(['Three hundred people who send money home every month, and want to know what it is buying.',
                   'They asked harder questions than any journalist at home has managed this year.',
                   'You came back with foreign currency and a reputation for being away.']),
          tone: 'good'
        };
      }
    }),

    A({
      id: 'tender', ico: '📑', ap: 1, tier: [6, 13],
      name: 'Steer a contract',
      desc: 'A ministry procurement, a friendly consortium, a percentage.',
      risky: true,
      run: function (a) {
        var take = a.wage(14 + a.tier() * 4);
        a.add('money', take); a.add('business', a.rng(3, 7)); a.add('capital', a.rng(2, 6));
        a.add('stats.integrity', -a.rng(4, 8));
        a.dirt('tender', 'A ministry contract awarded to a company connected to you', 4);
        a.owePatron(RZ.makeName(a.C), 5);
        a.nation('corruption', a.rng(.6, 1.8));
        return {
          title: P(['The evaluation committee found in favour', 'A consortium nobody had heard of', 'Signed on a Friday afternoon']),
          body: P(['The specification was written narrowly enough that only one bidder could meet it. It was met.',
                   'The money is life-changing. So is the paper trail, if anyone ever pulls it.',
                   'Two officials in the ministry now know exactly what you did. You will be paying them forever.']),
          tone: 'flat'
        };
      }
    }),

    /* ---------------- party machine ---------------- */
    A({
      id: 'courtleader', ico: '🤝', ap: 1, tier: [1, 12],
      name: function (a) { return 'Court the leadership'; },
      desc: 'Be visible, be loyal, be useful, be non-threatening.',
      run: function (a) {
        var ok = a.roll('cunning', 42);
        a.add('leader', ok ? a.rng(4, 8) : a.rng(0, 2));
        a.add('party', a.rng(.5, 2)); a.add('capital', -2);
        if (!ok && a.chance(.25)) { a.add('leader', -a.rng(1, 3)); }
        return {
          title: ok ? P(['You were seen in the right car', 'A place at the top table', 'The principal took your call'])
                    : P(['You were kept waiting', 'A diary clash, twice', 'Someone got there first']),
          body: ok ? P(['You praised the leadership in public, in the right words, at the right length. It was noticed.',
                        'You carried a difficult message for the principal and did not leak it. That is the whole audition.',
                        'You were asked to chair a subcommittee nobody wants. Say yes. It is a door.'])
                   : P(['The inner circle is closed this season and you are not in it.',
                        'A rival got the meeting you asked for and briefed against you inside it.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    A({
      id: 'factions', ico: '♟️', ap: 1, tier: [3, 13],
      name: 'Build your slate',
      desc: 'Recruit people who will rise with you — and fall with you.',
      run: function (a) {
        var ok = a.roll('cunning', 45);
        a.add('party', ok ? a.rng(3, 6) : a.rng(.5, 2));
        if (ok) a.recruitAlly();
        a.add('capital', -3);
        return {
          title: ok ? P(['A slate takes shape', 'Three provinces, one list', 'They will move together now'])
                    : P(['Talks without an agreement', 'Everyone wants to be number one']),
          body: ok ? P(['You are no longer an individual with ambitions. You are a faction, and factions get counted.',
                        'The arrangement is simple: your people back their positions, their people back yours.',
                        'Names were written on a single sheet of paper. That sheet is now the most dangerous object you own.'])
                   : P(['Two of them want the same position and neither will move.',
                        'They will not commit until they see whether you can win without them.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    A({
      id: 'delegates', ico: '🎟️', ap: 1, tier: [3, 13],
      name: function (a) { return 'Work the delegates'; },
      desc: 'Buses, T-shirts, per diems, and a long list of names.',
      risky: true,
      run: function (a) {
        var spend = a.wage(6 + a.tier() * 2);
        if (a.P.money < spend) return { title: 'You cannot afford it', body: 'Delegate mobilisation is not free, and the structures do not run on gratitude.', tone: 'bad', fail: true };
        a.add('money', -spend);
        var gain = a.rng(4, 9) * (1 + a.C.inst.patronage / 130);
        a.add('party', gain);
        a.spendOnDelegates(a.rng(6, 13));
        a.regionsNear().forEach(function (r) { a.addRegion(r, a.rng(2, 6)); });
        if (a.C.inst.patronage > 45 && a.chance(.2)) a.dirt('delegates', 'Cash handed to delegates in a hotel car park', 2);
        return {
          title: P(['Buses booked, lists checked', 'The structures moved', 'Per diems paid in a hotel car park']),
          body: P(['Nobody calls it buying delegates. It is called facilitating participation, and it costs the same.',
                   'Regalia, transport, accommodation. By the time they arrive they have already voted.',
                   'You now know which branch chairs can deliver and which only talk. That list is worth more than the money.']),
          tone: 'good'
        };
      }
    }),

    A({
      id: 'lobbyList', ico: '📋', ap: 1, tier: [3, 12],
      when: function (a) { return a.C.house.method === 'pr' || a.C.house.method === 'mmp'; },
      name: 'Lobby the list committee',
      desc: 'In a list system, the committee is the electorate.',
      run: function (a) {
        var ok = a.roll('cunning', 44);
        a.add('party', ok ? a.rng(4, 8) : a.rng(0, 2));
        a.add('leader', ok ? a.rng(1, 4) : 0);
        a.add('capital', -3);
        return {
          title: ok ? P(['You moved up the list', 'A safe position, provisionally', 'Your name is above the line'])
                    : P(['Held at your current position', 'The committee is not persuaded']),
          body: ok ? P(['Voters will never see your name until it is already a seat. That is the elegance of the system.',
                        'Someone else dropped eleven places to make room. They will find out in a fortnight.'])
                   : P(['Provincial nominations outweighed yours. The committee balances regions before merit.',
                        'You were told to be patient. In list politics, patient means replaceable.']),
          tone: ok ? 'good' : 'flat'
        };
      }
    }),

    /* ---------------- public profile ---------------- */
    A({
      id: 'media', ico: '🎙️', ap: 1, tier: [1, 13],
      name: 'Give a sit-down interview',
      desc: function (a) { return 'An hour with ' + P(a.C.media) + '. No notes allowed.'; },
      run: function (a) {
        var ok = a.roll('oratory', 46 + (a.P.dirt.length * 4));
        if (ok) {
          a.add('media', a.rng(3, 7)); a.add('fame', a.rng(2, 4.5)); a.add('party', a.rng(0, 1.5));
          return { title: P(['A clean hour', 'You held the room', 'Quoted on every bulletin']),
            body: P(['You answered the difficult question first and it defused the rest of the interview.',
                     'Specific numbers, no slogans. Editors love a politician who has read the budget.',
                     'The clip is being shared by people who do not like you, which is the best kind of reach.']),
            tone: 'good' };
        }
        a.add('media', -a.rng(1, 4)); a.add('fame', a.rng(1, 3));
        if (a.chance(.35)) a.dirt('gaffe', 'A recorded answer you cannot take back', 1);
        return { title: P(['A bad eleven seconds', 'You should have said nothing', 'The clip is out of context, and it is out']),
          body: P(['You lost your temper about the audit and the camera stayed on your face for a long time.',
                   'A follow-up question you had not prepared for, and a pause that reads as guilt.',
                   'You said "the people of this country are tired of questions like that." They were not.']),
          tone: 'bad' };
      }
    }),

    A({
      id: 'radio', ico: '📻', ap: 1, tier: [0, 13],
      name: 'Take a phone-in on radio',
      desc: 'Vernacular radio still reaches further than anything with a screen.',
      run: function (a) {
        var ok = a.roll('charisma', 43);
        a.add('fame', ok ? a.rng(2, 4) : a.rng(.5, 1.5));
        a.add('grassroots', ok ? a.rng(2, 4) : a.rng(0, 1));
        a.add('media', a.rng(.5, 2));
        return { title: ok ? P(['The lines jammed', 'Callers from three ' + a.t.regionPl, 'An hour that went well'])
                           : P(['A caller had your record in front of her', 'Awkward, live, and unedited']),
          body: ok ? P(['You took a hostile caller seriously and the host thanked you for it on air.',
                        'You answered in the language people actually argue in. That lands differently.'])
                   : P(['She listed three promises, with dates. You had no answer for the second one.',
                        'The host cut to music early, which is its own review.']),
          tone: ok ? 'good' : 'bad' };
      }
    }),

    A({
      id: 'social', ico: '📱', ap: 1, tier: [0, 13],
      name: 'Run a social media push',
      desc: 'A content team, a hashtag, and some accounts you will not admit to.',
      run: function (a) {
        var spend = a.wage(1.5 + a.tier() * .5);
        a.add('money', -spend);
        var ok = a.roll('cunning', 40);
        a.add('fame', ok ? a.rng(2.5, 5) : a.rng(.5, 2));
        a.add('media', ok ? a.rng(1, 3) : -a.rng(0, 2));
        if (!ok && a.chance(.25)) a.dirt('bots', 'A network of fake accounts traced back to your team', 2);
        return { title: ok ? P(['Trending by Thursday', 'The clip travelled', 'Reach without a rally'])
                           : P(['The bots were spotted', 'Ratioed', 'A campaign nobody asked for']),
          body: ok ? P(['Three hundred thousand views and no budget for a stadium. The young are cheaper to reach than the old.',
                        'Your team clipped the one good answer and dropped it at 7pm. It worked.'])
                   : P(['A researcher noticed forty accounts created in the same hour, all of them fond of you.',
                        'The hashtag was captured within a day and turned against you.']),
          tone: ok ? 'good' : 'bad' };
      }
    }),

    A({
      id: 'policy', ico: '📚', ap: 1, tier: [1, 13],
      name: 'Do the policy work',
      desc: 'Unglamorous, unnoticed, and the only thing that survives a hostile audit.',
      run: function (a) {
        a.add('stats.intellect', a.rng(.6, 1.6));
        a.add('party', a.rng(1, 3)); a.add('media', a.rng(1, 3));
        a.add('capital', a.rng(1, 3));
        a.add('grassroots', -a.rng(0, 1));
        return { title: P(['A paper nobody expected', 'Committee work, done properly', 'You read the whole annexure']),
          body: P(['You produced costed numbers on ' + P(a.C.issues) + ' while everyone else produced adjectives.',
                   'The permanent secretaries have started copying you into things. That is real power, slowly.',
                   'The document will be plagiarised by three colleagues within a year, and each theft is a citation.']),
          tone: 'good' };
      }
    }),

    A({
      id: 'parliament', ico: '🏛️', ap: 1, tier: [4, 13],
      name: function (a) { return 'Speak in the ' + a.t.assembly; },
      desc: 'Hansard is forever, and the clip is on Facebook by lunchtime.',
      run: function (a) {
        var ok = a.roll('oratory', 47);
        a.add('fame', ok ? a.rng(2, 4.5) : a.rng(.3, 1));
        a.add('media', ok ? a.rng(2, 5) : -a.rng(0, 2));
        a.add('party', ok ? a.rng(0, 2) : -a.rng(0, 2));
        if (ok && a.P.stats.integrity > 60) a.add('capital', a.rng(1, 3));
        return { title: ok ? P(['The House went quiet', 'A speech that will be quoted', 'The front bench stopped smiling'])
                           : P(['Heckled into silence', 'The Speaker cut you off', 'A muddle at the despatch box']),
          body: ok ? P(['You had the audit report in your hand and read the paragraph number aloud. Nobody interrupted twice.',
                        'Even the other side thumped the benches. That is a career-making twelve minutes.'])
                   : P(['You were caught without the figures and the minister enjoyed it visibly.',
                        'Your own whip glared at you throughout. Loyalty is measured in silence.']),
          tone: ok ? 'good' : 'bad' };
      }
    }),

    A({
      id: 'book', ico: '✒️', ap: 1, tier: [5, 13],
      name: 'Publish a manifesto',
      desc: 'A slim volume with your face on it and someone else’s prose inside.',
      run: function (a) {
        a.add('fame', a.rng(2, 5)); a.add('stats.intellect', a.rng(.5, 1.5));
        a.add('media', a.rng(1, 4)); a.add('money', -a.wage(2));
        a.add('leader', -a.rng(0, 3));
        return { title: P(['A book, and a signal', 'Launched at a hotel in ' + a.C.capital, 'Everyone read the acknowledgements first']),
          body: P(['Nobody writes a book about the nation’s future unless they intend to run it. The leadership understood immediately.',
                   'The ideas are decent. The subtext is the whole point, and the subtext is: I am ready.',
                   'Four columnists reviewed it as a leadership bid, which is exactly what it is.']),
          tone: 'good' };
      }
    }),

    /* ---------------- dark arts ---------------- */
    A({
      id: 'oppo', ico: '🔍', ap: 1, tier: [2, 13],
      name: 'Put someone on a rival',
      desc: 'A retired detective, a paid clerk, a bank statement.',
      risky: true,
      run: function (a) {
        a.add('stats.cunning', a.rng(.5, 1.4)); a.add('money', -a.wage(2));
        var found = a.digOnRival();
        if (!found) return { title: 'Nothing usable, yet', body: 'Either they are careful, or the people who know are still frightened. Give it time.', tone: 'flat' };
        return { title: P(['A file with a name on it', 'Somebody talked', 'The paperwork exists']),
          body: 'You now hold something on <strong>' + a.esc(found.name) + '</strong>: ' + a.esc(found.label) +
                '. It sits in a drawer until it is useful, which is where such things do the most work.',
          tone: 'good' };
      }
    }),

    A({
      id: 'leak', ico: '📰', ap: 1, tier: [2, 13],
      when: function (a) { return a.hasLeverage(); },
      name: 'Leak the file',
      desc: 'A Sunday paper, an unnamed source, and a very bad week for someone.',
      risky: true,
      run: function (a) { return a.doLeak(); }
    }),

    A({
      id: 'bury', ico: '🧹', ap: 1, tier: [1, 13],
      when: function (a) { return a.P.dirt.some(function (d) { return !d.exposed; }); },
      name: 'Bury a problem',
      desc: 'Lawyers, a settlement, and a witness who moves to another town.',
      risky: true,
      run: function (a) { return a.doBury(); }
    }),

    A({
      id: 'rehab', ico: '🕯️', ap: 1, tier: [0, 13],
      when: function (a) { return a.P.dirt.some(function (d) { return d.exposed; }); },
      name: 'Rehabilitate yourself',
      desc: 'A year of visible service, an apology nobody asked for, and a very long silence.',
      run: function (a) {
        var ok = a.roll('grit', 48) && a.P.stats.integrity > 30;
        a.add('health', -a.rng(2, 5)); a.add('money', -a.wage(1.5));
        a.add('fame', -a.rng(1, 3));
        if (ok) {
          a.clearExposed(1);
          a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(2, 6)); a.add('grassroots', a.rng(2, 5));
          return { title: 'They have started inviting you again',
            body: RZ.pick([
              'A year of clinics, boreholes and funerals, and not one press statement. The invitations resumed without anyone announcing a decision.',
              'You apologised specifically, once, and then never mentioned it again. In this region that is the entire technology of political survival.',
              'You took the unglamorous committee nobody wanted and did the work. Rehabilitation here is not forgiveness; it is attrition.'
            ]), tone: 'good' };
        }
        return { title: 'It is still the first question',
          body: RZ.pick([
            'Every interview, every rally, every radio phone-in. The file has not moved and neither have you.',
            'A columnist wrote that your comeback tour is the comeback tour of a man who thinks the country has a short memory. It does not, yet.'
          ]), tone: 'bad' };
      }
    }),

    A({
      id: 'securocrats', ico: '🎖️', ap: 1, tier: [5, 13],
      name: 'Dine with the generals',
      desc: 'Army, police, intelligence. In some countries they are the third chamber.',
      run: function (a) {
        var ok = a.roll('cunning', 40);
        a.add('security', ok ? a.rng(4, 9) : a.rng(0, 2));
        a.add('media', -a.rng(0, 2)); a.add('capital', -2);
        if (a.C.inst.security > 60) a.add('leader', -a.rng(0, 3));
        return { title: ok ? P(['An understanding, over meat', 'They will not move against you', 'You were shown the file on someone else'])
                           : P(['Correct, formal, and cold', 'They are committed elsewhere']),
          body: ok ? P(['Nothing was promised. But in a country where the barracks have opinions, being liked there is a form of insurance.',
                        'They wanted to know your position on their pensions before your position on anything else.',
                        'A brigadier told you which of your phones to stop using. He was not joking.'])
                   : P(['The commander was polite and told you nothing, which is itself information.',
                        'You are seen as a civilian problem, not a partner. That can be fatal here.']),
          tone: ok ? 'good' : 'flat' };
      }
    }),

    /* ---------------- outward ---------------- */
    A({
      id: 'donors', ico: '🌍', ap: 1, tier: [4, 13],
      name: 'Meet the ambassadors and the Fund',
      desc: 'Donor capitals, the IMF resident representative, a regional summit.',
      run: function (a) {
        var ok = a.roll('intellect', 46);
        a.add('intl', ok ? a.rng(4, 8) : a.rng(0, 2));
        a.add('media', a.rng(1, 3)); a.add('grassroots', -a.rng(0, 2));
        return { title: ok ? P(['A serious hearing', 'They took notes', 'Invited back'])
                           : P(['Polite, and nothing more', 'A briefing that went badly']),
          body: ok ? P(['You made the case for ' + P(a.C.issues) + ' with numbers they recognised. Word gets back to the capital.',
                        'The Fund’s representative asked for your paper. That is how conditionality gets negotiated years early.',
                        'You are now on the list of people foreign capitals call before an election.'])
                   : P(['You were treated as a courtesy call, and the meeting ended eight minutes early.',
                        'A question about the arrears caught you out, and everyone in the room knew the number except you.']),
          tone: ok ? 'good' : 'flat' };
      }
    }),

    /* ---------------- self ---------------- */
    /* ---------------- the seat you have to hold ---------------- */
    A({
      id: 'lobby', ico: '🏛️', ap: 1, tier: [4, 13],
      name: 'Lobby the ministry',
      desc: function (a) {
        var n = RZ.ward.needs(a.S);
        return n.length
          ? 'You have no budget. Go and spend influence on somebody who has: ' + n[0].name + ', perhaps.'
          : 'Everything you can reasonably ask for is already under construction.';
      },
      when: function (a) { return RZ.ward && RZ.ward.canLobby(a.S); },
      run: function (a) {
        // Falls through to the plain roll when no conversation is available;
        // the meeting is the normal case. There may be nothing left to ask
        // for, which is its own kind of success.
        var want = RZ.ward.needs(a.S);
        if (!want.length) return { fail: true, title: 'There is nothing left to ask them for' };
        var pick = RZ.pick(want);
        a.add('capital', -RZ.ward.lobbyCost(a.S, pick.id) * 0.5);
        a.startProject(pick.id, {});
        return {
          title: 'A letter, and then another letter',
          body: 'No meeting, no minister, and eventually a line in the adjustment estimates that somebody in the ' +
                'ministry put there because you would not stop writing. It is in the system now.',
          tone: 'flat'
        };
      }
    }),

    A({
      id: 'pac', ico: '📊', ap: 1, tier: [4, 12],
      name: 'Sit on the accounts committee',
      desc: 'Summon somebody who has spent public money and ask them where it went, on television.',
      risky: true,
      when: function (a) { return a.tier() >= 4 && a.P.capital >= 4; },
      run: function (a) {
        a.add('capital', -a.rng(2, 5));
        a.add('media', a.rng(2, 5));
        return {
          title: 'The hearing was adjourned to a date to be confirmed',
          body: 'Two of the four witnesses sent apologies and the third brought a lawyer who objected to the ' +
                'terms of reference. Committee work is mostly this.',
          tone: 'flat'
        };
      }
    }),

    A({
      id: 'whip', ico: '🔔', ap: 1, tier: [4, 12],
      name: 'Take the whip’s call',
      desc: 'There is a division at four and he wants to know now, not then.',
      when: function (a) { return a.tier() >= 4 && !a.isPresident(); },
      run: function (a) {
        a.add('party', a.rng(0, 2));
        return { title: 'The division passed without you', body: 'You were paired. Nobody minded, and nobody noticed.', tone: 'flat' };
      }
    }),

    A({
      id: 'wardcrisis', ico: '🚱', ap: 1, tier: [4, 13],
      name: function (a) { return 'Hold the constituency office in ' + a.homeName(); },
      desc: 'Whoever walks in is your problem for the afternoon.',
      when: function (a) { return a.tier() >= 4; },
      run: function (a) {
        a.add('grassroots', a.rng(1, 3)); a.add('health', -a.rng(1, 3));
        a.wardTrust(a.rng(0, 2));
        return {
          title: 'Nine people, four hours',
          body: 'A pension that has stopped, a school transfer, a boundary dispute and a man who wanted to ' +
                'explain a theory. You solved one of them.',
          tone: 'flat'
        };
      }
    }),

    /* ---------------- the state, once you run part of it ---------------- */
    A({
      id: 'megatender', ico: '✒️', ap: 1, tier: [6, 13], risky: true,
      name: 'Sign off the national contract',
      desc: 'Four hundred pages, three bidders, and one of them can actually do the work.',
      when: function (a) { return a.tier() >= 6 && a.inGov(); },
      run: function (a) {
        a.nation('infra', a.rng(0.5, 2)); a.add('business', a.rng(1, 4));
        return { title: 'It went to committee', body: 'Deferred for a further evaluation report. Nothing was signed and nothing was stopped.', tone: 'flat' };
      }
    }),

    A({
      id: 'purge', ico: '🗂️', ap: 1, tier: [9, 12], risky: true,
      name: 'Work the central committee',
      desc: 'Forty-one names, annotated in three colours, two days before nominations.',
      when: function (a) { return a.tier() >= 9 && !a.isPresident() && a.P.capital >= 10; },
      run: function (a) {
        a.add('capital', -a.rng(3, 7)); a.add('party', a.rng(1, 4));
        return { title: 'A long evening of telephone calls', body: 'Nobody was removed and nobody was promised anything, and four people now know you were counting.', tone: 'flat' };
      }
    }),

    A({
      id: 'shadowdiplo', ico: '🛬', ap: 1, tier: [10, 13],
      name: 'Travel, quietly',
      desc: 'Not on either country’s programme, and no officials in the room.',
      when: function (a) { return a.tier() >= 10; },
      run: function (a) {
        a.add('intl', a.rng(2, 6)); a.add('grassroots', -a.rng(1, 4)); a.add('health', -a.rng(1, 3));
        return { title: 'Four days abroad', body: 'A communiqué, two dinners and a corridor conversation that may be worth something one day. Your province noticed you were gone.', tone: 'flat' };
      }
    }),

    A({
      id: 'ssa', ico: '🕵️', ap: 1, tier: [13, 13], risky: true,
      name: 'Send for the Director-General',
      desc: 'He brings nothing with him, ever.',
      when: function (a) { return a.isPresident(); },
      run: function (a) {
        a.add('security', a.rng(1, 4));
        return { title: 'A briefing, and nothing on paper', body: 'Forty minutes on regional posture and one sentence about a domestic matter that he declined to expand on.', tone: 'flat' };
      }
    }),

    /* ---------------- forcing the issue ---------------- */
    A({
      id: 'revolt', ico: '⚔️', ap: 1, tier: [2, 9], risky: true,
      name: 'Challenge the incumbent',
      desc: function (a) {
        var o = RZ.revolt.revoltOdds(a.S);
        return o ? 'Force a vote against ' + o.name + '. Roughly ' + o.pct + '% of the room, on today’s numbers.'
                 : 'Force an internal vote rather than wait to be chosen.';
      },
      when: function (a) { return RZ.revolt && RZ.revolt.canRevolt(a.S); },
      run: function (a) {
        var r = RZ.revolt.revolt(a.S, a);
        if (!r) return { fail: true, title: 'There is nobody to challenge' };
        return { title: r.title, body: r.body, tone: r.tone };
      }
    }),

    A({
      id: 'blackmail', ico: '🗄️', ap: 1, tier: [2, 11], risky: true,
      name: 'Trade the file for the seat',
      desc: function (a) {
        var t = RZ.revolt.blackmailTarget(a.S);
        return t ? 'You have something on ' + t.name + '. Positions have been exchanged for less.'
                 : 'You have nothing on anybody worth the trade.';
      },
      when: function (a) {
        var nr = RZ.engine.nextRung(a.S);
        return RZ.revolt && !!RZ.revolt.blackmailTarget(a.S) && !!nr && nr.how !== 'auto' &&
               a.S.tempo !== 'week';
      },
      run: function (a) { return RZ.revolt.blackmail(a.S, a); }
    }),

    /* ---------------- crossing the floor ---------------- */
    A({
      id: 'defect', ico: '🚪', ap: 1, tier: [2, 12], risky: true,
      name: 'Cross the floor',
      desc: function (a) {
        var to = bestRivalParty(a);
        return to ? 'Leave for ' + to.abbr + '. Everything you built here stays here.'
                  : 'There is nowhere to go.';
      },
      when: function (a) { return !a.P.isPresident && !!bestRivalParty(a); },
      run: function (a) {
        var to = bestRivalParty(a);
        if (!to) return { fail: true, title: 'There is nobody to cross to' };
        var from = a.C.partyById[a.P.partyId];

        // Loyalty is not transferable. Whatever you were owed here is written
        // off the moment you walk, and the people who own you now owe you nothing.
        a.P.standing.leader = 0;
        a.add('party', -(a.P.standing.party * RZ.range(0.55, 0.8)));

        // What you do get is a fortnight of being the only story in the country.
        var media = a.rng(14, 26), grass = a.rng(8, 16);
        a.add('media', media); a.add('grassroots', grass); a.add('fame', a.rng(6, 14));
        if (RZ.crisis) {
          RZ.crisis.addBuff(a.S, 'media', media, 5, 'crossed the floor');
          RZ.crisis.addBuff(a.S, 'grassroots', grass, 5, 'crossed the floor');
        }

        a.P.partyId = to.id;
        a.S.flags.crossings = (a.S.flags.crossings || 0) + 1;
        a.P.record.push({ year: a.S.date.year, text: 'Left ' + from.abbr + ' for ' + to.abbr + '.' });
        a.dirt('crossed', 'Crossed the floor from ' + from.abbr + ' to ' + to.abbr, 2);
        a.makeRival();

        // Whatever a nemesis had over you was branch machinery, and it is not
        // your branch any more.
        var freed = RZ.revolt && RZ.revolt.nemesisOf(a.S)
          ? RZ.revolt.tryNeutralise(a.S, null, 'defect') : null;

        // In most of these systems the seat belongs to the party, not to you.
        var lostSeat = a.tier() >= 4 && RZ.chance(0.55);
        if (lostSeat) a.demote();

        return {
          title: lostSeat ? 'You crossed, and the seat did not come with you'
                          : 'You crossed the floor',
          body: (a.S.flags.crossings > 1
            ? 'The second crossing is not a conviction, it is a habit, and the press said so within the hour. '
            : 'It was done at a press conference at eleven, in front of a banner that had been printed the night before. ') +
            (freed ? 'It has also put you out of ' + freed.name + '’s reach for good, which was half the point. ' : '') +
            (lostSeat
              ? 'The seat was the party’s, not yours. The Speaker declared it vacant on Thursday and you are outside the House ' +
                'looking in — famous, and without a vote.'
              : 'For about three weeks you will be the most interesting person in the country. ' +
                'After that you will be a new member of a party that watched you leave your last one.'),
          tone: lostSeat ? 'bad' : 'flat'
        };
      }
    }),

    A({
      id: 'study', ico: '🎓', ap: 1, tier: [0, 13],
      name: 'Take a course',
      desc: 'Public finance, law, or an executive programme abroad.',
      run: function (a) {
        a.add('money', -a.wage(2.5));
        a.add('stats.intellect', a.rng(1.5, 3));
        a.add('capital', a.rng(0, 2));
        a.add('grassroots', -a.rng(0.5, 2));
        return { title: P(['Back to the classroom', 'A certificate, and some actual knowledge', 'Weekends gone']),
          body: P(['You now understand the appropriation process better than most of the people voting on it.',
                   'Two months of evenings. Your constituency noticed you were less visible, and said so.',
                   'A qualification is armour: it is the first thing they attack when they cannot attack anything else.']),
          tone: 'good' };
      }
    }),

    A({
      id: 'rest', ico: '🏡', ap: 1, tier: [0, 13],
      name: 'Go home and sleep',
      desc: 'Your family have started introducing themselves to you.',
      run: function (a) {
        a.add('health', a.rng(8, 15));
        a.add('fame', -a.rng(0, 1));
        a.add('grassroots', -a.rng(0, 1));
        return { title: P(['A week without a motorcade', 'You slept eight hours, twice', 'Nobody called it a holiday']),
          body: P(['The cardiologist has been trying to reach you since March. You finally went.',
                   'Your daughter did not recognise the sound of your car. She does now.',
                   'Two rivals used the quiet week to move against you. It was still worth it.']),
          tone: 'good' };
      }
    }),

    A({
      id: 'relocate', ico: '🧭', ap: 1, tier: [0, 4],
      when: function (a) { return a.C.regions.length > 1 && !a.S.campaign.season; },
      name: function (a) { return 'Move your base to another ' + a.t.constituency; },
      desc: 'Parachute somewhere your party can actually win. Everybody does it; nobody admits it.',
      run: function (a) { return a.relocate(); }
    }),

    A({
      id: 'campaign', ico: '📣', ap: 1, tier: [0, 13],
      when: function (a) { return a.isCampaignSeason(); },
      name: 'Campaign flat out',
      desc: 'Convoys, T-shirts, loud-hailers, and no sleep at all.',
      run: function (a) {
        var spend = a.wage(3 + a.tier());
        a.add('money', -spend);
        var mult = a.P.money >= 0 ? 1 : .5;
        var g = a.rng(4, 8) * mult;
        a.add('grassroots', g); a.add('fame', a.rng(2, 4));
        a.regionsNear().forEach(function (r) { a.addRegion(r, a.rng(3, 7) * mult); });
        a.add('health', -a.rng(4, 8));
        a.campaignEffort(a.rng(6, 12) * mult);
        return { title: P(['Six ' + a.t.regionPl + ' in nine days', 'The convoy has not stopped', 'Loud-hailers from dawn']),
          body: P(['You have stopped writing speeches and started repeating one, which is the correct decision.',
                   'Regalia everywhere. The party colours are on every taxi in the ' + a.t.constituency + '.',
                   'You are hoarse, thirteen kilos lighter, and ahead where it matters.']),
          tone: 'good' };
      }
    })
  ];

  ACTIONS.forEach(function (act) {
    if (act.id === 'church') {
      act.name = function (a) { return 'Work the churches'; };
    }
  });

  RZ.ACTIONS = ACTIONS;
  RZ.actionById = {};
  ACTIONS.forEach(function (x) { RZ.actionById[x.id] = x; });
})();
