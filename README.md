# Pitch Control Board (Spearman-style)

Interactive coaching board built with Next.js for free deployment on Vercel.

## What it does

- Full pitch board with draggable player pins
- Draggable arrow handles to set each player's movement direction/vector
- Live pitch-control heatmap (home vs away dominance)
- Tunable model parameters: max speed, reaction time, decay sigma, grid size

## Model (practical approximation)

This app uses a Spearman-inspired time-to-intercept approach:

1. Estimate each player's time-to-intercept for each pitch grid cell.
2. Convert interception time to influence with exponential decay.
3. Normalize home vs away total influence to get control probability per cell.

This is designed for interactive scenario exploration, not as a direct reproduction of proprietary production tracking models.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy free on Vercel

1. Push this project to GitHub.
2. Go to `https://vercel.com/new`.
3. Import the GitHub repo.
4. Keep defaults (Framework: Next.js).
5. Click Deploy.

Vercel free tier is enough for this project.

## Useful edits

- Player defaults: `lib/pitchControl.ts` (`makeDefaultPlayers`)
- Pitch-control math: `lib/pitchControl.ts` (`travelTime`, `buildControlGrid`)
- UI board and interactions: `components/PitchControlApp.tsx`
- Styling: `components/pitch-control.css`
