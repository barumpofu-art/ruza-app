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

  function who(a, role, org) {
    return { name: RZ.makeName(a.C), role: role, org: org };
  }
  function money(a, m) { return RZ.money(a.wage(m), a.C.cur.sym); }
  // Country terms are stored lower case for use mid-sentence; a job title is not.
  function cap(v) { return v.charAt(0).toUpperCase() + v.slice(1); }
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
              run: function (a) { a.add('grassroots', a.rng(4, 7)); a.add('business', -a.rng(2, 5)); a.promise('wages', 'An above-inflation public service wage rise'); },
              reply: '"Say that again outside, into a microphone, and I will believe you." She writes the date down.' },
            { t: 'I cannot promise that. I can promise not to lie to you about why.', mood: 1,
              run: function (a) { a.add('stats.integrity', a.rng(1, 3)); a.add('party', a.rng(1, 3)); a.add('grassroots', a.rng(0, 2)); },
              reply: '"Hm." She sits back. "That is the first honest answer this room has heard since March."' },
            { t: 'The fiscal position is under review by Treasury.', mood: -3,
              run: function (a) { a.add('grassroots', -a.rng(3, 6)); a.add('media', -a.rng(0, 2)); },
              reply: '"Under review." She repeats it to the room and somebody at the back laughs.' }
          ]
        },
        {
          q: '"Second thing. When our people strike — and they will — do you send the police, or do you come and sit with us?"',
          answers: [
            { t: 'I come and sit. Every time.', mood: 3,
              run: function (a) { a.add('grassroots', a.rng(3, 6)); a.add('security', -a.rng(1, 3)); },
              reply: '"Then we will hold you to it in public, which is the only way anyone is held to anything."' },
            { t: 'I keep the police away from a lawful strike. An unlawful one is not mine to protect.', mood: 1,
              run: function (a) { a.add('party', a.rng(1, 4)); a.add('security', a.rng(0, 2)); },
              reply: '"A lawyer\'s answer. But you drew the line where the law draws it, and not lower. Noted."' },
            { t: 'Order has to be maintained. That is not negotiable.', mood: -3,
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
              run: function (a) { a.add('stats.integrity', a.rng(2, 4)); a.add('grassroots', a.rng(1, 3)); },
              reply: '"At least you did not stand there and lie." He rubs his face. "Everyone lies in this room."' },
            { t: 'I will stop it.', mood: 1, tag: 'promise',
              run: function (a) { a.add('grassroots', a.rng(4, 8)); a.promise('retrench', 'To stop eight hundred retrenchments at the mine'); },
              reply: '"Then I am going to tell eight hundred families that." He looks at you a long time. "Do not do this to me."' },
            { t: 'The company has obligations under the law. I will make sure they meet them.', mood: 0,
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
              run: function (a) { a.add('money', a.wage(9)); a.add('business', a.rng(5, 9)); a.add('stats.integrity', -a.rng(3, 6)); a.dirt('capture', 'A construction financier who was promised more than access', 3); },
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
              run: function (a) { a.add('money', a.wage(6)); a.add('business', a.rng(3, 6)); a.add('stats.integrity', -a.rng(1, 3)); a.dirt('patron', 'An unwritten obligation to a man who keeps records', 2); },
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
              run: function (a) { a.add('party', a.rng(4, 8)); a.recruitAlly(); a.add('stats.integrity', -a.rng(2, 4)); a.promise('slate', 'Positions for three provincial chairpersons who backed you'); },
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
  ];

  RZ.DIALOGUE = SCENES;
})();
