/* data-origins.js — how you got into this.

   Character creation used to be a menu of numbers. It is a scene now: one
   afternoon that decides what kind of politician you are going to be, played
   before the first month starts.

   Three openings, because there are three ways in. The ward activist is somebody
   who was insulted in their own yard and could not let it go. The
   parliamentary candidate is somebody already successful being asked, in a
   room with no windows, what they are worth. The minister has already made
   every compromise the climb demands, except the last one.

   Each answer sets the starting position AND a trait that follows you for the
   whole career, so the scene is not decoration — it is the first real choice.
*/
(function () {
  'use strict';

  // What is in the bag. A politician handing out food in this part of the
  // world is handing out the specific thing people cook at night.
  var STAPLE = {
    BW: 'mealie meal', ZA: 'mealie meal', ZW: 'mealie meal', ZM: 'mealie meal',
    NA: 'mahangu meal', LS: 'maize meal', MW: 'a bag of maize flour',
    MZ: 'xima flour', AO: 'funge flour', SZ: 'mealie meal'
  };
  function staple(c) { return STAPLE[c.id] || 'mealie meal'; }

  /* =======================================================================
     TRAITS — what the answer makes you, for good
     ======================================================================= */
  var TRAITS = {
    firebrand: {
      id: 'firebrand', name: 'Firebrand', ico: '🔥',
      note: 'Crowds move for you and committees do not.',
      // One persistent modifier each. Cheap to carry, and felt every month.
      grassrootsGain: 1.25, partyGain: 0.8
    },
    hustler: {
      id: 'hustler', name: 'Hustler', ico: '💵',
      note: 'Money finds you. So does the question of where it came from.',
      moneyGain: 1.3, integrityDecay: 1.6
    },
    schemer: {
      id: 'schemer', name: 'Schemer', ico: '🎞️',
      note: 'You keep things. People find that out late.',
      digBonus: 0.22
    },
    tycoon: {
      id: 'tycoon', name: 'Financier', ico: '🏗️',
      note: 'You funded your own way in, and everybody knows the figure.',
      moneyGain: 1.2, businessDecay: 0.6, scandalRisk: 1.25
    },
    mandarin: {
      id: 'mandarin', name: 'Mandarin', ico: '🗄️',
      note: 'You know where every file is and no camera has ever liked you.',
      capitalGain: 1.35, mediaGain: 0.7
    },
    advocate: {
      id: 'advocate', name: 'Advocate', ico: '⚖️',
      note: 'Credibility, and nothing in the account.',
      mediaGain: 1.3, integrityDecay: 0.6
    }
  };

  /* =======================================================================
     THE SCENES
     ======================================================================= */
  var ORIGINS = {

    /* ---------------- the ward: how it starts in a yard ---------------- */
    activist: {
      id: 'activist',
      kicker: 'Before any of it',
      title: function (c) { return 'The yard, ' + (c.startYear - 1); },
      opening: function (c, name) {
        return 'It is the end of the month and the lights have been off since Tuesday. Your mother is at the table ' +
          'with a torch and a pile of bills she has already been through twice, doing the arithmetic again in case ' +
          'it comes out differently.\n\n' +
          'A vehicle stops in the road — the big white one, with the party colours on the door. ' +
          'The councillor does not get out of it. His man does, and carries a ' +
          'bag of ' + staple(c) + ' and a folded t-shirt to the gate, and calls your mother by her first name, ' +
          'which nobody in this street does.';
      },
      question: function (c) {
        return '“Ask her to remember us in October,” he says, and he says it loudly enough for the neighbours. ' +
          'Then he looks at you — twenty-six, at home, unemployed — and adds: “And you, my friend. Get a t-shirt.”\n\n' +
          'Your mother has already said thank you. She has said it twice.';
      },
      answers: [
        {
          id: 'firebrand', trait: 'firebrand',
          t: 'Put the bag back in his hands',
          d: 'In front of the whole street.',
          reply: function (c) {
            return '“We are not hungry for this,” you say, and your voice carries further than you meant it to. ' +
              '“We are hungry for the clinic. Four years. Tell him I said the clinic.”\n\n' +
              'He does not answer. He puts the bag on the ground, because he will not carry it back to the car, ' +
              'and he drives off with the window up. Three houses down, somebody starts clapping and then stops, ' +
              'embarrassed. But they clapped.\n\n' +
              'By Sunday four people have asked you what else you are going to say.';
          }
        },
        {
          id: 'hustler', trait: 'hustler',
          t: 'Take the bag, and quote him a price',
          d: 'The youth are not voting. That is worth something to somebody.',
          reply: function (c, sym, money) {
            return 'You carry the bag inside for your mother first. Then you come back to the gate and lean on it.\n\n' +
              '“The young ones here are not registering,” you tell him. “Not one. But I know all of them, and they ' +
              'listen to me.” You let that sit. “' + money + ' and I will have four hundred of them registered ' +
              'before the roll closes.”\n\n' +
              'He looks at you properly for the first time. Then he takes out a phone, photographs your face, ' +
              'and says somebody will call. Somebody calls on Thursday.';
          }
        },
        {
          id: 'schemer', trait: 'schemer',
          t: 'Say nothing, and photograph the number plate',
          d: 'A government vehicle. On a party errand. In an election year.',
          reply: function (c) {
            return 'You thank him. You shake his hand and you use both of yours, the way your mother taught you, ' +
              'and he decides you are a polite boy from a good house.\n\n' +
              'What he does not see is that you walked to the corner first and got the plate, the party sticker ' +
              'and the government disc in one frame, with the date on the phone. A state vehicle running party ' +
              'errands eleven weeks before a ballot.\n\n' +
              'You do not send it to anybody. You are twenty-six and you have just worked out that the useful ' +
              'thing about a photograph is not publishing it.';
          }
        }
      ]
    },

    /* ---------------- the lounge: how it starts at a table ---------------- */
    candidate: {
      id: 'candidate',
      kicker: 'The room where it is decided',
      title: function (c) { return 'A lounge in ' + c.capital; },
      opening: function (c, name, kingmaker) {
        return 'There is no sign on the door and the lighting is deliberate. Four tables, three of them empty, ' +
          'and a man at the fourth who does not stand up when you come in.\n\n' +
          kingmaker + ' has made four ministers and unmade two. He has never held a seat himself and never ' +
          'intends to. He pours you a whisky you did not ask for and pushes it across the wood.\n\n' +
          '“The list closes in six weeks,” he says. “The old man wants new faces. I have three names and one of ' +
          'them can be yours.”';
      },
      question: function (c) {
        return 'He does not ask about your politics. He does not ask what you believe. He turns his glass a ' +
          'quarter turn on the table and asks the only question that has ever been asked in this room:\n\n' +
          '“So. What exactly do you bring to my table?”';
      },
      answers: [
        {
          id: 'tycoon', trait: 'tycoon',
          t: '“Money. Mine, and I will spend it here.”',
          d: 'You fund the whole region. He owes you the seat.',
          reply: function (c) {
            return '“I am not asking you for anything,” you say. “I will fund the region. All of it — the buses, ' +
              'the regalia, the branch conferences. You give me the ticket and I will take four constituencies ' +
              'off your worry list.”\n\n' +
              'He smiles for the first time and it does not reach his eyes. “A man who pays his own way,” he says, ' +
              '“is a man nobody else can buy.” He raises the glass. “That is a compliment and a warning, and you ' +
              'should hear both of them.”\n\n' +
              'The name goes on the list that night. Everybody who matters knows what it cost you, to the pula.';
          }
        },
        {
          id: 'mandarin', trait: 'mandarin',
          t: '“Ten years running the ministries.”',
          d: 'You know how it actually works, and where everything is filed.',
          reply: function (c) {
            return '“I have signed every procurement in that building for ten years,” you say. “I know which ' +
              'director-general cannot be moved and why. I know which of your ministers has never read a budget ' +
              'vote in his life. And I know where the files are.”\n\n' +
              'The room gets very quiet. He puts the glass down.\n\n' +
              '“That last part,” he says slowly, “you should not say out loud again. Not to me. Not to anybody.” ' +
              'Then, after a moment: “The name goes on the list.” He is not smiling now, and he watches you all ' +
              'the way to the door.';
          }
        },
        {
          id: 'advocate', trait: 'advocate',
          t: '“Credibility. Which none of you have.”',
          d: 'The students and the middle class listen to you. You have no money at all.',
          reply: function (c) {
            return '“I have no money,” you say. “I have no branch. What I have is that when I say something on ' +
              'that radio station, people who have stopped believing your party still believe me. You are polling ' +
              'nineteen percent with anyone under thirty-five. I am the only thing in this room that moves that ' +
              'number.”\n\n' +
              'He is silent for long enough that you think you have finished your career in a lounge.\n\n' +
              '“You are going to be exhausting,” he says at last. “And you are right, which is worse.” ' +
              'He writes your name himself, in pen, and does not offer to fund you.';
          }
        }
      ]
    },

    /* ---------------- the anteroom: how it starts in cabinet ---------------- */
    minister: {
      id: 'minister',
      kicker: 'The oath is already taken',
      title: function (c) { return 'An anteroom in ' + c.capital; },
      opening: function (c, name) {
        return 'You have already been sworn. The cameras have gone. The director-general is waiting in the corridor ' +
          'with three folders and a face that has seen twelve of you.\n\n' +
          'The person who put you here is still in the chair, and they have sent for you before the first cabinet. ' +
          'Not to brief you. To see what you are.\n\n' +
          '“Sit down,” they say. “The country is going to decide, over the next four years, whether you are the ' +
          'successor or the spare. I would like to know which one you think you are, before they do.”';
      },
      question: function (c) {
        return 'They do not look at the folders. They look at you.\n\n' +
          '“So. What did the climb cost you, and are you finished paying?”';
      },
      answers: [
        {
          id: 'mandarin', trait: 'mandarin',
          t: '“I know where every file is. That is what it cost.”',
          d: 'You kept your hands in the machine and off the camera.',
          reply: function (c) {
            return '“I did not buy anyone,” you say. “I did not make a speech. I signed what had to be signed and I ' +
              'know which of your ministers has never read a vote. That is the climb. I am not finished.”\n\n' +
              'They nod once, which in this building is a promotion. “Good. The camera will find you anyway. ' +
              'Try not to enjoy it.”';
          }
        },
        {
          id: 'advocate', trait: 'advocate',
          t: '“I kept my name. That is rarer than a ministry.”',
          d: 'The clean path. It ends short of the last office, and you know that.',
          reply: function (c) {
            return '“I can still walk into a hall without somebody looking at the floor,” you say. “That cost me ' +
              'the last office, if I am honest, and I am still here. I am not going to start paying now.”\n\n' +
              'They almost smile. “Then you will be a very good minister, and you will never sit in my chair. ' +
              'I can live with that. The country might even thank you.”';
          }
        },
        {
          id: 'schemer', trait: 'schemer',
          t: '“I kept things. I am not finished.”',
          d: 'The last step is a set of files. You have some of them already.',
          reply: function (c) {
            return 'You do not say what you kept. You do not have to. They have been in this building long enough.\n\n' +
              '“Be careful,” they say, “that the last step is still a step, and not a fall. I have seen both. ' +
              'The folders are yours. Try to open them in the right order.”';
          }
        }
      ]
    }
  };

  /* =======================================================================
     WHAT THE ANSWER LEAVES YOU WITH
     Applied at the end of newGame, after rivals exist, because one of these
     answers is a photograph of somebody.
     ======================================================================= */
  var PACKAGES = {
    firebrand: function (S, c, api) {
      var P = S.player;
      P.standing.grassroots += 16;
      P.standing.party -= 6;
      P.stats.integrity += 12;
      P.stats.oratory += 8;
      P.money = 0;                       // you gave the bag back
      P.record.push({ year: c.startYear - 1, text: 'Refused a councillor’s food parcel in front of the street.' });
    },
    hustler: function (S, c, api) {
      var P = S.player;
      P.money = Math.round(P.money + RZ.engine.WAGE_BASE[c.id] * 4);
      P.stats.cunning += 12;
      P.stats.integrity -= 10;
      P.standing.grassroots += 6;
      P.standing.party += 4;
      P.record.push({ year: c.startYear - 1, text: 'Registered four hundred young voters, for a fee.' });
    },
    schemer: function (S, c, api) {
      var P = S.player;
      P.capital += 12;
      P.stats.cunning += 10;
      P.stats.integrity -= 4;
      // The photograph. It is on somebody specific — and somebody senior enough
      // for it to be worth having kept.
      var mark = RZ.field.strongestFirst(RZ.field.ours(S))[0];
      if (mark) {
        mark.dirt.push({ label: 'a state vehicle running party errands eleven weeks before a ballot', used: false });
      }
      P.record.push({ year: c.startYear - 1, text: 'Kept a photograph, and told nobody about it.' });
    },
    tycoon: function (S, c, api) {
      var P = S.player;
      P.money = Math.round(P.money + RZ.engine.WAGE_BASE[c.id] * 26);
      P.standing.business += 22;
      P.standing.party += 6;
      P.stats.integrity -= 6;
      P.standing.media -= 4;
      P.record.push({ year: c.startYear - 1, text: 'Funded an entire regional campaign personally.' });
    },
    mandarin: function (S, c, api) {
      var P = S.player;
      P.capital += 26;
      P.standing.party += 16;
      P.standing.media -= 12;
      P.stats.intellect += 12;
      P.stats.charisma -= 6;
      P.record.push({ year: c.startYear - 1, text: 'Ten years signing procurement in the ministry.' });
    },
    advocate: function (S, c, api) {
      var P = S.player;
      P.standing.media += 22;
      P.stats.integrity += 14;
      P.stats.oratory += 8;
      P.money = Math.round(RZ.engine.WAGE_BASE[c.id] * 0.4);
      P.capital = 0;
      P.record.push({ year: c.startYear - 1, text: 'Said it on the radio before anybody asked them to.' });
    }
  };

  RZ.ORIGIN_PACKAGES = PACKAGES;
  RZ.ORIGINS = ORIGINS;
  RZ.TRAITS = TRAITS;
  RZ.originStaple = staple;
})();
