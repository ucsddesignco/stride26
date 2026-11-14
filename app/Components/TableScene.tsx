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

// The lamp: the apex of the light cone, whose base is the felt. The desktop
// cone's wings meet at screen (12.566, −812.555) (see the cone below), drawn at
// the tablet camera angle, where a point (x, 0, h) shows at (x, −h·c) with
// c = 0.97347. So the lamp hangs over x = 12.566, z = 0 at h = 812.555 / c.
// A point at height h is lit while it is less than
// TABLE_RADIUS · (1 − h / LAMP_H) from the lamp horizontally.
export const LAMP_X = 12.566;
export const LAMP_H = 812.555 / 0.97347; // ≈ 834.70

// The cone's outline on screen: the tablet polygon, and the desktop wings
// (see .table-cone-wing in globals.css). Drawn once as the haze and once as
// a clip that tints a ball's unlit side where it sits in front of the haze.
const CONE_POLYGON = `-50.5,-615.4 72.5,-615.4 ${TABLE_RADIUS},0 ${-TABLE_RADIUS},0`;
const CONE_WING_LEFT = `M12.566,-812.555 C12.366,-812.268 -508.479,-64.249 ${-TABLE_RADIUS},0 L11,0 Z`;
// The felt's front half on screen, plus everything above it between the table's
// sides: a ball is clipped to this, so it slides behind the front rim rather
// than going dark there (see .table-on-screen and PoolShot's drawLight).
const FRONT_CLIP = `M${-TABLE_RADIUS},0 A${TABLE_RADIUS},${TABLE_RADIUS} 0 0 0 ${TABLE_RADIUS},0 V-100000 H${-TABLE_RADIUS} Z`;
const CONE_WING_RIGHT = `M12.566,-812.555 C12.566,-812.555 ${TABLE_RADIUS},-64.261 ${TABLE_RADIUS},0 L11,0 Z`;

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

// At the tilted angles things are drawn bigger toward the viewer. This is that
// growth in world px of radius per world px of depth (blue → white in the frame).
export const DEPTH_SLOPE = 0.0176;

const cueVars = { ...ballVars(cueBall), "--depth-slope": DEPTH_SLOPE } as CSSProperties;

// A ball's off-white spot. At rest it's the art's circle, written as a path:
// as the ball rolls, PoolShot rewrites d with the spot's true outline on the
// sphere, reading where it rests from the data attributes.
function BallSpot({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <path
      data-ball-spot
      data-u={cx}
      data-v={cy}
      data-r={r}
      d={`M${cx - r},${cy}A${r},${r} 0 1 0 ${cx + r},${cy}A${r},${r} 0 1 0 ${cx - r},${cy}Z`}
      fill="#FCFFF2"
    />
  );
}

// Ball artwork, drawn on a unit circle (scaled to the ball radius in CSS).
function BallArt({ kind }: { kind: Ball["kind"] }) {
  switch (kind) {
    case "yellow":
      return (
        <>
          <circle r="1" fill="#F4F48F" />
          <g clipPath="url(#table-ball-clip)">
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
          <g clipPath="url(#table-ball-clip)">
            <BallSpot cx={-0.28} cy={-0.095} r={0.4953} />
          </g>
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
          <g clipPath="url(#table-ball-clip)">
            <BallSpot cx={0.238} cy={-0.21} r={0.4952} />
          </g>
        </>
      );
  }
}

// A ball's unlit side on its unit circle: black, a dim copy of the ball's
// colour over the felt (PoolShot sets its fill), or in the cone's haze colour (its opacity is the
// cone's, see .table-ball-haze-layer).
function BallDark({ haze = false }: { haze?: boolean }) {
  return (
    <path
      data-ball-dark
      className="table-ball-dark"
      clipPath="url(#table-ball-dark-clip)"
      fillRule="evenodd"
      fill={haze ? "#FFDB9F" : "black"}
    />
  );
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
      {/* keyboard focus outline, about 2px clear of the band (see globals.css) */}
      <rect
        className="table-cue-focus"
        x="-0.0038"
        y="-0.62"
        width="1.0076"
        height="1.24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      />
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
          {/* a ball's unit circle: keeps stripes and rolling spots on the ball */}
          <clipPath id="table-ball-clip">
            <circle r="1" />
          </clipPath>
          {/* a ball's dark side reaches 2% past its outline, over the ball's
              antialiased edge, which would otherwise show as a faint ring; past
              the ball that's a hairline of its dim colour or haze */}
          <clipPath id="table-ball-dark-clip">
            <circle r="1.02" />
          </clipPath>
          {/* the felt on screen (squashed like .table-plane), and the front
              rim's clip: both in the balls' screen space */}
          <clipPath id="table-felt-screen">
            <circle className="table-on-screen" r={TABLE_RADIUS} />
          </clipPath>
          <clipPath id="table-front-clip">
            <path className="table-on-screen" d={FRONT_CLIP} />
          </clipPath>
          {/* the white ball's own copy, moved down by how far its drawn bottom
              hangs below where it touches the felt (PoolShot writes
              --overhang), so it goes behind the rim once that touch point does */}
          <clipPath id="table-front-clip-white">
            <path data-front-clip-white className="table-front-clip-white" d={FRONT_CLIP} />
          </clipPath>
          {/* the cone's screen shape, moved by the same CSS as the haze below */}
          <clipPath id="table-cone-clip">
            <polygon points={CONE_POLYGON} />
            <path className="table-cone-wing table-cone-wing-left" d={CONE_WING_LEFT} />
            <path className="table-cone-wing table-cone-wing-right" d={CONE_WING_RIGHT} />
          </clipPath>
        </defs>

        {/* spotlight cone: screen-space, lands on the table's left/right edges.
            The polygon is the tablet cone. The wings are the two halves of the
            desktop cone (Figma 9026:2309 in world px, split down the table's
            center line): curved edges that meet at a point above the frame.
            They are flattened onto the polygon's edges at tablet width and
            open out toward desktop (see .table-cone-wing in globals.css).
            One group, so the overlapping shapes share a single opacity. */}
        <g aria-hidden className="table-cone" fill="#FFDB9F">
          <polygon points={CONE_POLYGON} />
          <path className="table-cone-wing table-cone-wing-left" d={CONE_WING_LEFT} />
          <path className="table-cone-wing table-cone-wing-right" d={CONE_WING_RIGHT} />
        </g>

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
            {/* cut at the front rim on screen: a ball crossing it isn't lit by
                the lamp, so it slides behind the rim instead */}
            <g
              clipPath={
                ball === cueBall
                  ? "url(#table-front-clip-white)"
                  : ball.kind !== "yellow"
                    ? "url(#table-front-clip)"
                    : undefined
              }
            >
              <g
                aria-hidden
                data-ball={ball.kind}
                className={`table-ball ${ball === cueBall ? "cursor-pointer" : ""}`}
                style={ballVars(ball)}
              >
                {/* only the white ball's face turns flat (--spin); the blue and
                    eight roll their spot instead, and yellow never moves */}
                {ball === cueBall ? (
                  <g className="table-ball-spin">
                    <BallArt kind={ball.kind} />
                  </g>
                ) : (
                  <BallArt kind={ball.kind} />
                )}
                {/* the side out of the lamp's light (PoolShot writes d); empty
                    while lit. Black, so off the felt it's lost in the page. */}
                {ball.kind !== "yellow" && <BallDark />}
              </g>
            </g>
            {/* the same unlit side in a dim copy of the ball's colour, only
                where the ball is over the felt: a black side there read as a hole */}
            {ball.kind !== "yellow" && (
              <g aria-hidden clipPath="url(#table-felt-screen)">
                <g data-ball-felt={ball.kind} className="table-ball-felt" style={ballVars(ball)}>
                  <BallDark />
                </g>
              </g>
            )}
            {/* the same unlit side again in the cone's haze, shown only where the
                ball is in front of the cone, so a ball leaving out the back fades
                into the haze rather than turning into a black disc. Past the
                back rim the ball is behind the cone, so the disc hazes its lit
                side too (PoolShot writes --behind). The shapes are opaque and
                the layer carries the cone's opacity, so where they overlap the
                haze isn't applied twice. */}
            {ball.kind !== "yellow" && (
              <g aria-hidden clipPath="url(#table-cone-clip)" className="table-ball-haze-layer">
                <g data-ball-haze={ball.kind} className="table-ball-haze" style={ballVars(ball)}>
                  <circle className="table-ball-behind" r="1" fill="#FFDB9F" />
                  <BallDark haze />
                </g>
              </g>
            )}
          </g>
        ))}

        {/* "Click me" beside the smiley (Figma 9346:258), until the first shot:
            PoolShot marks it data-dismissed. Laid out in screen px from the
            text's top right corner, which .table-hint in globals.css places in
            ball radii from the ball and holds at one size at every width. The
            arrow is the Figma vector in its 20.871 × 16.779 box (the file adds
            1px for the stroke), turned as in the frame; the frame has the
            label on the ball's right, so the leading scale(-1 1) mirrors it. */}
        <g aria-hidden data-pool-hint className="table-hint" style={ballVars(cueBall)}>
          <text className="table-hint-text font-sans" y="14.5" fontSize="16" fill="#FFFFFF" textAnchor="end">
            Click me
          </text>
          <image
            href="/hero/click-me-arrow.svg"
            x="-1"
            y="-1"
            width="23.3978"
            height="18.7789"
            transform="scale(-1 1) translate(24.061 30.495) rotate(173.64) scale(1 -1) translate(-10.4355 -8.3895)"
          />
        </g>
      </svg>
    </div>
  );
}
