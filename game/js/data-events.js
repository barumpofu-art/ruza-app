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
      body: function (a) {
        var other = a.otherParty();
        return 'An emissary from <strong>' + a.esc(other.abbr) + '</strong> asked to meet somewhere with no cameras. ' +
          'They are offering a safe position, resources, and a promise that you would not have to wait your turn. ' +
          'They are also offering, implicitly, the end of everything you have built where you are.';
      },
      choices: [
        { t: 'Cross the floor', d: 'A new party, a new ceiling, and a permanent asterisk.', tag: 'risk',
          run: function (a) { return a.defect(); } },
        { t: 'Refuse, and tell your leadership about it', d: 'Loyalty, publicly banked.',
          run: function (a) {
            a.add('leader', a.rng(5, 10)); a.add('party', a.rng(3, 7)); a.add('media', a.rng(1, 3));
            return { title: 'You reported the approach', body: 'You walked into the principal’s office and named the emissary. In a movement that fears betrayal above all things, that is the most valuable currency there is.', tone: 'good' };
          } },
        { t: 'Refuse, and keep the number', d: 'No decision is also a decision.',
          run: function (a) {
            a.add('stats.cunning', a.rng(.5, 1.5)); a.add('capital', a.rng(1, 3));
            a.S.flags.hasBackChannel = true;
            return { title: 'You left the door open', body: 'Nobody knows, which is the point. If your own structures collapse, there is a landing place.', tone: 'flat' };
          } }
      ]
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
      body: function (a) {
        return 'Land allocation, a school, and the question of who really speaks for this area. He has not endorsed anyone ' +
          'in nineteen years, and everyone in the ' + a.t.constituency + ' waits to hear what he thinks before they decide what they think.';
      },
      choices: [
        { t: 'Show deference and ask for nothing', d: 'Sit low, speak last.',
          run: function (a) {
            var ok = a.roll('charisma', 42);
            a.addRegion(a.P.regionId, ok ? a.rng(6, 11) : a.rng(1, 4));
            a.add('grassroots', ok ? a.rng(3, 6) : a.rng(0, 2));
            return { title: ok ? 'You were received well' : 'Courteous, and non-committal', body: ok
              ? 'You sat on the mat, took off your shoes, and let the elders talk for two hours. When you finally spoke, they listened.'
              : 'He accepted your greeting and told you nothing. The area will wait.', tone: ok ? 'good' : 'flat' };
          } },
        { t: 'Promise the school and the road', d: 'Deliverable, if you survive the budget cycle.',
          run: function (a) {
            a.addRegion(a.P.regionId, a.rng(4, 9)); a.add('grassroots', a.rng(2, 5));
            a.S.flags.owesSchool = true;
            return { title: 'A promise, witnessed', body: 'It was said in front of the whole kraal. Promises made there are not forgotten, and are not forgiven either.', tone: 'good' };
          } },
        { t: 'Go around him to the youth', d: 'The young are more of them, and less patient.',
          run: function (a) {
            a.add('fame', a.rng(2, 5)); a.addRegion(a.P.regionId, a.rng(1, 4));
            a.add('grassroots', -a.rng(1, 3));
            return { title: 'You chose the future', body: 'The under-35s are the majority and they are not sentimental about chieftaincy. The elders will remember the insult for longer than the young remember the speech.', tone: 'flat' };
          } }
      ]
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
      body: function (a) {
        return '"Do you want to be ' + a.t.hos + '?" There is no good answer. Denial is a lie everyone can see, ' +
          'confirmation is a declaration of war, and a joke reads as arrogance.';
      },
      choices: [
        { t: 'Say yes, plainly', d: 'End the pretence. Start the fight.', tag: 'risk',
          run: function (a) { a.add('fame', a.rng(6, 12)); a.add('media', a.rng(3, 8)); a.add('party', a.rng(2, 6)); a.add('leader', -a.rng(8, 16)); a.makeRival();
            return { title: 'You declared', body: 'It was refreshing, and it cost you the principal permanently. From tonight, every mistake you make is a story about ambition.', tone: 'flat' }; } },
        { t: 'Say the movement will decide', d: 'The formula. Everyone knows what it means.',
          run: function (a) { a.add('party', a.rng(2, 5)); a.add('leader', -a.rng(1, 4)); a.add('media', -a.rng(0, 2));
            return { title: 'You used the formula', body: '"I serve where I am deployed." Nobody believes it, nobody can attack it, and it has protected ambitious deputies for fifty years.', tone: 'good' }; } },
        { t: 'Rule it out completely', d: 'Buys total trust. Costs the option.', tag: 'risk',
          run: function (a) { a.add('leader', a.rng(8, 15)); a.add('media', a.rng(2, 5)); a.add('party', -a.rng(2, 6)); a.S.flags.ruledOut = true;
            return { title: 'You ruled yourself out', body: 'The principal relaxed visibly. You have bought years of protection at the price of a promise that will be quoted back at you the day you break it.', tone: 'flat' }; } }
      ]
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
      body: function (a) {
        return 'Provincial structures have begun passing resolutions calling for the term limit to be reviewed. ' +
          'You did not ask them to. Some of them were paid to. The constitution says two terms; the ' + a.t.exec +
          ' says the movement must not be destabilised.';
      },
      choices: [
        { t: 'Rule it out and start the handover', d: 'Leave. The hardest thing in this job.',
          run: function (a) { a.add('intl', a.rng(10, 20)); a.add('media', a.rng(8, 15)); a.add('stats.integrity', a.rng(6, 12)); a.S.flags.willStepDown = true; a.legacyMark('respectedTermLimit');
            return { title: 'You announced your last day', body: 'You named the date, in public, with three years to run. The markets steadied and every ambitious person in your party began moving at once.', tone: 'good' }; } },
        { t: 'Let the debate run without endorsing it', d: 'Say nothing. Let them build it for you.', tag: 'risk',
          run: function (a) { a.add('media', -a.rng(3, 8)); a.add('intl', -a.rng(3, 8)); a.add('party', a.rng(2, 6)); a.S.flags.thirdTermDebate = true;
            return { title: 'You did not discourage them', body: 'Your spokesperson said it is a matter for the movement. Everyone understood exactly what that meant.', tone: 'flat' }; } },
        { t: 'Push the amendment through', d: 'It can be done. It has been done.', tag: 'risk',
          run: function (a) { return a.attemptThirdTerm(); } }
      ]
    }),

    E({
      id: 'deputybrief', w: 7, kicker: 'Your deputy',
      when: function (a) { return a.isLeader() || a.isPresident(); },
      title: 'Your deputy is briefing against you',
      body: 'Journalists have started using a phrase that only comes from one office. Provincial chairs are being ' +
            'flown to a farm at somebody else’s expense. It is happening, and it is early.',
      choices: [
        { t: 'Fire them', d: 'Decisive. Also creates a martyr with a base.', tag: 'risk',
          run: function (a) { var ok = a.roll('cunning', 52); a.add('party', ok ? a.rng(2, 6) : -a.rng(5, 12)); a.add('media', -a.rng(1, 5)); a.makeRival();
            return { title: ok ? 'Removed, cleanly' : 'They left with three provinces', body: ok
              ? 'Announced at 6am with a replacement already sworn in. No vacuum, no rally, no story by Thursday.'
              : 'The dismissal was the beginning of their campaign, not the end of it. They have a grievance now, and grievances win conferences.', tone: ok ? 'good' : 'bad' }; } },
        { t: 'Bind them closer — give them something big', d: 'Make them responsible for a problem.',
          run: function (a) { a.add('capital', -5); a.add('party', a.rng(1, 4)); a.add('stats.cunning', a.rng(1, 2));
            return { title: 'They now own the electricity crisis', body: 'You handed them a portfolio that cannot be fixed in four years and thanked them publicly for their willingness to serve.', tone: 'good' }; } },
        { t: 'Destroy them with what you have', d: 'You have a file. Everyone has a file.', tag: 'risk',
          run: function (a) { return a.doLeak(true); } }
      ]
    })
  ];

  RZ.EVENTS = EVENTS;
})();
