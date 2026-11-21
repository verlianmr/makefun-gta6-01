// The shape of Costa Brisa: one place for the numbers every other module reads — the world,
// its road grid, the car catalogue, the wanted ladder and the story's fixed addresses.

export const WORLD = { width: 3840, height: 2520 };
export const ROAD_WIDTH = 96;
export const LANE_OFFSET = 24;
export const SIDEWALK_OFFSET = 62;

/** West-to-east avenues (x centres); the last one is Costa Drive, along the beach. */
export const AVENUES_X = [240, 720, 1200, 1680, 2160, 2640, 3120, 3360];
/** North-to-south streets (y centres). */
export const STREETS_Y = [240, 660, 1080, 1500, 1920, 2340];
/** East of BEACH_X is sand; east of WATER_X is the sea. Land vehicles and people stop at the water. */
export const BEACH_X = 3456;
export const WATER_X = 3620;

export const CITY_SEED = 20261121;

/** The car catalogue: original Brisa metal, each with its own pace and toughness. */
export const CAR_TYPES = {
  meridian: { name: 'Meridian Sedan', length: 42, width: 20, maxSpeed: 322, accel: 245, hp: 100 },
  pico: { name: 'Pico Hatch', length: 36, width: 19, maxSpeed: 292, accel: 232, hp: 85 },
  sable: { name: 'Vantek Sable', length: 44, width: 20, maxSpeed: 432, accel: 335, hp: 95 },
  mule: { name: 'Cargo Mule Van', length: 50, width: 23, maxSpeed: 262, accel: 192, hp: 140 },
  solcab: { name: 'Sol Cab Taxi', length: 42, width: 20, maxSpeed: 322, accel: 245, hp: 100 },
  interceptor: { name: 'CBPD Interceptor', length: 43, width: 20, maxSpeed: 402, accel: 322, hp: 150 },
};
export const TRAFFIC_TYPES = ['meridian', 'pico', 'meridian', 'solcab', 'mule', 'pico', 'sable'];
export const CAR_COLORS = ['#ff8c69', '#ffd94d', '#7fe3d0', '#84ceeb', '#f6f0e6', '#ff6b9d', '#a8e6cf', '#c3aed6', '#ffb35c', '#5ad1c8'];

/** Heat points per star: index is the star count the heat has reached. */
export const HEAT_FOR_STAR = [0, 30, 80, 160, 280, 450];
export const CRIME_HEAT = { theft: 26, shot: 7, pedHit: 62, copHit: 55, carHit: 14, reckless: 5 };

/** The story's fixed addresses, in world pixels. */
export const PLACES = {
  clubDoor: { x: 1440, y: 946, label: 'The Marlin Club' },
  dockPickup: { x: 2880, y: 2245, label: 'Puerto Brisa docks' },
  shopDrop: { x: 480, y: 2240, label: "Tito's Chop Shop" },
  marinaLot: { x: 3240, y: 1290, label: 'Marina Lot' },
  lighthouse: { x: 3360, y: 128, label: 'Lighthouse Point' },
  policeStation: { x: 960, y: 636, label: 'CBPD Station' },
  hospital: { x: 1440, y: 636, label: 'San Brisa Hospital' },
  playerStart: { x: 1440, y: 1006 },
};

export const SAVE_KEY = 'costa-brisa-save-v1';
