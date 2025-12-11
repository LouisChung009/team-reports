import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize Gemini API
// Note: In production, use process.env.GEMINI_API_KEY
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyCiNmePcPLKPmKxyMQ1TiyDrUYwYB27He8";

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
4. 格式：請回傳 JSON 格式，包含一個陣列，每個物件有 'name' 和 'summary' 兩個欄位。

資料：
${JSON.stringify(memberNotes, null, 2)}
        `;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`;
        const aiResponse = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!aiResponse.ok) {
            const errText = await aiResponse.text();
            console.error("Gemini API Error Details:", errText);
            throw new Error(`Gemini API Error: ${aiResponse.status} ${aiResponse.statusText}`);
        }

        const data = await aiResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

        // Parse JSON from the response (removing markdown code blocks if any)
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        const summaries = JSON.parse(jsonStr);

        return NextResponse.json({ summaries });

    } catch (error) {
        console.error("AI Summarization Error:", error);
        return NextResponse.json(
            { error: "Failed to generate summary" },
            { status: 500 }
        );
    }
}
