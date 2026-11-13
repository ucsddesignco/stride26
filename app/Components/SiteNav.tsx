"use client";

import ArrowIcon from "./ArrowIcon";
import { useEffect, useState } from "react";

// Figma's nav bar height (9026:1632). The bar is fixed over the top of the hero.
const NAV_HEIGHT = 82;
// Gap left above a section when a nav link scrolls to it
const SECTION_GAP = 32;
// Scroll moves smaller than this don't hide or show the bar
const SCROLL_TOLERANCE = 5;

/** Headroom: true while the bar should be slid out of view. It hides on a
    downward scroll, comes back on an upward one, and never hides within the
    first NAV_HEIGHT px of the page. */
function useHiddenOnScrollDown() {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = window.scrollY;
      if (y <= NAV_HEIGHT) {
        setIsHidden(false);
      } else if (Math.abs(y - lastY) >= SCROLL_TOLERANCE) {
        setIsHidden(y > lastY);
      } else {
        return;
      }
      lastY = y;
    };
    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return isHidden;
}

export default function SiteNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // keyboard focus inside the bar keeps it on screen
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  const isScrolledAway = useHiddenOnScrollDown();
  const isHidden = isScrolledAway && !isMenuOpen && !hasKeyboardFocus;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const scrollToSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
    sectionId: string,
  ) => {
    event.preventDefault();

    const section = document.getElementById(sectionId);
    if (!section) return;

    setIsMenuOpen(false);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    // Scrolling up brings the bar back, and keyboard focus keeps it there:
    // in both cases the section has to stop below it.
    const sectionTop = section.getBoundingClientRect().top;
    const barStays =
      sectionTop < 0 || event.currentTarget.matches(":focus-visible");
    const offset = SECTION_GAP + (barStays ? NAV_HEIGHT : 0);

    window.scrollTo({
      top: Math.max(sectionTop + window.scrollY - offset, 0),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    window.history.pushState(null, "", `#${sectionId}`);
  };

  return (
    <nav
      onFocus={(event) => setHasKeyboardFocus(event.target.matches(":focus-visible"))}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasKeyboardFocus(false);
      }}
      className={`fixed inset-x-0 top-0 z-50 flex h-[82px] items-center justify-between bg-black px-8 transition-transform duration-300 ease-out motion-reduce:transition-none ${
        isHidden ? "-translate-y-full" : ""
      }`}
    >
      <a href="https://designatucsd.com/" target="_blank">
        <div className="flex items-center gap-2">
          <ArrowIcon />
          <span className="font-display">DESIGN CO</span>
        </div>
      </a>
      <div className="hidden min-[744px]:flex items-center space-x-8 text-base font-display text-white">
        <a
          href="#about"
          onClick={(event) => scrollToSection(event, "about")}
          className="hover:text-gray-300 transition-colors"
        >
          About
        </a>
        <a
          href="#agenda"
          onClick={(event) => scrollToSection(event, "agenda")}
          className="hover:text-gray-300 transition-colors"
        >
          Agenda
        </a>
        <a
          href="#attendees"
          onClick={(event) => scrollToSection(event, "attendees")}
          className="hover:text-gray-300 transition-colors"
        >
          Attendees
        </a>
        <a
          href="#faq"
          onClick={(event) => scrollToSection(event, "faq")}
          className="hover:text-gray-300 transition-colors"
        >
          FAQ
        </a>
      </div>

      <button
        type="button"
        aria-label={
          isMenuOpen ? "Close navigation menu" : "Open navigation menu"
        }
        aria-expanded={isMenuOpen}
        aria-controls="mobile-navigation"
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
        className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 min-[744px]:hidden"
      >
        <span
          className={`h-0.5 w-6 bg-white transition-transform duration-300 ease-in-out ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
        />
        <span
          className={`h-0.5 w-6 bg-white transition-opacity duration-200 ease-in-out ${isMenuOpen ? "opacity-0" : ""}`}
        />
        <span
          className={`h-0.5 w-6 bg-white transition-transform duration-300 ease-in-out ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
        />
      </button>

      <div
        id="mobile-navigation"
        aria-hidden={!isMenuOpen}
        className={`absolute left-0 top-full flex w-full flex-col gap-6 overflow-hidden border-b border-white/10 bg-black px-8 text-base font-display will-change-[max-height,opacity,transform] transform-gpu transition-[max-height,opacity,transform,padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none min-[744px]:hidden ${
          isMenuOpen
            ? "pointer-events-auto max-h-96 translate-y-0 py-6 opacity-100"
            : "pointer-events-none max-h-0 -translate-y-2 py-0 opacity-0"
        }`}
      >
        <a href="#about" onClick={(event) => scrollToSection(event, "about")}>
          About
        </a>
        <a href="#agenda" onClick={(event) => scrollToSection(event, "agenda")}>
          Agenda
        </a>
        <a
          href="#attendees"
          onClick={(event) => scrollToSection(event, "attendees")}
        >
          Attendees
        </a>
        <a href="#faq" onClick={(event) => scrollToSection(event, "faq")}>
          FAQ
        </a>
      </div>
    </nav>
  );
}
