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
    <div className="min-h-screen bg-[#030712] text-slate-50 selection:bg-indigo-500/30 overflow-hidden font-sans">
      <SiteHeader user={user} />
      
      {/* Abstract Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] w-[30%] h-[30%] rounded-full bg-blue-500/10 blur-[100px] translate-x-[-50%]" />
      </div>

      <main className="relative z-10">
        {/* Premium Hero Section */}
        <section className="relative px-6 pt-32 pb-24 md:pt-48 md:pb-32 flex flex-col items-center justify-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8 animate-fade-in">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-medium tracking-wide text-indigo-200">Next-Generation Formatting Engine</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-5xl text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-8 animate-fade-in [animation-delay:100ms]">
            Your academic research, <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">flawlessly structured.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 animate-fade-in [animation-delay:200ms] font-light leading-relaxed">
            Upload your draft. AcadFormat analyzes your structure, unifies your references, and completely rebuilds your document to verified university specifications without losing a single word.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in [animation-delay:300ms]">
            <Button asChild size="lg" className="h-14 px-8 text-base bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-[0_0_40px_-10px_rgba(79,70,229,0.5)] transition-all duration-300 hover:scale-105">
              <Link to={user ? "/dashboard" : "/auth"}>
                {user ? "Enter Workspace" : "Get Started Now"} <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base border-white/10 hover:bg-white/5 bg-transparent text-white rounded-xl transition-all duration-300">
              <Link to="/institutions">
                <LayoutTemplate className="w-5 h-5 mr-2 text-slate-400" /> View Standards
              </Link>
            </Button>
          </div>
        </section>

        {/* Feature Bento Grid */}
        <section className="px-6 py-24 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 md:p-12 transition-all hover:bg-white/[0.07]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] group-hover:bg-indigo-500/20 transition-all" />
              <FileText className="w-10 h-10 text-indigo-400 mb-6" />
              <h3 className="text-2xl font-semibold text-white mb-4">Zero-Loss Reconstruction</h3>
              <p className="text-slate-400 leading-relaxed max-w-md">
                Our engine parses every paragraph, table, and reference. It restructures the Abstract, Roman numerals, and Table of Contents while guaranteeing 100% text fidelity. Your words, just properly formatted.
              </p>
            </div>

            <div className="relative group overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 transition-all hover:bg-white/[0.07]">
              <CheckCircle className="w-10 h-10 text-emerald-400 mb-6" />
              <h3 className="text-xl font-semibold text-white mb-4">Automated Audits</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Instant health scorecards for your document structure, highlighting orphaned headings, broken tables, and inconsistent abbreviations.
              </p>
            </div>

            <div className="relative group overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 transition-all hover:bg-white/[0.07]">
              <Settings2 className="w-10 h-10 text-violet-400 mb-6" />
              <h3 className="text-xl font-semibold text-white mb-4">Verified Templates</h3>
              <p className="text-slate-400 leading-relaxed text-sm">
                Built-in adherence to exact university specifications, including COLTECH and UBa standards for dissertations and theses.
              </p>
            </div>

            <div className="md:col-span-2 relative group overflow-hidden rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-8 md:p-12 flex items-center justify-between transition-all hover:bg-white/[0.07]">
              <div>
                <h3 className="text-3xl font-semibold text-white mb-4">Ready to format?</h3>
                <p className="text-slate-400 mb-8 max-w-sm">Upload your raw draft and download a fully structured DOCX in seconds.</p>
                <Button asChild className="bg-white text-black hover:bg-slate-200 rounded-lg px-6">
                  <Link to="/auth">Create an account</Link>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
