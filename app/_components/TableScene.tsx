import type { CSSProperties } from "react";

// The pool table is modelled as a small 3D scene seen by an orthographic
// camera. The camera's elevation is driven purely by viewport width in CSS
// (see `.table-scene` in globals.css), so this stays a zero-JS server component.
// HeroIntro and PoolShot animate it by setting CSS variables on its parts.
//
// World coordinates are in tablet-frame px (Figma 9026:1895), origin at the
// table center: x → right, z → toward the viewer, height h → up.
// A point (x, z, h) lands on screen at (x, z·s − h·c), where s/c are the
// sine/cosine of the camera elevation.

export const TABLE_RADIUS = 508.48;

type Ball = {
  kind: "yellow" | "blue" | "white" | "eight";
  x: number;
  z: number;
  /** radius at the tablet angle (bigger toward the front, like perspective) */
  rTablet: number;
  /** radius when seen top-down */
  rMobile: number;
  /** the desktop frame's shadow ellipse on the felt, in ball radii:
      offset from the ball, then a 2×2 matrix on the unit circle */
  shadow: { x: number; z: number; m: [number, number, number, number] };
};

// Sorted back-to-front (by z) so later balls paint over earlier ones.
// Positions, radii and shadows come from the desktop frame (9026:1631), whose
// table is this one scaled by 1.0363; mobile radii from 9026:2063, rescaled
// from its 552px table to this 1017px one. All x are shifted +145 from the
// frame so the white → eight span is centered on tablet and mobile; the
// desktop table pose shifts back by the same amount (see globals.css).
// The white and eight balls (and so the cue) sit 175 further toward the viewer
// than the frame, so on mobile they clear the hero text with ≥8px to spare.
const balls: Ball[] = [
  {
    kind: "blue",
    x: -58.39,
    z: -328.4,
    rTablet: 28.68,
    rMobile: 57.11,
    shadow: { x: 0.5058, z: -1.934, m: [1.2639, 0.1408, -0.0152, 2.6069] },
  },
  {
    kind: "white",
    x: -210.35,
    z: 161.4,
    rTablet: 37.32,
    rMobile: 57.97,
    shadow: { x: 0.6288, z: -1.6979, m: [1.3897, 0.8266, -0.0747, 2.3974] },
  },
  {
    kind: "eight",
    x: 211.26,
    z: 228.72,
    rTablet: 42.32,
    rMobile: 56.02,
    shadow: { x: 0.8281, z: -1.5972, m: [1.474, 0.252, -0.0228, 2.5428] },
  },
  {
    kind: "yellow",
    x: 5.62,
    z: 376.11,
    rTablet: 49.81,
    rMobile: 55.53,
    shadow: { x: 0.8642, z: -1.6714, m: [1.4504, 0.1051, -0.0095, 2.5022] },
  },
];

export const cueBall = balls.find((b) => b.kind === "white")!;
export const blueBall = balls.find((b) => b.kind === "blue")!;
export const eightBall = balls.find((b) => b.kind === "eight")!;

function ballVars(ball: Ball) {
  const [sa, sb, sc, sd] = ball.shadow.m;
  return {
    "--x": ball.x,
    "--z": ball.z,
    "--rt": ball.rTablet,
    "--rm": ball.rMobile,
    "--sx": ball.shadow.x,
    "--sz": ball.shadow.z,
    "--sa": sa,
    "--sb": sb,
    "--sc": sc,
    "--sd": sd,
  } as CSSProperties;
}

const cueVars = ballVars(cueBall);

// Ball artwork, drawn on a unit circle (scaled to the ball radius in CSS).
function BallArt({ kind }: { kind: Ball["kind"] }) {
  switch (kind) {
    case "yellow":
      return (
        <>
          <circle r="1" fill="#F4F48F" />
          <g clipPath="url(#table-yellow-ball)">
            <g transform="rotate(15.42)">
              <rect x="-1.45" y="-1.75" width="0.9" height="3.5" fill="#FCFFF2" />
              <rect x="0.55" y="-1.75" width="0.9" height="3.5" fill="#FCFFF2" />
            </g>
          </g>
        </>
      );
    case "blue":
      return (
        <>
          <circle r="1" fill="#A4CDF9" />
          <circle cx="-0.280" cy="-0.095" r="0.4953" fill="#FCFFF2" />
        </>
      );
    case "white":
      return (
        <>
          <circle r="1" fill="#FCFFF2" />
          {/* face looks up-left, away from the cue */}
          <g transform="scale(-1 1)">
            <circle cx="0.040" cy="-0.395" r="0.0617" fill="black" />
            <circle cx="0.466" cy="-0.615" r="0.0617" fill="black" />
            <path
              transform="translate(0.344 -0.377) scale(0.021386) rotate(148.11) scale(1 -1) translate(-4.762 -1.643)"
              d="M0 1.04934C0 0.310679 0.763257 -0.181081 1.43587 0.124221L3.60503 1.10881C4.25845 1.4054 5.00657 1.41304 5.66591 1.12986L8.10117 0.0839565C8.77491 -0.205404 9.52493 0.28874 9.52493 1.02199C9.52493 1.37469 9.34284 1.70512 9.03795 1.88245C5.88333 3.71724 3.49223 3.7875 0.45348 1.88443C0.167429 1.70529 0 1.38686 0 1.04934Z"
              fill="black"
            />
          </g>
        </>
      );
    case "eight":
      return (
        <>
          <circle r="1" fill="black" />
          <circle cx="0.238" cy="-0.210" r="0.4952" fill="#FCFFF2" />
        </>
      );
  }
}

// Cue artwork on a unit band: x 0 (tip) → 1 (butt), y −0.5 → 0.5.
// Tip and butt start from the desktop cue (9026:1697); butt segment widths
// from the mobile cue (9026:2118), the only frame that shows the butt.
function CueArt() {
  return (
    <>
      <rect x="0.0355" y="-0.5" width="0.6455" height="1" fill="#FFDDD0" />
      <rect x="0.681" y="-0.5" width="0.0137" height="1" fill="#FFFFFF" />
      <rect x="0.6945" y="-0.5" width="0.3055" height="1" fill="#9E1717" />
      <rect x="0.0055" y="-0.5" width="0.0302" height="1" fill="#FFFFFF" />
      <rect x="0" y="-0.5" width="0.0058" height="1" fill="#A4CDF9" />
    </>
  );
}

export default function TableScene() {
  return (
    <div className="table-scene">
      <svg viewBox="-620 -640 1240 1280" width={1240} height={1280}>
        <defs>
          <clipPath id="table-felt">
            <circle r={TABLE_RADIUS} />
          </clipPath>
          <clipPath id="table-yellow-ball">
            <circle r="1" />
          </clipPath>
        </defs>

        {/* spotlight cone: screen-space, lands on the table's left/right edges */}
        <polygon
          aria-hidden
          className="table-cone"
          points={`-50.5,-615.4 72.5,-615.4 ${TABLE_RADIUS},0 ${-TABLE_RADIUS},0`}
          fill="#FFDB9F"
        />

        {/* everything lying on the felt, drawn top-down and squashed by the camera */}
        <g aria-hidden className="table-plane">
          <circle r={TABLE_RADIUS} fill="#D32525" />
          <g clipPath="url(#table-felt)" fill="#660000">
            {/* unit band like the cue, tapered at the tip end and placed by the light (see globals.css);
                runs on past x = 1 so the felt clip always ends it at the rim */}
            <g data-hero-cue className="table-cue-shadow opacity-0" style={cueVars}>
              <polygon points="0.0008,0.0947 1,-0.5 2,-0.5 2,0.4375 1,0.4375 0,0.5" />
            </g>
            {balls.map((ball) => (
              <circle
                key={ball.kind}
                data-ball-shadow={ball.kind}
                className="table-ball-shadow"
                style={ballVars(ball)}
                r="1"
              />
            ))}
          </g>
        </g>

        {/* balls stay round; the cue sits just behind the ball it's aimed at */}
        {balls.map((ball) => (
          <g key={ball.kind}>
            {ball === cueBall && (
              <g
                data-hero-cue
                data-pool-cue
                role="button"
                tabIndex={0}
                aria-label="Take the shot"
                className="table-cue cursor-pointer opacity-0"
                style={cueVars}
              >
                <CueArt />
              </g>
            )}
            <g
              aria-hidden
              data-ball={ball.kind}
              className={`table-ball ${ball === cueBall ? "cursor-pointer" : ""}`}
              style={ballVars(ball)}
            >
              <g className="table-ball-spin">
                <BallArt kind={ball.kind} />
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  );
}
