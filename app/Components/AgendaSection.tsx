export default function AgendaSection() {
  return (
    <section
      id="agenda"
      className="pb-16 min-[744px]:pb-24 min-[1280px]:pb-30 px-10 min-[744px]:px-20 min-[1280px]:px-30 max-w-7xl mx-auto my-12"
    >
      <div className="flex flex-col gap-6">
        <h2 className="text-3xl font-display text-white">Agenda</h2>
        <div className="flex gap-8 min-[744px]:gap-12 min-[1280px]:gap-18 items-stretch">
          <div className="w-full">
            <div className="py-2 px-4 m-0 flex bg-white text-black font-sans justify-between text-sm"><p>WED, NOV 18</p></div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-white/30 flex flex-col min-[744px]:max-[1279px]:flex-row min-[744px]:max-[1279px]:items-center"><p className="text-sm min-[744px]:max-[1279px]:w-2/5">6:30 PM PT</p><p className="text-2xl min-[744px]:max-[1279px]:flex-1 min-[744px]:max-[1279px]:text-right">Doors Open</p></div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-white/30 flex flex-col min-[744px]:max-[1279px]:flex-row min-[744px]:max-[1279px]:items-center"><p className="text-sm min-[744px]:max-[1279px]:w-2/5">6:40 PM PT</p><p className="text-2xl min-[744px]:max-[1279px]:flex-1 min-[744px]:max-[1279px]:text-right">Kickoff + Panel Discussion</p></div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-white/30 flex flex-col min-[744px]:max-[1279px]:flex-row min-[744px]:max-[1279px]:items-center"><p className="text-sm min-[744px]:max-[1279px]:w-2/5">7:25 PM PT</p><p className="text-2xl min-[744px]:max-[1279px]:flex-1 min-[744px]:max-[1279px]:text-right">Student Design Showcase</p></div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-white/30 flex flex-col min-[744px]:max-[1279px]:flex-row min-[744px]:max-[1279px]:items-center"><p className="text-sm min-[744px]:max-[1279px]:w-2/5">7:50 PM PT</p><p className="text-2xl min-[744px]:max-[1279px]:flex-1 min-[744px]:max-[1279px]:text-right">Networking</p></div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-white/30 flex flex-col min-[744px]:max-[1279px]:flex-row min-[744px]:max-[1279px]:items-center"><p className="text-sm min-[744px]:max-[1279px]:w-2/5">8:50 PM PT</p><p className="text-2xl min-[744px]:max-[1279px]:flex-1 min-[744px]:max-[1279px]:text-right">Closing Remarks</p></div>
          </div>
          <div className="relative hidden min-[1280px]:block w-full min-h-0 overflow-hidden">
            {/* <AgendaGraphic /> */}
            <img src="/agenda-graphic.png" alt="Agenda event illustration" className="absolute inset-x-0 top-0 block w-full max-w-none h-auto" />
          </div>
        </div>
      </div>
    </section>
  );
}
