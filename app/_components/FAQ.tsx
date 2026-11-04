"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqData = [
  {
    id: "1",
    question: "Who can participate?",
    answer:
      "UCSD students of all levels and backgrounds are encouraged to apply! Teams are not assigned, so we encourage you to form your own groups in advance. Design teams can consist of up to four members.",
  },
  {
    id: "2",
    question: "What's in it for me?",
    answer:
      "Design Frontiers is a fast-paced, immersive design sprint that simulates real-world product design practice. You’ll gain hands-on experience working through the iterative design process, learn how teams move from idea to solution, and build practical skills in collaboration, problem-solving, and rapid prototyping.",
  },
  {
    id: "3",
    question: "What will the event look like?",
    answer:
      "Design Frontiers will be split over the course of two days. The event kicks off Saturday afternoon with lightning talks, prompt reveal, and the start of the design sprint. On Sunday, teams will continue working before presenting to the judges panel. The event will conclude with finalist presentations and a closing ceremony.",
  },
  {
    id: "4",
    question: "When is the deadline to register?",
    answer:
      "April 30th at 11:59 PM. Space is limited to 80 participants, so we recommend signing up early. Waitlisted students are not guaranteed a spot, but we will keep you updated if there are any openings!",
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
      <div className="max-w-7xl mx-auto px-30">
        <h2 className="text-3xl font-display text-black pb-6">
          FAQ
        </h2>

        <div>
          {faqData.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div
                key={item.id}
                className="border border-black bg-white overflow-hidden [&:not(:first-child)]:border-t-0 font-sans"
              >
                <button
                  onClick={() => toggleAccordion(item.id)}
                  className="w-full flex items-center justify-between p-6 text-left font-medium text-black cursor-pointer"
                  aria-expanded={isOpen}
                >
                  <span className="text-lg">{item.question}</span>
                  
                  {/* Icon Container */}
                  <div className="relative w-4 h-4 flex items-center justify-center shrink-0 ml-4">
                    {/* Horizontal bar (stays flat) */}
                    <span className="absolute w-full h-[2px] bg-black rounded-full" />
                    
                    {/* Vertical bar rotates 90 degrees to form the minus */}
                    <motion.span
                      className="absolute h-full w-[2px] bg-black rounded-full"
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
                      <div className="px-6 pb-6 text-black/80 leading-relaxed text-base pt-0">
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