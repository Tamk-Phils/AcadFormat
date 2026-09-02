import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowRight, BookOpen, FileText, CheckCircle, Sparkles, LayoutTemplate, Settings2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AcadFormat | Premium Academic Formatting Engine" },
      { name: "description", content: "Rebuild your thesis to verified institutional standards with 100% verbatim text fidelity." },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 font-sans">
      
      {/* Main Glass Container */}
      <main className="glass-panel rounded-[2rem] p-6 md:p-12 relative overflow-hidden">
        {/* Abstract Background Elements inside glass */}
        <div className="absolute inset-0 z-0 pointer-events-none opacity-50">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-500/20 blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center text-center py-16 md:py-32">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-pill mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            <span className="text-sm font-medium tracking-wide text-indigo-100">Next-Generation Formatting Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/70 mb-8 animate-fade-in [animation-delay:100ms] leading-tight">
            Your academic research, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-violet-300">flawlessly structured.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mb-12 animate-fade-in [animation-delay:200ms] font-light leading-relaxed">
            Upload your draft. AcadFormat analyzes your structure, unifies your references, and completely rebuilds your document to verified university specifications without losing a single word.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in [animation-delay:300ms]">
            <Button asChild size="lg" className="h-14 px-8 text-base bg-white text-black hover:bg-slate-200 rounded-2xl shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-105">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Enter Workspace" : "Get Started Now"} <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base border-white/20 hover:bg-white/10 bg-black/20 text-white rounded-2xl backdrop-blur-md transition-all duration-300">
              <Link to="/institutions">
                <LayoutTemplate className="w-5 h-5 mr-2 text-slate-300" /> View Standards
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Feature Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div className="md:col-span-2 relative group overflow-hidden rounded-[2rem] glass-panel p-8 md:p-10 transition-all hover:glass-panel-strong">
          <FileText className="w-10 h-10 text-indigo-300 mb-6" />
          <h3 className="text-2xl font-semibold text-white mb-4">Zero-Loss Reconstruction</h3>
          <p className="text-slate-300 leading-relaxed max-w-md">
            Our engine parses every paragraph, table, and reference. It restructures the Abstract, Roman numerals, and Table of Contents while guaranteeing 100% text fidelity. Your words, just properly formatted.
          </p>
        </div>

        <div className="relative group overflow-hidden rounded-[2rem] glass-panel p-8 transition-all hover:glass-panel-strong">
          <CheckCircle className="w-10 h-10 text-emerald-400 mb-6" />
          <h3 className="text-xl font-semibold text-white mb-4">Automated Audits</h3>
          <p className="text-slate-300 leading-relaxed text-sm">
            Instant health scorecards for your document structure, highlighting orphaned headings, broken tables, and inconsistent abbreviations.
          </p>
        </div>

        <div className="relative group overflow-hidden rounded-[2rem] glass-panel p-8 transition-all hover:glass-panel-strong">
          <Settings2 className="w-10 h-10 text-violet-300 mb-6" />
          <h3 className="text-xl font-semibold text-white mb-4">Verified Templates</h3>
          <p className="text-slate-300 leading-relaxed text-sm">
            Built-in adherence to exact university specifications, including COLTECH and UBa standards for dissertations and theses.
          </p>
        </div>

        <div className="md:col-span-2 relative group overflow-hidden rounded-[2rem] glass-panel p-8 md:p-10 flex flex-col md:flex-row items-center justify-between transition-all hover:glass-panel-strong gap-6">
          <div>
            <h3 className="text-3xl font-semibold text-white mb-3">Ready to format?</h3>
            <p className="text-slate-300 max-w-sm">Upload your raw draft and download a fully structured DOCX in seconds.</p>
          </div>
          <Button asChild className="h-12 px-8 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl shadow-lg shrink-0">
            <Link to="/auth">Create an account</Link>
          </Button>
        </div>

      </section>
    </div>
  );
}
