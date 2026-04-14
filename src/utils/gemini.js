import { GoogleGenerativeAI } from "@google/generative-ai";

// جلب المفتاح الذي أضفناه في Vercel باستخدام صيغة Vite
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function generateGeminiResponse(promptText) {
    try {
        // نستخدم نموذج gemini-1.5-flash السريع
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        
        const result = await model.generateContent(promptText);
        const response = await result.response;
        
        return {
            success: true,
            data: response.text()
        };
    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            success: false,
            error: "حدث خطأ أثناء الاتصال بجيميناي. الرجاء المحاولة لاحقاً."
        };
    }
}
