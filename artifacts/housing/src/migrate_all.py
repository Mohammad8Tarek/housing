import re
import os

files = [
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\settings\components\GeneralSettings.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\settings\components\DoorLocksSection.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\settings\components\HrSyncSection.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\settings\components\LookupSection.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\settings\hooks\useSettingsForm.ts",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\reports\index.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\pages\portal.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\components\PortalFoodTransport.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\components\PortalNotifications.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\components\PortalReports.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\components\PortalSchedule.tsx",
    r"E:\lab\Sunrise-Housing-FULL\final_project\artifacts\housing\src\hooks\use-websocket.ts"
]

def replacer(match):
    inner = match.group(1)
    is_error = 'variant: "destructive"' in inner or "variant: 'destructive'" in inner
    
    title = None
    desc = None
    
    title_m = re.search(r'title:\s*(.*?)(?:,\s*[a-zA-Z0-9_]+:|\s*$)', inner, re.DOTALL)
    if title_m:
        title = title_m.group(1).strip()
        if title.endswith(','): title = title[:-1].strip()
        
    desc_m = re.search(r'description:\s*(.*?)(?:,\s*[a-zA-Z0-9_]+:|\s*$)', inner, re.DOTALL)
    if desc_m:
        desc = desc_m.group(1).strip()
        if desc.endswith(','): desc = desc[:-1].strip()

    text = desc if desc else title
    if not text:
        text = '""'
        
    if is_error:
        return f'toast.error({text})'
    else:
        return f'toast.success({text})'

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. replace import
    if 'import { toast } from "sonner";' not in content and 'useToast' in content:
        content = re.sub(
            r'import\s*{\s*useToast\s*}\s*from\s*"@/hooks/use-toast";?\n?', 
            'import { toast } from "sonner";\n', 
            content
        )

    # 2. remove const { toast } = useToast();
    content = re.sub(r'[ \t]*const\s*{\s*toast\s*}\s*=\s*useToast\(\);?\n?', '', content)
    
    # 3. replace toast({ ... })
    content = re.sub(r'toast\(\{\s*(.*?)\s*\}\)', replacer, content, flags=re.DOTALL)
    
    # 4. specific fixes
    if "reports\\index.tsx" in filepath or "reports/index.tsx" in filepath:
        # Looking for .catch(() => {})
        content = re.sub(
            r'\.catch\(\(\)\s*=>\s*\{\s*\}\)',
            r'.catch(() => { toast.error(ar ? "فشل تصدير التقرير" : "Failed to export report"); })',
            content
        )
    
    if "HrSyncSection.tsx" in filepath:
        # Looking for .catch(() => {})
        content = re.sub(
            r'\.catch\(\(\)\s*=>\s*\{\s*\}\)',
            r'.catch(() => { toast.error(ar ? "فشل تحميل إعدادات المزامنة" : "Failed to load sync settings"); })',
            content
        )

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Migration completed.")
