import re

with open("artifacts/housing/src/components/layout/AppLayout.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove the footer
footer_pattern = re.compile(r'\s*\{\/\* Bottom Profile \/ Footer Section inside sidebar \*\/\}\s*<div className="p-4 border-t border-white\/5 bg-muted\/20">.*?<\/div>\s*<\/div>', re.DOTALL)
content = re.sub(footer_pattern, '', content)

# 2. Replace hardcoded violet/indigo colors with generic primary colors
# Logo subtle glow
content = content.replace("bg-violet-500/10 rounded-full", "bg-primary/10 rounded-full")

# Logo placeholder background
content = content.replace("bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20", "bg-primary flex items-center justify-center shadow-lg shadow-primary/20")

# Active parent dropdown button
content = content.replace("bg-violet-500/10 text-violet-700 dark:text-violet-300 font-semibold shadow-sm", "bg-primary/10 text-primary font-semibold shadow-sm")
content = content.replace("bg-violet-500/20 text-violet-600 dark:text-violet-400", "bg-primary/20 text-primary")

# Active subitem
content = content.replace("bg-gradient-to-r from-violet-600 to-indigo-600 text-primary-foreground font-semibold shadow-md shadow-violet-500/20 translate-x-1", "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 translate-x-1")
# Just in case it was 'text-white' instead of 'text-primary-foreground' (I used text-white in my script earlier)
content = content.replace("bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-md shadow-violet-500/20 translate-x-1", "bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20 translate-x-1")

# Active main item
content = content.replace("bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold shadow-lg shadow-violet-500/25 scale-[1.02]", "bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 scale-[1.02]")

# The pulse dot bg
content = content.replace("bg-white animate-pulse", "bg-primary-foreground animate-pulse")
content = content.replace("bg-white/20 text-white", "bg-primary-foreground/20 text-primary-foreground")


with open("artifacts/housing/src/components/layout/AppLayout.tsx", "w", encoding="utf-8") as f:
    f.write(content)
