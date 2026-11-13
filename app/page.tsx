import AboutSection from "./Components/AboutSection";
import AgendaSection from "./Components/AgendaSection";
import FAQ from "./Components/FAQ";
import FooterSection from "./Components/FooterSection";
import SiteNav from "./Components/SiteNav";
import AttendingProfessionals from "./Components/AttendingProfessionals";
import Hero from "./Components/Hero";


export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <SiteNav />
      <Hero />
      <AboutSection />
      <AgendaSection />
      
      <section id="attendees" className="overflow-x-clip bg-black py-20 text-white">
        <div
          className="mx-auto max-w-7xl"
          style={{
            paddingInline:
              "clamp(2.5rem, calc(2.5rem + (100vw - 24.375rem) * 0.126183), 7.5rem)",
          }}
        >
          <h2 className="text-left font-display text-3xl">
            <span className="block md:inline">Attending</span>{" "}
            <span className="block md:inline">Professionals</span>
          </h2>
        </div>
        <AttendingProfessionals />
      </section>
      
      
      <FAQ />
      <FooterSection />
    </div>
  );
}
