import Image from "next/image";

const YELLOW = { src: "/hero/star-yellow-1.svg", width: 50.239, height: 49.5335 };
const BLUE = { src: "/hero/star-blue.svg", width: 75.7703, height: 74.7063 };
const RED = { src: "/hero/star-red.svg", width: 29.9892, height: 29.5714 };

const people: {
  name: string;
  role: string;
  image: string;
  star: { src: string; width: number; height: number; className: string };
}[] = [
  {
    name: "Alan Tran",
    role: "UX Engineer @ Illumina",
    image: "/alanPhoto.png",
    star: { ...YELLOW, className: "left-[67%] top-[71%] size-[68px] rotate-[18deg]" },
  },
  {
    name: "Brendan Jew",
    role: "Senior Product Designer @ Intuit",
    image: "/brendanPhoto.png",
    star: { ...BLUE, className: "left-[-5%] top-[-2%] size-[80px] -rotate-6" },
  },
  {
    name: "Grace Lin",
    role: "Product Designer @ Deloitte",
    image: "/gracePhoto.png",
    star: { ...RED, className: "left-[56%] top-[-8%] size-[46px]" },
  },
  {
    name: "Cailey Grembowski",
    role: "UX Researcher & UI Designer @ PINT, Inc.",
    image: "/caileyPhoto.png",
    star: { ...YELLOW, className: "left-[-4%] top-[64%] size-[68px] -rotate-[14deg]" },
  },
];

export default function AttendingProfessionals() {
  return (
    <div className="mt-3 flex items-start overflow-x-auto overflow-y-hidden scroll-smooth pt-10 [scrollbar-width:none] [overflow-anchor:none] [&::-webkit-scrollbar]:hidden">
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
          <div className="relative aspect-square w-full">
            <div className="absolute inset-0 overflow-hidden rounded-full">
              <Image
                src={person.image}
                alt={person.name}
                fill
                className="object-cover"
                sizes="236px"
              />
            </div>
            <Image
              src={person.star.src}
              alt=""
              aria-hidden
              width={person.star.width}
              height={person.star.height}
              className={`pointer-events-none absolute z-10 max-w-none ${person.star.className}`}
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
