import { GoogleGenerativeAI } from "@google/generative-ai";

// نظام ذكي لاستدعاء المفتاح (Lazy Loading) يمنع انهيار التطبيق
function getGenAI() {
  const key = import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) {
    throw new Error("❌ فشل الاتصال: مفتاح VITE_GEMINI_API_KEY غير موجود في إعدادات Vercel. تأكد من إضافته وإعادة البناء.");
  }
  return new GoogleGenerativeAI(key);
}

// تطبيع النص العربي
function normalizeAr(s) {
  return (s || '').trim().replace(/\s+/g, ' ').toLowerCase()
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه')               
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\u0640/g, '')            
    .replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')               
}

function wordSimilarity(a, b) {
  const words = s => new Set(s.split(' ').filter(w => w.length >= 3))
  const A = words(a), B = words(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  A.forEach(w => { if (B.has(w)) inter++ })
  return inter / (A.size + B.size - inter)
}

export function findDuplicateTask(newTitle, existingTasks) {
  const n = normalizeAr(newTitle)
  if (!n) return null
  return existingTasks.find(t => {
    const e = normalizeAr(t.title)
    if (!e) return false
    if (e === n) return true
    if (n.length >= 15 && e.includes(n)) return true
    if (e.length >= 15 && n.includes(e)) return true
    if (wordSimilarity(n, e) >= 0.72) return true
    return false
  }) || null
}

export function isDuplicateTask(newTitle, existingTasks) {
  return findDuplicateTask(newTitle, existingTasks) !== null
}

// محادثة جيميناي
export async function callClaudeChat(apiKey, systemPrompt, messages) {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        systemInstruction: systemPrompt 
    });

    const geminiMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({
        history: geminiMessages.slice(0, -1), 
    });

    const lastMessage = geminiMessages[geminiMessages.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw new Error(error.message || "حدث خطأ غير معروف في المحادثة.");
  }
}

export function buildSmartChatSystem(activeTasks) {
  const summary = activeTasks.length
    ? activeTasks.slice(0, 30).map(t =>
        `- ${t.title}${t.projectName ? ` [${t.projectName}]` : ''}${t.person ? ` (${t.person})` : ''}`
      ).join('\n')
    : 'لا توجد مهام نشطة'

  return `أنت مساعد ذكي لإدارة المهام في مركز عمليات المختبرات بوزارة الصحة السعودية.

⚠️ قواعد مهمة جداً:
- استخرج فقط المهام الجديدة من كلام المستخدم. لا ترجع المهام الموجودة مسبقاً.
- "tasks" تحتوي فقط على المهام الجديدة المستخرجة من رسالة المستخدم الحالية.
- لو ما فيه مهام جديدة، ارجع tasks فارغة [].
- لو المستخدم ذكر شخص (مثل سعد)، حاول مطابقته مع أسماء الفريق.

المهام الموجودة (للمقارنة وكشف التكرار فقط — لا ترجعها):
${summary}

أرجع JSON فقط بهذا الشكل:
{
  "message": "رسالة موجزة تشرح ماذا فعلت",
  "tasks": [
    { "id": "t1", "title": "عنوان المهمة الجديدة", "priority": "urgent|medium|low", "person": "", "dueDate": "", "projectName": "" }
  ],
  "questions": [],
  "duplicates": [{ "taskId": "t1", "existingTitle": "مهمة مشابهة موجودة", "reason": "سبب التشابه" }],
  "ready": false
}`
}

export async function callClaude(apiKey, systemPrompt, userContent, modelName = 'gemini-2.5-flash') {
  try {
     const genAI = getGenAI();
     const model = genAI.getGenerativeModel({ 
        model: modelName,
        systemInstruction: systemPrompt 
    });
    
    const result = await model.generateContent(userContent);
    return result.response.text();
  } catch (error) {
     console.error("Gemini API Error:", error);
     throw new Error(error.message || "حدث خطأ في معالجة الطلب.");
  }
}

export const EXTRACT_SYSTEM = `أنت مساعد ذكي لاستخراج المهام من النصوص. أرجع JSON array فقط:
[{"title": "مهمة", "priority": "urgent|medium|low", "category": "work|personal|health", "subcategory": "leaders", "person": "", "dueDate": ""}]`

export const EXTRACT_SYSTEM_EN = EXTRACT_SYSTEM

export const PDF_MEETING_SYSTEM = `أنت مساعد لاستخراج مهام مركز عمليات المختبرات (LOC). أرجع JSON فقط:
{"meetingTitle": "اسم", "chairperson": "اسم", "suggestedProject": "مشروع", "tasks": []}`

export const ANALYZE_TASK_SYSTEM = `أنت مساعد لتحليل مهام LOC. أرجع JSON فقط:
{"priority": "urgent|medium|low", "category": "work", "subcategory": "leaders", "person": "", "projectName": "", "reason": "", "subTasks": []}`

export async function analyzeTaskWithAI(apiKey, taskTitle) {
  const text = await callClaude(apiKey, ANALYZE_TASK_SYSTEM, taskTitle, 'gemini-2.5-flash')
  try {
    return JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''))
  } catch {
    return null
  }
}

export const VISUAL_SUMMARY_SYSTEM = `أنت خبير مكتب إدارة المشاريع (PMO). حلل المهام وأرجع تقرير JSON يخدم د. منار سمان. 
أرجع JSON فقط بنفس الهيكل المعتمد مسبقاً وبدون أي نصوص إضافية خارج الـ JSON.`

const REPORT_OWNER_PATTERNS = ['منار', 'د. منار', 'منار سمان', 'د. منار سمان']

function stripOwnerFromPerson(personStr) {
  if (!personStr) return ''
  const parts = personStr.split(/[،,]/).map(p => p.trim()).filter(Boolean)
  if (parts.length <= 1) return personStr   
  const filtered = parts.filter(p => !REPORT_OWNER_PATTERNS.some(pat => p.includes(pat)))
  return filtered.length > 0 ? filtered.join('، ') : personStr
}

export async function generateVisualSummary(apiKey, tasks) {
  const today = new Date().toISOString().slice(0, 10)
  const slim = tasks.map(t => ({
    t: t.title, p: t.priority, c: t.category, f: t.projectName || '',
    w: stripOwnerFromPerson(t.person || ''), d: t.done ? 1 : 0, due: t.dueDate || '',
    ca: t.completedAt ? t.completedAt.slice(0, 10) : '',
  }))
  
  const promptText = `today=${today}\n${JSON.stringify(slim)}`;
  const raw = await callClaude(apiKey, VISUAL_SUMMARY_SYSTEM, promptText, 'gemini-2.5-flash');
  
  try {
     return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, ''));
  } catch (error) {
     throw new Error("فشل في استخراج التقرير المرئي.");
  }
}

export async function reviewByTaskExpert(apiKey, promptText) {
  const systemPrompt = `أنت خبير مكتب إدارة المشاريع (PMO). قدم ملاحظات احترافية ومختصرة.`;
  try {
     return await callClaude(apiKey, systemPrompt, JSON.stringify(promptText), 'gemini-2.5-flash');
  } catch (error) {
     return "تعذر إكمال مراجعة الخبير في الوقت الحالي.";
  }
}
