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

type Star = typeof RED & { box: string };

// Figma 9026:1631
const desktopStars: Star[] = [
  { ...RED, box: "left-[45px] top-[132px] size-[48px]" },
  { ...RED, box: "left-[866px] top-[300px] size-[48px]" },
  { ...YELLOW, box: "left-[657px] top-[84px] size-[61px]" },
  { ...BLUE, box: "left-[1119px] top-[175px] size-[92px]" },
  { ...BLUE, box: "left-[146px] top-[505px] size-[92px]" },
];

// Figma 9026:1895
const tabletStars: Star[] = [
  { ...RED, box: "left-[136px] top-[26.34px] size-[37px]" },
  { ...RED, box: "left-[740px] top-[318px] size-[37px]" },
  { ...YELLOW, box: "left-[623px] top-[75.34px] size-[61px]" },
  { ...BLUE, box: "left-[78px] top-[380.34px] size-[92px]" },
];

// Figma 9026:2063
const mobileStars: Star[] = [
  { ...RED, box: "left-[46px] top-[45.34px] size-[37px]" },
  { ...RED, box: "left-[300px] top-[671.34px] size-[37px]" },
  { ...YELLOW, box: "left-[306px] top-[45.34px] size-[61px]" },
  { ...BLUE, box: "left-[112px] top-[606.34px] size-[92px]" },
];

function Stars({ stars }: { stars: Star[] }) {
  return stars.map((star, i) => (
    <div key={i} aria-hidden className={`absolute ${star.box}`}>
      <div className={`absolute ${star.inset}`}>
        <Image
          src={star.src}
          alt=""
          width={star.w}
          height={star.h}
          className="block size-full max-w-none"
        />
      </div>
    </div>
  ));
}

// "Stride" with the dot over the i. Sized by font-size so it scales per stage.
function Wordmark({ className }: { className: string }) {
  return (
    <h1 data-hero-glow-title className={`relative whitespace-nowrap font-display leading-[1.4756] text-cream ${className}`}>
      Stride
      <Image
        src="/hero/stride-dot.svg"
        alt=""
        aria-hidden
        data-hero-glow-dot
        width={41.6614}
        height={41.6614}
        className="absolute left-[1.5441em] top-[0.4228em] size-[0.2637em] max-w-none"
      />
    </h1>
  );
}

function EventDetails({ date, iconClassName = "" }: { date: string; iconClassName?: string }) {
  return (
    <div className="flex flex-col gap-[9px] font-sans text-[16px] leading-none text-white">
      <p className="flex items-center gap-[8px]">
        <span className="whitespace-pre underline">{date}</span>
        <CalendarIcon className={iconClassName} />
      </p>
      <p className="flex items-center gap-[8px]">
        <span className="underline">DIB 208</span>
        <LocationIcon className={iconClassName} />
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
// TODO: real hrefs for the calendar invite and the map.
function DesktopEventDetails() {
  const link =
    "flex items-center gap-[8px] whitespace-nowrap font-plak text-[14px] underline decoration-from-font [text-underline-position:from-font] opacity-80";
  return (
    <div className="mt-[4px] flex w-full items-center justify-between font-sans text-[16px] leading-[normal] text-white">
      <div className="flex w-[326.505px] flex-col items-start gap-[4px]">
        <p className="whitespace-pre">{"Wednesday, November 18  |  6:30-9:00 PM"}</p>
        <a href="#" className={link}>
          <CalendarIcon />
          Add to Calendar
        </a>
      </div>
      <div className="flex w-[285.959px] flex-col items-start gap-[4px]">
        <p>DIB 208</p>
        <a href="#" className={link}>
          <LocationIcon />
          View in Maps
        </a>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative h-[760px] w-full overflow-clip bg-black">
      <HeroIntro>
        {/* table light (flickers on). The black overlay dims the scene like
            brightness() would, but animates on the compositor (see HeroIntro). */}
        <div data-hero-light className="absolute inset-0 opacity-[0.08]">
          <PoolShot>
            <TableScene />
          </PoolShot>
          <div data-hero-dim aria-hidden className="pointer-events-none absolute inset-0 bg-black opacity-70" />
        </div>

        {/* desktop */}
        <div className="absolute left-1/2 top-0 hidden h-full w-[1280px] -translate-x-1/2 pointer-events-none lg:block">
          <div data-hero-text className="absolute left-[110px] top-[115px] w-[621px] opacity-0 [&_a]:pointer-events-auto">
            <Wordmark className="text-[142.907px] [text-shadow:0_0_15.5px_rgba(255,255,255,0.65)]" />
            <DesktopEventDetails />
          </div>
          <Stars stars={desktopStars} />
        </div>

        {/* tablet */}
        <div className="absolute left-1/2 top-0 hidden h-full w-[744px] -translate-x-1/2 pointer-events-none sm:block lg:hidden">
          <div data-hero-text className="absolute left-[75px] top-[42.34px] opacity-0 [&_a]:pointer-events-auto">
            <Wordmark className="text-[138.93px]" />
            <EventDetails date={"Wednesday, November 18  |  6:30-9:00 PM"} iconClassName="opacity-80" />
          </div>
          <Stars stars={tabletStars} />
        </div>

        {/* mobile */}
        <div className="absolute left-1/2 top-0 h-full w-[390px] -translate-x-1/2 pointer-events-none sm:hidden">
          <div data-hero-text className="absolute left-[36px] top-[275px] flex flex-col gap-[2px] opacity-0 [&_a]:pointer-events-auto">
            <Wordmark className="text-[95.5px]" />
            <EventDetails date={"Wed, November 18  |  6:30-9:00 PM"} />
          </div>
          <Stars stars={mobileStars} />
        </div>
      </HeroIntro>
    </section>
  );
}
