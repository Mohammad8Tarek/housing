## 🚀 Sunrise Housing - Startup Guide

### ✅ الملفات المتوفرة:

| الملف | الوصف |
|------|-------|
| `backend.bat` | تشغيل Backend (Batch) |
| `backend.ps1` | تشغيل Backend (PowerShell) |
| `frontend.bat` | تشغيل Frontend (Batch) |
| `frontend.ps1` | تشغيل Frontend (PowerShell) |

---

## 🎯 البدء السريع:

### **الطريقة 1: Batch Files (الأسهل - Windows)**

#### 1. افتح Terminal و اضغط على الملف:
```
double-click backend.bat
```

#### 2. في terminal آخر:
```
double-click frontend.bat
```

---

### **الطريقة 2: PowerShell**

#### 1. Backend:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\backend.ps1
```

#### 2. Frontend (في PowerShell window جديد):
```powershell
.\frontend.ps1
```

---

## 📊 URLs:

| الخدمة | الرابط | المنفذ |
|--------|--------|--------|
| Backend API | http://localhost:4000/api | 4000 |
| Housing Portal | http://localhost:9000 | 9000 |
| Employee Portal | http://localhost:10000 | 10000 |

---

## ⚙️ الإعدادات:

### Database Connection (Backend):
```
DATABASE_URL=postgresql://postgres:admin123@localhost:5432/staff-housing
```

### Ports (Frontend):
```
Housing: 9000
Employee: 10000
API: 4000
```

---

## 🛑 الإيقاف:

- أغلق نوافذ التطبيقات (البات أو PowerShell)

---

**الآن جاهز للتشغيل! 🎉**
