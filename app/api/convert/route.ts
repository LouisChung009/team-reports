import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        // Create temp directory
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "group-manager-"));
        const inputPath = path.join(tempDir, "input.doc");
        const outputPath = path.join(tempDir, "input.docx");

        // Write uploaded file to temp
        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(inputPath, buffer);

        // Run textutil to convert
        try {
            await execAsync(`textutil -convert docx -output "${outputPath}" "${inputPath}"`);
        } catch (error) {
            console.error("Textutil conversion failed:", error);
            return NextResponse.json({ error: "Conversion failed. Ensure you are on macOS." }, { status: 500 });
        }

        // Read the converted file
        const convertedBuffer = await fs.readFile(outputPath);

        // Cleanup
        await fs.rm(tempDir, { recursive: true, force: true });

        // Return the docx file
        return new NextResponse(convertedBuffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": 'attachment; filename="converted.docx"',
            },
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
