import Image, { type StaticImageData } from "next/image";
import alanPhoto from "./alanPhoto.png";
import stellaPhoto from "./stellaPhoto.png";
import gracePhoto from "./gracePhoto.png";
import caileyPhoto from "./caileyPhoto.png";

const people: { name: string; role: string; image: StaticImageData }[] = [
  {
    name: "Alan Tran",
    role: "UX Engineer @ Persona",
    image: alanPhoto,
  },
  {
    name: "Stella Seki",
    role: "Senior Product Designer & Design Lead @ AoPS",
    image: stellaPhoto,
  },
  {
    name: "Grace Lin",
    role: "Product Designer @ Deloitte",
    image: gracePhoto,
  },
  {
    name: "Cailey Grembowski",
    role: "UX Researcher & UI Designer @ PINT, Inc.",
    image: caileyPhoto,
  },
];

export default function AttendingProfessionals() {
  return (
    <div className="mt-[52px] flex items-start overflow-x-auto overflow-y-hidden scroll-smooth [scrollbar-width:none] [overflow-anchor:none] [&::-webkit-scrollbar]:hidden">
      <div
        aria-hidden
        className="shrink-0"
        style={{
          width:
            "max(clamp(2.5rem, calc(2.5rem + (100vw - 24.375rem) * 0.126183), 7.5rem), calc((100vw - 80rem) / 2 + 7.5rem))",
        }}
      />
      {people.map((person, index) => (
        <article
          key={person.name}
          className={`w-[236px] shrink-0 ${index < people.length - 1 ? "mr-8" : ""}`}
        >
          <div className="relative aspect-square w-full overflow-hidden rounded-full">
            <Image
              src={person.image}
              alt={person.name}
              fill
              className="object-cover"
              sizes="236px"
            />
          </div>
          <p className="mt-4 text-center font-sans text-base leading-tight text-white">
            {person.name}
          </p>
          <p className="mt-1 text-center font-sans text-sm leading-snug text-neutral-400">
            {person.role}
          </p>
        </article>
      ))}
    </div>
  );
}
