"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";
import Calendar from "./Calendar";

const introImages = [
  {
    src: "/intro/intro-1.webp",
    alt: "STRIDE Design Expo installation",
  },
  {
    src: "/intro/intro-2.webp",
    alt: "Visitors exploring STRIDE Design Expo",
  },
  {
    src: "/intro/intro-3.webp",
    alt: "Design work at STRIDE Design Expo",
  },
  {
    src: "/intro/intro-4.webp",
    alt: "STRIDE Design Expo showcase",
  },
  {
    src: "/intro/intro-5.webp",
    alt: "Visitors at STRIDE Design Expo",
  },
  {
    src: "/intro/intro-6.webp",
    alt: "STRIDE Design Expo event space",
  },
];

export default function AboutSection() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % introImages.length);
    }, 4500);

    return () => window.clearInterval(interval);
  }, []);

  const title = "STRIDE Design Expo";
  const location = "9510 Innovation Ln, La Jolla, CA 92093";
  const description =
    "Join STRIDE, Design Co's design expo and networking event for UCSD students, industry professionals, and student designers.";
  const start = "20261118T183000";
  const end = "20261118T210000";
  const calendarUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}&ctz=America%2FLos_Angeles&sf=true&output=xml`;

  return (
    <section
      id="about"
      className="py-16 min-[744px]:py-24 min-[1280px]:py-30 max-w-7xl mx-auto px-10 min-[744px]:px-20 min-[1280px]:px-30"
    >
      <div className="grid grid-cols-1 min-[1280px]:grid-cols-2 gap-8 min-[744px]:gap-12 items-center">
        <div>
          <div className="relative w-full h-[220px] min-[744px]:h-[280px] min-[1280px]:h-[320px] overflow-hidden">
            <AnimatePresence mode="sync">
              <motion.div
                key={activeSlide}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: "easeInOut" }}
              >
                <Image
                  src={introImages[activeSlide].src}
                  alt={introImages[activeSlide].alt}
                  fill
                  sizes="(min-width: 1280px) 50vw, 100vw"
                  className="object-cover"
                  priority={activeSlide === 0}
                />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="pt-4 flex w-full justify-center gap-[8px]">
            {introImages.map((image, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Show ${image.alt}`}
                aria-pressed={activeSlide === index}
                onClick={() => setActiveSlide(index)}
                className={`h-[8px] w-[8px] cursor-pointer rounded-full transition-colors duration-300 ${
                  activeSlide === index ? "bg-white" : "bg-neutral-700"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <h2 className="text-3xl font-display text-white">
            STRIDE is Design Co’s unique design expo.
          </h2>
          <div className="flex items-center gap-2 font-sans underline">
            November 18 | DIB 208
            <a className="inline-flex items-center" href={calendarUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#ffffff" }}>
              <Calendar style={{ color: "#ffffff", strokeWidth: 1.5 }} />
            </a>
          </div>
          <p className="text-gray-300 font-sans leading-5">
            STRIDE is a design expo and networking event connecting UCSD
            students with industry professionals, student ambassadors, and
            peers interested in design. The event will provide an opportunity
            to explore career paths, learn about design tools and industry
            opportunities, and build meaningful professional connections in a
            casual, interactive environment.
          </p>
        </div>
      </div>
    </section>
  );
}
