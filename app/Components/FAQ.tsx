"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
    <section id="faq" className="w-full pb-30">
      {/* Centered container with max-width and your 120px (px-30) padding */}
      <div className="max-w-7xl mx-auto px-10 min-[744px]:px-20 min-[1280px]:px-30">
        <h2 className="text-3xl font-display text-white pb-6">
          FAQ
        </h2>

        <div>
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
