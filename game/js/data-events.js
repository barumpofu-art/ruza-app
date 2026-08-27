/* data-events.js — situations that arrive whether you want them or not.
   { id, w:weight, kicker, once, when(a), title(a), body(a), choices:[{t,d,tag,when,run}] }
*/
(function () {
  'use strict';
  var P = RZ.pick;

  function E(o) { return o; }

  var EVENTS = [

    /* ================= economy & country ================= */
    E({
      id: 'drought', w: 10, kicker: 'The rains',
      when: function (a) { return a.month() >= 11 || a.month() <= 3; },
      title: 'The rains have failed again',
      body: function (a) {
        return 'The first planting is gone. Extension officers in ' + a.homeName() + ' are reporting total crop loss ' +
          'and the relief committee has not met since August. In the ' + a.t.meetingPl + ' people are not asking about ' +
          'policy. They are asking about maize.';
      },
      choices: [
        { t: 'Demand relief loudly, now', d: 'Go to the press before the ministry is ready.', tag: 'media',
          run: function (a) {
            var ok = a.roll('oratory', 44);
            a.add('grassroots', a.rng(3, 6)); a.add('media', ok ? a.rng(2, 5) : 0);
            a.add('leader', -a.rng(1, 4));
            return { title: 'You went first', body: 'The relief was announced eleven days later and half the district believes you forced it. The ministry believes you embarrassed it. Both are correct.', tone: 'good' };
          } },
        { t: 'Work it quietly through the ministry', d: 'Slower, invisible, and it actually delivers.',
          run: function (a) {
            a.add('leader', a.rng(2, 5)); a.add('capital', a.rng(1, 3)); a.add('grassroots', a.rng(0, 2));
            a.nation('unrest', -a.rng(0, 1.5));
            return { title: 'The trucks moved', body: 'Nobody will credit you. The Permanent Secretary will remember, and permanent secretaries outlive ministers.', tone: 'good' };
          } },
        { t: 'Buy the maize yourself and distribute it', d: 'Effective. Also, in an election year, an offence.', tag: 'risk',
          when: function (a) { return a.P.money > a.wage(4); },
          run: function (a) {
            a.add('money', -a.wage(5));
            a.add('grassroots', a.rng(7, 12)); a.addRegion(a.P.regionId, a.rng(8, 14));
            a.add('stats.integrity', -a.rng(1, 3));
            if (a.chance(.35)) a.dirt('handout', 'Food distributed in your own name during a campaign period', 2);
            return { title: 'Your name on every bag', body: 'Twelve tonnes, your face on the truck. The electoral commission has rules about this. Everyone breaks them; only the losers get charged.', tone: 'good' };
          } }
      ]
    }),

    E({
      id: 'commodity', w: 9, kicker: 'Markets',
      title: function (a) { return 'The ' + a.C.econ.staple.split(' ')[0] + ' price moves'; },
      body: function (a) {
        var down = a.S.flags._commodDown;
        return down
          ? 'The price of ' + a.C.econ.staple + ' has fallen through the floor. Treasury is revising the budget mid-year, the ' +
            'currency is sliding, and the wage bill suddenly looks impossible.'
          : 'The price of ' + a.C.econ.staple + ' has jumped. For about eighteen months there will be more money than sense in the ' +
            'system, and every ministry has already spent it twice in their heads.';
      },
      prep: function (a) { a.S.flags._commodDown = a.chance(.55); },
      choices: [
        { t: 'Argue for saving it', d: 'A stabilisation fund. Unpopular, correct.',
          run: function (a) {
            a.add('stats.intellect', a.rng(.5, 1.5)); a.add('intl', a.rng(2, 5));
            a.add('grassroots', -a.rng(1, 3)); a.add('party', a.rng(0, 2));
            a.nation('reserves', a.rng(.2, .6));
            return { title: 'You said the boring thing', body: 'Foreign capitals noticed. Your own province asked why you are protecting money instead of spending it on them.', tone: 'flat' };
          } },
        { t: 'Argue for spending it', d: 'Roads, clinics, salaries, now.',
          run: function (a) {
            a.add('grassroots', a.rng(3, 6)); a.add('party', a.rng(1, 4));
            a.add('intl', -a.rng(1, 3)); a.nation('debt', a.rng(.5, 2));
            return { title: 'You said the popular thing', body: 'The tar reached two villages that have waited thirty years. The arrears will land on somebody else’s desk.', tone: 'good' };
          } },
        { t: 'Get your province a share of it', d: 'Pure constituency politics.', tag: 'risk',
          run: function (a) {
            a.addRegion(a.P.regionId, a.rng(6, 11)); a.add('grassroots', a.rng(3, 6));
            a.add('party', -a.rng(1, 4)); a.nation('corruption', a.rng(.3, 1));
            if (a.chance(.2)) a.dirt('capture', 'Public projects steered to your own district', 2);
            return { title: 'Your district ate first', body: 'Other ' + a.t.regionPl + ' noticed the allocation table. You have made yourself a regional champion and a national suspect.', tone: 'flat' };
          } }
      ]
    }),

    E({
      id: 'currency', w: 8, kicker: 'Treasury',
      when: function (a) { return a.S.nation.economy.inflation > 12; },
      title: 'The currency is going',
      body: 'Queues at the bureaux, three exchange rates in circulation, and traders quoting in dollars by lunchtime. ' +
            'Civil servants were paid on Friday and the money was worth less by Monday.',
      choices: [
        { t: 'Back the central bank governor', d: 'Tighten, hurt, stabilise.',
          run: function (a) {
            a.nation('inflation', -a.rng(2, 5)); a.nation('growth', -a.rng(.3, 1));
            a.add('intl', a.rng(2, 5)); a.add('grassroots', -a.rng(2, 5));
            return { title: 'You took the pain', body: 'Interest rates up, credit gone, small traders furious. In eighteen months this will look like wisdom. There may not be eighteen months.', tone: 'flat' };
          } },
        { t: 'Blame the speculators', d: 'Arrests, raids, a task force.', tag: 'risk',
          run: function (a) {
            a.add('grassroots', a.rng(2, 5)); a.add('media', -a.rng(1, 4));
            a.nation('inflation', a.rng(1, 4)); a.nation('corruption', a.rng(.4, 1.2));
            return { title: 'The street traders were arrested', body: 'It played well for nine days. The rate kept moving, because the rate was never about the street traders.', tone: 'bad' };
          } },
        { t: 'Say nothing and buy dollars', d: 'What everyone with money is doing.', tag: 'risk',
          run: function (a) {
            a.add('money', a.wage(3)); a.add('stats.integrity', -a.rng(2, 5));
            if (a.chance(.3)) a.dirt('forex', 'Personal foreign currency dealings during a currency crisis', 3);
            return { title: 'You protected yourself', body: 'Sensible, private, and indefensible if it ever comes out.', tone: 'flat' };
          } }
      ]
    }),

    E({
      id: 'imf', w: 7, kicker: 'Washington',
      when: function (a) { return a.S.nation.economy.debt > 65 && a.tier() >= 5; },
      title: 'The Fund has put a programme on the table',
      body: 'Budget support, a debt restructuring and credibility — in exchange for subsidy removal, a wage freeze and ' +
            'a public audit. The queue outside the fuel stations already goes around the block.',
      choices: [
        { t: 'Take the programme', d: 'Money now, riots later.',
          run: function (a) {
            a.S.nation.intl.imf = true;
            a.nation('debt', -a.rng(4, 10)); a.nation('reserves', a.rng(.8, 2)); a.nation('inflation', -a.rng(1, 4));
            a.nation('unrest', a.rng(4, 9)); a.add('intl', a.rng(6, 12)); a.add('grassroots', -a.rng(4, 8));
            return { title: 'Signed in the small hours', body: 'The first disbursement lands next quarter. So does the fuel price. Both were in the same document and only one made the news.', tone: 'flat' };
          } },
        { t: 'Refuse and look east', d: 'Different lender, different conditions, same debt.',
          run: function (a) {
            a.nation('debt', a.rng(2, 6)); a.nation('reserves', a.rng(.4, 1.2));
            a.add('intl', -a.rng(2, 6)); a.add('grassroots', a.rng(2, 5)); a.add('business', a.rng(1, 4));
            return { title: 'A different creditor', body: 'The terms are commercial, the collateral is the mine, and nobody made you cut the fuel subsidy. Read the annexure in five years.', tone: 'flat' };
          } },
        { t: 'Refuse everything', d: 'Sovereignty, and arrears.',
          run: function (a) {
            a.nation('reserves', -a.rng(.5, 1.5)); a.nation('inflation', a.rng(2, 6));
            a.add('grassroots', a.rng(3, 7)); a.add('intl', -a.rng(6, 12));
            return { title: 'You told them no, in public', body: 'The speech was magnificent. The fuel still has to be paid for in a currency you do not print.', tone: 'flat' };
          } }
      ]
    }),

    E({
      id: 'power', w: 8, kicker: 'Utilities',
      title: 'Load-shedding, eighteen hours a day',
      body: 'The grid is failing, the utility is insolvent, welders are out of work and the clinics are running generators ' +
            'on diesel bought at pump prices. Every phone-in show has become an electricity phone-in show.',
      choices: [
        { t: 'Push emergency independent power', d: 'Fast, expensive, and someone’s cousin will own it.', tag: 'risk',
          run: function (a) {
            a.nation('infra', a.rng(3, 7)); a.nation('debt', a.rng(1, 3));
            a.add('business', a.rng(2, 6)); a.add('grassroots', a.rng(2, 5));
            if (a.chance(.3)) a.dirt('ipp', 'An emergency power contract signed without tender', 3);
            return { title: 'Turbines by December', body: 'Emergency procurement waived the tender rules. It worked. It is also the single most auditable thing you have ever signed.', tone: 'good' };
          } },
        { t: 'Fix the utility properly', d: 'Tariffs up, staff cut, three years of nothing visible.',
          run: function (a) {
            a.nation('infra', a.rng(1, 3)); a.nation('unrest', a.rng(2, 5));
            a.add('grassroots', -a.rng(2, 5)); a.add('intl', a.rng(3, 6)); a.add('stats.integrity', a.rng(1, 3));
            return { title: 'The unglamorous route', body: 'Cost-reflective tariffs, a new board, and a maintenance schedule. Nobody will thank you before the next election, and possibly ever.', tone: 'flat' };
          } },
        { t: 'Blame the previous administration', d: 'Free, and partly true.',
          run: function (a) {
            a.add('media', -a.rng(0, 3)); a.add('party', a.rng(1, 3)); a.nation('unrest', a.rng(1, 3));
            return { title: 'A speech about legacy problems', body: 'It is genuinely their fault. It has also been your problem for four years, and the audience can do arithmetic.', tone: 'bad' };
          } }
      ]
    }),

    /* ================= party machine ================= */
    E({
      id: 'reshuffle', w: 11, kicker: 'State House',
      when: function (a) { return a.tier() >= 4 && a.tier() <= 10 && a.inGov(); },
      title: 'A reshuffle is coming',
      body: function (a) {
        return 'Three ministers are finished and everyone in the ' + a.t.assembly + ' knows which three. The ' +
          'principal is taking calls this week and not next week. Nobody will say the word "lobbying" out loud.';
      },
      choices: [
        { t: 'Make your case directly', d: 'Ask for the portfolio. Brave, or fatal.', tag: 'risk',
          run: function (a) {
            var ok = a.roll('cunning', 50);
            if (ok) { a.add('leader', a.rng(6, 12)); a.add('capital', a.rng(2, 5)); return { title: 'He heard you out', body: 'Asking is a risk in a system built on being asked. This time it read as confidence rather than ambition.', tone: 'good' }; }
            a.add('leader', -a.rng(4, 9));
            return { title: 'You overreached', body: 'The principal does not like being told what he was about to decide. You are now a name on a different list.', tone: 'bad' };
          } },
        { t: 'Send emissaries', d: 'Let three other people mention your name.',
          run: function (a) {
            a.add('leader', a.rng(2, 6)); a.add('party', a.rng(1, 3)); a.add('capital', -2);
            return { title: 'Your name came up, from elsewhere', body: 'Two premiers and a secretary-general raised you unprompted, which is the only way ambition is permitted to travel here.', tone: 'good' };
          } },
        { t: 'Be conspicuously loyal and say nothing', d: 'The safest play, and often the winning one.',
          run: function (a) {
            a.add('leader', a.rng(3, 7)); a.add('fame', -a.rng(0, 1.5));
            return { title: 'Silence, correctly deployed', body: 'You defended the leadership on television during the worst week of the year and asked for nothing. That is a debt, and debts get paid in portfolios.', tone: 'good' };
          } }
      ]
    }),

    E({
      id: 'primarychal', w: 9, kicker: 'The structures',
      when: function (a) { return a.tier() >= 3 && a.tier() <= 8; },
      title: function (a) { return 'A challenger in your own ' + a.t.constituency; },
      body: function (a) {
        return 'A former ' + P(['council chair', 'businessman', 'teacher', 'soldier', 'nurse', 'radio presenter']) +
          ' is going around the branches saying you have forgotten where you came from. Worse, they are buying lunch while they say it.';
      },
      choices: [
        { t: 'Out-organise them in the branches', d: 'Meetings, lists, and every branch chair by name.',
          run: function (a) {
            var ok = a.roll('grit', 45);
            a.add('grassroots', ok ? a.rng(4, 8) : a.rng(1, 3));
            a.addRegion(a.P.regionId, ok ? a.rng(6, 12) : a.rng(1, 4));
            a.add('health', -a.rng(3, 6));
            return { title: ok ? 'You held the structures' : 'They are still gaining', body: ok
              ? 'Eleven branch meetings in fourteen days. You know the names of their children. That is what wins a nomination.'
              : 'Two branches have gone. The chair in the north will not take your calls, which means he has taken theirs.', tone: ok ? 'good' : 'bad' };
          } },
        { t: 'Have them disqualified on a technicality', d: 'Membership dates, unpaid subscriptions, a committee ruling.', tag: 'risk',
          run: function (a) {
            var ok = a.roll('cunning', 48);
            if (ok) { a.add('party', a.rng(2, 5)); a.add('grassroots', -a.rng(1, 4)); a.dirt('rigging', 'A challenger removed from the ballot on a technicality', 2);
              return { title: 'Ruled ineligible', body: 'Their membership lapsed for six weeks in 2019. The committee found this decisive. Nobody in the branch believes that was the reason.', tone: 'flat' }; }
            a.add('grassroots', -a.rng(4, 8)); a.add('media', -a.rng(2, 5));
            return { title: 'The appeal went against you', body: 'The national committee reinstated them and the story ran for a week. You have made a martyr out of a nuisance.', tone: 'bad' };
          } },
        { t: 'Offer them something', d: 'A council seat, a board, a job for a brother.',
          run: function (a) {
            a.add('money', -a.wage(3)); a.add('party', a.rng(1, 3)); a.add('stats.cunning', a.rng(.4, 1.2));
            a.add('stats.integrity', -a.rng(1, 2.5));
            return { title: 'They withdrew, citing unity', body: 'A parastatal board seat and a quiet handshake. They will be back in five years, better funded.', tone: 'flat' };
          } }
      ]
    }),

    E({
      id: 'defectoffer', w: 6, kicker: 'An approach',
      when: function (a) { return a.tier() >= 3 && a.tier() <= 9 && a.C.parties.length > 1; },
      title: 'Another party wants you',
      speaker: function (a) { return { name: RZ.makeName(a.C), role: 'an emissary', org: a.otherParty().abbr }; },
      where: 'A private dining room, no phones on the table',
      settleOn: 'party',
      opening: function (a) {
        var other = a.otherParty();
        return 'He does not hand over a card. "I am authorised by ' + a.esc(other.abbr) + ' to have a conversation ' +
          'that has not happened. Before you say anything — I know what you are worth there, and I know what you ' +
          'are being paid for it, and those two numbers are not close."';
      },
      beats: [
        {
          q: function (a) {
            return '"A safe seat, resources, and you do not wait your turn. That is the offer and it does not improve. ' +
              'What is keeping you where you are?"';
          },
          answers: [
            { t: 'Nothing is keeping me. Draw up the papers.', mood: 3, tag: 'risk',
              run: function (a, convo) { convo.crossing = true; },
              reply: '"Then we will announce on a Tuesday, because Tuesday is a slow news day and you will want the coverage to be about policy." It will not be about policy.' },
            { t: 'Thirty years of people who carried chairs for me.', mood: 1,
              run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('stats.integrity', a.rng(2, 4)); },
              reply: '"Chairs." He nods, unbothered. "Half the people who carried chairs for me are now in my party. Loyalty is a route, not a destination."' },
            { t: 'The fact that you would do this to me in two years’ time.', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('capital', a.rng(1, 2)); },
              reply: 'He laughs properly. "Yes. I would. But you would have had two years, and two years is a ministry."' }
          ]
        },
        {
          q: '"Then the last question, and I would like the true answer because it costs you nothing tonight. Who do you tell about this meeting?"',
          answers: [
            { t: 'My leadership. Tomorrow morning, with your name in it.', mood: -3,
              run: function (a, convo) {
                if (convo.crossing) return;
                a.add('leader', a.rng(5, 10)); a.add('party', a.rng(3, 7)); a.add('media', a.rng(1, 3));
              },
              reply: '"My name." He puts his glass down. "That is a costly answer for me and a very good one for you. Enjoy it."' },
            { t: 'Nobody. And I am keeping your number.', mood: 1,
              run: function (a, convo) {
                if (convo.crossing) return;
                a.add('stats.cunning', a.rng(.5, 1.5)); a.add('capital', a.rng(1, 3));
                a.S.flags.hasBackChannel = true;
              },
              reply: '"Nobody." He is satisfied. "Then this was a good use of a Thursday for both of us."' },
            { t: 'Everybody. I am going to say it in a speech.', mood: 0,
              run: function (a, convo) {
                if (convo.crossing) return;
                a.add('media', a.rng(3, 7)); a.add('fame', a.rng(2, 5)); a.add('leader', a.rng(2, 6)); a.add('party', -a.rng(0, 3));
              },
              reply: '"In a speech." He is already standing. "You will get one good week out of it and we will deny all of it."' }
          ]
        }
      ],
      settles: function (a, temp, convo) {
        if (convo.crossing) {
          var res = a.defect();
          convo.transcript.push({ who: 'them', text: String(res.body).replace(/<[^>]+>/g, '') });
        } else {
          a.add('party', (temp === 'warm' ? -1 : 1) * a.rng(1, 3));
        }
      },
      close: function (a, temp, convo) {
        if (convo.crossing) return 'The papers were signed on the Friday and announced on the Tuesday, exactly as he said they would be.';
        return {
          warm: 'He pays for the meal, which is the last thing his party will ever give you.',
          fair: 'You both leave by different doors, ten minutes apart, out of habit rather than necessity.',
          cool: 'He leaves first and does not offer his hand.',
          hostile: 'He was on the phone before he reached the car, and not to his own leadership.'
        }[temp];
      }
    }),

    E({
      id: 'relativejob', w: 8, kicker: 'Family',
      title: 'Your cousin wants a job',
      body: function (a) {
        return 'She has a diploma, four children, and has been unemployed for three years. Her mother paid for your ' +
          'schooling when nobody else would. There is a vacancy in a parastatal and one phone call would settle it.';
      },
      choices: [
        { t: 'Make the call', d: 'Everyone does it. That is the problem.', tag: 'risk',
          run: function (a) {
            a.add('grassroots', a.rng(1, 3)); a.add('stats.integrity', -a.rng(2, 4));
            a.dirt('nepotism', 'A relative placed in a state job on your instruction', 1);
            a.nation('corruption', a.rng(.2, .8));
            return { title: 'She starts on Monday', body: 'The family is grateful in a way that will be repaid in votes for two generations. The HR file will outlive your career.', tone: 'flat' };
          } },
        { t: 'Refuse, and explain why', d: 'Correct. Also, at the next funeral, you will sit alone.',
          run: function (a) {
            a.add('stats.integrity', a.rng(2, 4)); a.add('media', a.rng(0, 2));
            a.add('grassroots', -a.rng(1, 4));
            return { title: 'You said no to your own blood', body: 'The aunt who fed you did not shout. She simply stopped speaking to you, and half the village noticed.', tone: 'flat' };
          } },
        { t: 'Pay for her to study instead', d: 'Your own money, no state involved.',
          when: function (a) { return a.P.money > a.wage(2); },
          run: function (a) {
            a.add('money', -a.wage(2)); a.add('stats.integrity', a.rng(1, 2));
            a.add('grassroots', a.rng(0, 2));
            return { title: 'Fees, from your account', body: 'It cost more than the phone call would have and solved less. It is also the only version of this you could defend under oath.', tone: 'good' };
          } }
      ]
    }),

    E({
      id: 'chief', w: 7, kicker: 'Tradition',
      when: function (a) { return a.C.inst.ethnic > 25; },
      title: function (a) { return 'The ' + a.t.chief + ' sends for you'; },
      speaker: function (a) { return { name: RZ.makeName(a.C), role: 'the ' + a.t.chief, org: a.C.regionById[a.P.regionId].name }; },
      where: 'A kraal, mid-morning, shoes left at the edge of the mat',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'He lets the elders speak for an hour and a half before he says anything at all. ' +
          'Then: "You have come about the ' + a.t.constituency + '. Everyone comes about the ' + a.t.constituency + '. ' +
          'I have not told anybody what I think for nineteen years."';
      },
      beats: [
        {
          q: '"Before we discuss land or schools. Whose area is this? Say it carefully."',
          answers: [
            { t: 'Yours. I am a visitor here who happens to be on a ballot.', mood: 3,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(6, 11)); a.add('grassroots', a.rng(3, 6)); a.add('stats.integrity', a.rng(1, 3)); },
              reply: '"A visitor." The elders make a low sound of approval. "Then you may sit closer."' },
            { t: 'The people’s. I answer to them and so, with respect, do you.', mood: -1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(0, 3)); a.add('fame', a.rng(1, 4)); a.add('media', a.rng(1, 3)); a.add('grassroots', -a.rng(0, 3)); },
              reply: 'Nobody speaks for a while. "That is a modern answer," he says, and it is not a compliment.' },
            { t: 'Mine, in law. I would rather it were ours in practice.', mood: 1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(2, 6)); a.add('stats.charisma', a.rng(.5, 1.5)); },
              reply: '"In law." He almost smiles. "The law has been to this kraal twice in my lifetime and left both times."' }
          ]
        },
        {
          q: function (a) {
            return '"Now. There are four hundred children walking eleven kilometres to school. ' +
              'What are you going to do, and do not say you will look into it, because the last three did."';
          },
          answers: [
            { t: 'Promise the school and the road, here, in front of everyone.', mood: 3,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(5, 10)); a.add('grassroots', a.rng(3, 6)); a.S.flags.owesSchool = true; a.promise('school', 'A school and a road, promised at the kraal in front of the elders'); },
              reply: '"Witnessed." He says it formally, and the word changes what you have just done. It is not a campaign promise any more.' },
            { t: 'I can get the road this year. The school I cannot promise.', mood: 2,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4)); a.promise('kraalroad', 'A road to the kraal within the year'); },
              reply: '"One of two." He nods slowly. "Nobody has ever offered me one of two. They always offer both."' },
            { t: 'Nothing, until I am in a position to deliver it. Ask me again then.', mood: 0,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.addRegion(a.P.regionId, -a.rng(0, 2)); a.add('grassroots', a.rng(0, 2)); },
              reply: 'The elders talk among themselves. He listens to them. "We will remember that you did not lie. It is a smaller thing than a school."' }
          ]
        },
        {
          q: '"Last. The young men here do not come to the kraal any more. They are on the internet and they are angry. Do you go to them through me, or around me?"',
          answers: [
            { t: 'Through you. Always.', mood: 3,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(3, 7)); a.add('grassroots', a.rng(2, 5)); a.add('fame', -a.rng(0, 2)); },
              reply: '"Then I will call them, and they will come, because they still come when I call." That may not be true for much longer, and he knows it.' },
            { t: 'Around you, and I would rather tell you that to your face.', mood: 0,
              run: function (a) { a.add('fame', a.rng(3, 6)); a.addRegion(a.P.regionId, a.rng(1, 4)); a.add('grassroots', -a.rng(1, 3)); },
              reply: 'He takes it better than the elders do. "You are honest and you are wrong, and the second one is the one that will cost you."' },
            { t: 'Both. You for the funerals, them for the rallies.', mood: 1,
              run: function (a) { a.addRegion(a.P.regionId, a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 2)); a.add('fame', a.rng(1, 3)); },
              reply: '"Both." He looks at you for a long moment. "That is what a politician says. At least you said it here."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'He walks you to the gate himself, which he has not done for a politician in nineteen years, and everybody in the kraal sees it.',
          fair: 'You are given tea and thanked. Nothing is said about endorsement, which is how these things are never said.',
          cool: 'An elder walks you out. The ' + a.t.chief + ' is already talking to somebody else.',
          hostile: 'The meeting is ended early, courteously, and by tomorrow the whole ' + a.t.constituency + ' will know it was ended early.'
        }[temp];
      }
    }),

    /* ================= scandal & law ================= */
    E({
      id: 'journalist', w: 9, kicker: 'The press',
      when: function (a) { return a.P.dirt.some(function (d) { return !d.exposed; }); },
      title: 'A reporter has the documents',
      body: function (a) {
        var d = a.worstDirt();
        return 'A journalist from ' + P(a.C.media) + ' called your office for comment. They have detail: ' +
          '<em>' + a.esc(d.label.toLowerCase()) + '</em>. They are publishing on Sunday with or without you.';
      },
      choices: [
        { t: 'Get ahead of it — admit and explain', d: 'Costs you a week. Might cost you nothing else.',
          run: function (a) {
            var d = a.worstDirt(); a.removeDirt(d.id);
            a.add('media', a.rng(1, 4)); a.add('fame', a.rng(1, 3));
            a.add('party', -a.rng(1, 4)); a.add('stats.integrity', a.rng(1, 3));
            return { title: 'You said it first', body: 'You gave the interview, took the questions, and apologised for one specific thing rather than in general. The story ran for four days instead of four months.', tone: 'good' };
          } },
        { t: 'Deny everything and threaten to sue', d: 'Standard. Works, until it does not.', tag: 'risk',
          run: function (a) {
            var ok = a.roll('cunning', 50 - a.C.inst.media / 4);
            if (ok) { a.add('media', -a.rng(1, 3)); a.worstDirt().severity += 1; return { title: 'The lawyers wrote', body: 'The editor softened it to two paragraphs on page nine. The file is still in their office and it has grown.', tone: 'flat' }; }
            a.exposeDirt(a.worstDirt().id);
            return { title: 'They published everything', body: 'The letter from your lawyers was reproduced in full, which made the story twice as long and three times as damaging.', tone: 'bad' };
          } },
        { t: 'Reach the proprietor, not the reporter', d: 'A different conversation entirely.', tag: 'risk',
          when: function (a) { return a.P.standing.business > 35 || a.P.money > a.wage(6); },
          run: function (a) {
            a.add('money', -a.wage(5));
            var ok = a.roll('cunning', 46 + a.C.inst.media / 3);
            if (ok) { a.removeDirt(a.worstDirt().id); a.add('media', -a.rng(2, 5)); a.add('stats.integrity', -a.rng(2, 4));
              return { title: 'The story died upstairs', body: 'The reporter was moved to the sports desk. Two colleagues resigned in protest and neither of them will ever be kind to you again.', tone: 'flat' }; }
            a.exposeDirt(a.worstDirt().id); a.add('media', -a.rng(4, 9));
            return { title: 'They ran the interference attempt as the story', body: 'The attempt to kill it became the lede. Press-freedom groups have issued statements. This is now international.', tone: 'bad' };
          } }
      ]
    }),

    E({
      id: 'commission', w: 7, kicker: 'The commission',
      when: function (a) { return a.P.dirt.some(function (d) { return d.exposed; }) && a.C.inst.judiciary > 40; },
      title: 'You have been summoned',
      body: 'A commission of inquiry wants you under oath, on television, for two days. Your lawyers say the evidence ' +
            'is circumstantial. Your lawyers also say that is not the point.',
      choices: [
        { t: 'Appear and answer everything', d: 'Full cooperation, in public.',
          run: function (a) {
            var ok = a.roll('intellect', 52);
            if (ok) { a.add('media', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 5)); a.clearExposed(1);
              return { title: 'You survived the cross-examination', body: 'Eleven hours of testimony, no contradictions, and one moment of genuine contrition. Commentators who wanted you finished have gone quiet.', tone: 'good' }; }
            a.add('media', -a.rng(3, 7)); a.add('leader', -a.rng(2, 6)); a.add('fame', a.rng(2, 5));
            return { title: 'The evidence leader took you apart', body: 'You could not explain the payment dates. The clip of you saying "I do not recall" seven times is already a ringtone.', tone: 'bad' };
          } },
        { t: 'Take every point on review', d: 'Litigate the process, not the facts.', tag: 'risk',
          run: function (a) {
            a.add('money', -a.wage(6)); a.add('media', -a.rng(2, 6)); a.add('fame', a.rng(1, 4));
            a.S.flags.stallCommission = true;
            return { title: 'Stalled in the courts', body: 'Four review applications, two appeals, and a timeline that now runs past the next election. It is legal. It looks exactly like what it is.', tone: 'flat' };
          } },
        { t: 'Resign the position and fight it clean', d: 'Costs the office. May save the career.',
          when: function (a) { return a.tier() >= 5; },
          run: function (a) {
            a.demote(); a.add('media', a.rng(4, 9)); a.add('stats.integrity', a.rng(3, 6)); a.clearExposed(2);
            a.add('party', a.rng(1, 4));
            return { title: 'You stepped aside', body: 'Nobody in this country resigns. Doing it voluntarily reset your reputation in a single afternoon — and cost you a portfolio you may never get back.', tone: 'flat' };
          } }
      ]
    }),

    E({
      id: 'court', w: 6, kicker: 'The courts',
      when: function (a) { return a.C.inst.judiciary > 55; },
      title: 'The court has ruled against the government',
      body: 'A judgment has struck down something the executive wanted badly. There are already voices in the party ' +
            'calling the judiciary counter-revolutionary, captured, and unelected.',
      choices: [
        { t: 'Defend the court publicly', d: 'Unpopular inside the party. Noticed everywhere else.',
          run: function (a) {
            a.add('media', a.rng(3, 7)); a.add('intl', a.rng(3, 6)); a.add('stats.integrity', a.rng(2, 4));
            a.add('party', -a.rng(2, 6)); a.add('leader', -a.rng(1, 4));
            a.nation('judiciary', a.rng(.5, 2));
            return { title: 'You said the judgment must be obeyed', body: 'Four columnists called it statesmanship. Three colleagues called it positioning. The principal called it nothing at all, which was the loudest response.', tone: 'good' };
          } },
        { t: 'Join the attack on the judges', d: 'Cheap applause inside the tent.',
          run: function (a) {
            a.add('party', a.rng(3, 6)); a.add('leader', a.rng(2, 5));
            a.add('media', -a.rng(3, 7)); a.add('intl', -a.rng(2, 5));
            a.nation('judiciary', -a.rng(1, 3));
            return { title: 'You called them unelected', body: 'The line got a standing ovation at the rally. It also gets replayed every time you are ever accused of anything.', tone: 'flat' };
          } },
        { t: 'Say nothing at all', d: 'Wait for the news cycle.',
          run: function (a) { a.add('capital', a.rng(0, 2)); return { title: 'You were unavailable for comment', body: 'A week of silence, and everyone forgot to ask again. Cowardice has an excellent success rate.', tone: 'flat' }; } }
      ]
    }),

    /* ================= security & unrest ================= */
    E({
      id: 'protest', w: 8, kicker: 'The street',
      when: function (a) { return a.S.nation.society.unrest > 35; },
      title: 'The young are in the street',
      body: function (a) {
        return 'It started over ' + P(['fuel prices', 'the electricity tariff', 'a student who died in custody', 'unemployment', 'a stolen election']) +
          ' and it is now in eleven towns. The police have used live ammunition once already. The army is asking for instructions.';
      },
      choices: [
        { t: 'Go out and talk to them, without security', d: 'Reckless. Occasionally magnificent.', tag: 'risk',
          run: function (a) {
            var ok = a.roll('charisma', 52);
            if (ok) { a.add('fame', a.rng(6, 12)); a.add('grassroots', a.rng(4, 9)); a.add('media', a.rng(4, 8));
              a.nation('unrest', -a.rng(4, 9)); a.add('security', -a.rng(1, 4));
              return { title: 'You walked into the crowd', body: 'No convoy, no bodyguards, three hours of being shouted at. By nightfall the photograph was everywhere and the barricades were coming down.', tone: 'good' }; }
            a.add('health', -a.rng(8, 20)); a.add('fame', a.rng(3, 7)); a.add('media', a.rng(1, 4));
            return { title: 'It turned', body: 'A bottle, then a rush, then your driver pulling you backwards through a shop doorway. You are bruised, filmed, and lucky.', tone: 'bad' };
          } },
        { t: 'Back a hard security response', d: 'It ends the protest. It starts something else.', tag: 'risk',
          run: function (a) {
            a.add('security', a.rng(4, 9)); a.nation('unrest', -a.rng(6, 12));
            a.add('media', -a.rng(4, 9)); a.add('intl', -a.rng(4, 10)); a.add('stats.integrity', -a.rng(3, 7));
            a.nation('deaths', a.irange(3, 24));
            a.dirt('crackdown', 'Deaths during a crackdown you publicly authorised', 3);
            return { title: 'Order was restored', body: 'The roads are open, the shops reopened, and there is a number that will follow you into every obituary ever written about you.', tone: 'bad' };
          } },
        { t: 'Announce a concession', d: 'Roll back the price, appoint a commission.',
          run: function (a) {
            a.nation('unrest', -a.rng(4, 8)); a.nation('debt', a.rng(.5, 2));
            a.add('grassroots', a.rng(2, 5)); a.add('intl', -a.rng(1, 3)); a.add('leader', -a.rng(0, 3));
            return { title: 'The price went back down', body: 'Treasury is furious, the Fund is furious, and nobody died this week. Two of those three will be forgotten.', tone: 'good' };
          } }
      ]
    }),

    E({
      id: 'barracks', w: 6, kicker: 'The barracks',
      when: function (a) { return a.C.inst.security > 55 && a.tier() >= 6; },
      title: 'The soldiers have not been paid',
      body: 'Three months of allowances outstanding, and a warrant officer said something on a recording that has ' +
            'reached the Ministry of Defence. In this country that sentence has ended governments.',
      choices: [
        { t: 'Find the money tonight', d: 'From wherever. Ask later.',
          run: function (a) {
            a.nation('debt', a.rng(.5, 2)); a.add('security', a.rng(5, 11));
            a.nation('coup', -a.rng(6, 14));
            return { title: 'Paid by Friday', body: 'The Treasury raided a road fund to do it. The generals now know you understand priorities.', tone: 'good' };
          } },
        { t: 'Arrest the ringleaders', d: 'Decisive. Also how mutinies start.', tag: 'risk',
          run: function (a) {
            var ok = a.roll('cunning', 55);
            a.add('security', ok ? a.rng(1, 4) : -a.rng(5, 12));
            a.nation('coup', ok ? -a.rng(2, 6) : a.rng(8, 18));
            return { title: ok ? 'The command structure held' : 'The barracks did not accept it', body: ok
              ? 'Eleven arrests, no unrest, and a quiet purge of a faction that was becoming a problem anyway.'
              : 'Two units refused to hand over their own. Nothing has happened yet. The word "yet" is doing a great deal of work.', tone: ok ? 'flat' : 'bad' };
          } },
        { t: 'Go to the barracks yourself', d: 'Eat with them. Old trick, still works.',
          run: function (a) {
            var ok = a.roll('grit', 48);
            a.add('security', ok ? a.rng(6, 12) : a.rng(0, 3));
            a.nation('coup', ok ? -a.rng(5, 12) : 0);
            a.add('fame', a.rng(1, 4));
            return { title: ok ? 'You ate from the same pot' : 'Politely received, nothing more', body: ok
              ? 'You queued with a plate like everyone else and listened for four hours. Soldiers remember that longer than they remember money.'
              : 'The officers were correct and formal throughout. You learned nothing and neither did they.', tone: ok ? 'good' : 'flat' };
          } }
      ]
    }),

    E({
      id: 'insurgency', w: 7, kicker: 'The north', only: ['MZ'],
      title: 'An attack in Cabo Delgado',
      body: 'A district town has been taken and held for two days. Displaced families are moving south, the gas project ' +
            'has suspended contractors again, and foreign troops are already in the country.',
      choices: [
        { t: 'Call for a political settlement', d: 'Grievance, not just insurgency.',
          run: function (a) { a.add('intl', a.rng(3, 7)); a.add('media', a.rng(2, 5)); a.add('security', -a.rng(3, 7)); a.add('party', -a.rng(2, 5));
            return { title: 'You named the grievances out loud', body: 'You said the word "marginalisation" in public about the north. Foreign analysts agreed with you. The Ministry of Defence did not.', tone: 'flat' }; } },
        { t: 'Demand more foreign troops', d: 'Faster. Sovereignty is negotiable when the gas is not flowing.',
          run: function (a) { a.add('security', a.rng(3, 7)); a.add('business', a.rng(3, 7)); a.nation('unrest', -a.rng(2, 5)); a.add('grassroots', -a.rng(1, 4));
            return { title: 'The contingent was extended', body: 'The contractors returned within a month. So did the question of what happens the day the foreigners leave.', tone: 'flat' }; } },
        { t: 'Go there yourself', d: 'Nobody senior has.', tag: 'risk',
          run: function (a) { a.add('fame', a.rng(5, 10)); a.add('media', a.rng(3, 8)); a.add('health', -a.rng(4, 9)); a.add('grassroots', a.rng(3, 7));
            return { title: 'You slept in the district', body: 'One night in a school hall with displaced families and no press pool. The photographs that did emerge were taken by the families themselves, which made them unanswerable.', tone: 'good' }; } }
      ]
    }),

    E({
      id: 'xeno', w: 6, kicker: 'The townships', only: ['ZA', 'BW'],
      title: 'Shops are burning',
      body: 'Foreign-owned shops have been looted in three townships and a man has been killed. Two politicians have ' +
            'already blamed immigrants for unemployment, and the polling says it works.',
      choices: [
        { t: 'Condemn it without qualification', d: 'The right answer. It costs votes.',
          run: function (a) { a.add('intl', a.rng(4, 9)); a.add('media', a.rng(3, 7)); a.add('stats.integrity', a.rng(2, 5)); a.add('grassroots', -a.rng(3, 7));
            return { title: 'You refused the easy line', body: 'You said plainly that the unemployed man in the queue is not there because of the shopkeeper. It was not applauded in the hall.', tone: 'good' }; } },
        { t: 'Blame illegal immigration', d: 'It polls. It also puts people in hospital.', tag: 'risk',
          run: function (a) { a.add('grassroots', a.rng(4, 9)); a.add('fame', a.rng(2, 6)); a.add('intl', -a.rng(5, 11)); a.add('media', -a.rng(3, 7)); a.add('stats.integrity', -a.rng(4, 8)); a.nation('unrest', a.rng(2, 6));
            return { title: 'The line landed', body: 'Your numbers moved four points in a week. Three more shops burned in the same week and one of the owners had been in the country for nineteen years.', tone: 'flat' }; } },
        { t: 'Go and reopen a shop with the owner', d: 'A photograph worth more than a statement.',
          run: function (a) { a.add('media', a.rng(3, 7)); a.add('fame', a.rng(2, 5)); a.add('grassroots', -a.rng(0, 3)); a.nation('unrest', -a.rng(1, 4));
            return { title: 'You helped carry the shelving back in', body: 'It changed nothing structural and it changed one street completely.', tone: 'good' }; } }
      ]
    }),

    /* ================= personal ================= */
    E({
      id: 'health', w: 6, kicker: 'Your body',
      when: function (a) { return a.P.health < 55; },
      title: 'The doctor was blunt',
      body: 'Blood pressure, a heart that is not enjoying this, and a specialist saying the word "immediately". ' +
            'There is a by-election in eight weeks and a conference in five months.',
      choices: [
        { t: 'Take the leave', d: 'Six weeks out. Everyone will notice the gap.',
          run: function (a) { a.add('health', a.rng(20, 32)); a.add('fame', -a.rng(2, 5)); a.add('party', -a.rng(1, 4)); a.skipTurns(1);
            return { title: 'You disappeared for six weeks', body: 'Rumours of something worse ran the whole time. You came back thinner, calmer, and considered vulnerable.', tone: 'flat' }; } },
        { t: 'Treat it around the diary', d: 'Medication, and carry on.',
          run: function (a) { a.add('health', a.rng(5, 12)); a.add('money', -a.wage(1));
            return { title: 'Pills, and the schedule unchanged', body: 'The specialist was not consulted about this plan.', tone: 'flat' }; } },
        { t: 'Ignore it entirely', d: 'There is a conference in five months.', tag: 'risk',
          run: function (a) { a.add('health', -a.rng(3, 8)); a.add('party', a.rng(2, 5)); a.add('grassroots', a.rng(2, 5));
            return { title: 'You did not slow down', body: 'You have never looked more committed. Your cardiologist has stopped calling.', tone: 'bad' }; } }
      ]
    }),

    E({
      id: 'tabloid', w: 5, kicker: 'Sunday paper',
      title: 'A private matter, on the front page',
      body: function (a) {
        return P(['A second household in another town.', 'A maintenance case from eleven years ago.',
                  'A recording of you speaking about a colleague in terms you would not repeat.',
                  'A property in the capital that nobody knew you owned.']) +
          ' The tabloid has photographs and the family have already seen them.';
      },
      choices: [
        { t: 'Address it once, then never again', d: 'A statement, a family photograph, silence.',
          run: function (a) { a.add('media', a.rng(0, 3)); a.add('fame', a.rng(2, 5)); a.add('grassroots', -a.rng(1, 4)); a.add('health', -a.rng(2, 6));
            return { title: 'One statement, and a wall', body: 'You did not perform contrition and you did not fight. It burned out in nine days, which is fast for this country.', tone: 'flat' }; } },
        { t: 'Attack the paper', d: 'Rally the base against the media.',
          run: function (a) { a.add('grassroots', a.rng(1, 4)); a.add('media', -a.rng(3, 8)); a.add('fame', a.rng(3, 7));
            return { title: 'You made it a fight', body: 'The base loved it. The paper now has a personal interest in your career, which is the worst kind of interest to attract.', tone: 'bad' }; } },
        { t: 'Have your wife/husband stand beside you', d: 'It works. It also costs something private.', tag: 'risk',
          run: function (a) { a.add('media', a.rng(1, 5)); a.add('grassroots', a.rng(1, 4)); a.add('health', -a.rng(3, 8)); a.add('stats.integrity', -a.rng(0, 2));
            return { title: 'The photograph was taken', body: 'They agreed, held your hand for the cameras, and did not speak to you in the car afterwards.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'endorse', w: 6, kicker: 'The youth league',
      when: function (a) { return a.tier() >= 3 && a.P.fame > 30; },
      title: function (a) { return 'The ' + a.t.youthWing + ' wants to endorse you'; },
      body: 'They are noisy, they are undisciplined, they can fill a stadium in a week, and they have destroyed ' +
            'three careers by endorsing them too early.',
      choices: [
        { t: 'Accept publicly', d: 'Energy now, a target on your back immediately.', tag: 'risk',
          run: function (a) { a.add('fame', a.rng(5, 10)); a.add('grassroots', a.rng(3, 7)); a.add('party', a.rng(2, 5)); a.add('leader', -a.rng(4, 10));
            return { title: 'They sang your name at the stadium', body: 'You are now the succession candidate whether you wanted to be or not. The principal watched the broadcast without expression.', tone: 'flat' }; } },
        { t: 'Accept quietly, deny publicly', d: 'Take the machine, not the headline.',
          run: function (a) { a.add('grassroots', a.rng(2, 5)); a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(.5, 1.5)); a.add('leader', -a.rng(0, 2));
            return { title: 'Neither confirmed nor denied', body: 'Their structures are working for you in four ' + a.t.regionPl + '. Officially, nothing has happened.', tone: 'good' }; } },
        { t: 'Decline it', d: 'Loyalty, visibly.',
          run: function (a) { a.add('leader', a.rng(4, 9)); a.add('grassroots', -a.rng(1, 4)); a.add('fame', -a.rng(0, 2));
            return { title: 'You told them it was premature', body: 'You said the movement has a leader and the leader is not you. It was word-for-word what the principal needed to hear.', tone: 'good' }; } }
      ]
    }),

    E({
      id: 'rivalfalls', w: 5, kicker: 'A vacancy',
      when: function (a) { return a.rivalCount() > 0; },
      title: 'Your rival has fallen',
      body: function (a) {
        var r = a.aRival();
        return '<strong>' + a.esc(r.name) + '</strong> is finished — ' +
          P(['arrested at the airport', 'named in an audit report', 'recorded saying the wrong thing to the wrong person',
             'abandoned by their own province', 'hospitalised, and the party has moved on already']) +
          '. There is a gap where they used to stand and four people are already moving into it.';
      },
      choices: [
        { t: 'Move into the space immediately', d: 'Their structures are leaderless for about a week.',
          run: function (a) { a.add('party', a.rng(4, 8)); a.add('grassroots', a.rng(2, 5)); a.removeRival(); a.add('media', -a.rng(0, 2));
            return { title: 'You took the province', body: 'You were in their stronghold within four days, promising continuity to people who were terrified of being purged. Most of them took it.', tone: 'good' }; } },
        { t: 'Defend them publicly', d: 'Costly, and remembered by everyone.',
          run: function (a) { a.add('stats.integrity', a.rng(2, 5)); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(1, 4)); a.makeAlly();
            return { title: 'You said they deserved a hearing', body: 'You were the only senior figure who did. If they ever come back — and here, they often do — you own them.', tone: 'good' }; } },
        { t: 'Say nothing and watch', d: 'Free.',
          run: function (a) { a.removeRival(); a.add('capital', a.rng(1, 3));
            return { title: 'You were unavailable', body: 'The safest thing you can do while a colleague is destroyed is to be photographed somewhere else.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'disaster', w: 6, kicker: 'Emergency',
      title: function (a) { return P(['A cyclone', 'A bus disaster', 'Flooding', 'A mine collapse', 'A cholera outbreak']) + ' in ' + a.homeName(); },
      body: 'The response is late because the response is always late. The fund exists on paper. The trucks exist in another province.',
      choices: [
        { t: 'Be there within 24 hours', d: 'Sleep on the floor of the community hall.',
          run: function (a) { a.add('grassroots', a.rng(5, 10)); a.addRegion(a.P.regionId, a.rng(6, 12)); a.add('fame', a.rng(3, 7)); a.add('health', -a.rng(4, 9)); a.add('media', a.rng(2, 5));
            return { title: 'You got there before the minister', body: 'You were photographed carrying blankets, which is worth a decade of speeches. You also actually carried blankets.', tone: 'good' }; } },
        { t: 'Organise the response from the capital', d: 'Less visible. More effective.',
          run: function (a) { a.add('capital', a.rng(2, 5)); a.add('leader', a.rng(2, 5)); a.nation('unrest', -a.rng(1, 3)); a.add('grassroots', a.rng(0, 2));
            return { title: 'Four ministries, one call list', body: 'The convoy moved on day two instead of day nine. Nobody knows why and you will never be able to prove it was you.', tone: 'good' }; } },
        { t: 'Launch a public appeal in your name', d: 'Money in, credit up, questions later.', tag: 'risk',
          run: function (a) { a.add('fame', a.rng(4, 8)); a.add('money', a.wage(1.5)); a.add('grassroots', a.rng(3, 6));
            if (a.chance(.3)) a.dirt('appeal', 'A disaster appeal fund with no published accounts', 2);
            return { title: 'The fund raised well', body: 'Six weeks later somebody asked for the audited statement. There is not one yet.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'donorcall', w: 6, kicker: 'A debt',
      when: function (a) { return a.P.dirt.some(function (d) { return d.id === 'patron' || d.id === 'donor'; }); },
      title: 'He has called in the favour',
      body: 'The man who funded your last three campaigns wants a licence renewed, a case dropped, or a board seat. ' +
            'He is not asking. He is reminding.',
      choices: [
        { t: 'Do it', d: 'Keep the money, keep the obligation.', tag: 'risk',
          run: function (a) { a.add('business', a.rng(3, 7)); a.add('money', a.wage(3)); a.add('stats.integrity', -a.rng(3, 6)); a.dirt('capture', 'A regulatory decision made for a private funder', 3);
            return { title: 'The licence was renewed', body: 'One signature, thirty seconds, and a permanent hold over you by a man who keeps records.', tone: 'flat' }; } },
        { t: 'Refuse', d: 'Lose the funding. Possibly gain a file.', tag: 'risk',
          run: function (a) { a.add('business', -a.rng(5, 10)); a.add('stats.integrity', a.rng(3, 6));
            if (a.chance(.45)) { a.dirt('revenge', 'A former funder is briefing journalists against you', 3); return { title: 'He is talking to reporters', body: 'You said no. Within a fortnight a journalist had documents that only he could have supplied.', tone: 'bad' }; }
            return { title: 'He accepted it, coldly', body: 'The funding stopped that afternoon. So far, nothing else has.', tone: 'flat' }; } },
        { t: 'Delay him with process', d: 'A committee, a review, a year.',
          run: function (a) { a.add('stats.cunning', a.rng(.5, 1.5)); a.add('business', -a.rng(1, 4)); a.add('capital', -2);
            return { title: 'It went to a technical committee', body: 'Nobody has said no. Nothing has happened. This can be sustained for about eleven months.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'recall', w: 5, kicker: 'The list',
      when: function (a) { return (a.C.house.method === 'pr') && a.tier() >= 4 && a.P.standing.party < 45; },
      title: 'They can simply remove you',
      body: function (a) {
        return 'Under a list system your seat belongs to the party, not to you or to any voter. The ' + a.t.execShort +
          ' has begun discussing your "deployment", which is the word used immediately before somebody stops being an MP.';
      },
      choices: [
        { t: 'Grovel to the leadership', d: 'Publicly, thoroughly, immediately.',
          run: function (a) { a.add('leader', a.rng(5, 10)); a.add('party', a.rng(3, 7)); a.add('media', -a.rng(2, 5)); a.add('fame', -a.rng(1, 3));
            return { title: 'You made the correct noises', body: 'A statement reaffirming your commitment to the collective. It was humiliating and it worked.', tone: 'flat' }; } },
        { t: 'Go public and dare them', d: 'Make removal expensive.', tag: 'risk',
          run: function (a) { var ok = a.roll('oratory', 52); a.add('media', ok ? a.rng(4, 9) : -a.rng(1, 4)); a.add('fame', a.rng(3, 7)); a.add('party', -a.rng(3, 8));
            if (!ok) a.demote();
            return { title: ok ? 'Too expensive to remove' : 'They removed you anyway', body: ok
              ? 'You made yourself a story. Firing a story is harder than firing a member.'
              : 'The deployment committee met on a Tuesday and it was done by Wednesday. There is no appeal.', tone: ok ? 'good' : 'bad' }; } },
        { t: 'Start building an exit', d: 'A new party, or a job outside politics.',
          run: function (a) { a.S.flags.hasBackChannel = true; a.add('business', a.rng(2, 5)); a.add('party', -a.rng(0, 3));
            return { title: 'You made arrangements', body: 'Two conversations that would end you if reported. Both worth having.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'coalition', w: 7, kicker: 'Coalition', only: ['ZA', 'LS', 'BW'],
      when: function (a) { return a.tier() >= 6; },
      title: 'The coalition partner is threatening to walk',
      body: 'Over a portfolio, a policy, or an insult at a press conference — the reason changes weekly. If they go, ' +
            'the arithmetic goes with them and the government falls inside a month.',
      choices: [
        { t: 'Give them the portfolio', d: 'Survive now, look weak now.',
          run: function (a) { a.add('capital', -6); a.nation('stability', a.rng(4, 9)); a.add('party', -a.rng(2, 5)); a.add('media', -a.rng(1, 4));
            return { title: 'They got Trade', body: 'The government survived the week. Your own backbenchers watched a junior partner extract a cabinet post by threatening to leave, and learned the lesson.', tone: 'flat' }; } },
        { t: 'Call their bluff', d: 'They have more to lose than you do. Probably.', tag: 'risk',
          run: function (a) { var ok = a.roll('cunning', 50); if (ok) { a.add('party', a.rng(4, 8)); a.add('fame', a.rng(2, 5)); a.nation('stability', a.rng(2, 5));
              return { title: 'They stayed', body: 'They had nowhere to go and you knew it. The relationship is now purely transactional, which is at least honest.', tone: 'good' }; }
            a.nation('stability', -a.rng(8, 16)); a.add('party', -a.rng(3, 7));
            return { title: 'They walked', body: 'The letter was delivered to the Speaker at 4pm. There is a motion on the order paper for Tuesday.', tone: 'bad' }; } },
        { t: 'Open talks with a different party', d: 'Replace them before they jump.',
          run: function (a) { a.add('stats.cunning', a.rng(1, 2)); a.add('capital', -4); a.nation('stability', a.rng(1, 5)); a.add('media', -a.rng(0, 3));
            return { title: 'A second door', body: 'Two parties now believe they are indispensable, which means neither is. This is the only stable position in coalition politics.', tone: 'good' }; } }
      ]
    }),

    E({
      id: 'observers', w: 5, kicker: 'Observers',
      when: function (a) { return a.C.inst.electoral < 60 && a.yearsToElection() <= 1; },
      title: 'The observers have concerns',
      body: 'Regional and continental observer missions have raised the voters’ roll, the state media coverage, and ' +
            'the use of government vehicles. The commission says the process is credible.',
      choices: [
        { t: 'Demand a clean roll, publicly', d: 'Even if it costs your own side.',
          run: function (a) { a.add('intl', a.rng(5, 10)); a.add('media', a.rng(3, 7)); a.add('party', -a.rng(3, 8)); a.nation('electoral', a.rng(1, 4)); a.add('stats.integrity', a.rng(2, 4));
            return { title: 'You broke ranks on the roll', body: 'The opposition quoted you for a week. Your own provincial chair asked, on a recording, whose side you are on.', tone: 'good' }; } },
        { t: 'Attack the observers as colonial', d: 'It works domestically. It always works domestically.',
          run: function (a) { a.add('party', a.rng(3, 7)); a.add('grassroots', a.rng(1, 4)); a.add('intl', -a.rng(5, 11)); a.nation('electoral', -a.rng(1, 3));
            return { title: 'You told them to mind their own business', body: 'The line was applauded at every rally for a month. Two donor programmes are now "under review".', tone: 'flat' }; } },
        { t: 'Quietly fix the worst of it', d: 'Fix the roll, keep the vehicles.',
          run: function (a) { a.add('intl', a.rng(2, 5)); a.nation('electoral', a.rng(1, 3)); a.add('capital', -3);
            return { title: 'A partial clean-up', body: 'Ninety thousand duplicates removed and nothing said publicly. Enough for the mission report, not enough to lose anything.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'whistle', w: 5, kicker: 'Your ministry',
      when: function (a) { return a.tier() >= 6; },
      title: 'A whistleblower inside your ministry',
      body: 'A middle manager has taken documents about a procurement to the auditor-general. You did not sign that ' +
            'contract. Somebody who reports to you did, and the difference will not survive a headline.',
      choices: [
        { t: 'Back the whistleblower and open it all up', d: 'Costs allies. Buys a reputation.',
          run: function (a) { a.add('media', a.rng(4, 9)); a.add('stats.integrity', a.rng(3, 6)); a.add('intl', a.rng(2, 5)); a.add('party', -a.rng(3, 8)); a.nation('corruption', -a.rng(.5, 2));
            return { title: 'You referred it yourself', body: 'Two of your own deployees are now under investigation and one of them raised money for you. The auditor-general has never had a minister do this.', tone: 'good' }; } },
        { t: 'Manage it internally', d: 'A quiet transfer, a quiet settlement.', tag: 'risk',
          run: function (a) { a.add('party', a.rng(1, 4)); a.add('stats.integrity', -a.rng(2, 5)); a.dirt('cover', 'A procurement complaint settled quietly inside your ministry', 3);
            return { title: 'Transferred to another department', body: 'The whistleblower has a new office with no work in it. The file is closed. Files reopen.', tone: 'flat' }; } },
        { t: 'Blame the official and move on', d: 'Someone must be seen to fall.',
          run: function (a) { a.add('media', a.rng(0, 3)); a.add('party', -a.rng(0, 3)); a.add('leader', a.rng(1, 4)); a.add('stats.integrity', -a.rng(1, 3));
            return { title: 'The director-general resigned', body: 'A statement about accountability at all levels. The tender pipeline was not changed in any way.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'landcase', w: 5, kicker: 'Land',
      title: 'A land dispute in your area',
      body: 'A commercial farm, a resettlement claim, and a chief with a competing map. Three hundred families have ' +
            'built houses on land that at least two people have title to.',
      choices: [
        { t: 'Side with the occupiers', d: 'Justice, or populism, depending who is asked.',
          run: function (a) { a.addRegion(a.P.regionId, a.rng(5, 10)); a.add('grassroots', a.rng(3, 7)); a.add('business', -a.rng(3, 7)); a.add('intl', -a.rng(1, 4));
            return { title: 'You stood in front of the bulldozers', body: 'Literally, and it was filmed. Investors have noticed. So have three hundred families who now belong to you.', tone: 'good' }; } },
        { t: 'Uphold the title deeds', d: 'Rule of law, cold comfort.',
          run: function (a) { a.add('business', a.rng(3, 7)); a.add('intl', a.rng(2, 5)); a.add('grassroots', -a.rng(4, 8)); a.add('stats.integrity', a.rng(1, 3));
            return { title: 'The eviction went ahead', body: 'You said the courts must be respected. You were right, and you will lose two wards for it.', tone: 'flat' }; } },
        { t: 'Find land elsewhere and pay for the move', d: 'Slow, expensive, and the only outcome nobody hates.',
          run: function (a) { a.add('capital', -5); a.add('money', -a.wage(2)); a.add('grassroots', a.rng(2, 5)); a.add('business', a.rng(1, 4)); a.add('stats.intellect', a.rng(.5, 1.5));
            return { title: 'A negotiated resettlement', body: 'Eight months of meetings, a serviced site, and no headlines at all. This is what governing actually looks like.', tone: 'good' }; } }
      ]
    }),

    E({
      id: 'clinic', w: 6, kicker: 'Health',
      title: 'The clinic has no medicine',
      body: function (a) {
        return 'The district hospital in ' + a.homeName() + ' has been out of basic drugs for eleven weeks. A nurse posted ' +
          'a photograph of the empty dispensary and it has been shared forty thousand times.';
      },
      choices: [
        { t: 'Amplify the nurse', d: 'Back the person who told the truth.',
          run: function (a) { a.add('media', a.rng(3, 7)); a.add('grassroots', a.rng(3, 6)); a.add('leader', -a.rng(2, 5)); a.add('party', -a.rng(1, 4));
            return { title: 'You shared it yourself', body: 'A politician amplifying a criticism of their own government is rare enough to be news. The Ministry of Health is furious, and the medicines arrived in nine days.', tone: 'good' }; } },
        { t: 'Buy the medicines yourself', d: 'Immediate. Also a permanent expectation.',
          when: function (a) { return a.P.money > a.wage(2); },
          run: function (a) { a.add('money', -a.wage(2.5)); a.addRegion(a.P.regionId, a.rng(5, 10)); a.add('grassroots', a.rng(4, 8)); a.nation('health', a.rng(0, 1));
            return { title: 'Three months of stock, from your pocket', body: 'It solved this quarter and taught the district that the state is optional and you are not.', tone: 'good' }; } },
        { t: 'Take it up through channels', d: 'A letter, a follow-up, a question in the House.',
          run: function (a) { a.add('capital', a.rng(1, 3)); a.add('party', a.rng(0, 2)); a.add('grassroots', a.rng(0, 2)); a.nation('health', a.rng(0, .6));
            return { title: 'A written question, answered in six weeks', body: 'The answer confirmed the stockout and blamed a supplier. Nothing arrived until the following quarter.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'succession', w: 7, kicker: 'Succession',
      when: function (a) { return a.tier() >= 8 && !a.isLeader(); },
      title: 'Somebody asked the question on live television',
      speaker: function (a) { return { name: RZ.makeName(a.C), role: 'anchor', org: RZ.pick(a.C.media) }; },
      where: 'A live studio, the panel discussion already overrunning',
      settleOn: 'media',
      opening: function (a) {
        return 'She waits for the other panellist to finish, and then turns her chair very slightly towards you, ' +
          'which is how you know the next eleven minutes are the reason you were invited.';
      },
      beats: [
        {
          q: function (a) { return '"Simple question. Do you want to be ' + a.t.hos + '?"'; },
          answers: [
            { t: 'Yes. I do.', mood: 2, tag: 'risk',
              run: function (a) { a.add('fame', a.rng(6, 12)); a.add('media', a.rng(3, 8)); a.add('party', a.rng(2, 6)); a.add('leader', -a.rng(8, 16)); a.makeRival(); a.S.flags.declared = true; },
              reply: 'She had a follow-up ready for every answer except that one. "Right," she says. "Well. That is a first."' },
            { t: 'The movement will decide. I serve where I am deployed.', mood: 0,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', -a.rng(1, 4)); a.add('media', -a.rng(0, 2)); },
              reply: '"I serve where I am deployed," she repeats, to camera. "That has been the answer since 1994 and it has never once meant no."' },
            { t: 'No. Not now, not in five years, not ever.', mood: 1, tag: 'risk',
              run: function (a) { a.add('leader', a.rng(8, 15)); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(2, 6)); a.S.flags.ruledOut = true; },
              reply: '"Not ever." She lets it hang. "That is on tape now, and tape is forever, as you know."' }
          ]
        },
        {
          q: function (a) {
            return '"Then let me ask it the other way. If the ' + a.t.exec + ' came to you tonight and asked you to stand — what would you say to them?"';
          },
          answers: [
            { t: 'I would say yes, and I have just said so on your programme.', mood: 2,
              run: function (a) { a.add('fame', a.rng(4, 9)); a.add('party', a.rng(2, 6)); a.add('leader', -a.rng(4, 10)); a.makeRival(); },
              reply: '"So the answer to the first question was yes." She is enjoying this. So, by now, is the entire country.' },
            { t: 'I would ask them why they were asking me and not the person in the job.', mood: 3,
              run: function (a) { a.add('media', a.rng(3, 7)); a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3)); },
              reply: 'She actually pauses. It is the first answer of the night that has moved the question rather than dodged it.' },
            { t: 'I would tell them what I have told you, and you may draw your own conclusion.', mood: -1,
              run: function (a) { a.add('media', -a.rng(2, 5)); a.add('leader', a.rng(1, 4)); },
              reply: '"I will draw it, then." She turns back to the wide shot. "Viewers, draw your own."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'The clip ran on every bulletin for two days and you came out of it looking like somebody who answers questions.',
          fair: 'The clip ran once. Your office spent Friday explaining what you had meant, which is the usual Friday.',
          cool: 'The clip ran with the anchor’s eyebrow, which did more damage than anything you said.',
          hostile: 'The clip is now the thing people play before they introduce you at events, for years.'
        }[temp];
      }
    }),

    E({
      id: 'stadium', w: 4, kicker: 'Relief',
      title: 'The national team qualified',
      body: 'For one week nobody is talking about the currency. Every politician in the country is trying to be ' +
            'photographed at the airport and the team has noticed.',
      choices: [
        { t: 'Be at the airport with everyone else', d: 'Shameless. Effective.',
          run: function (a) { a.add('fame', a.rng(2, 5)); a.add('media', -a.rng(0, 2)); a.add('grassroots', a.rng(1, 3));
            return { title: 'You made the group photograph', body: 'You are fourth from the left, half obscured by a minister who arrived earlier. It still counts.', tone: 'good' }; } },
        { t: 'Pay the players’ outstanding bonuses instead', d: 'They have not been paid since March.',
          when: function (a) { return a.P.money > a.wage(2) || a.tier() >= 6; },
          run: function (a) { a.add('money', -a.wage(2)); a.add('fame', a.rng(4, 9)); a.add('grassroots', a.rng(3, 6)); a.add('media', a.rng(2, 5));
            return { title: 'The captain thanked you by name', body: 'Live, on the tarmac, in front of the entire country. That is the cheapest publicity ever purchased in this republic.', tone: 'good' }; } },
        { t: 'Stay away from it', d: 'Some dignity is worth keeping.',
          run: function (a) { a.add('media', a.rng(1, 3)); a.add('stats.integrity', a.rng(0, 1.5));
            return { title: 'You were not at the airport', body: 'One columnist noticed and approved. Nobody else noticed at all.', tone: 'flat' }; } }
      ]
    }),

    E({
      id: 'thirdterm', w: 12, kicker: 'The constitution',
      when: function (a) { return a.isPresident() && a.S.nation.termNumber >= 2 && a.C.termLimit > 0; },
      once: true,
      title: 'They are asking you to stay',
      speaker: function (a) { return { name: RZ.makeName(a.C), role: 'Secretary-General of the party', org: '' }; },
      where: 'The residence, after ten at night, no minutes taken',
      settleOn: 'party',
      opening: function (a) {
        return 'He has the resolutions in a folder and he puts the folder on the table without opening it. ' +
          '"Six provinces. You did not ask for them. Four of them were paid for and I know which four. ' +
          'The constitution says two terms and the ' + a.t.exec + ' says the movement must not be destabilised, ' +
          'and both of those sentences are now your problem."';
      },
      beats: [
        {
          q: '"So. Do we let this run, or do you kill it tonight?"',
          answers: [
            { t: 'Kill it tonight. I will name my last day in public tomorrow.', mood: 2,
              run: function (a) { a.add('intl', a.rng(10, 20)); a.add('media', a.rng(8, 15)); a.add('stats.integrity', a.rng(6, 12)); a.add('party', -a.rng(2, 6)); a.S.flags.willStepDown = true; a.legacyMark('respectedTermLimit'); },
              reply: 'He is quiet for a long time. "Then from tomorrow you are a lame duck and everybody in this building starts moving. You know that."' },
            { t: 'Let it run. I will say nothing either way.', mood: 1,
              run: function (a) { a.add('media', -a.rng(3, 8)); a.add('intl', -a.rng(3, 8)); a.add('party', a.rng(2, 6)); a.S.flags.thirdTermDebate = true; },
              reply: '"Nothing either way." He opens the folder now. "Then I will keep collecting these, and in nine months it will not be a debate any more."' },
            { t: 'Bring me the amendment. I want the numbers in the House by Friday.', mood: 3, tag: 'risk',
              run: function (a) { a.S.flags.pushingThirdTerm = true; a.add('party', a.rng(3, 8)); a.add('intl', -a.rng(6, 14)); a.add('media', -a.rng(5, 12)); },
              reply: '"By Friday." He writes nothing down. Men in his position have not written anything down since 1998.' }
          ]
        },
        {
          q: function (a) {
            return '"Whichever way. There is a second question and nobody else in this country will ask it of you. ' +
              'What are you afraid of — losing the office, or what happens to you the day after you leave it?"';
          },
          answers: [
            { t: 'The day after. Obviously. And I am going to leave anyway.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(4, 8)); a.add('intl', a.rng(3, 8)); a.S.flags.willStepDown = true; a.legacyMark('respectedTermLimit'); },
              reply: '"Then we will need to build you a floor to land on." For the first time tonight he sounds like a friend rather than a Secretary-General.' },
            { t: 'The office. The country is not finished and neither am I.', mood: 1,
              run: function (a) { a.add('party', a.rng(3, 7)); a.add('media', -a.rng(2, 6)); a.add('intl', -a.rng(2, 6)); a.S.flags.thirdTermDebate = true; },
              reply: '"They all say the country is not finished." He picks up the folder. "It is never finished. That is what a country is."' },
            { t: 'Neither. I am afraid of who gets it next.', mood: 2,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', a.rng(0, 3)); a.add('stats.cunning', a.rng(1, 3)); },
              reply: '"Then choose one and build them, starting Monday." It is the best advice you will get this year and you will probably not take it.' }
          ]
        }
      ],
      settles: function (a, temp, convo) {
        // The amendment is only actually attempted if it was asked for, and the
        // room decides how much of the machine goes with it.
        if (a.S.flags.pushingThirdTerm) {
          a.S.flags.pushingThirdTerm = false;
          var res = a.attemptThirdTerm();
          convo.transcript.push({ who: 'them', text: res.title + ' ' + String(res.body).replace(/<[^>]+>/g, '') });
        } else {
          a.add('party', (temp === 'warm' ? 1 : temp === 'hostile' ? -1 : 0) * a.rng(2, 5));
        }
      },
      close: function (a, temp) {
        return {
          warm: 'He leaves by the side door at one in the morning. Whatever was decided in this room, it was decided with him and not around him.',
          fair: 'He leaves without finishing the tea. Nothing was settled that cannot be reopened in three months.',
          cool: 'He takes the folder with him, which means the resolutions keep coming.',
          hostile: 'He takes the folder with him and does not say goodnight. By Thursday two more provinces have passed the resolution.'
        }[temp];
      }
    }),

    E({
      id: 'deputybrief', w: 7, kicker: 'Your deputy',
      when: function (a) { return a.isLeader() || a.isPresident(); },
      title: 'Your deputy is briefing against you',
      speaker: function (a) {
        var r = a.aRival();
        return { name: r ? r.name : RZ.makeName(a.C), role: r ? r.role : 'your deputy', org: '' };
      },
      where: 'Your office, a meeting neither of you asked for',
      settleOn: 'party',
      opening: function (a) {
        return 'Journalists have started using a phrase that comes from exactly one office. Provincial chairs are ' +
          'being flown to a farm at somebody else’s expense. He sits down before he is asked to, which is itself ' +
          'the answer to the question you were going to open with.';
      },
      beats: [
        {
          q: '"You wanted to see me. I assume this is about the farm."',
          answers: [
            { t: 'It is. Stop, or I remove you this week.', mood: -2,
              run: function (a, convo) {
                convo.removed = a.roll('cunning', 52);
                a.add('party', convo.removed ? a.rng(2, 6) : -a.rng(4, 9));
                a.add('leader', convo.removed ? a.rng(1, 4) : -a.rng(2, 5));
                if (!convo.removed) a.makeRival();
              },
              reply: function (a, convo) {
                return convo.removed
                  ? '"This week." He counts the provinces in his head, out loud, and stops at two. "Fine."'
                  : '"Remove me." He smiles. "Count the provinces first. I have, twice, this morning."';
              } },
            { t: 'It is. And I would like to know what you actually want.', mood: 2,
              run: function (a) { a.add('stats.cunning', a.rng(1, 3)); a.add('party', a.rng(1, 4)); },
              reply: '"What I want." He looks genuinely thrown. "Nobody in this building has asked me that in four years."' },
            { t: 'No. It is about the electricity portfolio, which is now yours.', mood: 1,
              run: function (a) { a.add('capital', -5); a.add('party', a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 2)); },
              reply: '"Electricity." He understands immediately what has been done to him, and he cannot refuse it in front of a camera.' }
          ]
        },
        {
          q: '"Let us be adults. There is a conference in two years and one of us is going to be finished by it. What is the arrangement?"',
          answers: [
            { t: 'You succeed me. I will say so publicly and I will mean it.', mood: 3,
              run: function (a) { a.add('party', a.rng(4, 9)); a.add('leader', a.rng(2, 5)); a.add('stats.integrity', a.rng(2, 5)); a.removeRival(); a.promise('succession', 'A public undertaking that your deputy succeeds you'); },
              reply: '"Publicly." He does not trust it and he cannot afford not to. "Then I will stop, and if you break it I will not stop again."' },
            { t: 'There is no arrangement. Beat me on the floor or stop briefing.', mood: -1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('stats.grit', a.rng(1, 3)); a.makeRival(); },
              reply: '"On the floor, then." He stands. At least it is now a contest and not a whispering campaign.' },
            { t: 'There is a file on you, and this is me telling you it exists.', mood: -3, tag: 'risk',
              run: function (a) { var r = a.doLeak(true); a.S.flags.leakedOnDeputy = true; },
              reply: '"A file." He is very still. "Then we are both going to find out what is in yours."' }
          ]
        }
      ],
      close: function (a, temp) {
        return {
          warm: 'He leaves and cancels the farm. The phrase disappears from the papers within a fortnight.',
          fair: 'He leaves. The briefings slow down without stopping, which is the most you were going to get.',
          cool: 'He leaves and flies to the farm that weekend anyway, with two more chairs than last time.',
          hostile: 'He leaves, and by Sunday three provinces have passed motions of support for him that nobody drafted in a province.'
        }[temp];
      }
    }),

    /* ================= what you said in a room ================= */
    E({
      id: 'promiseDue', w: 9, kicker: 'A word given',
      when: function (a) {
        var p = a.oldestPromise();
        return !!p && a.monthsSince(p) >= 10;
      },
      title: function (a) {
        return a.monthsSince(a.oldestPromise()) >= 20 ? 'They have stopped asking politely' : 'They have come to collect';
      },
      body: function (a) {
        var p = a.oldestPromise();
        var months = a.monthsSince(p);
        return 'In ' + RZ.monthName(p.month) + ' ' + p.year + ', in a room with people in it, you said this: ' +
          '<strong>' + RZ.esc(p.text) + '</strong>. That was ' + months + ' months ago. ' +
          (months >= 20
            ? 'The delegation outside your office has brought the minutes, and a photographer.'
            : 'They have written twice. This morning they came in person and sat down without being asked.');
      },
      choices: [
        { t: 'Deliver it, whatever it costs now', d: 'Late is not the same as never.', tag: 'cost',
          when: function (a) { return a.P.money > a.wage(2) || a.P.capital > 12; },
          run: function (a) {
            var p = a.oldestPromise();
            a.keepPromise(p.id);
            if (a.P.capital > 12) a.add('capital', -a.rng(6, 12)); else a.add('money', -a.wage(a.rng(2, 4)));
            a.add('grassroots', a.rng(5, 10)); a.addRegion(a.P.regionId, a.rng(6, 12));
            a.add('stats.integrity', a.rng(1, 3)); a.add('media', a.rng(0, 3));
            return { title: 'Late, and done', body: 'It took every favour you had left in that department, and it is finished. ' +
              'People who had written you off have started saying your name differently.', tone: 'good' };
          } },
        { t: 'Explain honestly why you could not', d: 'No excuse, no theatre. Just the truth.',
          run: function (a) {
            var p = a.oldestPromise();
            a.keepPromise(p.id);
            var ok = a.roll('oratory', 48);
            a.add('grassroots', ok ? -a.rng(0, 2) : -a.rng(4, 9));
            a.add('stats.integrity', a.rng(1, 2));
            if (!ok) a.addRegion(a.P.regionId, -a.rng(3, 7));
            return { title: ok ? 'They did not like it, but they believed you' : 'Honesty was not enough',
              body: ok ? 'You told them exactly where it stalled and who stopped it, and you did not promise anything new. ' +
                'One of them said afterwards that at least you came yourself.'
                : 'Halfway through, somebody at the back said that a man who cannot deliver should not have opened his mouth. ' +
                  'The room agreed with him.', tone: ok ? 'flat' : 'bad' };
          } },
        { t: 'Promise it again, with a date this time', d: 'Buys quiet. Buys nothing else.', tag: 'risk',
          run: function (a) {
            var p = a.oldestPromise();
            a.keepPromise(p.id);
            a.promise(p.id + '-again', p.text + ' (repeated, with a date)');
            a.add('grassroots', a.rng(1, 3)); a.add('stats.integrity', -a.rng(1, 3));
            if (a.chance(0.4)) a.dirt('promises', 'A record of promises made and not kept, kept by somebody else', 2);
            return { title: 'A new date', body: 'They wrote it down. So did the reporter who was standing in the corridor ' +
              'and who you did not see until afterwards.', tone: 'flat' };
          } }
      ]
    }),

    /* ================= the last question ================= */
    E({
      id: 'lastterm', w: 11, kicker: 'The end of it',
      // Asked once, and late. It ends careers, so it must not come round again
      // every second year for somebody who has already answered it.
      once: true,
      when: function (a) { return a.P.age >= 68 && a.tier() >= 2; },
      title: 'They want to know if this is the last one',
      speaker: function (a) {
        return { name: RZ.makeName(a.C), role: 'your constituency secretary of twenty years', org: '' };
      },
      where: 'The constituency office, Saturday, nobody else in',
      settleOn: 'grassroots',
      opening: function (a) {
        return 'She has made the tea and she has not sat down, which is how you know. ' +
          '"I have been asked to ask you, because nobody else will. You are ' + a.P.age + '. ' +
          'Is this the last one?"';
      },
      beats: [
        {
          q: '"And before you answer — I am not asking whether you can win it. I know you can win it. I am asking whether you should."',
          answers: [
            { t: 'It is the last one. Announce it and start finding my successor.', mood: 3,
              run: function (a, convo) {
                convo.leaving = true;
                a.add('grassroots', a.rng(4, 9)); a.add('media', a.rng(4, 9));
                a.add('stats.integrity', a.rng(4, 8)); a.recruitAlly();
                a.legacyMark('leftOnOwnTerms');
              },
              reply: '"Thank you." She sits down at last. "Twenty years and that is the first time you have answered a question of mine straight away."' },
            { t: 'One more term. Then I go, and you may hold me to it.', mood: 2,
              run: function (a) { a.add('grassroots', a.rng(2, 6)); a.add('party', a.rng(1, 4)); a.promise('lastterm', 'One more term, and then out — said to a secretary of twenty years'); },
              reply: '"I will hold you to it." She writes the year on the wall planner, in pen, where everybody who comes in can see it.' },
            { t: 'I will go when they carry me out.', mood: -2,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('grassroots', -a.rng(2, 6)); a.add('media', -a.rng(2, 5)); a.add('stats.grit', a.rng(1, 3)); },
              reply: '"They will," she says, and it is not affectionate. "That is not a threat, it is a description. I have watched it happen twice."' }
          ]
        },
        {
          q: function (a) {
            var r = a.aRival();
            return '"Then the part I actually came to say. ' +
              (r ? '<strong>' + a.esc(r.name) + '</strong> has been in this office twice this month asking about the branch register. ' : 'People have been asking about the branch register. ') +
              'What am I supposed to tell them?"';
          },
          answers: [
            { t: 'Tell them the truth, and give them the register.', mood: 3,
              run: function (a) { a.add('stats.integrity', a.rng(3, 6)); a.add('party', -a.rng(1, 4)); a.add('grassroots', a.rng(2, 5)); },
              reply: '"The register." She nods once. "Then this really is the last one, whatever you said a minute ago."' },
            { t: 'Tell them nothing and lock the cabinet.', mood: 0,
              run: function (a) { a.add('party', a.rng(2, 5)); a.add('stats.cunning', a.rng(1, 3)); a.add('grassroots', -a.rng(0, 3)); a.makeRival(); },
              reply: '"Locked." She has locked it before, for the man who had this office before you, and he lost anyway.' },
            { t: 'Tell them to come and see me. Directly.', mood: 2,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('leader', a.rng(0, 3)); a.add('stats.charisma', a.rng(.5, 1.5)); },
              reply: '"Directly." She almost smiles. "They will not come. They never come when you offer."' }
          ]
        }
      ],
      settles: function (a, temp, convo) {
        if (convo.leaving) {
          a.P.record.push({ year: a.S.date.year, text: 'Announced that this would be the last term.' });
          a.S.flags.announcedLast = a.S.date.year;
        }
        a.add('grassroots', (temp === 'warm' ? 1 : temp === 'hostile' ? -1 : 0) * a.rng(2, 4));
      },
      close: function (a, temp, convo) {
        if (convo.leaving) return 'She locks up behind you both. The office looks exactly as it did, and it is not the same office any more.';
        return {
          warm: 'She walks you to the car and says nothing else, which after twenty years is a whole conversation.',
          fair: 'She washes the cups. You leave first.',
          cool: 'She is still standing when you go.',
          hostile: 'The tea goes cold on the desk. She hands in her notice in the spring.'
        }[temp];
      }
    })
  ];

  RZ.EVENTS = EVENTS;
})();
