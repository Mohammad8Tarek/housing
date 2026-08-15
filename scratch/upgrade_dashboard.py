import re

with open("artifacts/housing/src/pages/dashboard.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Stat Cards
old_card = '<Card className="h-full flex flex-col border-border hover:shadow-md hover:border-primary/30 transition-all">'
new_card = '<Card className="h-full flex flex-col bg-card/60 backdrop-blur-2xl border-border/50 shadow-lg hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/40 transition-all duration-500 relative overflow-hidden">'
content = content.replace(old_card, new_card)

# Add subtle inner glow to stat cards
old_header = '<CardHeader className="flex flex-row items-center justify-between pb-2">'
new_header = """<div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.15] pointer-events-none transition-opacity duration-500 group-hover:opacity-30 ${card.bg}`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">"""
content = content.replace(old_header, new_header)

old_card_content = '<CardContent className="flex-1 flex flex-col justify-end">'
new_card_content = '<CardContent className="flex-1 flex flex-col justify-end relative z-10">'
content = content.replace(old_card_content, new_card_content)

# Make the wrapper group for stat cards
content = content.replace('<div key={i} className="block h-full">', '<div key={i} className="block h-full group">')

# 2. General Cards (Tables, Charts, Activity)
# I will replace all instances of '<Card className="border-border' and '<Card className="col-span-'
content = content.replace('<Card className="border-border">', '<Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">')
content = content.replace('<Card className="col-span-4 border-border">', '<Card className="col-span-4 bg-card/70 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">')
content = content.replace('<Card className="col-span-3 border-border flex flex-col">', '<Card className="col-span-3 bg-card/70 backdrop-blur-xl border-border/50 shadow-xl flex flex-col overflow-hidden">')

# 3. Quick Links Cards
old_quick_link = '<Card className="border-border hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer text-center p-4 group h-full">'
new_quick_link = '<Card className="bg-card/60 backdrop-blur-lg border-border/50 shadow-lg hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 cursor-pointer text-center p-4 group h-full relative overflow-hidden">'
content = content.replace(old_quick_link, new_quick_link)

# Quick Link Inner Glow
old_quick_link_icon = '<div\n                      className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform`}'
new_quick_link_icon = """<div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-30 ${item.color.split(' ')[1]}`} />
                    <div
                      className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform relative z-10`}"""
content = content.replace(old_quick_link_icon, new_quick_link_icon)

# 4. Table Row styling
content = content.replace('className="border-b border-border/50 hover:bg-muted/40 cursor-pointer transition-colors"', 'className="border-b border-border/40 hover:bg-muted/60 cursor-pointer transition-all duration-200 hover:shadow-sm"')

# 5. Departure Alerts
content = content.replace('className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors cursor-pointer"', 'className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden"')

with open("artifacts/housing/src/pages/dashboard.tsx", "w", encoding="utf-8") as f:
    f.write(content)
