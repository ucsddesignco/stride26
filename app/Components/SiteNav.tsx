"use client";

import ArrowIcon from "./ArrowIcon";
import { useEffect, useState } from "react";

export default function SiteNav() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    const navigation = document.querySelector("nav");
    const navigationHeight = navigation?.getBoundingClientRect().height ?? 0;
    const sectionTop =
      section.getBoundingClientRect().top + window.scrollY - 32;

    window.scrollTo({
      top: Math.max(sectionTop, 0),
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });

    window.history.pushState(null, "", `#${sectionId}`);
  };

  return (
    <nav className="relative sticky top-0 z-50 flex items-center justify-between border-b border-white/10 bg-black/80 px-8 py-4 backdrop-blur-md">
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
