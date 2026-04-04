"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  buildControlGrid,
  clampToPitch,
  ControlCell,
  ControlParams,
  makeDefaultPlayers,
  PitchDimensions,
  PlayerState,
} from "@/lib/pitchControl";
import "./pitch-control.css";

type DragMode =
  | { type: "player"; playerId: string }
  | { type: "velocity"; playerId: string }
  | { type: "ball" }
  | null;

const pitch: PitchDimensions = { width: 105, height: 68 };
const metersToPx = 8;

const defaultParams: ControlParams = {
  maxSpeed: 7,
  reactionTime: 0.7,
  sigma: 0.45,
  minCell: 2.4,
};

const teamFill = {
  home: "#1356f5",
  away: "#e63429",
};

const defaultBallPosition = {
  x: pitch.width / 2,
  y: pitch.height / 2,
};

const cellAlpha = (cell: ControlCell): number => {
  const dominance = Math.abs(cell.homeProb - 0.5) * 2;
  return Math.min(0.75, 0.15 + dominance * 0.7);
};

function drawHeatmap(
  canvas: HTMLCanvasElement,
  grid: ControlCell[],
  dims: PitchDimensions,
  cellSizeMeters: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const widthPx = dims.width * metersToPx;
  const heightPx = dims.height * metersToPx;

  canvas.width = widthPx;
  canvas.height = heightPx;

  ctx.clearRect(0, 0, widthPx, heightPx);

  const approxCols = Math.max(1, Math.floor(dims.width / cellSizeMeters));
  const approxRows = Math.max(1, Math.floor(dims.height / cellSizeMeters));
  const cellW = widthPx / approxCols;
  const cellH = heightPx / approxRows;

  for (const cell of grid) {
    const x = (cell.x / dims.width) * widthPx - cellW / 2;
    const y = (cell.y / dims.height) * heightPx - cellH / 2;

    const homeStrong = cell.homeProb >= 0.5;
    const base = homeStrong ? "21, 86, 245" : "230, 52, 41";

    ctx.fillStyle = `rgba(${base}, ${cellAlpha(cell)})`;
    ctx.fillRect(x, y, cellW + 1, cellH + 1);
  }
}

function toPitchCoords(
  clientX: number,
  clientY: number,
  root: HTMLDivElement,
): { x: number; y: number } {
  const rect = root.getBoundingClientRect();
  const pxX = clientX - rect.left;
  const pxY = clientY - rect.top;

  return {
    x: (pxX / rect.width) * pitch.width,
    y: (pxY / rect.height) * pitch.height,
  };
}

export function PitchControlApp() {
  const [players, setPlayers] = useState<PlayerState[]>(() =>
    makeDefaultPlayers(pitch),
  );
  const [ballPosition, setBallPosition] = useState(defaultBallPosition);
  const [params, setParams] = useState<ControlParams>(defaultParams);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragMode>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [focusMenuOpen, setFocusMenuOpen] = useState(false);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const focusMenuRef = useRef<HTMLElement | null>(null);
  const focusMenuToggleRef = useRef<HTMLButtonElement | null>(null);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const grid = useMemo(
    () => buildControlGrid(players, pitch, params),
    [players, params],
  );

  useEffect(() => {
    if (heatmapCanvasRef.current) {
      drawHeatmap(heatmapCanvasRef.current, grid, pitch, params.minCell);
    }
  }, [grid, params.minCell]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drag || !boardRef.current) return;

      const p = clampToPitch(
        toPitchCoords(event.clientX, event.clientY, boardRef.current),
        pitch,
      );

      if (drag.type === "ball") {
        setBallPosition(p);
        return;
      }

      setPlayers((prev) =>
        prev.map((player) => {
          if (player.id !== drag.playerId) return player;

          if (drag.type === "player") {
            return {
              ...player,
              position: p,
            };
          }

          return {
            ...player,
            velocity: {
              x: p.x - player.position.x,
              y: p.y - player.position.y,
            },
          };
        }),
      );
    };

    const onUp = () => setDrag(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag]);

  const enterFocusMode = async () => {
    setFocusMode(true);
    setFocusMenuOpen(false);
    if (boardWrapRef.current?.requestFullscreen) {
      try {
        await boardWrapRef.current.requestFullscreen();
      } catch {
        // Fullscreen may be blocked by browser policy; CSS focus mode still applies.
      }
    }
  };

  const exitFocusMode = async () => {
    setFocusMode(false);
    setFocusMenuOpen(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // No-op fallback.
      }
    }
  };

  useEffect(() => {
    const onKeyDown = async (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setFocusMode(false);
      setFocusMenuOpen(false);
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // No-op fallback.
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!focusMode || !focusMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (focusMenuRef.current?.contains(target)) return;
      if (focusMenuToggleRef.current?.contains(target)) return;
      setFocusMenuOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [focusMode, focusMenuOpen]);

  const boardStyle = focusMode
    ? {
        width: "min(calc(100vw - 24px), calc((100vh - 24px) * 105 / 68))",
        height: "min(calc((100vw - 24px) * 68 / 105), calc(100vh - 24px))",
      }
    : {
        width: `${pitch.width * metersToPx}px`,
        height: `${pitch.height * metersToPx}px`,
      };

  const shellClass = "w-full antialiased";
  const layoutClass =
    "mx-auto grid max-w-[1640px] items-start gap-8 grid-cols-1 min-[1100px]:grid-cols-[minmax(350px,390px)_1fr] min-[1100px]:[column-gap:2rem]";
  const panelClass =
    "flex h-fit flex-col gap-4 rounded-[22px] border border-[#4F7C82] bg-[#0B2E33] p-7 shadow-[0_18px_34px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(184,227,233,0.12)] backdrop-blur-[1px]";
  const panelTitleClass =
    "m-0 font-[var(--font-display)] text-[1.62rem] leading-tight tracking-[-0.02em] text-[#B8E3E9]";
  const panelCopyClass =
    "m-0 max-w-prose text-[0.92rem] leading-[1.55] text-[#B8E3E9]";
  const controlsClass =
    "grid gap-3.5 rounded-[14px] border border-[#4F7C82] bg-[#12373d] p-4 shadow-[inset_0_1px_0_rgba(184,227,233,0.12)]";
  const labelClass =
    "grid gap-2 border-b border-[#4F7C82] pb-3 text-[0.9rem] font-medium tracking-[0.01em] text-[#B8E3E9] last:border-b-0 last:pb-0";
  const rangeClass = "controlRange";
  const buttonRowClass = "grid grid-cols-1 gap-3 sm:grid-cols-2";
  const primaryBtnClass =
    "w-full cursor-pointer rounded-xl border border-[#4F7C82] bg-[#4F7C82] px-4 py-[0.82rem] text-[0.91rem] font-bold text-[#B8E3E9] shadow-[0_7px_16px_rgba(11,46,51,0.45)] transition duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_10px_20px_rgba(11,46,51,0.52)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8E3E9]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2E33]";
  const secondaryBtnClass =
    "w-full cursor-pointer rounded-xl border border-[#93B1B5] bg-[#93B1B5] px-4 py-[0.82rem] text-[0.91rem] font-bold text-[#0B2E33] shadow-[0_7px_16px_rgba(11,46,51,0.35)] transition duration-150 ease-out hover:-translate-y-[1px] hover:shadow-[0_10px_20px_rgba(11,46,51,0.44)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8E3E9]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B2E33]";
  const noteClass =
    "m-0 border-t border-[#4F7C82] pt-4 text-[0.78rem] leading-5 text-[#B8E3E9]";
  const boardWrapClass = focusMode
    ? "fixed inset-0 z-[100] flex items-center justify-center bg-[#0B2E33] p-3"
    : "min-w-0";
  const focusToolbarClass =
    "pointer-events-none absolute inset-x-[10px] top-[10px] z-10 flex items-start justify-between";
  const menuBtnClass =
    "pointer-events-auto cursor-pointer rounded-[10px] border border-[#4F7C82] bg-[#12373d] px-[0.65rem] py-[0.4rem] font-bold text-[#B8E3E9] shadow-[0_8px_16px_rgba(0,0,0,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8E3E9]/70";
  const focusMenuClass =
    "absolute left-3.5 top-[66px] z-20 max-h-[calc(100vh-84px)] w-[min(340px,calc(100vw-28px))] overflow-auto rounded-[14px] border border-[#4F7C82] bg-[#12373d] p-3 shadow-[0_18px_36px_rgba(0,0,0,0.26)] backdrop-blur-[6px]";
  const focusMenuHeaderClass = "mb-2.5 flex items-center justify-between";
  const focusMenuTitleClass = "m-0 text-base text-[#B8E3E9]";
  const focusMenuCloseClass =
    "cursor-pointer rounded-lg border border-[#93B1B5] bg-[#93B1B5] px-2.5 py-[0.35rem] font-bold text-[#0B2E33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8E3E9]/70";

  return (
    <div className={shellClass}>
      <div className={layoutClass}>
        {!focusMode ? (
          <aside className={panelClass}>
            <div className="mb-1 flex items-center gap-3">
              <Image
                src="/pitch-control-labs-logo.png"
                alt="Pitch Control Lab logo"
                width={32}
                height={32}
                className="h-8 w-8 object-contain"
                priority
              />
              <h1 className={panelTitleClass}>Pitch Control Lab</h1>
            </div>

            <p className={panelCopyClass}>
              Drag players to shape your setup. Tap a player to reveal and
              adjust that player’s movement vector. The heatmap updates live to
              show likely territorial control. Blue favors the home team, red
              favors the away team, and the yellow marker shows ball position.
            </p>

            <div className={controlsClass}>
              <label className={labelClass}>
                <span>Max Speed ({params.maxSpeed.toFixed(1)} m/s)</span>
                <input
                  className={rangeClass}
                  type="range"
                  min={3}
                  max={9}
                  step={0.1}
                  value={params.maxSpeed}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      maxSpeed: Number(e.target.value),
                    }))
                  }
                />
              </label>

              <div className="h-px bg-[#2a3d5e]" />

              <label className={labelClass}>
                <span>Reaction Time ({params.reactionTime.toFixed(2)} s)</span>
                <input
                  className={rangeClass}
                  type="range"
                  min={0.2}
                  max={1.4}
                  step={0.05}
                  value={params.reactionTime}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      reactionTime: Number(e.target.value),
                    }))
                  }
                />
              </label>

              <div className="h-px bg-[#2a3d5e]" />

              <label className={labelClass}>
                <span>Time Decay Sigma ({params.sigma.toFixed(2)})</span>
                <input
                  className={rangeClass}
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.01}
                  value={params.sigma}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      sigma: Number(e.target.value),
                    }))
                  }
                />
              </label>

              <div className="h-px bg-[#2a3d5e]" />

              <label className={labelClass}>
                <span>Grid Size ({params.minCell.toFixed(1)} m)</span>
                <input
                  className={rangeClass}
                  type="range"
                  min={1.4}
                  max={4.2}
                  step={0.1}
                  value={params.minCell}
                  onChange={(e) =>
                    setParams((prev) => ({
                      ...prev,
                      minCell: Number(e.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className={buttonRowClass}>
              <button
                className={primaryBtnClass}
                onClick={() => {
                  setPlayers(makeDefaultPlayers(pitch));
                  setBallPosition(defaultBallPosition);
                  setSelectedPlayerId(null);
                }}
              >
                Reset Scenario
              </button>

              <button className={secondaryBtnClass} onClick={enterFocusMode}>
                Full Size Pitch
              </button>
            </div>

            <p className={noteClass}>
              Model note: this is a Spearman-inspired approximation using
              time-to-intercept and exponential control weighting.
            </p>
          </aside>
        ) : null}

        <section className={boardWrapClass} ref={boardWrapRef}>
          {focusMode ? (
            <div className={focusToolbarClass}>
              <button
                ref={focusMenuToggleRef}
                className={menuBtnClass}
                onClick={() => setFocusMenuOpen((prev) => !prev)}
              >
                ☰ Menu
              </button>
              <div className="flex items-center gap-2">
                <button className={menuBtnClass} onClick={exitFocusMode}>
                  Exit Full Size
                </button>
              </div>
            </div>
          ) : null}
          {focusMode && focusMenuOpen ? (
            <aside className={focusMenuClass} ref={focusMenuRef}>
              <div className={focusMenuHeaderClass}>
                <h2 className={focusMenuTitleClass}>Pitch Controls</h2>
                <button
                  className={focusMenuCloseClass}
                  onClick={() => setFocusMenuOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className={controlsClass}>
                <label className={labelClass}>
                  Max Speed ({params.maxSpeed.toFixed(1)} m/s)
                  <input
                    className={`${rangeClass} mt-0.5`}
                    type="range"
                    min={3}
                    max={9}
                    step={0.1}
                    value={params.maxSpeed}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        maxSpeed: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className={labelClass}>
                  Reaction Time ({params.reactionTime.toFixed(2)} s)
                  <input
                    className={`${rangeClass} mt-0.5`}
                    type="range"
                    min={0.2}
                    max={1.4}
                    step={0.05}
                    value={params.reactionTime}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        reactionTime: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className={labelClass}>
                  Time Decay Sigma ({params.sigma.toFixed(2)})
                  <input
                    className={`${rangeClass} mt-0.5`}
                    type="range"
                    min={0.2}
                    max={1}
                    step={0.01}
                    value={params.sigma}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        sigma: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className={labelClass}>
                  Grid Size ({params.minCell.toFixed(1)} m)
                  <input
                    className={`${rangeClass} mt-0.5`}
                    type="range"
                    min={1.4}
                    max={4.2}
                    step={0.1}
                    value={params.minCell}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        minCell: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <button
                className={`${primaryBtnClass} focus-visible:ring-offset-[#10213a]`}
                onClick={() => {
                  setPlayers(makeDefaultPlayers(pitch));
                  setBallPosition(defaultBallPosition);
                  setSelectedPlayerId(null);
                }}
              >
                Reset Scenario
              </button>
            </aside>
          ) : null}
          <div
            className="board"
            ref={boardRef}
            style={boardStyle}
            onPointerDown={(e) => {
              const target = e.target as Element;
              if (
                target.closest(".player") ||
                target.closest(".arrowHandleHit") ||
                target.closest(".ball")
              )
                return;
              setSelectedPlayerId(null);
            }}
          >
            <canvas ref={heatmapCanvasRef} className="heat" />

            <svg
              viewBox={`0 0 ${pitch.width} ${pitch.height}`}
              className="lines"
              preserveAspectRatio="none"
            >
              <rect
                x={0}
                y={0}
                width={pitch.width}
                height={pitch.height}
                fill="none"
                stroke="white"
                strokeWidth={0.5}
              />
              <line
                x1={pitch.width / 2}
                y1={0}
                x2={pitch.width / 2}
                y2={pitch.height}
                stroke="white"
                strokeWidth={0.45}
              />
              <circle
                cx={pitch.width / 2}
                cy={pitch.height / 2}
                r={9.15}
                fill="none"
                stroke="white"
                strokeWidth={0.45}
              />
              <rect
                x={0}
                y={pitch.height / 2 - 20.16}
                width={16.5}
                height={40.32}
                fill="none"
                stroke="white"
                strokeWidth={0.45}
              />
              <rect
                x={pitch.width - 16.5}
                y={pitch.height / 2 - 20.16}
                width={16.5}
                height={40.32}
                fill="none"
                stroke="white"
                strokeWidth={0.45}
              />
              <circle
                cx={11}
                cy={pitch.height / 2}
                r={0.2}
                fill="rgba(255,255,255,0.9)"
              />
              <circle
                cx={pitch.width - 11}
                cy={pitch.height / 2}
                r={0.2}
                fill="rgba(255,255,255,0.9)"
              />
            </svg>

            <svg
              viewBox={`0 0 ${pitch.width} ${pitch.height}`}
              className="tokens"
              preserveAspectRatio="none"
            >
              <defs>
                <marker
                  id="homeArrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#1356f5" />
                </marker>
                <marker
                  id="awayArrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="4"
                  markerHeight="4"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#e63429" />
                </marker>
              </defs>

              {players.map((player) => {
                const vectorEnd = {
                  x: player.position.x + player.velocity.x,
                  y: player.position.y + player.velocity.y,
                };
                const arrowMarker =
                  player.team === "home"
                    ? "url(#homeArrow)"
                    : "url(#awayArrow)";
                const isSelected = selectedPlayerId === player.id;

                return (
                  <g key={player.id}>
                    <line
                      x1={player.position.x}
                      y1={player.position.y}
                      x2={vectorEnd.x}
                      y2={vectorEnd.y}
                      stroke={teamFill[player.team]}
                      strokeWidth={0.45}
                      markerEnd={arrowMarker}
                    />

                    <circle
                      cx={player.position.x}
                      cy={player.position.y}
                      r={1.25}
                      fill={teamFill[player.team]}
                      className={`player ${isSelected ? "playerSelected" : ""}`}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedPlayerId(player.id);
                        setDrag({ type: "player", playerId: player.id });
                      }}
                    />

                    <text
                      x={player.position.x}
                      y={player.position.y + 0.2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="jersey"
                    >
                      {player.number}
                    </text>

                    {isSelected ? (
                      <>
                        <rect
                          x={vectorEnd.x - 0.52}
                          y={vectorEnd.y - 0.52}
                          width={1.04}
                          height={1.04}
                          rx={0.08}
                          ry={0.08}
                          transform={`rotate(45 ${vectorEnd.x} ${vectorEnd.y})`}
                          className="arrowHandle arrowHandleActive"
                          fill={teamFill[player.team]}
                          pointerEvents="none"
                        />

                        <circle
                          cx={vectorEnd.x}
                          cy={vectorEnd.y}
                          r={1.85}
                          className="arrowHandleHit"
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedPlayerId(player.id);
                            setDrag({ type: "velocity", playerId: player.id });
                          }}
                        />
                      </>
                    ) : null}
                  </g>
                );
              })}

              <g>
                <circle
                  cx={ballPosition.x}
                  cy={ballPosition.y}
                  r={1.05}
                  className="ball"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDrag({ type: "ball" });
                  }}
                />
                <path
                  d={`
                    M ${ballPosition.x - 0.42} ${ballPosition.y}
                    L ${ballPosition.x + 0.42} ${ballPosition.y}
                    M ${ballPosition.x} ${ballPosition.y - 0.42}
                    L ${ballPosition.x} ${ballPosition.y + 0.42}
                  `}
                  className="ballMark"
                />
              </g>
            </svg>
          </div>
        </section>
      </div>
    </div>
  );
}
