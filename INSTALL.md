# تثبيت مهامي Pro على الآيفون

## الطريقة الأسرع — نشر على Vercel (مجاناً)

```bash
npm install -g vercel
npm run build
vercel --prod
```

ستحصل على رابط مثل: `https://mytasks-xxx.vercel.app`

---

## تثبيته كتطبيق على آيفون 11

1. افتح Safari (ليس Chrome)
2. اذهب للرابط
3. اضغط زر **المشاركة** (الأسهم) في الأسفل
4. اختر **"إضافة إلى الشاشة الرئيسية"**
5. اضغط **"إضافة"**

سيظهر التطبيق كأيقونة على الهوم سكرين ✅
عند الفتح يعمل بدون شريط Safari وبدون إنترنت (Offline).

---

## إعداد Claude API (للاستخراج الذكي)

1. اذهب لـ [console.anthropic.com](https://console.anthropic.com)
2. أنشئ API Key
3. في التطبيق اضغط **⚙️ API** في الأعلى
4. أدخل المفتاح واضغط حفظ

---

## تشغيل محلياً للتطوير

```bash
npm install
npm run dev
```
