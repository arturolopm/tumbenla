import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardPanel, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { BiSolidZap } from "react-icons/bi";

export default function Pricing() {
  const communityFeatures = [
    { text: "Full Next.js boilerplate", included: true },
    { text: "Auth, payments & UI prewired", included: true },
    { text: "Built-in SEO", included: true },
    { text: "Resend transaction emails", included: true },
    { text: "Payments via Stripe / Lemon Squeezy / Polar", included: true },
    { text: "Active community support", included: true },
    { text: "MIT open-source license", included: true },
    { text: "Regular updates & fixes", included: true },
  ];

  const premiumFeatures = [
    { text: "Everything in free", included: true },
    { text: "One-click deploys", included: true },
    { text: "Role-based access & invite system", included: true },
    { text: "Advanced SEO & Blog", included: true },
    { text: "Analytics hooks ready for Posthog", included: true },
    { text: "Pro UI kit", included: true },
    { text: "Private Discord Community", included: true },
    { text: "lifetime updates", included: true },
    { text: "Priority support", included: true },
  ];

  return (
    <section className="py-24 px-4 sm:px-6 bg-[#F4F4F5]">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-semibold tracking-tight mb-4">
            Choose your plan
          </h2>
          <p className="text-lg text-muted-foreground">
            Start free, upgrade when you're ready
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Community */}
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Community</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-semibold font-mono">$0</span>
              </div>
            </CardHeader>
            <CardPanel className="flex-1">
              <ul className="space-y-3">
                {communityFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground">{feature.text}</span>
                  </li>
                ))}
              </ul>
            </CardPanel>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" size="lg">
                <BiSolidZap className="h-4 w-4" />
                Get ShipFree
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Open source. Free forever
              </p>
            </CardFooter>
          </Card>

          {/* Premium */}
          <Card className="flex flex-col relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle>Premium</CardTitle>
                <Badge variant="secondary" className="ml-auto">
                  Most popular
                </Badge>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-muted-foreground line-through font-mono">$150</span>
                  <span className="text-4xl font-semibold font-mono">$90</span>
                </div>
              </div>
            </CardHeader>
            <CardPanel className="flex-1">
              <ul className="space-y-3">
                {premiumFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={`text-muted-foreground ${feature.highlighted ? 'underline decoration-green-500 decoration-wavy' : ''}`}>
                      {feature.text}
                    </span>
                    {feature.badge && (
                      <Badge variant="success" className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {feature.badge}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardPanel>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" size="lg">
                <BiSolidZap className="h-4 w-4" />
                Get ShipFree Pro
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Pay once. Build unlimited projects!
              </p>
            </CardFooter>
          </Card>
        </div>
      </div>
    </section>
  );
}

