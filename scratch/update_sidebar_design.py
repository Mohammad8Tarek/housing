import re

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

sidebar_pattern = re.compile(r'  const renderSidebar = \(\) => \(.*?\n  \);\n', re.DOTALL)

new_render_sidebar = """  const renderSidebar = () => (
    <div className="flex h-full flex-col bg-card/95 backdrop-blur-xl text-card-foreground w-64 border-r border-white/10 shadow-[4px_0_24px_-10px_rgba(0,0,0,0.1)] dark:shadow-[4px_0_24px_-10px_rgba(0,0,0,0.5)]">
      <div className="px-6 py-5 flex flex-col items-center gap-3 border-b border-white/5 relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
        
        {systemLogo ? (
          <img
            src={systemLogo}
            alt="Logo"
            className="h-12 w-auto max-w-[160px] object-contain drop-shadow-md z-10 relative"
            fetchpriority="high"
          />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 z-10 relative">
            <Building2 className="w-6 h-6 text-white" />
          </div>
        )}
        <div className="text-center z-10 relative">
          <span className="text-base font-extrabold tracking-tight leading-none block text-foreground">
            {systemName}
          </span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1.5 font-medium">
            {ar ? "نظام الإسكان" : "Staff Housing"}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1.5 no-scrollbar">
        <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2 px-3">
          {ar ? "القائمة الرئيسية" : "Main Menu"}
        </p>
        {visibleNavItems.map((item, idx) => {
          if (item.subItems) {
            const isGroupActive = item.subItems.some((s) => isActive(s.href));
            const open = accommodationOpen || isGroupActive;
            return (
              <div key={idx} className="mb-1">
                <button
                  onClick={() => setAccommodationOpen((o) => !o)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                    isGroupActive
                      ? "bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold shadow-sm"
                      : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-colors ${isGroupActive ? 'bg-violet-500/20 text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                  </div>
                  <span className="flex-1 text-start font-medium">{item.label}</span>
                  {open ? (
                    <ChevronDown className="h-4 w-4 flex-shrink-0 opacity-50" />
                  ) : (
                    <ChevronRight
                      className={`h-4 w-4 flex-shrink-0 opacity-50 transition-transform ${ar ? "rotate-180" : ""}`}
                    />
                  )}
                </button>
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}`}
                >
                  <div
                    className={`${ar ? "mr-6 pr-3 border-r-2" : "ml-6 pl-3 border-l-2"} border-border/40 flex flex-col gap-1`}
                  >
                    {item.subItems.map((sub, sIdx) => {
                      const active = isActive(sub.href);
                      return (
                        <Link
                          key={sIdx}
                          href={sub.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span
                            className={`block px-3 py-2 text-sm rounded-lg transition-all duration-200 ${
                              active
                                ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-500/20 translate-x-1"
                                : "text-foreground/60 hover:text-foreground hover:bg-muted/50 hover:translate-x-1"
                            }`}
                          >
                            {sub.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          }

          const active = isActive(item.href!);
          return (
            <Link
              key={idx}
              href={item.href!}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                  active
                    ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 scale-[1.02]"
                    : "text-foreground/70 hover:bg-muted/50 hover:text-foreground hover:scale-[1.01]"
                }`}
              >
                <div className={`p-1.5 rounded-lg transition-colors ${active ? 'bg-white/20 text-white' : 'text-muted-foreground'}`}>
                  <item.icon
                    className={`h-4 w-4 flex-shrink-0`}
                  />
                </div>
                <span className="font-medium">{item.label}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </span>
            </Link>
          );
        })}
      </div>
      
      {/* Bottom Profile / Footer Section inside sidebar */}
      <div className="p-4 border-t border-white/5 bg-muted/20">
        <div className="flex items-center gap-3 p-2 rounded-xl bg-card border border-white/5 shadow-sm">
           <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-inner">
             <span className="text-white text-xs font-bold">IT</span>
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-xs font-bold text-foreground truncate">SUNRISE IT Team</p>
             <p className="text-[9px] text-muted-foreground truncate uppercase tracking-wider">Staff Housing System</p>
           </div>
        </div>
      </div>
    </div>
  );
"""

content = re.sub(sidebar_pattern, new_render_sidebar, content)

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
