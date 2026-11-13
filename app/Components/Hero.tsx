import Image from "next/image";
import HeroIntro from "./HeroIntro";
import PoolShot from "./PoolShot";
import TableScene from "./TableScene";

// The hero has three fixed-size stages (desktop 1280, tablet 744, mobile 390),
// each centered and swapped at a breakpoint. Only the pool table scene moves
// continuously with width, desktop → tablet → mobile (see TableScene).
// HeroIntro plays the entrance: glowing title, table light flicker, cue slide.
// Then PoolShot lets you take the shot; the stages above the table pass
// pointer events through to it, except on their links.

// Star decorations. `inset` is the star's offset within its square bounding box.
const STAR_INSET_LG = "inset-[8.23%_8.82%_10.56%_8.82%]";
const STAR_INSET_SM = "inset-[8.9%_9.47%_11.18%_9.47%]";

const RED = { src: "/hero/star-red.svg", w: 29.9892, h: 29.5714, inset: STAR_INSET_SM };
const YELLOW = { src: "/hero/star-yellow-1.svg", w: 50.239, h: 49.5335, inset: STAR_INSET_LG };
const BLUE = { src: "/hero/star-blue.svg", w: 75.7703, h: 74.7063, inset: STAR_INSET_LG };

// `spin` is one full turn and `delay` a negative start offset. Each differs per
// star so they drift out of step instead of turning together like gears.
// `twinkle` is one shrink (a full loop is twice that) and `twinkleDelay` its
// start offset, spread across the loop so the stars don't pulse together.
type Star = typeof RED & {
  box: string;
  spin: string;
  delay: string;
  twinkle: string;
  twinkleDelay: string;
};

// Figma 9026:1631
const desktopStars: Star[] = [
  { ...RED, box: "left-[45px] top-[132px] size-[48px]", spin: "12.5s", delay: "0s", twinkle: "4s", twinkleDelay: "0s" },
  { ...RED, box: "left-[866px] top-[300px] size-[48px]", spin: "11.5s", delay: "-0.3s", twinkle: "3.5s", twinkleDelay: "-3.2s" },
  { ...YELLOW, box: "left-[657px] top-[84px] size-[61px]", spin: "13.5s", delay: "-0.6s", twinkle: "4.5s", twinkleDelay: "-6.5s" },
  { ...BLUE, box: "left-[1119px] top-[187.5px] size-[67px]", spin: "12s", delay: "-0.9s", twinkle: "3.75s", twinkleDelay: "-2.5s" },
  { ...BLUE, box: "left-[146px] top-[505px] size-[92px] rotate-[13.61deg]", spin: "13s", delay: "-1.2s", twinkle: "4.25s", twinkleDelay: "-6.1s" },
];

// Figma 9026:1895
const tabletStars: Star[] = [
  { ...RED, box: "left-[136px] top-[26.34px] size-[37px]", spin: "12.5s", delay: "0s", twinkle: "4s", twinkleDelay: "0s" },
  { ...RED, box: "left-[740px] top-[318px] size-[37px]", spin: "11.5s", delay: "-0.3s", twinkle: "3.5s", twinkleDelay: "-3.2s" },
  { ...YELLOW, box: "left-[623px] top-[75.34px] size-[61px]", spin: "13.5s", delay: "-0.6s", twinkle: "4.5s", twinkleDelay: "-6.5s" },
  { ...BLUE, box: "left-[78px] top-[380.34px] size-[92px]", spin: "12s", delay: "-0.9s", twinkle: "3.75s", twinkleDelay: "-2.5s" },
];

// Figma 9026:2071
const mobileStars: Star[] = [
  { ...RED, box: "left-[112px] top-[0.34px] size-[37px]", spin: "12.5s", delay: "0s", twinkle: "4s", twinkleDelay: "0s" },
  { ...RED, box: "left-[300px] top-[671.34px] size-[37px]", spin: "11.5s", delay: "-0.3s", twinkle: "3.5s", twinkleDelay: "-3.2s" },
  { ...YELLOW, box: "left-[306px] top-[45.34px] size-[61px]", spin: "13.5s", delay: "-0.6s", twinkle: "4.5s", twinkleDelay: "-6.5s" },
  { ...BLUE, box: "left-[112px] top-[606.34px] size-[92px] rotate-[7.8deg]", spin: "12s", delay: "-0.9s", twinkle: "3.75s", twinkleDelay: "-2.5s" },
];

// The art has nine points, so its true center sits below its box center (51.43%
// down, measured from the SVG paths). Spinning around it keeps the star from
// wobbling. The spin is on the inner div so it adds to a box's static tilt.
function Stars({ stars }: { stars: Star[] }) {
  return stars.map((star, i) => (
    <div key={i} aria-hidden className={`absolute ${star.box}`}>
      <div
        className={`absolute ${star.inset} origin-[50%_51.43%] motion-safe:animate-star-spin`}
        style={{ animationDuration: star.spin, animationDelay: star.delay }}
      >
        <Image
          src={star.src}
          alt=""
          width={star.w}
          height={star.h}
          className="block size-full max-w-none origin-[50%_51.43%] motion-safe:animate-star-twinkle"
          style={{ animationDuration: star.twinkle, animationDelay: star.twinkleDelay }}
        />
      </div>
    </div>
  ));
}

// "Stride" with the dot over the i. Sized by font-size (--wordmark-size, blended
// with width in globals.css); the dot is in em so it follows. The text-shadow is
// its resting glow at every size; HeroIntro brightens it and settles back to it.
// The dot starts with HeroIntro's glow-off filter (dotGlow(0)), not none:
// framer-motion can't build a starting keyframe for nested drop-shadows from none.
function Wordmark({ className = "" }: { className?: string }) {
  return (
    <h1 data-hero-glow-title className={`hero-wordmark relative whitespace-nowrap font-display leading-[1.4756] text-cream [text-shadow:0_0_15.5px_rgba(255,255,255,0.65)] ${className}`}>
      Stride
      <Image
        src="/hero/stride-dot.svg"
        alt=""
        aria-hidden
        data-hero-glow-dot
        width={41.6614}
        height={41.6614}
        className="absolute left-[1.5441em] top-[0.4228em] size-[0.2637em] max-w-none [filter:drop-shadow(0_0_4px_rgba(164,205,249,0))_drop-shadow(0_0_12px_rgba(164,205,249,0))]"
      />
    </h1>
  );
}

const CALENDAR_HREF = "/stride-2026.ics";
const MAPS_HREF =
  "https://www.google.com/maps/search/?api=1&query=Design%20and%20Innovation%20Building%2C%20UC%20San%20Diego";

// Stretches a link's hit area to at least 24px tall without moving the layout.
const LINK_HIT_AREA = "relative before:absolute before:inset-x-0 before:-inset-y-[2px]";

// Tablet and mobile: the date and place rows are themselves the action links.
function EventDetails({
  date,
  iconClassName = "",
  className = "",
}: {
  date: string;
  iconClassName?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-[9px] font-sans text-[16px] leading-none text-white ${className}`}>
      <p>
        <a
          href={CALENDAR_HREF}
          download
          aria-label={`${date}, Add to Calendar`}
          className={`flex w-fit items-center gap-[8px] ${LINK_HIT_AREA}`}
        >
          <span className="whitespace-pre underline">{date}</span>
          <CalendarIcon className={iconClassName} />
        </a>
      </p>
      <p>
        <a
          href={MAPS_HREF}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="DIB 208, View in Maps"
          className={`flex w-fit items-center gap-[8px] ${LINK_HIT_AREA}`}
        >
          <span className="underline">DIB 208</span>
          <LocationIcon className={iconClassName} />
        </a>
      </p>
    </div>
  );
}

function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`relative size-[20px] shrink-0 ${className}`}>
      <Image
        src="/hero/icon-calendar-add.svg"
        alt=""
        aria-hidden
        width={15.5026}
        height={15.8327}
        className="absolute left-[2.83px] top-[2.5px] max-w-none"
      />
    </span>
  );
}

function LocationIcon({ className = "" }: { className?: string }) {
  return (
    <span className={`relative size-[20px] shrink-0 ${className}`}>
      <Image
        src="/hero/icon-location.svg"
        alt=""
        aria-hidden
        width={14.3333}
        height={17.7734}
        className="absolute left-[2.83px] top-[1.17px] max-w-none"
      />
    </span>
  );
}

// Desktop lays the date and place side by side, each with an action link below.
function DesktopEventDetails() {
  const link = `flex items-center gap-[8px] whitespace-nowrap font-plak text-[14px] underline decoration-from-font [text-underline-position:from-font] opacity-80 ${LINK_HIT_AREA}`;
  return (
    <div className="mt-[4px] flex w-full items-center justify-between font-sans text-[16px] leading-[normal] text-white">
      <div className="flex w-[326.505px] flex-col items-start gap-[4px]">
        <p className="whitespace-pre">{"Wednesday, November 18  |  6:30-9:00 PM"}</p>
        <a href={CALENDAR_HREF} download className={link}>
          <CalendarIcon />
          Add to Calendar
        </a>
      </div>
      <div className="flex w-[285.959px] flex-col items-start gap-[4px]">
        <p>DIB 208</p>
        <a href={MAPS_HREF} target="_blank" rel="noopener noreferrer" className={link}>
          <LocationIcon />
          View in Maps
        </a>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="hero-fluid relative h-[760px] w-full overflow-clip bg-black">
      <HeroIntro>
        {/* table light (flickers on). The black overlay dims the scene like
            brightness() would, but animates on the compositor (see HeroIntro). */}
        <div data-hero-light className="absolute inset-0 opacity-[0.08]">
          <PoolShot>
            <TableScene />
          </PoolShot>
          <div data-hero-dim aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-70" />
        </div>

        {/* star stages: fixed-size frames centered per breakpoint */}
        <div className="absolute left-1/2 top-0 hidden h-full w-[1280px] -translate-x-1/2 pointer-events-none lg:block">
          <Stars stars={desktopStars} />
        </div>
        <div className="absolute left-1/2 top-0 hidden h-full w-[744px] -translate-x-1/2 pointer-events-none sm:block lg:hidden">
          <Stars stars={tabletStars} />
        </div>
        <div className="hero-stars-mobile absolute left-1/2 top-0 h-full w-[390px] -translate-x-1/2 pointer-events-none sm:hidden">
          <Stars stars={mobileStars} />
        </div>

        {/* Text is pinned to the section's edges, not the centered stages, so
            it never clips when the viewport is narrower than its stage. Its
            position and wordmark size blend between the frames with width
            (.hero-text in globals.css); the wordmark holds its tablet size
            until it reaches the side padding, then shrinks to fit. */}

        {/* desktop */}
        <div
          data-hero-text
          className="pointer-events-none hero-text absolute z-10 hidden w-[621px] opacity-0 lg:block [&_a]:pointer-events-auto"
        >
          <Wordmark />
          <DesktopEventDetails />
        </div>

        {/* tablet */}
        <div
          data-hero-text
          className="pointer-events-none hero-text absolute z-10 hidden opacity-0 sm:block lg:hidden [&_a]:pointer-events-auto"
        >
          <Wordmark />
          <EventDetails date={"Wednesday, November 18  |  6:30-9:00 PM"} iconClassName="opacity-80" />
        </div>

        {/* mobile: the block is centered (middle at y 310 at 390px); the details
            are left-aligned with the wordmark */}
        <div
          data-hero-text
          className="pointer-events-none hero-text absolute z-10 flex flex-col items-start gap-[2px] opacity-0 sm:hidden [&_a]:pointer-events-auto"
        >
          <Wordmark />
          <EventDetails date={"Wed, November 18  |  6:30-9:00 PM"} />
        </div>
      </HeroIntro>
    </section>
  );
}
