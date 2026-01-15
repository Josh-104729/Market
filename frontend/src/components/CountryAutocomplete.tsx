import { useEffect, useMemo, useRef, useState } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { COUNTRIES } from "../utils/countries";

type Props = {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  leftIcon?: React.ReactNode;
};

export function CountryAutocomplete({
  id,
  value,
  onValueChange,
  placeholder = "Select your country",
  disabled,
  className,
  inputClassName,
  leftIcon,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimer = useRef<number | null>(null);
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keep input in sync when parent value changes (e.g. back/forward).
    setQuery(value || "");
  }, [value]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    // Simple substring match; fast and predictable.
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    // Reset active index when results change.
    setActiveIndex(0);
  }, [query]);

  const commit = (country: string) => {
    onValueChange(country);
    setQuery(country);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }

    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) commit(chosen);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
  };

  const handleFocus = () => {
    if (disabled) return;
    if (blurTimer.current) {
      window.clearTimeout(blurTimer.current);
      blurTimer.current = null;
    }
    setOpen(true);
  };

  const handleBlur = () => {
    // Delay closing to allow click selection.
    blurTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  const handleChange = (v: string) => {
    setQuery(v);
    if (!open) setOpen(true);
    // If the user types an exact match, keep the saved value in sync.
    const exact = COUNTRIES.find((c) => c.toLowerCase() === v.trim().toLowerCase());
    if (exact) onValueChange(exact);
    else onValueChange(v);
  };

  const showResults = open && !disabled;

  return (
    <Popover open={showResults} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className={cn("relative", className)}>
          {leftIcon ? (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          ) : null}
          <Input
            id={id}
            disabled={disabled}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(leftIcon ? "pl-10" : "", inputClassName)}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        sideOffset={6}
        align="start"
        className="w-[--radix-popover-trigger-width] p-0"
        onInteractOutside={(e) => {
          // Keep the list open when interacting with the input/anchor.
          if (anchorRef.current && anchorRef.current.contains(e.target as Node)) {
            e.preventDefault();
          }
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ScrollArea className="max-h-[320px]" style={{ overflowY: 'auto', scrollbarWidth: 'thin' }}>
          <div className="p-1">
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
            ) : (
              results.slice(0, 200).map((country, idx) => {
                const active = idx === activeIndex;
                return (
                  <button
                    key={country}
                    type="button"
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      active ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commit(country)}
                    role="option"
                    aria-selected={active}
                  >
                    {country}
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}


