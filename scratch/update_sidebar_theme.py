import re

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Sidebar main background
content = content.replace("bg-card/95 backdrop-blur-xl text-card-foreground", "bg-sidebar backdrop-blur-xl text-sidebar-foreground")

# Subtexts and headers
content = content.replace("text-foreground", "text-sidebar-foreground")
content = content.replace("text-muted-foreground", "text-sidebar-foreground/70")

# Hover states
content = content.replace("hover:bg-muted/50", "hover:bg-sidebar-accent/50")

# The logo placeholder (if no logo)
content = content.replace("bg-primary flex items-center justify-center shadow-lg shadow-primary/20", "bg-sidebar-primary flex items-center justify-center shadow-lg shadow-sidebar-primary/20")

# Active states
content = content.replace("bg-primary/10", "bg-sidebar-primary/10")
content = content.replace("bg-primary/20", "bg-sidebar-primary/20")
content = content.replace("text-primary", "text-sidebar-primary")

content = content.replace("bg-primary text-primary-foreground", "bg-sidebar-primary text-sidebar-primary-foreground")
content = content.replace("shadow-primary/20", "shadow-sidebar-primary/20")
content = content.replace("shadow-primary/25", "shadow-sidebar-primary/25")

content = content.replace("bg-primary-foreground", "bg-sidebar-primary-foreground")
content = content.replace("text-sidebar-primary-foreground", "text-sidebar-primary-foreground") # just in case

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
