import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AttendeesSection() {
  return (
    <section id="attendees" className="pb-30 px-30 max-w-7xl mx-auto my-12">
      <div className="flex flex-col gap-5">
        <h2 className="text-3xl font-display text-white">(Judges)</h2>
        <div className="flex w-full gap-6 justify-center items-center">
          <ChevronLeft />
          <div className="flex w-full justify-between gap-8">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="w-full flex flex-col gap-4">
                <div className="bg-neutral-800 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
            ))}
          </div>
          <ChevronRight />
        </div>
      </div>
    </section>
  );
}
