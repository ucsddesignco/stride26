"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

// FAQ star layout. Each star has a position and scale for the three art-directed
// breakpoints: mobile (<744px), tablet (744px–1279px), and desktop (1280px+).
// Tune the left/top/size values here without needing to change the FAQ markup.
const faqStars = [
  {
    src: "/hero/star-red.svg",
    className:
      "left-[5%] top-[192px] size-[30px] min-[744px]:right-[106.5%] min-[744px]:top-[192px] min-[744px]:size-[33px] min-[1280px]:left-[8%] min-[1280px]:top-[192px] min-[1280px]:size-[32px]",
  },
  {
    src: "/hero/star-blue.svg",
    className:
      "right-[13%] top-[30px] size-[58px] min-[744px]:left-[38%] min-[744px]:top-[24px] min-[744px]:size-[64px] min-[1280px]:right-[10%] min-[1280px]:top-[20px] min-[1280px]:size-[64px]",
  },
  {
    src: "/hero/star-yellow-1.svg",
    className:
      "right-[4%] top-[245px] size-[42px] min-[744px]:right-[5%] min-[744px]:top-[220px] min-[744px]:size-[50px] min-[1280px]:right-[7%] min-[1280px]:top-[205px] min-[1280px]:size-[54px]",
  },
] as const;

const faqData = [
  {
    id: "1",
    question: "Who can participate?",
    answer:
      "UCSD students of all majors and backgrounds are more than welcome to attend! Whether you’re interested in design or simply want to get your foot in the door with networking, we’d love to see you there! No prior experience is required.",
  },
  {
    id: "2",
    question: "What's in it for me?",
    answer:
      "Networking, community building, and a head start on breaking into the industry. During your night at STRIDE, you’ll get the opportunity to speak 1-on-1 with industry professionals while connecting with like-minded peers who share similar design interests.",
  },
  {
    id: "3",
    question: "What will the event look like?",
    answer:
      "STRIDE is a design exposition and networking event where UCSD students can connect with industry professionals and learn about upcoming opportunities in UX/UI, product design, and related fields. There will be a speaker panel, a design project showcase, structured networking time, and more.",
  },
];

export default function FAQ() {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleAccordion = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <section id="faq" className="relative w-full overflow-clip pb-30">
      {/* Centered container with max-width and your 120px (px-30) padding */}
      <div className="relative mx-auto max-w-7xl px-10 min-[744px]:px-20 min-[1280px]:px-30">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[320px]" aria-hidden="true">
          {faqStars.map((star) => (
            <div key={star.src} className={`absolute ${star.className}`}>
              <Image src={star.src} alt="" fill className="object-contain" />
            </div>
          ))}
        </div>

        <h2 className="relative z-10 pb-6 text-3xl font-display text-white">
          FAQ
        </h2>

        <div className="relative z-10">
          {faqData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="border border-white bg-black overflow-hidden [&:not(:first-child)]:border-t-0 font-sans"
              >
                <button
                  onClick={() => toggleAccordion(item.id)}
                  className="w-full flex items-center justify-between p-6 text-left font-medium text-white cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg">{item.question}</span>
                  
                  {/* Icon Container */}
                  <div className="relative w-4 h-4 flex items-center justify-center shrink-0 ml-4">
                    {/* Horizontal bar (stays flat) */}
                    <span className="absolute w-full h-[2px] bg-white rounded-full" />
                    
                    {/* Vertical bar rotates 90 degrees to form the minus */}
                    <motion.span
                      className="absolute h-full w-[2px] bg-white rounded-full"
                      animate={{ rotate: isOpen ? 90 : 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    />
                  </div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                    >
                      <div className="px-6 pb-6 text-white/80 leading-relaxed text-base pt-0">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
