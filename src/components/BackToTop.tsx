import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && target.scrollTop !== undefined) {
        setIsVisible(target.scrollTop > 250);
      }
    };

    const attachScrollListeners = () => {
      const scrollableContainers = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
      scrollableContainers.forEach(container => {
        container.addEventListener("scroll", handleScroll, { passive: true });
      });
      window.addEventListener("scroll", () => {
        setIsVisible(window.scrollY > 250);
      }, { passive: true });
    };

    // Attach initially and set up a mutation observer to catch dynamically added containers
    attachScrollListeners();
    
    const observer = new MutationObserver(() => attachScrollListeners());
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", () => {});
    };
  }, []);

  const scrollToTop = () => {
    // Smooth scroll window to top
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

    // Also target any active scrollable workspace containers
    const scrollableContainers = document.querySelectorAll(".overflow-y-auto, .overflow-auto");
    scrollableContainers.forEach((container) => {
      container.scrollTo({ top: 0, behavior: "smooth" });
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      title="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex h-11 w-11 items-center justify-center rounded-full",
        "bg-primary/95 text-primary-foreground shadow-lg backdrop-blur-md",
        "border border-primary/20 transition-all duration-300 hover:scale-110 hover:bg-primary",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "animate-in fade-in slide-in-from-bottom-4"
      )}
    >
      <ArrowUp className="h-5 w-5 stroke-[2.5]" />
    </button>
  );
}
