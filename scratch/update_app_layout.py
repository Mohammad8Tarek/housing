import re

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update imports
content = content.replace(
    'import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";\n',
    ''
)
content = content.replace(
    'import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";\n',
    'import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";\nimport { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";\nimport { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";\n'
)

# 2. Remove isMobileMenuOpen state
content = content.replace(
    '  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n',
    ''
)
content = content.replace(
    'setIsMobileMenuOpen(false)',
    'null' # Just a quick placeholder so it doesn't break compilation if missed
)

# 3. Wrapper components for Sidebar links
wrapper = """
function NavLink({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: boolean }) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link href={href} onClick={() => setOpenMobile(false)}>
      <div className={`flex items-center w-full cursor-pointer ${isActive ? 'text-sidebar-accent-foreground font-semibold' : ''}`}>{children}</div>
    </Link>
  );
}

function SubNavLink({ href, children, isActive }: { href: string; children: React.ReactNode; isActive: boolean }) {
  const { setOpenMobile } = useSidebar();
  return (
    <Link href={href} onClick={() => setOpenMobile(false)}>
      <div className={`block w-full cursor-pointer ${isActive ? 'text-sidebar-accent-foreground font-semibold' : ''}`}>{children}</div>
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {"""

content = content.replace("export function AppLayout({ children }: { children: React.ReactNode }) {", wrapper)

# 4. Replace renderSidebar and return block
sidebar_pattern = re.compile(r'  const renderSidebar = \(\) => \(.*?\n  \);\n\n  return \(\n    <>\n      <ChangePasswordDialog\n        open=\{changePasswordOpen\}\n        onOpenChange=\{setChangePasswordOpen\}\n      />\n      <div\n        className="flex h-\[100dvh\] w-full bg-background overflow-hidden"\n        dir=\{dir\}\n      >\n        <div className="hidden md:block flex-shrink-0">\{renderSidebar\(\)\}</div>\n\n        <div className="flex-1 flex flex-col min-w-0">\n          <header className="sticky top-0 z-30 h-14 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm">\n            <div className="flex items-center gap-3">\n              <Sheet open=\{null\} onOpenChange=\{null\}>\n                <SheetTrigger asChild>\n                  <Button variant="ghost" size="icon" className="md:hidden">\n                    <Menu className="h-5 w-5" />\n                  </Button>\n                </SheetTrigger>\n                <SheetContent\n                  side=\{dir === "rtl" \? "right" : "left"\}\n                  className="p-0 w-64 bg-sidebar border-none"\n                >\n                  \{renderSidebar\(\)\}\n                </SheetContent>\n              </Sheet>', re.DOTALL)

# Because we replaced `setIsMobileMenuOpen(false)` with `null` earlier, the Sheet now has `open={null}` etc. 
# It's safer to just split by `"return ("` and `"              {/* Property Switcher in Topbar with property logo */}"`

parts = content.split('  const renderSidebar = () => (')
if len(parts) > 1:
    before_render_sidebar = parts[0]
    
    parts2 = parts[1].split('              {/* Property Switcher in Topbar with property logo */}')
    after_property_switcher = '              {/* Property Switcher in Topbar with property logo */}' + parts2[1]
    
    new_return = """  return (
    <SidebarProvider dir={dir}>
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      
      <Sidebar variant="sidebar" collapsible="icon" className="border-r border-sidebar-border/50">
        <SidebarHeader className="flex flex-col items-center gap-2 py-4 border-b border-sidebar-border/50">
          {systemLogo ? (
            <img
              src={systemLogo}
              alt="Logo"
              className="h-10 w-auto max-w-[150px] object-contain group-data-[collapsible=icon]:max-w-[30px]"
              fetchpriority="high"
            />
          ) : (
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="text-center group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight leading-none block text-sidebar-foreground">
              {systemName}
            </span>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              {ar ? "نظام الإسكان" : "Staff Housing"}
            </p>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-2 gap-1 no-scrollbar">
          <SidebarGroup>
            <SidebarMenu className="gap-1">
              {visibleNavItems.map((item, idx) => {
                if (item.subItems) {
                  const isGroupActive = item.subItems.some((s) => isActive(s.href));
                  const defaultOpen = accommodationOpen || isGroupActive;
                  return (
                    <Collapsible key={idx} defaultOpen={defaultOpen} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton isActive={isGroupActive} tooltip={item.label} className="font-medium text-sm">
                            <item.icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            <ChevronRight className={`ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${ar ? "rotate-180 group-data-[state=open]/collapsible:-rotate-90" : ""}`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="mr-4 pr-3 border-r-2 border-sidebar-border/30 rtl:ml-4 rtl:pl-3 rtl:mr-0 rtl:border-r-0 rtl:border-l-2">
                            {item.subItems.map((sub, sIdx) => {
                              const active = isActive(sub.href);
                              return (
                                <SidebarMenuSubItem key={sIdx}>
                                  <SidebarMenuSubButton asChild isActive={active}>
                                    <SubNavLink href={sub.href} isActive={active}>{sub.label}</SubNavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }

                const active = isActive(item.href!);
                return (
                  <SidebarMenuItem key={idx}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="font-medium text-sm">
                      <NavLink href={item.href!} isActive={active}>
                        <div className="flex items-center gap-2 w-full">
                          <item.icon className={`h-4 w-4 ${active ? 'text-primary' : ''}`} />
                          <span>{item.label}</span>
                          {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
                        </div>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/50 p-4 text-center group-data-[collapsible=icon]:hidden bg-sidebar/50">
          <p className="text-[10px] font-medium text-muted-foreground/80 flex flex-col items-center justify-center gap-1">
            <span className="font-semibold uppercase tracking-wider text-primary/80">SUNRISE IT Team</span>
            <span>© 2026 White Hills</span>
          </p>
        </SidebarFooter>
      </Sidebar>

      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden bg-background">
        <header className="sticky top-0 z-30 h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm transition-all duration-300">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground md:hidden" />
"""
    content = before_render_sidebar + new_return + after_property_switcher

# Fix the end tags. The old layout had:
#       </div>
#     </>
#   );
# }
# Because we replaced `</>` with `</SidebarProvider>`, we need to find the ending tags.
content = content.replace(
    '        </div>\n      </div>\n    </>\n  );\n}',
    '        </div>\n      </div>\n    </SidebarProvider>\n  );\n}'
)
# Just in case `</>` is at the bottom. The old layout used `<>` and `</>`.
# Wait, actually:
# return (
#    <>
#      <ChangePasswordDialog .../>
#      <div ...>
#        <div ...>{renderSidebar()}</div>
#        <div className="flex-1 ...">
#           ...
#        </div>
#      </div>
#    </>
#  );
# So `</div>\n      </div>\n    </>\n  );\n}` should match. Let's make it robust:
content = re.sub(r'</>\s*\);\s*\}', '</SidebarProvider>\n  );\n}', content)

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
