with open("artifacts/housing/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("        </div>\n      </div>\n    </SidebarProvider>", "        </div>\n    </SidebarProvider>")

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
