import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import FAQ from "./Components/FAQ";
import ArrowIcon from "./Components/ArrowIcon";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-8 py-4 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ArrowIcon></ArrowIcon>
          <span className="font-display">DESIGN CO</span>
        </div>
        <div className="hidden md:flex items-center space-x-8 text-sm font-display text-black">
          <a href="#" className="hover:text-gray-500 transition-colors">
            About
          </a>
          <a href="#" className="hover:text-gray-500 transition-colors">
            Events
          </a>
          <a href="#" className="hover:text-gray-500 transition-colors">
            Community
          </a>
          <a href="#" className="hover:text-gray-500 transition-colors">
            Contact
          </a>
        </div>
        <Menu className="md:hidden" />
      </nav>

      {/* hero */}
      <section className="min-h-[760px] flex flex-col items-center justify-center text-center px-6 bg-gray-50">
        <div className="max-w-3xl space-y-6"></div>
      </section>

      {/* intro */}
      <section className="py-16 lg:py-30 max-w-7xl mx-auto px-6 md:px-16 lg:px-30">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="order-2 lg:order-1">
            <div>
              <div className="w-full h-[320px] md:h-[444px] lg:h-[320px] bg-gray-100 rounded-md"></div>
            </div>
            <div className="py-4 flex w-full justify-center gap-[8px]">
              <div className="h-[8px] w-[8px] bg-gray-600 flex rounded-full"></div>
              <div className="h-[8px] w-[8px] bg-gray-300 flex rounded-full"></div>
              <div className="h-[8px] w-[8px] bg-gray-300 flex rounded-full"></div>
              <div className="h-[8px] w-[8px] bg-gray-300 flex rounded-full"></div>
            </div>
          </div>
          <div className="order-1 lg:order-2 space-y-6">
            <h2 className="text-3xl font-display text-gray-900">
              STRIDE is Design Co’s uniquely design-forward career fair.
            </h2>
            <p className="text-gray-600 font-sans leading-5">
              Held once a year, STRIDE connects students with company
              representatives for a day of networking, resume reviews, and
              recruiting sessions designed to jump-start industry careers.
            </p>
            <div>
              <button className="px-5 py-2.5 font-display text-white bg-black hover:bg-gray-600 transition-colors cursor-pointer">
                Register now for $6
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* agenda */}
      <section
        id="agenda"
        className="pb-16 lg:pb-30 px-6 md:px-16 lg:px-30 max-w-7xl mx-auto bg-gray-50/50 rounded-3xl my-12"
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-display text-gray-900">Agenda</h2>
            <div className="py-2 px-4 m-0 flex bg-black text-white font-sans justify-between text-sm">
              <p>Day One</p>
              <p>SAT, MAY 3</p>
            </div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-black">
              <p className="text-sm">10:00 AM PT</p>
              <p className="text-2xl">Doors Open</p>
            </div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-black">
              <p className="text-sm">11:30 AM PT</p>
              <p className="text-2xl">Illumina Talk</p>
            </div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-black">
              <p className="text-sm">1:00 PM PT</p>
              <p className="text-2xl">AOPS Talk</p>
            </div>
            <div className="m-0 px-6 py-[40px] font-sans border-bottom border-b border-black">
              <p className="text-sm">2:00 PM PT</p>
              <p className="text-2xl">Doors Close</p>
            </div>
          </div>
          <div className="hidden lg:block w-full h-full bg-gray-100 rounded-md"></div>
        </div>
      </section>

      {/* judges */}
      <section className="pb-16 lg:pb-30 px-6 md:px-16 lg:px-30 max-w-7xl mx-auto bg-gray-50/50 rounded-3xl my-12">
        <div className="flex flex-col gap-5">
          <h2 className="text-3xl font-display text-gray-900">(Judges)</h2>
          <div className="flex w-full gap-6 justify-center items-center">
            <ChevronLeft className="hidden lg:block" />
            <div className="flex w-full justify-between gap-8">
              <div className="w-full flex flex-col gap-4">
                <div className="bg-gray-200 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
              <div className="w-full flex flex-col gap-4">
                <div className="bg-gray-200 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
              <div className="hidden md:flex w-full flex-col gap-4">
                <div className="bg-gray-200 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
              <div className="hidden lg:flex w-full flex-col gap-4">
                <div className="bg-gray-200 w-full h-[220px] rounded-md font-sans"></div>
                <p className="text-lg font-sans leading-1">First Last</p>
                <p className="font-sans leading-1 text-sm">Role @ Company</p>
              </div>
            </div>
            <ChevronRight className="hidden lg:block" />
          </div>
        </div>
      </section>

      {/* faq */}
      <section>
        <FAQ></FAQ>
      </section>

      {/* register */}
      <section>
        <div className="w-full h-[390px] bg-gradient-to-b from-[#ECECEC] to-[#C8C8C8] flex flex-col justify-center items-center">
          <h1 className="text-3xl font-display pb-6">Register for Stride!</h1>
          <button className="px-5 py-2.5 font-display text-white bg-black hover:bg-gray-600 transition-colors cursor-pointer">
            Register
          </button>
        </div>
      </section>

      {/* footer */}
      <section>
        <div className="px-6 md:px-16 lg:px-30 py-8 font-sans flex justify-between text-sm">
          <p>Made with {`<`}3 by Design Co</p>
          <p>Fall 2026</p>
        </div>
      </section>
    </div>
  );
}
