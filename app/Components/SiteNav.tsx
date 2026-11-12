"use client";

import ArrowIcon from "./ArrowIcon";

function scrollToSection(
  event: React.MouseEvent<HTMLAnchorElement>,
  sectionId: string,
) {
  event.preventDefault();

  const section = document.getElementById(sectionId);
  if (!section) return;

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const navigation = document.querySelector("nav");
  const navigationHeight = navigation?.getBoundingClientRect().height ?? 0;
  const sectionTop =
    section.getBoundingClientRect().top + window.scrollY - navigationHeight - 16;

  window.scrollTo({
    top: Math.max(sectionTop, 0),
    behavior: prefersReducedMotion ? "auto" : "smooth",
  });

  window.history.pushState(null, "", `#${sectionId}`);
}

export default function SiteNav() {
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="flex items-center gap-2">
        <ArrowIcon />
        <span className="font-display">DESIGN CO</span>
      </div>
      <div className="hidden min-[744px]:flex items-center space-x-8 text-sm font-display text-white">
        <a href="#about" onClick={(event) => scrollToSection(event, "about")} className="hover:text-gray-300 transition-colors">About</a>
        <a href="#agenda" onClick={(event) => scrollToSection(event, "agenda")} className="hover:text-gray-300 transition-colors">Agenda</a>
        <a href="#attendees" onClick={(event) => scrollToSection(event, "attendees")} className="hover:text-gray-300 transition-colors">Attendees</a>
        <a href="#faq" onClick={(event) => scrollToSection(event, "faq")} className="hover:text-gray-300 transition-colors">FAQ</a>
      </div>
    </nav>
  );
}
