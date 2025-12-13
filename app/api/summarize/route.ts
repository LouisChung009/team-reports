import { NextResponse } from "next/server";

// Initialize Gemini API
// Note: In production, use process.env.GEMINI_API_KEY
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCiNmePcPLKPmKxyMQ1TiyDrUYwYB27He8";

export const maxDuration = 60; // Allow 60 seconds for AI generation

export async function POST(req: Request) {
    try {
        const { members, meetings, month } = await req.json();

        // Prepare data for the prompt
        // Structure: Member Name -> [Date: Note, Date: Note...]
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

            return {
                name: member.name,
                hasNotes: notes.length > 0,
                notes: notes
            };
        }).filter((m: any) => m.hasNotes);

        if (memberNotes.length === 0) {
            return NextResponse.json({ summaries: [] });
        }

        // Construct Prompt
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

        // Use the stable model version
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

        const aiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error("Gemini API Error Details:", errText);
            throw new Error(`Gemini API Error: ${aiResponse.status} ${aiResponse.statusText} - ${errText}`);
        }

        const data = await aiResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        console.log("Gemini Raw Response:", text); // Debug log

        // Robust JSON parsing
        let jsonStr = text.trim();
        // Remove markdown code blocks if present (even though we asked not to)
        if (jsonStr.startsWith("```json")) {
            jsonStr = jsonStr.replace(/^```json/, "").replace(/```$/, "");
        } else if (jsonStr.startsWith("```")) {
            jsonStr = jsonStr.replace(/^```/, "").replace(/```$/, "");
        }

        const parsedData = JSON.parse(jsonStr);
        // Normalize response structure (some models might return array directly if prompted differently)
        const summaries = parsedData.summaries || parsedData;

        return NextResponse.json({ summaries });

    } catch (error: any) {
        console.error("AI Summarization Error:", error);
        return NextResponse.json(
            { error: "Failed to generate summary", details: error.message },
            { status: 500 }
        );
    }
}

