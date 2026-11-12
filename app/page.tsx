import AboutSection from "./Components/AboutSection";
import AgendaSection from "./Components/AgendaSection";
import AttendeesSection from "./Components/AttendeesSection";
import FAQ from "./Components/FAQ";
import HeroSection from "./Components/HeroSection";
import FooterSection from "./Components/FooterSection";
import SiteNav from "./Components/SiteNav";

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-black text-white">
      <SiteNav />
      <HeroSection />
      <AboutSection />
      <AgendaSection />
      <AttendeesSection />
      <FAQ />
      <FooterSection />
    </div>
  );
}
