export default function FooterSection() {
  return (
    <section>
      <div
        className="relative w-full h-[390px] overflow-hidden flex flex-col justify-center items-center"
      >
        <picture className="absolute inset-0">
          <source media="(max-width: 743px)" srcSet="/footer-mobile.png" />
          <source
            media="(min-width: 744px) and (max-width: 1279px)"
            srcSet="/footer-tablet.png"
          />
          <img
            src="/footer.png"
            alt=""
            className="h-full w-full object-cover object-center"
          />
        </picture>
        <h1 className="relative z-10 text-4xl min-[744px]:text-5xl font-display">
          Register for Stride!
        </h1>
      </div>
      <div className="px-10 min-[744px]:px-20 min-[1280px]:px-30 py-8 font-sans flex flex-wrap gap-4 justify-between text-sm">
        <p>Made with {`<`}3 by Design Co</p>
        <p>Fall 2026</p>
      </div>
    </section>
  );
}
