// Static world data: the twelve clubs of the fictional Kalahari Premiership,
// plus the name pools squads are generated from. Every club and person here is
// invented.

export const CLUBS = [
  { id: 'gab', name: 'Gaborone Thunder',   abbr: 'GAB', rep: 88, stadium: 'Thunderdome',        capacity: 24000, home: '#f2c14e', away: '#151a21' },
  { id: 'fra', name: 'Francistown Falcons', abbr: 'FRA', rep: 84, stadium: 'Falcon Park',        capacity: 20000, home: '#3d7bd6', away: '#ffffff' },
  { id: 'mau', name: 'Maun Crocodiles',    abbr: 'MAU', rep: 76, stadium: 'Delta Ground',        capacity: 15000, home: '#2f9e6b', away: '#0f1b16' },
  { id: 'sel', name: 'Selebi Steelers',    abbr: 'SEL', rep: 74, stadium: 'The Foundry',         capacity: 16000, home: '#c0562f', away: '#1b1b1b' },
  { id: 'lob', name: 'Lobatse Lions',      abbr: 'LOB', rep: 68, stadium: 'Lion Kraal',          capacity: 12000, home: '#d94f4f', away: '#f5f0e6' },
  { id: 'pal', name: 'Palapye Pioneers',   abbr: 'PAL', rep: 64, stadium: 'Pioneer Field',       capacity: 11000, home: '#7d5bbe', away: '#ede9f6' },
  { id: 'ser', name: 'Serowe Stallions',   abbr: 'SER', rep: 60, stadium: 'The Paddock',         capacity: 10000, home: '#2ba3a3', away: '#12211f' },
  { id: 'moc', name: 'Mochudi Meerkats',   abbr: 'MOC', rep: 56, stadium: 'Sentry Hill',         capacity: 9000,  home: '#e0873c', away: '#20160e' },
  { id: 'kas', name: 'Kasane Rapids',      abbr: 'KAS', rep: 52, stadium: 'Riverside',           capacity: 8500,  home: '#4bb2e8', away: '#0d2733' },
  { id: 'kan', name: 'Kanye Kestrels',     abbr: 'KAN', rep: 48, stadium: 'Hilltop',             capacity: 8000,  home: '#9aa63f', away: '#1d2110' },
  { id: 'gha', name: 'Ghanzi Dust Devils', abbr: 'GHA', rep: 44, stadium: 'The Pan',             capacity: 7000,  home: '#c9a227', away: '#2a2113' },
  { id: 'tsa', name: 'Tsabong Sandstorm',  abbr: 'TSA', rep: 40, stadium: 'Dune Arena',          capacity: 6500,  home: '#b8804f', away: '#241a12' },
];

// Clubs waiting in the second division; they swap in when someone goes down.
export const PROMOTION_POOL = [
  { id: 'ram', name: 'Ramotswa Rangers',   abbr: 'RAM', rep: 42, stadium: 'Border Park',   capacity: 6000, home: '#6f8fbf', away: '#12181f' },
  { id: 'jwa', name: 'Jwaneng Diggers',    abbr: 'JWA', rep: 46, stadium: 'Pit Head',      capacity: 9000, home: '#d8d2c4', away: '#1c2733' },
  { id: 'shk', name: 'Shakawe Sharks',     abbr: 'SHK', rep: 41, stadium: 'Panhandle',     capacity: 5500, home: '#2c6e91', away: '#0e1a22' },
  { id: 'mah', name: 'Mahalapye Marabou',  abbr: 'MAH', rep: 43, stadium: 'Rail Yard',     capacity: 7000, home: '#8e8b84', away: '#241f1a' },
  { id: 'gum', name: 'Gumare Gazelles',    abbr: 'GUM', rep: 40, stadium: 'Reed Ground',   capacity: 5000, home: '#c96f8c', away: '#1a1013' },
  { id: 'boc', name: 'Bobonong Cheetahs',  abbr: 'BOC', rep: 44, stadium: 'Hillside',      capacity: 6500, home: '#e2b93b', away: '#1f1a0d' },
];

export const FIRST_NAMES = [
  'Thabo', 'Kagiso', 'Mpho', 'Tebogo', 'Kabelo', 'Lesego', 'Onkabetse', 'Katlego',
  'Gaone', 'Tumelo', 'Oratile', 'Pako', 'Segolame', 'Thato', 'Mothusi', 'Keabetswe',
  'Bakang', 'Motheo', 'Gofaone', 'Karabo', 'Neo', 'Otsile', 'Reneilwe', 'Tshepo',
  'Phenyo', 'Goitseone', 'Modiri', 'Obonye', 'Tefo', 'Mogomotsi', 'Baitshepi',
  'Gaolatlhe', 'Kutlwano', 'Larona', 'Ontiretse', 'Kealeboga', 'Boemo', 'Tshiamo',
  'Lentswe', 'Odirile', 'Mmoloki', 'Ofentse', 'Sekgabo', 'Thero', 'Wame', 'Yaone',
];

export const SURNAMES = [
  'Molefe', 'Mogotsi', 'Sebego', 'Motlhabane', 'Ditshupo', 'Seleka', 'Mokgwathi',
  'Tshukudu', 'Baruti', 'Modise', 'Mmusi', 'Segokgo', 'Motshegwa', 'Rakgomo',
  'Setlhare', 'Motswagole', 'Moremi', 'Letsholo', 'Mmolotsi', 'Tladi', 'Segale',
  'Mothibi', 'Selepe', 'Ntsimane', 'Kebonang', 'Marumo', 'Gabaake', 'Pilane',
  'Serema', 'Motshabi', 'Kgafela', 'Bogatsu', 'Ramotswe', 'Ketlogetswe', 'Onalenna',
  'Tautona', 'Mabutho', 'Kgoroba', 'Sechele', 'Masilo', 'Phuthego', 'Ranko',
];

// A handful of imports keeps squads from sounding identical.
export const IMPORT_NAMES = [
  ['Kwesi', 'Mensah'], ['Ibrahim', 'Diallo'], ['Marcos', 'Vieira'], ['Tendai', 'Chikore'],
  ['Samuel', 'Okonkwo'], ['Amadou', 'Traore'], ['Rafael', 'Pinto'], ['Blessing', 'Moyo'],
  ['Youssef', 'Belhadj'], ['Danilo', 'Rocha'], ['Emeka', 'Nwosu'], ['Farai', 'Mutasa'],
  ['Joseph', 'Kimani'], ['Lucas', 'Mbeki'], ['Omar', 'Sissoko'], ['Paulo', 'Andrade'],
];

export const MANAGER_TITLES = ['Gaffer', 'Boss', 'Coach', 'Mister'];

// Nation flavour only, no gameplay effect.
export const CURRENCY = 'P';
