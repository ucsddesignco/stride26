export default function FooterSection() {
  return (
    <section>
      <div
        className="responsive-footer-background relative w-full h-[390px] overflow-hidden flex flex-col justify-center items-center"
      >
        <h1 className="relative z-10 text-5xl font-display">
          Register for Stride!
        </h1>
      </div>
      <div className="px-30 py-8 font-sans flex justify-between text-sm">
        <p>Made with {`<`}3 by Design Co</p>
        <p>Fall 2026</p>
      </div>
    </section>
  );
}
