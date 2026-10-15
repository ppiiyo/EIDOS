import React from 'react';
import { Hero } from '../components/Hero';
import { Problem } from '../components/Problem';
import { HowItWorks } from '../components/HowItWorks';
import { InteractiveDemo } from '../components/InteractiveDemo';
import { Metrics } from '../components/Metrics';
import { Pricing } from '../components/Pricing';
import { FAQ } from '../components/FAQ';
import { Footer } from '../components/Footer';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-slate-950">
      <Hero />
      <Problem />
      <HowItWorks />
      <InteractiveDemo />
      <Metrics />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
