// Formation shapes. x/y are percentages on a vertical pitch (0,0 top-left,
// the goal you attack is at the top) and are used by the tactics pitch view.

const shape = (name, slots) => ({ name, slots: slots.map((s, i) => ({ ...s, index: i })) });

export const FORMATIONS = {
  '4-4-2': shape('4-4-2', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'LB', x: 14, y: 73 },
    { role: 'DF', label: 'CB', x: 38, y: 77 },
    { role: 'DF', label: 'CB', x: 62, y: 77 },
    { role: 'DF', label: 'RB', x: 86, y: 73 },
    { role: 'MF', label: 'LM', x: 14, y: 48 },
    { role: 'MF', label: 'CM', x: 38, y: 52 },
    { role: 'MF', label: 'CM', x: 62, y: 52 },
    { role: 'MF', label: 'RM', x: 86, y: 48 },
    { role: 'FW', label: 'ST', x: 36, y: 22 },
    { role: 'FW', label: 'ST', x: 64, y: 22 },
  ]),
  '4-3-3': shape('4-3-3', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'LB', x: 14, y: 73 },
    { role: 'DF', label: 'CB', x: 38, y: 77 },
    { role: 'DF', label: 'CB', x: 62, y: 77 },
    { role: 'DF', label: 'RB', x: 86, y: 73 },
    { role: 'MF', label: 'CM', x: 26, y: 54 },
    { role: 'MF', label: 'CM', x: 50, y: 60 },
    { role: 'MF', label: 'CM', x: 74, y: 54 },
    { role: 'FW', label: 'LW', x: 16, y: 26 },
    { role: 'FW', label: 'ST', x: 50, y: 18 },
    { role: 'FW', label: 'RW', x: 84, y: 26 },
  ]),
  '4-2-3-1': shape('4-2-3-1', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'LB', x: 14, y: 73 },
    { role: 'DF', label: 'CB', x: 38, y: 77 },
    { role: 'DF', label: 'CB', x: 62, y: 77 },
    { role: 'DF', label: 'RB', x: 86, y: 73 },
    { role: 'MF', label: 'DM', x: 36, y: 60 },
    { role: 'MF', label: 'DM', x: 64, y: 60 },
    { role: 'MF', label: 'LW', x: 16, y: 38 },
    { role: 'MF', label: 'AM', x: 50, y: 40 },
    { role: 'MF', label: 'RW', x: 84, y: 38 },
    { role: 'FW', label: 'ST', x: 50, y: 17 },
  ]),
  '3-5-2': shape('3-5-2', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'CB', x: 26, y: 77 },
    { role: 'DF', label: 'CB', x: 50, y: 79 },
    { role: 'DF', label: 'CB', x: 74, y: 77 },
    { role: 'MF', label: 'LWB', x: 10, y: 52 },
    { role: 'MF', label: 'CM', x: 33, y: 56 },
    { role: 'MF', label: 'CM', x: 50, y: 46 },
    { role: 'MF', label: 'CM', x: 67, y: 56 },
    { role: 'MF', label: 'RWB', x: 90, y: 52 },
    { role: 'FW', label: 'ST', x: 36, y: 20 },
    { role: 'FW', label: 'ST', x: 64, y: 20 },
  ]),
  '5-3-2': shape('5-3-2', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'LWB', x: 10, y: 66 },
    { role: 'DF', label: 'CB', x: 30, y: 79 },
    { role: 'DF', label: 'CB', x: 50, y: 81 },
    { role: 'DF', label: 'CB', x: 70, y: 79 },
    { role: 'DF', label: 'RWB', x: 90, y: 66 },
    { role: 'MF', label: 'CM', x: 30, y: 52 },
    { role: 'MF', label: 'CM', x: 50, y: 56 },
    { role: 'MF', label: 'CM', x: 70, y: 52 },
    { role: 'FW', label: 'ST', x: 36, y: 22 },
    { role: 'FW', label: 'ST', x: 64, y: 22 },
  ]),
  '4-5-1': shape('4-5-1', [
    { role: 'GK', label: 'GK', x: 50, y: 92 },
    { role: 'DF', label: 'LB', x: 14, y: 73 },
    { role: 'DF', label: 'CB', x: 38, y: 77 },
    { role: 'DF', label: 'CB', x: 62, y: 77 },
    { role: 'DF', label: 'RB', x: 86, y: 73 },
    { role: 'MF', label: 'LM', x: 12, y: 46 },
    { role: 'MF', label: 'CM', x: 34, y: 56 },
    { role: 'MF', label: 'CM', x: 50, y: 48 },
    { role: 'MF', label: 'CM', x: 66, y: 56 },
    { role: 'MF', label: 'RM', x: 88, y: 46 },
    { role: 'FW', label: 'ST', x: 50, y: 18 },
  ]),
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

export const MENTALITIES = [
  { id: 'defensive', name: 'Defensive', blurb: 'Sit deep, protect the box, hit on the break.' },
  { id: 'balanced', name: 'Balanced', blurb: 'Take what the game gives you.' },
  { id: 'attacking', name: 'Attacking', blurb: 'Commit numbers forward and accept the risk.' },
];

export const PRESSING = [
  { id: 'low', name: 'Low block', blurb: 'Stay compact, save legs.' },
  { id: 'medium', name: 'Medium', blurb: 'Press in your own half.' },
  { id: 'high', name: 'High press', blurb: 'Win it high up. Costs stamina and fouls.' },
];

export const TEMPO = [
  { id: 'slow', name: 'Patient', blurb: 'Keep the ball, fewer chances either way.' },
  { id: 'normal', name: 'Normal', blurb: 'Play it as it comes.' },
  { id: 'fast', name: 'Direct', blurb: 'Get it forward quickly. An open game.' },
];

export const DEFAULT_TACTICS = {
  formation: '4-4-2',
  mentality: 'balanced',
  pressing: 'medium',
  tempo: 'normal',
};

export function slotsOf(formationName) {
  return (FORMATIONS[formationName] ?? FORMATIONS['4-4-2']).slots;
}
