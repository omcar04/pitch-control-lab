export type TeamId = "home" | "away";

export type Vector2 = {
  x: number;
  y: number;
};

export type PlayerState = {
  id: string;
  number: number;
  team: TeamId;
  position: Vector2;
  velocity: Vector2;
};

export type PitchDimensions = {
  width: number;
  height: number;
};

export type ControlParams = {
  maxSpeed: number;
  reactionTime: number;
  sigma: number;
  minCell: number;
};

export type ControlCell = {
  x: number;
  y: number;
  homeProb: number;
  awayProb: number;
};

const magnitude = (v: Vector2): number => Math.hypot(v.x, v.y);

const travelTime = (player: PlayerState, target: Vector2, params: ControlParams): number => {
  const velocityMag = magnitude(player.velocity);
  const clampedV = velocityMag > params.maxSpeed
    ? { x: (player.velocity.x / velocityMag) * params.maxSpeed, y: (player.velocity.y / velocityMag) * params.maxSpeed }
    : player.velocity;

  const projected = {
    x: player.position.x + clampedV.x * params.reactionTime,
    y: player.position.y + clampedV.y * params.reactionTime
  };

  const dist = Math.hypot(target.x - projected.x, target.y - projected.y);
  return params.reactionTime + dist / params.maxSpeed;
};

const influence = (timeToIntercept: number, sigma: number): number => {
  return Math.exp(-timeToIntercept / sigma);
};

export const buildControlGrid = (
  players: PlayerState[],
  pitch: PitchDimensions,
  params: ControlParams
): ControlCell[] => {
  const cols = Math.max(20, Math.floor(pitch.width / params.minCell));
  const rows = Math.max(12, Math.floor(pitch.height / params.minCell));

  const cellW = pitch.width / cols;
  const cellH = pitch.height / rows;

  const cells: ControlCell[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const target = {
        x: c * cellW + cellW / 2,
        y: r * cellH + cellH / 2
      };

      let homeInfluence = 0;
      let awayInfluence = 0;

      for (const player of players) {
        const tti = travelTime(player, target, params);
        const w = influence(tti, params.sigma);

        if (player.team === "home") {
          homeInfluence += w;
        } else {
          awayInfluence += w;
        }
      }

      const total = homeInfluence + awayInfluence;
      const homeProb = total > 0 ? homeInfluence / total : 0.5;
      const awayProb = 1 - homeProb;

      cells.push({
        x: target.x,
        y: target.y,
        homeProb,
        awayProb
      });
    }
  }

  return cells;
};

export const clampToPitch = (point: Vector2, pitch: PitchDimensions): Vector2 => {
  return {
    x: Math.max(0, Math.min(pitch.width, point.x)),
    y: Math.max(0, Math.min(pitch.height, point.y))
  };
};

export const makeDefaultPlayers = (pitch: PitchDimensions): PlayerState[] => {
  const home: PlayerState[] = [
    { id: "h1", number: 1, team: "home", position: { x: 8, y: pitch.height / 2 }, velocity: { x: 0, y: 0 } },
    { id: "h2", number: 2, team: "home", position: { x: 20, y: 9 }, velocity: { x: 0.4, y: 0.05 } },
    { id: "h3", number: 4, team: "home", position: { x: 20, y: 24 }, velocity: { x: 0.45, y: 0 } },
    { id: "h4", number: 5, team: "home", position: { x: 20, y: 44 }, velocity: { x: 0.4, y: 0 } },
    { id: "h5", number: 3, team: "home", position: { x: 20, y: 59 }, velocity: { x: 0.4, y: -0.05 } },
    { id: "h6", number: 6, team: "home", position: { x: 38, y: 14 }, velocity: { x: 0.65, y: 0.05 } },
    { id: "h7", number: 8, team: "home", position: { x: 38, y: 34 }, velocity: { x: 0.8, y: 0 } },
    { id: "h8", number: 10, team: "home", position: { x: 38, y: 54 }, velocity: { x: 0.65, y: -0.05 } },
    { id: "h9", number: 7, team: "home", position: { x: 61, y: 14 }, velocity: { x: 0.9, y: 0.1 } },
    { id: "h10", number: 9, team: "home", position: { x: 66, y: 34 }, velocity: { x: 1.1, y: 0 } },
    { id: "h11", number: 11, team: "home", position: { x: 61, y: 54 }, velocity: { x: 0.9, y: -0.1 } }
  ];

  const away = home.map((player, index) => ({
    id: `a${index + 1}`,
    number: player.number,
    team: "away" as const,
    position: { x: pitch.width - player.position.x, y: player.position.y },
    velocity: { x: -player.velocity.x, y: player.velocity.y }
  }));

  return [...home, ...away];
};
