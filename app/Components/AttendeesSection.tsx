import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AttendeesSection() {
  return (
    <section id="attendees" className="pb-30 px-10 min-[744px]:px-20 min-[1280px]:px-30 max-w-7xl mx-auto my-12 overflow-hidden">
      <div className="flex flex-col gap-5">
        <h2 className="text-3xl font-display text-white">(Judges)</h2>
        <div className="flex w-full min-w-0 gap-6 justify-center items-center">
          <ChevronLeft className="hidden min-[744px]:block shrink-0" />
          <div className="grid w-full min-w-0 grid-cols-1 min-[744px]:grid-cols-2 min-[1280px]:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="min-w-0 w-full flex flex-col gap-4">
                <div className="bg-neutral-800 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
            ))}
          </div>
          <ChevronRight className="hidden min-[744px]:block shrink-0" />
        </div>
      </div>
    </section>
  );
}
