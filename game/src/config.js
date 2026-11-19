// Bahía Sol — shared tuning, city layout and mission story.
// All numbers are metres / seconds. The city is a street grid; the sea lies
// to the south and the marina to the east.
export const CITY = {
  blocks: 9,          // blocks per side
  block: 40,          // block side length
  street: 14,         // street width
  pitch: 54,          // block + street
  half: 277,          // half-extent of the paved city
  beachZ: 340,        // sand ends here, water beyond
  marinaX: 340,       // docks end here, water beyond
};

export const STREETS = []; // street centre lines, one per axis
for (let i = 0; i <= CITY.blocks; i += 1) STREETS.push(-CITY.half + 7 + i * CITY.pitch);

export const PLAYER = {
  walkSpeed: 6, runSpeed: 10.5, accel: 42, radius: 0.55, height: 1.8,
  jumpSpeed: 7.5, gravity: 22, health: 100,
};

export const CAR = {
  accel: 22, brake: 34, reverseAccel: 12, maxSpeed: 42, maxReverse: 12,
  steer: 1.9, steerSpeed: 3.2, grip: 6.5, drag: 0.35, length: 4.4, width: 2.0,
};

export const WANTED = {
  decayDelay: 14,      // seconds unseen before a star starts to fade
  decayPerStar: 9,     // seconds per star once fading
  maxCops: [0, 2, 3, 4, 5, 6],
  bustSeconds: 2.5,    // a cop touching the player on foot this long = busted
};

export const PALETTE = {
  sky: 0x87bfe8, sun: 0xfff2d0, fog: 0xcfe4f2,
  asphalt: 0x2e3138, sidewalk: 0x9aa0a3, sand: 0xe8d29a, water: 0x2a7f9e,
  building: [0xd8c9a3, 0xc9b18c, 0xbfae9e, 0xa8b6c4, 0xd0a58a, 0x9fb4a4, 0xc4a4a4, 0x8fa3b8],
  car: [0xc23b2e, 0x2e6fc2, 0xe8b93a, 0x3aa655, 0xe8e8e8, 0x222226, 0x7a4a9e, 0xd06a2a],
  police: 0x1c2f6e, taxi: 0xf2c230,
};

// The story: Dario Cruz, a getaway driver trying to go straight, gets pulled
// back in by Doña Maribel, who runs the Solmar garage. Four jobs, one arc.
export const MISSIONS = [
  {
    id: 'fare', title: 'First Fare', giver: 'Doña Maribel',
    brief: 'A client waits at the Solmar garage. Drive him to the marina hotel before the meter runs out. No scratches, no police.',
    objective: 'Pick up the client at the garage, then drive him to the marina hotel.',
    payout: 250, timeLimit: 150,
  },
  {
    id: 'wheels', title: 'Hot Wheels', giver: 'Doña Maribel',
    brief: 'A sunrise-yellow Comet GT sits outside the Coral casino. Take it. The owner will not miss it until morning — the police might.',
    objective: 'Steal the Comet GT outside the Coral casino and deliver it to the garage.',
    payout: 600, timeLimit: 210,
  },
  {
    id: 'heat', title: 'Heat Run', giver: 'Doña Maribel',
    brief: 'The cops tagged your plates. Lose them — three stars and counting — and get to the hideout under the east bridge.',
    objective: 'Lose the police, then reach the hideout under the east bridge.',
    payout: 800, timeLimit: 240,
  },
  {
    id: 'score', title: 'The Big Score', giver: 'Doña Maribel',
    brief: 'One last job: the Banco Sol vault truck stops at the plaza at noon. Grab the cash, outrun the whole city, and bring it to the boat at the marina.',
    objective: 'Grab the cash at the plaza, escape the police, and reach the boat at the marina.',
    payout: 2500, timeLimit: 300,
  },
];

export const SHOT_DEFS = [
  { name: '1-cover', label: 'On foot in the lunch crowd' },
  { name: '2-drive', label: 'Driving the coast road' },
  { name: '3-chase', label: 'Three-star police chase' },
  { name: '4-mission', label: 'The Big Score in progress' },
];

export const SAVE_KEY = 'bahia-sol-save-v1';
