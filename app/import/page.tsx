"use client";

import { useState } from "react";
import mammoth from "mammoth";
import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, FileText, Check, AlertCircle, Loader2 } from "lucide-react";

export default function ImportPage() {
    const { user } = useAuth();
    const [uploading, setUploading] = useState(false);
    const [previewData, setPreviewData] = useState<string[][] | null>(null);
    const [logs, setLogs] = useState<string[]>([]);

    // Column Status Management
    // We map column index (visual index in preview) to a status object
    type ColumnStatus = {
        type: "normal" | "holiday" | "skip";
        reason?: string;
    };

    // Default is normal. We store overrides.
    const [columnStatuses, setColumnStatuses] = useState<Map<number, ColumnStatus>>(new Map());

    const setColumnType = (index: number, type: "normal" | "holiday" | "skip") => {
        setColumnStatuses(prev => {
            const next = new Map(prev);
            const current = next.get(index) || { type: "normal" };
            next.set(index, { ...current, type });
            return next;
        });
    };

    const setColumnReason = (index: number, reason: string) => {
        setColumnStatuses(prev => {
            const next = new Map(prev);
            const current = next.get(index) || { type: "normal" };
            next.set(index, { ...current, reason });
            return next;
        });
    };

    const getColumnStatus = (index: number): ColumnStatus => {
        return columnStatuses.get(index) || { type: "normal" };
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setLogs(["讀取檔案中..."]);

        try {
            let arrayBuffer: ArrayBuffer;

            // Check if file is .doc
            if (file.name.toLowerCase().endsWith(".doc")) {
                setLogs(prev => [...prev, "🔄 偵測到舊版 .doc 格式，正在自動轉檔中..."]);

                const formData = new FormData();
                formData.append("file", file);

                const response = await fetch("/api/convert", {
                    method: "POST",
                    body: formData,
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || "轉檔失敗");
                }

                setLogs(prev => [...prev, "✅ 轉檔成功！開始分析..."]);
                arrayBuffer = await response.arrayBuffer();
            } else {
                arrayBuffer = await file.arrayBuffer();
            }

            const result = await mammoth.convertToHtml({ arrayBuffer });
            const html = result.value;
            const messages = result.messages; // Any warnings

            // Log warnings
            messages.forEach(msg => {
                const typeIcon = msg.type === "error" ? "❌" : "⚠️";
                setLogs(prev => [...prev, `${typeIcon} [Mammoth]: ${msg.message}`]);
            });

            if (!html) {
                setLogs(prev => [...prev, "❌ 解析結果為空"]);
            } else {
                // For debug: simplified raw preview if table missing
                if (!html.includes("<table")) {
                    setLogs(prev => [...prev, "ℹ️ 提示：Mammoth 未偵測到標準表格標籤。可能原因：表格位於文字方塊中或使用了特殊排版。"]);
                    setLogs(prev => [...prev, "--- 解析內容 (前 200 字) ---"]);
                    setLogs(prev => [...prev, html.substring(0, 200).replace(/<[^>]*>?/gm, '') + "..."]);
                }
            }

            parseHtmlTable(html);
        } catch (error) {
            console.error("Error parsing file:", error);
            setLogs(prev => [...prev, typeof error === 'object' && error !== null && 'message' in error ? `❌ ${(error as any).message}` : "❌ 檔案解析失敗"]);
            setUploading(false);
        }
    };

    const parseHtmlTable = (html: string) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const tables = doc.querySelectorAll("table");

        // Normalize names to align attendance rows and notes rows (remove leading numbers and punctuation)
        const normalizeName = (raw: string) =>
            raw
                .replace(/^[0-9０-９]+[\\.．、﹒﹑]?/, "")
                .replace(/[:：]/g, "")
                .replace(/\s+/g, "")
                .trim();

        const splitNames = (raw: string) =>
            raw
                .split(/(?=[0-9０-９]+[\\.．、﹒﹑]?)/)
                .map(normalizeName)
                .filter(Boolean);

        if (tables.length === 0) {
            setLogs(prev => [...prev, "⚠️ 找不到標準表格，嘗試從文字段落解析..."]);
            return parseRawText(doc);
        }

        // --- Table 1: Attendance ---
        // It's possible the "Notes Table" is actually just the bottom part of Table 1.

        const attTable = tables[0];
        const attRows = Array.from(attTable.querySelectorAll("tr"));
        setLogs(prev => [...prev, `✅ 找到 ${tables.length} 個表格，正在分析...`]);

        const preview: string[][] = [];
        const nameMap = new Map<string, number>();

        let headerFound = false;
        let parsingNotes = false; // Check if we switched to updates section
        // Keep an explicit notes column so member updates won't overwrite the last numeric column (e.g. 出席次數)
        let noteColumnIndex = -1;

        for (let i = 0; i < attRows.length; i++) {
            const cells = Array.from(attRows[i].querySelectorAll("td, th")).map(cell => cell.textContent?.trim() || "");
            const firstCell = cells[0];

            // 1. Detect Section Headers
            if (["組員近況", "關懷名單", "小組長近況"].some(k => firstCell.includes(k))) {
                if (firstCell.includes("組員近況")) {
                    setLogs(prev => [...prev, `📝 偵測到「組員近況」區塊，切換至備註解析模式...`]);
                    parsingNotes = true;
                } else {
                    // Other sections we might not parse yet or stop
                    setLogs(prev => [...prev, `ℹ️ 抵達「${firstCell}」，略過後續內容。`]);
                    // If it's "Care List" or "Leader Update", we might stop completely for now?
                    // Or just stop parsing notes.
                    // For now, let's treat "組員近況" as the start of notes, and anything else as end?
                    // User said: "Care List" is after "Member Updates". So we can stop here if we want only updates.
                    // But let's be safe.
                }
                continue; // Skip the header row itself
            }

            // 2. Header Row (only relevant if NOT parsing notes)
            if (!parsingNotes && !headerFound) {
                const isDateRow = cells.slice(1).some(c => /(\d{1,2})[月\.](\d{1,2})/.test(c));
                if (isDateRow || i === 0) {
                    headerFound = true;
                    noteColumnIndex = cells.length;
                    const headerRow = [...cells, "出席狀況/備註"];
                    preview.push(headerRow);
                    continue;
                }
            }

            // 3. Process Row based on Mode
            if (parsingNotes) {
                // Parsing [Name, Note]
                // Be loose: Name is first non-empty? Or First cell?
                // Usually Name is Col 0.
                if (!firstCell || firstCell.length > 20) continue; // Noise?

                const names = splitNames(firstCell);
                const note = cells.slice(1).join(" ").trim();

                names.forEach((name) => {
                    const rowIndex = nameMap.get(name);
                    if (rowIndex !== undefined && note) {
                        const existingRow = preview[rowIndex];
                        if (noteColumnIndex === -1) {
                            noteColumnIndex = existingRow.length;
                            // Backfill header if missing (defensive)
                            if (preview[0]) {
                                preview[0].push("出席狀況/備註");
                            }
                        }
                        while (existingRow.length <= noteColumnIndex) {
                            existingRow.push("");
                        }
                        const currentNote = existingRow[noteColumnIndex];
                        // Append
                        if (!currentNote?.includes(note)) {
                            existingRow[noteColumnIndex] = currentNote ? `${currentNote}; ${note}` : note;
                        }
                    }
                });
            } else {
                // Parsing Attendance (Standard)
                if (!firstCell || firstCell.length > 20 || ["總計", "出席", "統計"].some(k => firstCell.includes(k))) continue;

                // Status Row Heuristic: only treat as status row if explicit keyword is present
                const isStatusRow = ["狀況", "事項", "代禱", "備註", "出席率", "信息分享", "當週出席率"].some(k => firstCell.includes(k));

                if (isStatusRow && preview.length > 1) {
                    const lastRow = preview[preview.length - 1];
                    const contentToMerge = cells.filter(c => c).join(" ");
                    if (contentToMerge) {
                        lastRow[lastRow.length - 1] = (lastRow[lastRow.length - 1] + " " + contentToMerge).trim();
                    }
                    continue;
                }

                const normalized = normalizeName(firstCell);
                if (nameMap.has(normalized)) continue; // Dedupe

                const row = [normalized, ...cells.slice(1)];
                if (noteColumnIndex !== -1) {
                    while (row.length <= noteColumnIndex) {
                        row.push("");
                    }
                }

                preview.push(row);
                nameMap.set(normalized, preview.length - 1);
            }
        }

        // --- Table 2: Member Updates (Fallback) ---
        // If the notes are indeed in a separate table (Table 2), this will catch them.
        // It won't hurt to run this even if we parsed notes in Table 1 (validation via nameMap).
        if (tables.length > 1) {
            setLogs(prev => [...prev, "📝 檢查額外表格..."]);
            const noteTable = tables[1]; // Or subsequent tables?
            // Actually, maybe ALL subsequent tables could be notes?
            // Let's just check Table 1 for now as per user description.

            const noteRows = Array.from(noteTable.querySelectorAll("tr"));
            for (const row of noteRows) {
                const cells = Array.from(row.querySelectorAll("td, th")).map(c => c.textContent?.trim() || "");
                if (cells.length < 2) continue;

                // Look for "組員近況" header in Table 2 too?
                if (cells[0].includes("組員近況")) continue;

                const names = splitNames(cells[0]);
                const note = cells.slice(1).join(" ").trim();

                names.forEach((name) => {
                    const rowIndex = nameMap.get(name);
                    if (rowIndex !== undefined && note) {
                        const existingRow = preview[rowIndex];
                        if (noteColumnIndex === -1) {
                            noteColumnIndex = existingRow.length;
                            // Backfill header if missing (defensive)
                            if (preview[0]) {
                                preview[0].push("出席狀況/備註");
                            }
                        }
                        while (existingRow.length <= noteColumnIndex) {
                            existingRow.push("");
                        }
                        const currentNote = existingRow[noteColumnIndex];
                        if (!currentNote?.includes(note)) {
                            existingRow[noteColumnIndex] = currentNote ? `${currentNote}; ${note}` : note;
                        }
                    }
                });
            }
        }

        // If we failed to produce a reasonable table, fallback to text parser
        if (!headerFound || (preview[0]?.length || 0) <= 2) {
            setLogs(prev => [...prev, "⚠️ 偵測到表格欄位不足，改用文字模式解析"]);
            return parseRawText(doc);
        }

        setPreviewData(preview);
        setColumnStatuses(new Map());
        setUploading(false);
    };

    const parseRawText = (doc: Document) => {
        const fullText = doc.body.textContent || "";
        setLogs(prev => [...prev, "ℹ️ 進入進階文字解析模式 (串流模式 v2)"]);

        // 1. Split Header and Body using the first member index "1."
        // This helps isolate the Date section.
        const firstMemberIndex = fullText.search(/[1１][.、]/);
        if (firstMemberIndex === -1) {
            setLogs(prev => [...prev, "❌ 無法偵測到 '1.' 成員編號，無法切分標題與內容"]);
            setUploading(false);
            return;
        }

        const headerText = fullText.substring(0, firstMemberIndex);
        const bodyText = fullText.substring(firstMemberIndex);

        // 2. Parse Dates from Header
        // Handle standard "2月7日" and abbreviated "14日" (inheriting month)
        // Pattern: (Month)M(Day)D ... (Day)D ...

        let dateColumns: { index: number; date: Date }[] = [];
        const yearMatch = headerText.match(/20\d{2}/);
        const reportYear = yearMatch ? parseInt(yearMatch[0]) : new Date().getFullYear();

        // Strategy: Find all numbers usually accompanied by date markers
        // Full date: (\d+)月(\d+)日?
        // Abbr date: (\d+)日
        // We scan linearly.

        // Regex for "2月7日" or "2/7"
        const fullDateRegex = /(\d{1,2})[月\.](\d{1,2})/g;
        // Regex for just "7日" or just "21" (if surrounded by dates? risky)
        // Let's stick to explicit markers if possible. The log showed "2月7日14日..."

        // New Strategy: Match all date-like strings
        // First pass: find full dates to set Month context
        // Then look for subsequent numbers followed by "日"?

        // Simple linear scan for "X月X" or "X日"
        const tokenRegex = /(\d{1,2})[月\.](\d{1,2})|[月\.]?(\d{1,2})[日]/g;
        // 1: Month, 2: Day (in X月X)
        // 3: Day (in X日)

        let currentMonth = -1;

        // Let's try matching carefully.
        // It's easier to regex for the specific "Month/Day" then "Day" pattern if they are adjacent.
        // e.g. "2月7日14日21日"

        // Normalize header: replace spaces
        const cleanHeader = headerText.replace(/\s+/g, '');

        // Match primary full dates first? No, order matters.
        // Let's use a smarter regex loop
        const smartDateRegex = /(\d{1,2})[月\.](\d{1,2})|(\d{1,2})日/g;

        let match;
        while ((match = smartDateRegex.exec(cleanHeader)) !== null) {
            let m, d;
            if (match[1] && match[2]) {
                // Format: 2月7
                m = parseInt(match[1]);
                d = parseInt(match[2]);
                currentMonth = m;
            } else if (match[3]) {
                // Format: 14日
                if (currentMonth === -1) continue; // Skip if no month context yet
                m = currentMonth;
                d = parseInt(match[3]);
            } else {
                continue;
            }

            // Validate
            if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                const dateVal = new Date(reportYear, m - 1, d);
                // Dedupe by string key
                if (!dateColumns.some(dc => dc.date.getTime() === dateVal.getTime())) {
                    dateColumns.push({ index: dateColumns.length, date: dateVal });
                }
            }
        }

        if (dateColumns.length === 0) {
            // Fallback: standard regex search in text
            setLogs(prev => [...prev, "⚠️ 標題模式找不到日期，嘗試全域搜尋..."]);
            const standardMatches = Array.from(headerText.matchAll(/(\d{1,2})[/\.](\d{1,2})/g));
            standardMatches.forEach(m => {
                const dateVal = new Date(reportYear, parseInt(m[1]) - 1, parseInt(m[2]));
                dateColumns.push({ index: dateColumns.length, date: dateVal });
            });
        }

        setLogs(prev => [...prev, `📅 偵測到日期 (${dateColumns.length}天)：${dateColumns.map(d => d.date.toLocaleDateString()).join(", ")}`]);

        // 3. Parse Body (Members)
        // Split by "Index."
        const parts = bodyText.split(/(\d+[.、])/);
        const preview: string[][] = [];

        // Header Row
        preview.push(["姓名", ...dateColumns.map(d => d.date.toLocaleDateString()), "狀況/備註"]);

        let memberCount = 0;

        for (let i = 1; i < parts.length; i += 2) {
            const marker = parts[i];
            const content = parts[i + 1];
            if (!marker || !content) continue;

            const cleanContent = content.trim();

            // Parse Name
            // Name is usually the first 2-4 chars (Chinese).
            let name = "";
            let remaining = "";

            // Try matching Chinese Name
            const nameMatch = cleanContent.match(/^([\u4e00-\u9fa5\s\.]{2,5})/);
            if (nameMatch) {
                name = nameMatch[0].replace(/\s/g, '');
                remaining = cleanContent.substring(nameMatch[0].length).trim();
            } else {
                // Fallback splitting
                const splitIdx = cleanContent.search(/[vV✓Oo0-9]/);
                if (splitIdx > 0) {
                    name = cleanContent.substring(0, splitIdx).trim();
                    remaining = cleanContent.substring(splitIdx).trim();
                } else {
                    name = cleanContent;
                    remaining = "";
                }
            }

            if (name.includes("出席") || name.length > 10) continue; // Noise

            // Parse Attendance & Notes
            const markRegex = /^([vV✓Oo0]+)/;
            const markMatch = remaining.match(markRegex);

            let marksStr = "";
            let notesStr = "";

            if (markMatch) {
                marksStr = markMatch[1];
                notesStr = remaining.substring(marksStr.length).trim();
            } else {
                notesStr = remaining;
            }

            // Map marks to columns
            const rowData = [name];
            for (let d = 0; d < dateColumns.length; d++) {
                if (d < marksStr.length) {
                    const char = marksStr[d].toUpperCase().replace('0', 'O');
                    rowData.push(char);
                } else {
                    rowData.push("");
                }
            }

            // Add Notes/Stats
            rowData.push(notesStr);

            preview.push(rowData);
            memberCount++;
        }

        if (memberCount === 0) {
            setLogs(prev => [...prev, "❌ 串流模式無法解析成員，請確認格式。"]);
            setUploading(false);
            return;
        }

        setLogs(prev => [...prev, `✅ 解析成功！找到 ${memberCount} 位成員資料`]);
        setPreviewData(preview);

        // Reset column statuses
        setColumnStatuses(new Map());

        setUploading(false);
    };

    const handleImport = async () => {
        if (!user || !previewData) return;
        setUploading(true);
        setLogs(prev => [...prev, "🚀 開始分析並匯入資料..."]);

        try {
            // 1. Identify Header Row (Dates)
            // Look for a row that has date-like strings
            let headerRowIndex = -1;
            let dateColumns: { index: number; date: Date }[] = [];

            for (let i = 0; i < previewData.length; i++) {
                const row = previewData[i];
                const foundDates = [];
                let monthContext: number | null = null;
                const currentYear = new Date().getFullYear();

                for (let j = 0; j < row.length; j++) {
                    const cell = (row[j] || "").trim();
                    if (!cell) continue;

                    // Update month context if we see "2月"
                    const onlyMonth = cell.match(/^(\d{1,2})月$/);
                    if (onlyMonth) {
                        monthContext = parseInt(onlyMonth[1], 10);
                        continue;
                    }

                    // 2/2 or 2.2
                    const mdSlash = cell.match(/(\d{1,2})[\/\.](\d{1,2})/);
                    if (mdSlash) {
                        const m = parseInt(mdSlash[1], 10);
                        const d = parseInt(mdSlash[2], 10);
                        const date = new Date(currentYear, m - 1, d);
                        if (!isNaN(date.getTime())) {
                            foundDates.push({ index: j, date });
                            monthContext = m;
                        }
                        continue;
                    }

                    // 2月7日 或 2月7
                    const mdHan = cell.match(/(\d{1,2})月(\d{1,2})日?/);
                    if (mdHan) {
                        const m = parseInt(mdHan[1], 10);
                        const d = parseInt(mdHan[2], 10);
                        const date = new Date(currentYear, m - 1, d);
                        if (!isNaN(date.getTime())) {
                            foundDates.push({ index: j, date });
                            monthContext = m;
                        }
                        continue;
                    }

                    // 7日（承接前面的月）
                    const dHan = cell.match(/(\d{1,2})日/);
                    if (dHan && monthContext !== null) {
                        const d = parseInt(dHan[1], 10);
                        const date = new Date(currentYear, monthContext - 1, d);
                        if (!isNaN(date.getTime())) {
                            foundDates.push({ index: j, date });
                        }
                        continue;
                    }
                }

                if (foundDates.length >= 1) {
                    headerRowIndex = i;
                    dateColumns = foundDates;
                    setLogs(prev => [...prev, `📅 偵測到標題列 (第 ${i + 1} 列)，包含 ${foundDates.length} 個聚會日期`]);
                    break;
                }
            }

            if (headerRowIndex === -1) {
                throw new Error("無法偵測到日期欄位，請確認表格包含日期 (如 2/2)");
            }

            // 2. Fetch Existing Members to match
            const membersRef = collection(db, "members");
            const membersSnapshot = await getDocs(membersRef);
            const existingMembers = new Map(membersSnapshot.docs.map(d => [d.data().name, d.id]));

            // 3. Process Rows
            let newMembersCount = 0;
            // Map keys: date string. Value: Meeting Data
            let meetingsMap = new Map<string, { date: Date; attendance: any[]; notes: string; type: "normal" | "holiday" }>();

            // Initialize meetings map from date columns
            dateColumns.forEach((col, idx) => {
                // Verify Status
                // The previewData column index for this date is col.index.
                // But wait, the `col.index` is the index in the ROW.
                // So getColumnStatus(col.index) should work.

                const status = getColumnStatus(col.index);

                if (status.type === 'skip') {
                    setLogs(prev => [...prev, `🚫 已略過欄位: ${col.date.toLocaleDateString()}`]);
                    return; // Don't create meeting entry
                }

                const key = col.date.toISOString();
                meetingsMap.set(key, {
                    date: col.date,
                    attendance: [],
                    notes: status.reason || "匯入資料",
                    type: status.type === 'holiday' ? 'holiday' : 'normal'
                });
            });

            const rows = previewData.slice(headerRowIndex + 1);
            for (const row of rows) {
                const name = row[0]?.trim(); // Assuming First column is Name

                // Extra safety: Skip if name looks like a note/status that wasn't merged
                // - Name > 5 chars and Chinese
                // - Contains specific keywords
                const isInvalidName = (name.length > 5 && /[\u4e00-\u9fa5]/.test(name)) ||
                    ["狀況", "事項", "代禱", "備註", "總計"].some(k => name.includes(k)) ||
                    name.includes("新朋友");

                if (!name || isInvalidName) continue;

                let memberId = existingMembers.get(name);

                // Create Member if not exists
                if (!memberId) {
                    setLogs(prev => [...prev, `👤 新增成員: ${name}`]);
                    const newMemberRef = await addDoc(collection(db, "members"), {
                        name,
                        role: "member",
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    memberId = newMemberRef.id;
                    existingMembers.set(name, memberId);
                    newMembersCount++;
                }

                // Process Attendance for this member
                dateColumns.forEach((col) => {
                    // Check if this meeting exists (was skipped?)
                    const key = col.date.toISOString();
                    const meeting = meetingsMap.get(key);

                    if (!meeting) return; // Skipped

                    // If it's a holiday, we might default everyone to NOT present, but existing attendance marks?
                    // Usually holiday = empty column.
                    // But if user marked a column as holiday, we still parse the column?
                    // Yes, just in case. But commonly holiday = empty.

                    const rowContent = row.slice(1, row.length - 1);
                    // Use col.index for the preview table row access?
                    // row is the full row content from previewData.
                    const cellContent = row[col.index]?.trim() || "";
                    const isPresent = ["v", "V", "✓", "O", "o", "1"].some(mark => cellContent.includes(mark));

                    let prayerRequest = undefined;
                    const notesCol = row[row.length - 1]?.trim();

                    // Find "Latest Date Column" that is NOT SKIPPED/HOLIDAY?
                    // Logic: Attach notes to the *last processed type=normal meeting*?
                    // Or simply the last meeting in the map.

                    const sortedDates = Array.from(meetingsMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
                    const lastMeeting = sortedDates[sortedDates.length - 1];

                    // Attach note only if this is the last meeting date
                    if (meeting.date.getTime() === lastMeeting?.date.getTime() && notesCol) {
                        prayerRequest = notesCol;
                    }

                    if (isPresent || prayerRequest) {
                        const record: any = {
                            memberId,
                            memberName: name,
                            present: isPresent,
                        };
                        if (prayerRequest) {
                            record.prayerRequest = prayerRequest;
                        }
                        meeting.attendance.push(record);
                    }
                });
            }

            // 4. Save Meetings
            setLogs(prev => [...prev, `💾 正在儲存 ${meetingsMap.size} 筆聚會記錄...`]);

            for (const meeting of Array.from(meetingsMap.values())) {
                // If holiday, attendance might be empty. That's fine.
                // If normal and attendance empty? Also fine, maybe nobody came (unlikely but possible).

                // Check dupes
                const q = query(
                    collection(db, "meetings"),
                    where("date", "==", meeting.date)
                );
                const querySnap = await getDocs(q);

                if (!querySnap.empty) {
                    setLogs(prev => [...prev, `⚠️ 跳過重複日期: ${meeting.date.toLocaleDateString()}`]);
                    continue;
                }

                // If holiday, ensure we save the type
                await addDoc(collection(db, "meetings"), {
                    date: meeting.date,
                    attendance: meeting.attendance,
                    newVisitors: [],
                    totalAttendance: meeting.attendance.filter((a: any) => a.present).length,
                    notes: meeting.notes,
                    type: meeting.type, // Save type
                    createdBy: user.uid,
                    createdAt: serverTimestamp()
                });
            }

            setLogs(prev => [...prev, `✅ 匯入完成！新增 ${newMembersCount} 位成員，${meetingsMap.size} 場聚會。`]);

        } catch (error) {
            console.error(error);
            setLogs(prev => [...prev, `❌ 錯誤: ${error}`]);
        } finally {
            setUploading(false);
        }
    };

    if (!user) return <div className="p-8 text-center">請先登入</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" />
                匯入舊資料
            </h1>

            <div className="bg-white p-6 rounded-lg shadow dark:bg-gray-800">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <input
                        type="file"
                        accept=".docx,.doc"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                        disabled={uploading}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-300">
                            點擊上傳 Word (.docx / .doc) 報表檔案
                        </span>
                        <span className="text-xs text-gray-400">
                            支援月報表格式 (舊版 .doc 會自動轉檔)
                        </span>
                    </label>
                </div>
            </div>

            {previewData && (
                <div className="bg-white p-6 rounded-lg shadow dark:bg-gray-800">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex justify-between items-center">
                        <span>預覽資料</span>
                        <button
                            onClick={handleImport}
                            disabled={uploading}
                            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            確認匯入
                        </button>
                    </h2>
                    {/* Preview Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-800">
                                <tr>
                                    {previewData[0].map((header, i) => {
                                        const isDateCol = i > 0 && i < previewData[0].length - 1;
                                        const status = getColumnStatus(i);

                                        return (
                                            <th key={i} className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${status.type === 'skip' ? 'text-gray-300 decoration-line-through' : 'text-gray-500 dark:text-gray-300'}`}>
                                                <div className="flex flex-col gap-2 min-w-[140px]">
                                                    <span className="font-bold text-sm">{header}</span>
                                                    {isDateCol && (
                                                        <div className="flex flex-col gap-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded">
                                                            <select
                                                                value={status.type}
                                                                onChange={(e) => setColumnType(i, e.target.value as any)}
                                                                className="text-xs p-1 border rounded"
                                                            >
                                                                <option value="normal">✅ 正常聚會</option>
                                                                <option value="holiday">🏖️ 特殊/假日</option>
                                                                <option value="skip">🚫 不匯入</option>
                                                            </select>

                                                            {status.type === "holiday" && (
                                                                <input
                                                                    type="text"
                                                                    placeholder="原因 (如: 過年)"
                                                                    value={status.reason || ""}
                                                                    onChange={(e) => setColumnReason(i, e.target.value)}
                                                                    className="text-xs p-1 border rounded w-full"
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                                {previewData.slice(1).map((row, rowIndex) => (
                                    <tr key={rowIndex}>
                                        {row.map((cell, cellIndex) => {
                                            const status = getColumnStatus(cellIndex);
                                            return (
                                                <td key={cellIndex} className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${status.type === 'skip' ? 'bg-gray-100 dark:bg-gray-800 opacity-30' : ''}`}>
                                                    {cell}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {logs.length > 0 && (
                <div className="bg-gray-50 p-4 rounded-lg dark:bg-gray-700/50 text-sm font-mono">
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1">{log}</div>
                    ))}
                </div>
            )}
        </div>
    );
}
