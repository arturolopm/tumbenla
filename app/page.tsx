import Navbar from "./(site)/navbar";
import Hero from "./(site)/hero";
import Features from "./(site)/features";
import Pricing from "./(site)/pricing";
import FAQ from "./(site)/faq";
import Footer from "./(site)/footer";

export default function Page() {
  return (
    <div className="bg-[#F4F4F5]">
      <Navbar />
      <Hero />
      <Features />
      <Pricing />
      <FAQ />
      <Footer />
    </div>
  );
}
