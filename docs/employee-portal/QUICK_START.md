# 🚀 Quick Start - Employee Portal Mobile

## البدء السريع

```bash
cd artifacts/employee-portal
npm install
npm run dev
```

الوصول: `http://localhost:10000`

---

## اختبار PWA

### على المتصفح (DevTools):

1. اضغط F12
2. اذهب لـ **Application** tab
3. فعّل **"Offline"** mode
4. يجب أن تظهر صفحة offline جميلة

### على الهاتف الفعلي:

1. استخدم نفس الشبكة المحلية
2. اذهب إلى `http://[pc-ip]:10000`
3. اضغط على تثبيت التطبيق
4. افتح التطبيق من الشاشة الرئيسية

---

## ملفات مهمة

| الملف                             | الوصف                    |
| --------------------------------- | ------------------------ |
| `vite.config.ts`                  | PWA + caching config     |
| `index.html`                      | Meta tags موجهة للموبايل |
| `public/manifest.json`            | PWA manifest             |
| `public/offline.html`             | Offline fallback         |
| `src/index.css`                   | Mobile-first styles      |
| `src/hooks/useMobileGestures.tsx` | Gesture hooks            |

---

## الميزات المضافة

✅ **Offline Support** - يعمل بدون انترنت  
✅ **Service Worker** - Caching ذكي  
✅ **Responsive Design** - موجه للموبايل  
✅ **PWA Install** - تثبيت كتطبيق  
✅ **Safe Area Support** - للـ iPhone notch  
✅ **Glass Effects** - تأثيرات حديثة  
✅ **Haptic Feedback** - اهتزازات اللمس  
✅ **Performance** - محسّن للموبايل

---

## أسئلة شائعة

**س: كيف أغيّر اللون الأساسي؟**
ج: عدّل في `vite.config.ts`:

```typescript
theme_color: "#your-color";
```

**س: كيف أعطّل الـ offline mode؟**
ج: في `vite.config.ts`:

```typescript
workbox: {
  cleanupOutdatedCaches: false,
}
```

**س: كيف أضيف أيقونة مخصصة؟**
ج: استبدل ملفات SVG في `public/icons/`

**س: كيف أختبر الـ notifications؟**
ج: في console:

```javascript
navigator.serviceWorker.ready.then((reg) => reg.showNotification("Hello!"));
```

---

## الأوامر المفيدة

```bash
# تطوير
npm run dev

# بناء
npm run build

# معاينة
npm run preview

# فحص الأخطاء
npm run lint
```

---

**النسخة:** 1.0.0  
**تم التحديث:** مايو 2026
