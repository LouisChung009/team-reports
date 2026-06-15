import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // textutil is macOS-only and not available on Firebase (Linux).
        // Please upload .docx format directly.
        return NextResponse.json(
            {
                error: "不支援 .doc 格式轉換。請將檔案另存為 .docx 格式後再上傳。",
                hint: "在 Word 中選擇「另存新檔」→ 格式選「.docx」即可。"
            },
            { status: 400 }
        );

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
