/*
 * openings.js — how a campaign begins, and who these four people are.
 *
 * Every generated game used to start the same way: a ruin, a monster already
 * in it, and initiative rolled before anybody had spoken. Four scenes, all of
 * them a fight. If the whole of your first impression is "roll for
 * initiative", the game is a skirmish generator wearing a campaign's clothes.
 *
 * Most sessions at a real table do not start in combat. They start with the
 * party somewhere, talking — in the common room of an inn arguing about a
 * notice on the door, on a cart three days out from anywhere, in a library
 * after hours with a book nobody was supposed to sign out. The fight comes
 * later, and it means more when it does.
 *
 * So openings here carry a KIND and an OPENS. `kind` is what sort of scene it
 * is; `opens` is whether anything hostile is present when the first line is
 * read. Most are 'peaceful'. Combat is one flavour among many rather than the
 * only one.
 *
 * They also carry two things the old list had no notion of:
 *
 *   fits — whose story this is. A wizard should get the library and a soldier
 *          the campaign road, rather than both getting whatever came up on a
 *          d4. Scored, not filtered, so the unlikely pairing still happens
 *          sometimes and the game does not become a lookup table.
 *
 *   bond — how these four know each other. A party that appears fully formed
 *          with no explanation is the oldest unforced error in the medium.
 *          Every opening names a way in: strangers answering the same notice,
 *          a company that has worked together for years, students who share a
 *          tutor. The Dungeon Master is told, and says so in the first scene.
 */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------- bonds ----
     Why these four are in the same room.
     
     Ten generic ways in, and then the ones that belong to a particular kind of
     person: paladins of one order, wizards taught by the same hand, a druid
     circle, a monastery, a thieves' guild that owns all four of them. These
     are SCORED against the party exactly as openings are, so a table with two
     paladins in it will usually — not always — have known each other before
     the first scene, which is what a Dungeon Master would reach for.

     `strangers` marks whether they have any history with each other at all,
     which changes how the opening should be written more than anything else
     here. */
  var BONDS = {
    /* ---------------------------------------------------- generic ------ */
    notice: {
      id: 'notice', strangers: true,
      short: 'strangers who answered the same notice',
      text: 'They do not know each other. Each of them saw the same notice — ' +
        'nailed up, chalked on a board, passed hand to hand — and each came to ' +
        'answer it. They have been in the same room for perhaps an hour. Names ' +
        'have been exchanged and not much else.',
    },
    company: {
      id: 'company', strangers: false,
      short: 'a working company, together some years',
      text: 'They have worked together long enough to have habits about it: who ' +
        'walks in front, who counts the money, whose turn it is to be annoyed. ' +
        'There is an easy shorthand between them and at least one argument they ' +
        'have had so many times it has stopped being an argument.',
    },
    hired: {
      id: 'hired', strangers: true,
      short: 'hired for the same job by the same person',
      text: 'Somebody with money hired each of them separately for the same ' +
        'piece of work, and this is the first time they have all been in one ' +
        'place. Nobody is certain yet whether the others are any good.',
    },
    road: {
      id: 'road', strangers: false,
      short: 'travellers who fell in together on the road',
      text: 'They met on the road, days ago rather than years, and have kept ' +
        'walking in the same direction because it was easier than not. It is ' +
        'friendlier than it started and nobody has said so out loud.',
    },
    survivors: {
      id: 'survivors', strangers: false,
      short: 'survivors of the same bad night',
      text: 'Something happened, and these four came out of it. They did not ' +
        'choose each other; the night did. There is a closeness to it that none ' +
        'of them would call friendship yet, and a subject they all avoid.',
    },
    kin: {
      id: 'kin', strangers: false,
      short: 'family, and those who came with them',
      text: 'Two of them are family, or as near as makes no difference, and the ' +
        'others came along with one or the other. The old grievances are ' +
        'genuinely old.',
    },
    debt: {
      id: 'debt', strangers: true,
      short: 'four people who owe the same person',
      text: 'They each owe the same person the same favour, and that person has ' +
        'called it in on all four at once. They are only beginning to work out ' +
        'that they have this in common.',
    },
    conscripts: {
      id: 'conscripts', strangers: true,
      short: 'thrown together by somebody with authority',
      text: 'Nobody asked them. A captain, a magistrate or a guild put these ' +
        'four names on the same piece of paper, and here they are. At least one ' +
        'of them is furious about it.',
    },
    rivals: {
      id: 'rivals', strangers: false,
      short: 'rivals obliged to cooperate',
      text: 'They have been on opposite sides of something — a contract, a ' +
        'competition, a court case — and circumstances have made that ' +
        'temporarily irrelevant. The needling is affectionate about half the time.',
    },
    saved: {
      id: 'saved', strangers: false,
      short: 'one of them pulled the others out of something',
      text: 'One of them saved the rest, or is believed to have, and the debt ' +
        'has quietly organised the group ever since. Whether that person wanted ' +
        'the responsibility is a live question.',
    },

    /* ---------------------------------------------------- vocation ----- *
       The bond IS the calling. Reached for when the party actually contains
       the people it belongs to. */
    order: {
      id: 'order', strangers: false,
      short: 'sworn into the same order',
      text: 'They took the same oath in the same hall, some of them on the same ' +
        'day. The order trained them, fed them and told them what they were for, ' +
        'and they do not all still agree with it. Rank between them is a real ' +
        'thing even when nobody says so.',
      fits: { classes: ['paladin', 'cleric', 'fighter'], backgrounds: ['acolyte', 'soldier', 'noble'] },
    },
    school: {
      id: 'school', strangers: false,
      short: 'taught by the same hand',
      text: 'The same master, the same cramped workroom, the same decade of ' +
        'being told they were doing it wrong. They finish each other\u2019s ' +
        'formulae and hold grudges about examinations nobody else remembers.',
      fits: { classes: ['wizard', 'artificer'], backgrounds: ['sage'] },
    },
    temple: {
      id: 'temple', strangers: false,
      short: 'raised or ordained in the same house of worship',
      text: 'The same bells, the same duties, the same faces at the same hours ' +
        'for years. Faith is the thing they share and not the thing they agree ' +
        'about; two of them have not spoken properly since a sermon.',
      fits: { classes: ['cleric', 'paladin', 'monk'], backgrounds: ['acolyte'] },
    },
    circle: {
      id: 'circle', strangers: false,
      short: 'of the same circle',
      text: 'They answer to the same grove, the same season and the same ' +
        'obligations, which are older than any of them and not negotiable. They ' +
        'speak of the circle the way other people speak of weather.',
      fits: { classes: ['druid', 'ranger'], backgrounds: ['outlander', 'hermit'] },
    },
    monastery: {
      id: 'monastery', strangers: false,
      short: 'of the same monastery',
      text: 'They rose at the same hour for years, ate the same plain food, and ' +
        'were beaten at the same forms by the same teacher until they stopped ' +
        'losing. The silences between them are companionable rather than empty.',
      fits: { classes: ['monk'], backgrounds: ['acolyte', 'hermit'] },
    },
    guild: {
      id: 'guild', strangers: false,
      short: 'the same guild owns all four of them',
      text: 'They work for the same organisation, which is not a word any of ' +
        'them uses out loud. There are rules, the rules are enforced, and every ' +
        'one of them has broken at least one and got away with it.',
      fits: { classes: ['rogue', 'bard'], backgrounds: ['criminal', 'charlatan', 'guildArtisan', 'urchin'] },
    },
    regiment: {
      id: 'regiment', strangers: false,
      short: 'they served in the same regiment',
      text: 'The same campaign, the same winter, the same appalling officer. ' +
        'They use words for things that nobody outside the unit understands and ' +
        'they do not explain them.',
      fits: { classes: ['fighter', 'ranger', 'paladin'], backgrounds: ['soldier'] },
    },
    college: {
      id: 'college', strangers: false,
      short: 'of the same college of music and rumour',
      text: 'They trained where performance and information are the same trade, ' +
        'and they still keep score. Every one of them has a story about the ' +
        'others that is only mostly true.',
      fits: { classes: ['bard'], backgrounds: ['entertainer', 'charlatan'] },
    },
    clan: {
      id: 'clan', strangers: false,
      short: 'of one clan or hold',
      text: 'The same hold, the same hearth, the same long memory. Obligation ' +
        'runs between them in directions an outsider would need an afternoon to ' +
        'have explained, and they take all of it seriously.',
      fits: { races: ['dwarf', 'hill-dwarf', 'mountain-dwarf', 'goliath', 'half-orc', 'orc'], backgrounds: ['folkHero', 'outlander'] },
    },
    enclave: {
      id: 'enclave', strangers: false,
      short: 'from the same long-lived enclave',
      text: 'They come from the same place, and for people who measure time as ' +
        'they do, that is a closer thing than it sounds. There is a shared ' +
        'reticence and an unhurriedness that the shorter-lived find maddening.',
      fits: { races: ['elf', 'high-elf', 'wood-elf', 'gnome', 'rock-gnome', 'forest-gnome'] },
    },
    patron: {
      id: 'patron', strangers: true,
      short: 'the same thing wants all four of them',
      text: 'Something is interested in each of them, and it is the same ' +
        'something. None of them arranged this meeting. Whether it counts as a ' +
        'coincidence is exactly the question they are avoiding.',
      fits: { classes: ['warlock', 'sorcerer'], backgrounds: ['hermit', 'charlatan'] },
    },
    blood: {
      id: 'blood', strangers: false,
      short: 'the same strangeness runs in all of them',
      text: 'Whatever is in their blood, it is the same thing, and it found them ' +
        'each other. They recognised it before they had words for it. Nobody ' +
        'outside would see anything at all.',
      fits: { classes: ['sorcerer', 'warlock'], races: ['tiefling', 'dragonborn', 'half-elf'] },
    },
    crew: {
      id: 'crew', strangers: false,
      short: 'they sailed together',
      text: 'The same deck, the same watches, the same captain they have all ' +
        'separately considered throwing overboard. Land has not quite worn the ' +
        'habit off them.',
      fits: { backgrounds: ['sailor'], classes: ['fighter', 'rogue', 'barbarian'] },
    },
    street: {
      id: 'street', strangers: false,
      short: 'they grew up in the same streets',
      text: 'The same city, the same three streets of it, the same lean years. ' +
        'They know each other\u2019s childhood names and use them as weapons.',
      fits: { backgrounds: ['urchin', 'criminal'], classes: ['rogue', 'monk'] },
    },
    warband: {
      id: 'warband', strangers: false,
      short: 'they ran with the same warband',
      text: 'They fought alongside each other before any of them called it a ' +
        'party, under someone who is no longer giving orders. Half of what binds ' +
        'them is the person who is not here.',
      fits: { classes: ['barbarian', 'fighter', 'ranger'], backgrounds: ['outlander', 'soldier', 'folkHero'] },
    },
  };


  /* --------------------------------------------------------- openings ----
     `opens`:
       peaceful — nothing hostile present; the scene is people, place and problem
       tense    — something is wrong but no blades are out yet
       violent  — it has already started

     `fits` scores the scene against the party that actually exists, so the
     wizard gets the library more often than the barbarian does. */
  var OPENINGS = [
    /* ---------------------------------------------------- social ------- */
    {
      id: 'brass-lantern', name: 'the Brass Lantern', biome: 'town',
      kind: 'social', opens: 'peaceful',
      timeOfDay: 'evening', weather: 'rain against the shutters',
      hook: 'A notice on the taproom door offering good coin for work nobody in ' +
        'the room wants to explain out loud.',
      firstBeat: 'The four of them have ended up at the same table, and the notice ' +
        'is still on the door.',
      bonds: ['notice', 'hired', 'debt'],
      fits: { classes: ['rogue', 'bard', 'fighter'], backgrounds: ['criminal', 'charlatan', 'soldier', 'entertainer'] },
      localName: 'Ospri Vane', localRole: 'who keeps the Brass Lantern and hears everything',
      localWants: 'the notice taken down and the business behind it taken somewhere else',
      localVoice: 'Dry, watchful, and entirely uninterested in anyone\u2019s excuses. Answers questions with questions.',
      lines: ['That notice has been up four days. You are the first to touch it.',
        'I did not write it and I will not vouch for it.',
        'Whatever you decide, decide it away from my bar.'],
    },
    {
      id: 'harvest-fair', name: 'the harvest fair at Little Ennet', biome: 'town',
      kind: 'celebration', opens: 'peaceful',
      timeOfDay: 'afternoon', weather: 'bright and windy',
      hook: 'Everyone in three valleys is here, and one family is very carefully ' +
        'not talking about the daughter who did not come back from the high field.',
      firstBeat: 'Music, fried bread, a wrestling ring, and a woman at the edge of ' +
        'it all who has been trying to catch someone\u2019s eye for an hour.',
      bonds: ['company', 'road', 'kin'],
      fits: { classes: ['bard', 'ranger', 'druid'], backgrounds: ['folkHero', 'entertainer', 'outlander', 'guildArtisan'] },
      localName: 'Nell Arrowsmith', localRole: 'who has been trying to get someone to listen since noon',
      localWants: 'somebody to walk up to the high field with her before dark',
      localVoice: 'Practical, embarrassed to be asking, and getting less patient the longer nobody listens.',
      lines: ['She knows that field better than I do. That is the part I keep coming back to.',
        'Everyone says she will turn up. It has been two days.',
        'I am not asking anyone to be brave. I am asking someone to come and look.'],
    },
    {
      id: 'guild-hall', name: 'the Ropewalk guildhall', biome: 'town',
      kind: 'social', opens: 'tense',
      timeOfDay: 'morning', weather: 'grey',
      hook: 'A guild meeting that has gone badly wrong, and four outsiders standing ' +
        'in the middle of it holding a contract nobody will now admit to signing.',
      firstBeat: 'Thirty people arguing, two of them armed, and a clerk quietly ' +
        'moving the ledgers out of the room.',
      outs: [
        'The contract is real and reading it aloud would end the argument.',
        'The clerk wants out of this more than anyone and will trade the ledger for safe passage.',
        'Nobody here actually wants blood; they want the vote. Delay wins it.',
        'Walking out with the contract unsigned costs nothing but the fee.',
      ],
      bonds: ['hired', 'debt', 'conscripts'],
      fits: { classes: ['rogue', 'bard'], backgrounds: ['guildArtisan', 'charlatan', 'noble', 'criminal'] },
      localName: 'Factor Denhall', localRole: 'who signed the contract and wishes he had not',
      localWants: 'the contract honoured quietly, before the guild votes',
      localVoice: 'Smooth until pressed, then very quick to explain why none of this is his doing.',
      lines: ['You were not to come here. You were to send word.',
        'I can pay you or I can keep my seat. Not both, today.',
        'Ask the clerk. No \u2014 do not ask the clerk.'],
    },

    /* ---------------------------------------------------- study -------- */
    {
      id: 'candlewick-library', name: 'the Candlewick reading room', biome: 'town',
      kind: 'study', opens: 'peaceful',
      timeOfDay: 'late night', weather: 'still and cold',
      hook: 'A book that should not have left the locked case is open on the table, ' +
        'and the four people around it are the only ones awake in the building.',
      firstBeat: 'Lamplight, dust, and a page of a language that has been dead ' +
        'longer than the city has stood.',
      bonds: ['students', 'oath', 'company'],
      fits: { classes: ['wizard', 'cleric', 'warlock'], backgrounds: ['sage', 'acolyte', 'hermit'] },
      localName: 'Sub-Librarian Coel', localRole: 'who is supposed to have locked up an hour ago',
      localWants: 'the book back in its case before the Keeper does her round',
      localVoice: 'Nervous, precise, and quietly thrilled that somebody else is finally interested.',
      lines: ['I did not take it out. I want that understood.',
        'It is catalogued under a name that does not exist.',
        'The Keeper walks the upper floor at the third bell. That gives us until then.'],
    },
    {
      id: 'observatory-stair', name: 'the observatory stair', biome: 'town',
      kind: 'study', opens: 'peaceful',
      timeOfDay: 'before dawn', weather: 'clear and very cold',
      hook: 'The star-tables have been wrong for nine nights running, and only one ' +
        'person seems to think that matters.',
      firstBeat: 'Four hundred steps, a brass instrument the size of a cart, and an ' +
        'argument about whether the sky or the arithmetic is at fault.',
      bonds: ['students', 'company', 'oath'],
      fits: { classes: ['wizard', 'sorcerer', 'cleric'], backgrounds: ['sage', 'acolyte', 'hermit'], races: ['gnome', 'high-elf'] },
      localName: 'Adept Sarrow', localRole: 'who has not slept and would like someone to check her figures',
      localWants: 'a second opinion before she reports something that will ruin her',
      localVoice: 'Fast, exhausted, apologetic about the mess and not at all about the conclusion.',
      lines: ['Nine nights. The same drift, the same hour, the same direction.',
        'If I am wrong I lose the chair. If I am right \u2014 well.',
        'Check it yourself. Please. I have stopped trusting my own hand.'],
    },

    /* ---------------------------------------------------- travel ------- */
    {
      id: 'ninefold-road', name: 'the Ninefold road', biome: 'road',
      kind: 'travel', opens: 'peaceful',
      timeOfDay: 'late afternoon', weather: 'warm, with dust',
      hook: 'Three days from anywhere, with a cart, a bad wheel, and a milestone ' +
        'that gives a distance nobody can make agree with the map.',
      firstBeat: 'The cart is stopped, the wheel is off, and there is time to talk ' +
        'for the first time in days.',
      bonds: ['road', 'company', 'notice'],
      fits: { classes: ['ranger', 'fighter', 'barbarian'], backgrounds: ['outlander', 'folkHero', 'soldier', 'sailor'] },
      localName: 'Bram Oaks', localRole: 'a carter who has driven this road for twenty years',
      localWants: 'to reach the ford before dark, wheel or no wheel',
      localVoice: 'Cheerful, superstitious, and full of information he does not think is important.',
      lines: ['That stone says four miles. It has said four miles for twenty years.',
        'We do not stop at the ford after dark. Nobody does. No, I could not tell you why.',
        'Hand me the pin and we will be moving before the light goes.'],
    },
    {
      id: 'ferry-crossing', name: 'the Greymouth ferry', biome: 'river',
      kind: 'travel', opens: 'peaceful',
      timeOfDay: 'morning', weather: 'river fog burning off',
      hook: 'A crossing that takes an hour, four passengers who did not plan to ' +
        'travel together, and a ferryman who will not take the last fare of the day.',
      firstBeat: 'Flat brown water, a rope across it, and nowhere to go until the far bank.',
      bonds: ['notice', 'road', 'hired'],
      fits: { classes: ['rogue', 'monk', 'bard'], backgrounds: ['sailor', 'urchin', 'hermit'] },
      localName: 'Old Cass', localRole: 'who has poled this crossing since before the bridge fell',
      localWants: 'to be off the water before the afternoon, and will not say why',
      localVoice: 'Talks constantly about the weather and not at all about anything else.',
      lines: ['Hour across. Hour back. That is the whole of my life, that is.',
        'I do not take a fare after the third bell. Ask in the village, they will tell you the same.',
        'You will want to keep your hands inside the gunwale along the middle.'],
    },
    {
      id: 'high-pass', name: 'the Corrie pass', biome: 'mountain',
      kind: 'travel', opens: 'tense',
      timeOfDay: 'dusk', weather: 'snow coming',
      hook: 'The pass closes tonight or tomorrow, the shelter hut is already ' +
        'occupied, and going back down is a day they do not have.',
      firstBeat: 'Wind, failing light, and a stone hut with somebody else\u2019s ' +
        'fire smoke coming out of it.',
      outs: [
        'She is one person and it is a cold night. Food shared is a floor shared.',
        'She is not hostile, only certain that everyone else is.',
        'There is a second shelter an hour down, and an hour is survivable.',
        'She came up the west track for a reason and would rather talk about that than fight.',
      ],
      bonds: ['road', 'survivors', 'company'],
      fits: { classes: ['barbarian', 'ranger', 'fighter'], backgrounds: ['outlander', 'soldier'], races: ['dwarf', 'goliath'] },
      localName: 'Ingra Sett', localRole: 'who got to the hut first and is not pleased to share',
      localWants: 'the hut to herself, and failing that, to know what these four are',
      localVoice: 'Short sentences. Watches hands rather than faces.',
      lines: ['Fire is mine. Floor you can have.',
        'Pass shuts tonight. Anyone tells you different is selling something.',
        'You came up the east track. Nobody comes up the east track.'],
    },

    /* ---------------------------------------------------- work --------- */
    {
      id: 'muster-yard', name: 'the muster yard at Cold Harbour', biome: 'town',
      kind: 'work', opens: 'peaceful',
      timeOfDay: 'early morning', weather: 'cold and clear',
      hook: 'Four names on the same warrant, a sergeant who did not choose any of ' +
        'them, and a job that starts in an hour.',
      firstBeat: 'Frost on the cobbles, a table with a ledger on it, and three ' +
        'other people who look about as pleased to be here.',
      bonds: ['conscripts', 'hired', 'oath'],
      fits: { classes: ['fighter', 'paladin', 'ranger'], backgrounds: ['soldier', 'folkHero', 'criminal'] },
      localName: 'Serjeant Amble', localRole: 'who reads the warrant and does not write it',
      localWants: 'four bodies out the gate by the hour, whoever they turn out to be',
      localVoice: 'Bored, thorough, and has done this every morning for eleven years.',
      lines: ['Four names. I have four bodies. That is my whole interest in you.',
        'Read it or do not read it. You are going either way.',
        'Any questions go to the man who signed it, and he is not here.'],
    },
    {
      id: 'dig-site', name: 'the Ashmill dig', biome: 'ruin',
      kind: 'work', opens: 'peaceful',
      timeOfDay: 'midday', weather: 'hot and airless',
      hook: 'A dig that has been going three seasons and has just, this morning, ' +
        'found a door.',
      firstBeat: 'Spoil heaps, string lines, and forty people who have all stopped ' +
        'working to look at the same thing.',
      bonds: ['hired', 'students', 'company'],
      fits: { classes: ['wizard', 'rogue', 'cleric'], backgrounds: ['sage', 'guildArtisan', 'acolyte'] },
      localName: 'Doctor Weyl', localRole: 'who has run this dig for three seasons on somebody else\u2019s money',
      localWants: 'the door opened by people she can afford to lose',
      localVoice: 'Precise, impatient, and treats every question as a delay.',
      lines: ['Three seasons. Three. And it was under the spoil heap the whole time.',
        'I am not going in first and neither is anyone I have known longer than a week.',
        'Do not touch the lintel. I will explain later. Do not touch the lintel.'],
    },
    {
      id: 'lambing-shed', name: 'the lambing sheds at Wether Fold', biome: 'wilds',
      kind: 'work', opens: 'peaceful',
      timeOfDay: 'night', weather: 'sleet',
      hook: 'Something has been taking lambs, and it is not a wolf, and the ' +
        'shepherds have stopped pretending otherwise.',
      firstBeat: 'A long low shed, forty ewes, lamplight, and four people who ' +
        'agreed to sit up all night for the same reason.',
      bonds: ['road', 'notice', 'kin'],
      fits: { classes: ['druid', 'ranger', 'barbarian'], backgrounds: ['outlander', 'folkHero', 'hermit'] },
      localName: 'Hesper Fold', localRole: 'who has farmed this hill her whole life',
      localWants: 'to know what it is, more than she wants it killed',
      localVoice: 'Slow, certain, and describes the tracks in more detail than anyone asked for.',
      lines: ['Wolf takes it and eats it. This takes it and leaves it.',
        'Eleven since the turn of the month. I counted every one.',
        'Sit where I put you and do not talk. It will not come if you talk.'],
    },

    /* ---------------------------------------------------- mystery ------ */
    {
      id: 'quiet-house', name: 'the house on Pell Street', biome: 'town',
      kind: 'mystery', opens: 'peaceful',
      timeOfDay: 'afternoon', weather: 'flat white sky',
      hook: 'A house whose owner has been gone eleven days, whose door was locked ' +
        'from inside, and whose neighbours have all separately decided not to mention it.',
      firstBeat: 'A key that works, a hallway that smells of nothing at all, and ' +
        'a hall table with eleven days of post on it.',
      bonds: ['hired', 'notice', 'debt'],
      fits: { classes: ['rogue', 'wizard', 'cleric'], backgrounds: ['criminal', 'sage', 'urchin', 'acolyte'] },
      localName: 'Mistress Ganning', localRole: 'who lives opposite and has watched the door for eleven days',
      localWants: 'somebody else to be the one who goes in',
      localVoice: 'Talks around the subject at length. Knows more than she is saying and is frightened of it.',
      lines: ['I am not saying anything is wrong. I am saying the post has not been taken in.',
        'He was not a man who went anywhere.',
        'I would not go up to the top floor myself. That is all I will say.'],
    },
    {
      id: 'salt-shrine', name: 'the salt shrine at Ivet', biome: 'coast',
      kind: 'mystery', opens: 'peaceful',
      timeOfDay: 'low tide, morning', weather: 'grey and blowing',
      hook: 'The shrine is exposed twice a day and has been the same for centuries. ' +
        'This month the offerings have started coming back.',
      firstBeat: 'Wet sand, a stone doorway with the sea in it, and a row of things ' +
        'laid out that were given away years ago.',
      bonds: ['oath', 'road', 'survivors'],
      fits: { classes: ['cleric', 'paladin', 'druid', 'warlock'], backgrounds: ['acolyte', 'sailor', 'hermit'] },
      localName: 'Keeper Alm', localRole: 'who has tended the shrine since his mother did',
      localWants: 'to understand it before he has to tell the village',
      localVoice: 'Careful with words. Treats the question as a religious one and is not sure it is.',
      lines: ['My grandmother gave that ring to the water. I have the day written down.',
        'Six tides now. Something new each time.',
        'Nothing is taking them. Something is giving them back. That is a different thing.'],
    },

    /* ---------------------------------------------------- crisis ------- */
    {
      id: 'burning-quarter', name: 'the Tanners\u2019 quarter, burning', biome: 'town',
      kind: 'crisis', opens: 'tense',
      timeOfDay: 'night', weather: 'smoke and no wind',
      hook: 'Half a street is alight, the bucket line is thirty people short, and ' +
        'somebody is still inside the third house.',
      firstBeat: 'Heat, shouting, and a line of buckets that stops well short of ' +
        'where it needs to reach.',
      outs: [
        'There is nothing here to fight. The enemy is a roof and a quarter of an hour.',
        'Thirty more hands would do it, and there are thirty people watching from the next street.',
        'The canal is forty feet away and nobody has thought of it.',
        'Whoever is in the third house can be reached from the roof of the second.',
      ],
      bonds: ['survivors', 'kin', 'conscripts'],
      fits: { classes: ['paladin', 'fighter', 'monk', 'cleric'], backgrounds: ['folkHero', 'soldier', 'urchin', 'guildArtisan'] },
      localName: 'Warden Iss', localRole: 'who is trying to run a bucket line and losing',
      localWants: 'the third house cleared before the roof goes',
      localVoice: 'Shouting over noise. Gives orders to anyone who looks capable and apologises later.',
      lines: ['You four \u2014 yes, you \u2014 third house, back way, go.',
        'The roof has maybe a quarter hour. Maybe.',
        'I do not care who you are. Can you carry someone or not?'],
    },
    {
      id: 'flooded-ward', name: 'the low ward, under water', biome: 'town',
      kind: 'crisis', opens: 'peaceful',
      timeOfDay: 'dawn', weather: 'rain easing',
      hook: 'The river came up in the night. Everyone got out except the people ' +
        'nobody counted.',
      firstBeat: 'Brown water to the knee, doors standing open, and a list on a ' +
        'wet board with names not yet crossed off.',
      bonds: ['survivors', 'conscripts', 'kin'],
      fits: { classes: ['cleric', 'druid', 'ranger'], backgrounds: ['acolyte', 'folkHero', 'urchin', 'sailor'] },
      localName: 'Sister Onwyn', localRole: 'who has been awake since the water came up',
      localWants: 'every name on her board accounted for, alive or otherwise',
      localVoice: 'Very calm, very tired, and has stopped softening anything.',
      lines: ['Nineteen names. Eleven crossed off. I will not guess at the rest.',
        'The cellars are the problem. They always are.',
        'Take the board. I have it by heart now anyway.'],
    },

    /* ---------------------------------------------------- combat ------- *
       Kept, and now the minority. A game that always starts here is a
       skirmish generator; a game that never does has no teeth. */
    {
      id: 'toll-bridge', name: 'the Ashford toll bridge', biome: 'river',
      kind: 'combat', opens: 'violent',
      timeOfDay: 'morning', weather: 'mist off the water',
      hook: 'A crossing that has been charging a toll it has no right to charge, ' +
        'and has stopped letting people turn back.',
      firstBeat: 'The bridge is held, the way back is held, and talking is over.',
      /* A fight is a negotiating position, not a verdict. Every violent
         opening names what else could happen, because a Dungeon Master who
         only knows how the fight goes will only ever run the fight. */
      outs: [
        'Pay the toll. It is extortion and it is also four silver.',
        'The one giving orders is bored and underpaid, and would rather be talked at than swung at.',
        'They want the cart, not the people. Leaving it buys the road.',
        'Naming their captain \u2014 or pretending to know him \u2014 changes the room.',
        'The far bank is thirty feet of cold water and they will not follow.',
      ],
      bonds: ['road', 'company', 'notice'],
      fits: { classes: ['fighter', 'barbarian', 'paladin'], backgrounds: ['soldier', 'folkHero'] },
      threats: ['bandit', 'kobold', 'goblin'],
      boss: ['bandit-captain', 'bugbear', 'hobgoblin'],
      localName: 'Petra Oarswell', localRole: 'a carter caught on the wrong side of the bridge',
      localWants: 'her cart and her horse back, in that order',
      localVoice: 'Furious and practical in about equal measure.',
      lines: ['They took the horse first. They knew what they were doing.',
        'There were four of them yesterday. There are more today.',
        'I will pay. I would rather not, but I will pay.'],
    },
    {
      id: 'drowned-chapel', name: 'the drowned chapel', biome: 'ruin',
      kind: 'combat', opens: 'violent',
      timeOfDay: 'afternoon', weather: 'overcast',
      hook: 'A chapel half-swallowed by the river two winters ago. Something has ' +
        'been denning in what is left of the nave.',
      firstBeat: 'It is already up, already aware of them, and between them and the door.',
      outs: [
        'It is starving rather than malicious, and there is meat in the packs.',
        'It has a den somewhere in the nave and will not follow far from it.',
        'The flooded transept is chest-deep and it will not go in the water.',
        'It was somebody\u2019s once. It still answers to a name, if anyone knew it.',
        'The bell rope still reaches. Noise brings the warden, and it fears the warden.',
      ],
      bonds: ['company', 'oath', 'hired'],
      fits: { classes: ['cleric', 'paladin', 'fighter'], backgrounds: ['acolyte', 'soldier'] },
      threats: ['gnoll', 'kobold', 'giant-rat', 'skeleton'],
      boss: ['gnoll-pack-lord', 'bugbear', 'ogre'],
      localName: 'Maerin Volk', localRole: 'the last warden of the parish',
      localWants: 'the chapel emptied before the spring flood takes the rest of it',
      localVoice: 'Old, unhurried, and entirely unimpressed by adventurers. Says half of what she means.',
      lines: ['You\u2019ll want boots you don\u2019t mind losing.',
        'It was a church once. Try to remember that.',
        'Three came before you. Two came back.'],
    },
    {
      id: 'kestrel-mine', name: 'the Kestrel cutting', biome: 'cave',
      kind: 'combat', opens: 'tense',
      timeOfDay: 'morning', weather: 'clear',
      hook: 'A tin working that stopped paying out a month ago. The crew that went ' +
        'down to find out why has not come up.',
      firstBeat: 'The cage is at the bottom, the lamps are lit, and something further ' +
        'in has just stopped moving.',
      outs: [
        'Whatever is down here has not attacked yet. It is deciding.',
        'The missing crew are alive further in, and that changes what winning means.',
        'Kobolds will trade. They always trade, if someone opens with an offer.',
        'The cage goes back up. Nothing here can follow it.',
        'Flooding the second gallery ends the problem without a blade drawn, and ruins the mine.',
      ],
      bonds: ['hired', 'company', 'notice'],
      fits: { classes: ['fighter', 'rogue', 'barbarian'], backgrounds: ['guildArtisan', 'folkHero'], races: ['dwarf'] },
      threats: ['kobold', 'giant-spider', 'stirge', 'skeleton'],
      boss: ['ochre-jelly', 'bugbear', 'gelatinous-cube'],
      localName: 'Hew Danning', localRole: 'the mine\u2019s reluctant foreman',
      localWants: 'his people back, and failing that, an honest answer about what took them',
      localVoice: 'Blunt, tired, and carrying more guilt than he will admit to.',
      lines: ['Nine went down. I signed for every one of them.',
        'Don\u2019t go past the second gallery. Just don\u2019t.',
        'I\u2019ll pay what I have. It isn\u2019t much.'],
    },
    {
      id: 'hollow-barrow', name: 'the hollow barrow', biome: 'crypt',
      kind: 'combat', opens: 'tense',
      timeOfDay: 'dusk', weather: 'fog',
      hook: 'A barrow that has stood shut since anyone can remember, and has lately ' +
        'stopped being shut.',
      firstBeat: 'The stone is rolled back from the inside, and the smell coming out ' +
        'of it is not old.',
      outs: [
        'The rites would settle them. Sister Ilke knows the words and cannot get near enough to say them.',
        'They are bound to the barrow and cannot follow past the boundary stones.',
        'Something was taken from inside. Putting it back may be the whole of it.',
        'They were people, and one of them is still wearing a name-token anybody could read.',
        'Sunrise is four hours off and they will not stand in it.',
      ],
      bonds: ['oath', 'survivors', 'hired'],
      fits: { classes: ['cleric', 'paladin', 'ranger'], backgrounds: ['acolyte', 'hermit', 'outlander'] },
      threats: ['skeleton', 'zombie', 'giant-rat', 'shadow'],
      boss: ['ghoul', 'wight', 'specter'],
      localName: 'Sister Ilke', localRole: 'a hedge-priest with no congregation left',
      localWants: 'the barrow closed properly, with the rites said over it this time',
      localVoice: 'Gentle and absolutely immovable. Talks about the dead as neighbours.',
      lines: ['They were people. Whatever is walking, they were people first.',
        'I can say the words. I cannot make it stand still long enough to hear them.',
        'Bring back what you can. Bones will do.'],
    },
  ];

  /* ------------------------------------------------------- selection ----
     Scored rather than filtered. A wizard SHOULD usually get the library, but
     a wizard who never once starts on a muddy road is a lookup table, not a
     campaign generator. */

  /** How well an opening suits the people who will actually play it. */
  function scoreFor(opening, party) {
    var fits = opening.fits || {};
    var score = 1;                       // everything is possible
    (party || []).forEach(function (p) {
      if (p.classId && (fits.classes || []).indexOf(p.classId) >= 0) score += 3;
      if (p.backgroundId && (fits.backgrounds || []).indexOf(p.backgroundId) >= 0) score += 3;
      if (p.raceId && (fits.races || []).indexOf(p.raceId) >= 0) score += 2;
      if (p.subraceId && (fits.races || []).indexOf(p.subraceId) >= 0) score += 2;
    });
    return score;
  }

  /**
   * Choose an opening for this party.
   *
   * `opts.kind` or `opts.opens` narrows the field first — a caller that wants
   * a peaceful start gets one — and the weighting picks among what is left.
   */
  function chooseOpening(rng, party, opts) {
    opts = opts || {};
    var pool = OPENINGS.filter(function (o) {
      if (opts.kind && o.kind !== opts.kind) return false;
      if (opts.opens && o.opens !== opts.opens) return false;
      if (opts.exclude && opts.exclude.indexOf(o.id) >= 0) return false;
      return true;
    });
    if (!pool.length) pool = OPENINGS.slice();

    var weights = pool.map(function (o) { return scoreFor(o, party); });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = (rng && rng.next ? rng.next() : Math.random()) * total;
    for (var i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /** The bond for a chosen opening, weighted by who the party actually are.
   *
   * Scored rather than picked from a list, for the same reason openings are:
   * a table with two paladins in it should usually have known each other
   * before the first scene, because that is what a Dungeon Master would reach
   * for — but "usually" is not "always", and a paladin who fell in with
   * strangers on the road is a perfectly good story.
   *
   * The opening's own `bonds` list is a preference, not a gate. A vocation
   * bond that fits the party strongly can beat it.
   */
  function chooseBond(rng, opening, party, opts) {
    opts = opts || {};
    if (opts.bond && BONDS[opts.bond]) return BONDS[opts.bond];

    var preferred = (opening && opening.bonds) || [];
    var ids = Object.keys(BONDS);
    var weights = ids.map(function (id) {
      var b = BONDS[id];
      var w = 0;
      /* Something the opening itself suggests. */
      if (preferred.indexOf(id) >= 0) w += 6;
      /* A vocation bond earns its place from the party. */
      if (b.fits) {
        var fitted = scoreFor({ fits: b.fits }, party) - 1;   // -1 for the base
        w += fitted * 2;
        /* A vocation bond that fits NOBODY should almost never come up: four
           people bound by a monastery none of them has ever seen. */
        if (fitted <= 0) w = Math.min(w, 1);
      } else if (!preferred.length) {
        w += 2;                                   // generic bonds are always plausible
      }
      return Math.max(0, w);
    });

    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    if (total <= 0) return BONDS[preferred[0]] || BONDS.notice;
    var roll = (rng && rng.next ? rng.next() : Math.random()) * total;
    for (var i = 0; i < ids.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return BONDS[ids[i]];
    }
    return BONDS[ids[ids.length - 1]];
  }

  function byId(id) {
    return OPENINGS.filter(function (o) { return o.id === id; })[0] || null;
  }

  /** How many of these are peaceful, for tests and for honesty. */
  function stats() {
    var byKind = {}, byOpens = {};
    OPENINGS.forEach(function (o) {
      byKind[o.kind] = (byKind[o.kind] || 0) + 1;
      byOpens[o.opens] = (byOpens[o.opens] || 0) + 1;
    });
    return { total: OPENINGS.length, byKind: byKind, byOpens: byOpens };
  }

  var api = {
    OPENINGS: OPENINGS, BONDS: BONDS,
    chooseOpening: chooseOpening, chooseBond: chooseBond,
    scoreFor: scoreFor, byId: byId, stats: stats,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  global.DND = global.DND || {};
  global.DND.Openings = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
