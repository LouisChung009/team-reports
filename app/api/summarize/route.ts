import { NextResponse } from "next/server";

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
const REQUEST_TIMEOUT_MS = 50_000; // 50s — leaves buffer before Firebase's 60s function timeout

async function callGemini(prompt: string, attempt = 1): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: controller.signal,
        });

        if (res.status === 503 && attempt < 3) {
            // Gemini temporarily overloaded — retry with backoff
            await new Promise(r => setTimeout(r, attempt * 2000));
            return callGemini(prompt, attempt + 1);
        }

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Gemini API ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } finally {
        clearTimeout(timer);
    }
}

export async function POST(req: Request) {
    if (!API_KEY) {
        console.error("GEMINI_API_KEY is not configured in the production environment.");
        return NextResponse.json(
            { error: "AI 功能未設定", details: "伺服器未設定 GEMINI_API_KEY，請聯絡管理員。" },
            { status: 503 }
        );
    }

    try {
        const { members, meetings } = await req.json();

        const memberNotes = members.map((member: any) => {
            const notes = meetings
                .map((m: any) => {
                    const status = m.attendance.find((a: any) => a.memberId === member.id);
                    if (status?.prayerRequest && status.prayerRequest.trim()) {
                        const date = new Date(m.date);
                        return `[${date.getDate()}日] ${status.prayerRequest}`;
                    }
                    return null;
                })
                .filter(Boolean);

            return { name: member.name, hasNotes: notes.length > 0, notes };
        }).filter((m: any) => m.hasNotes);

        if (memberNotes.length === 0) {
            return NextResponse.json({ summaries: [] });
        }

        const prompt = `
你是一個專業的小組報表助理。請根據以下成員的代禱事項與備註紀錄，為每位成員撰寫一段簡潔、溫暖的「近況與代禱事項」摘要。

規則：
1. 摘要長度：每人約 30-80 字。
2. 語氣：溫暖、關懷、正面。
3. 內容：整合多次的紀錄，去除重複資訊，保留關鍵事件（如生病、考試、工作變動）。
4. 格式：請務必回傳純粹的 valid JSON 格式，不要包含 Markdown 標記 (如 \`\`\`json)。
5. JSON 結構包含一個 'summaries' 陣列，每個物件有 'name' 和 'summary' 兩個欄位。

資料：
${JSON.stringify(memberNotes, null, 2)}
        `;

        const text = await callGemini(prompt);

        let jsonStr = text.trim();
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.slice(7).replace(/```$/, "").trim();
        } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.slice(3).replace(/```$/, "").trim();
        }

        const parsedData = JSON.parse(jsonStr);
        const summaries = parsedData.summaries ?? parsedData;

        return NextResponse.json({ summaries });

    } catch (error: any) {
        console.error("AI Summarization Error:", error);
        const isTimeout = error.name === "AbortError";
        return NextResponse.json(
            {
                error: "Failed to generate summary",
                details: isTimeout ? "AI 請求逾時，請稍後再試。" : error.message
            },
            { status: 500 }
        );
    }
}

