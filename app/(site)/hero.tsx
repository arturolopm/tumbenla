import { Button } from "@/components/ui/button";
import { BiSolidZap } from "react-icons/bi";
import { ArrowUpRight } from "lucide-react";

export default function Hero() {
  return (
    <main className="flex min-h-screen flex-col bg-[#F4F4F5] items-center justify-start px-4 pt-40 pb-24 sm:px-6">
      <div className="mx-auto w-full max-w-4xl text-center">
        <h1 className="mx-auto max-w-3xl text-balance text-center font-semibold text-4xl leading-tight tracking-tighter sm:text-5xl md:max-w-4xl md:text-6xl lg:leading-[1.1]">
          A production-ready{" "}
          <img 
            src="/nextjs_logo.svg" 
            alt="Next.js" 
            className="inline-block h-[0.9em] w-[0.9em] align-middle mx-1"
          />{" "}
          Next.js boilerplate built to make $$$
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-balance text-center text-muted-foreground md:max-w-2xl md:text-lg">
        Go from idea to income in record time. A modern boilerplate that saves you weeks of setup so you can spend time building features that actually make money.        </p>
        <div className="mx-auto mt-10 flex items-center justify-center gap-4">
          <Button 
            variant="default"
            className="text-white font-semibold !h-12 px-8 text-base"
          >
            <BiSolidZap className="h-8 w-8" />
            Get ShipFree
          </Button>
          <Button 
            variant="outline"
            className="font-semibold !h-12 px-8 text-base"
          >
            Try demo
            <ArrowUpRight className="h-8 w-8" />
          </Button>
        </div>
      </div>
    </main>
  );
}

