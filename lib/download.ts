import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
import * as XLSX from "xlsx";

// Custom download helper that properly sets filename
const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

interface AttendanceRecord {
    memberId: string;
    memberName: string;
    present: boolean;
}

interface NewVisitor {
    name: string;
    phone?: string;
    notes?: string;
}

interface MeetingData {
    date: Date;
    attendance: AttendanceRecord[];
    newVisitors: NewVisitor[];
    totalAttendance: number;
    notes?: string;
}

export const downloadMeetingWord = async (meeting: MeetingData) => {
    const dateStr = meeting.date.toLocaleDateString("zh-TW", { year: 'numeric', month: 'long', day: 'numeric' });
    const title = `${dateStr} 小組報表`;

    // Members Table Rows
    const memberRows = meeting.attendance.map(record =>
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(record.memberName)] }),
                new TableCell({ children: [new Paragraph(record.present ? "V" : "")] }),
            ],
        })
    );

    // Visitors Table
    const visitorRows = meeting.newVisitors.map(v =>
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(v.name)] }),
                new TableCell({ children: [new Paragraph(v.phone || "")] }),
                new TableCell({ children: [new Paragraph(v.notes || "")] }),
            ],
        })
    );

    const doc = new Document({
        sections: [
            {
                properties: {},
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: title,
                                bold: true,
                                size: 32,
                            }),
                        ],
                        spacing: { after: 400 },
                    }),
                    new Paragraph({
                        text: `總出席人數：${meeting.totalAttendance}`,
                        spacing: { after: 200 }
                    }),
                    new Paragraph({
                        text: `聚會備註：${meeting.notes || "無"}`,
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: "小組成員出席狀況", bold: true, size: 24 })],
                        spacing: { after: 200 }
                    }),
                    new Table({
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "姓名", bold: true })] })], width: { size: 3000, type: WidthType.DXA } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "出席", bold: true })] })], width: { size: 1000, type: WidthType.DXA } }),
                                ],
                            }),
                            ...memberRows,
                        ],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }),
                    new Paragraph({
                        text: "",
                        spacing: { after: 400 }
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: "新朋友名單", bold: true, size: 24 })],
                        spacing: { after: 200 }
                    }),
                    visitorRows.length > 0 ? new Table({
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "姓名", bold: true })] })], width: { size: 2000, type: WidthType.DXA } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "電話", bold: true })] })], width: { size: 2000, type: WidthType.DXA } }),
                                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "備註", bold: true })] })], width: { size: 4000, type: WidthType.DXA } }),
                                ],
                            }),
                            ...visitorRows,
                        ],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }) : new Paragraph("本週無新朋友"),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${title}.docx`);
};

export const downloadMeetingExcel = (meeting: MeetingData) => {
    const dateStr = meeting.date.toLocaleDateString("zh-TW");
    const filename = `${dateStr}_小組報表.xlsx`;

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Summary & Members
    const summaryData = [
        ["日期", dateStr],
        ["總出席人數", meeting.totalAttendance],
        ["備註", meeting.notes || ""],
        [],
        ["姓名", "出席狀況"],
        ...meeting.attendance.map(r => [r.memberName, r.present ? "出席" : "缺席"])
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "出席記錄");

    // Sheet 2: Visitors
    if (meeting.newVisitors.length > 0) {
        const visitorData = [
            ["姓名", "電話", "備註"],
            ...meeting.newVisitors.map(v => [v.name, v.phone || "", v.notes || ""])
        ];
        const visitorSheet = XLSX.utils.aoa_to_sheet(visitorData);
        XLSX.utils.book_append_sheet(workbook, visitorSheet, "新朋友");
    }

    XLSX.writeFile(workbook, filename);
};

// Monthly Report Types
// Monthly Report Types
interface MonthlyMeetingData {
    date: Date;
    attendance: Map<string, { present: boolean; prayerRequest?: string }>; // memberId -> status
    totalAttendance: number;
    newVisitors: NewVisitor[];
    notes?: string;
}

interface MonthlyReportData {
    year: number;
    month: number;
    meetings: MonthlyMeetingData[];
    members: { id: string; name: string; summary?: string }[];
    useAiSummary?: boolean;
}

export const downloadMonthlyWord = async (data: MonthlyReportData) => {
    const title = `${data.year} 信帆小組報表`;
    const monthDays = data.meetings.map(m => m.date.getDate());

    // Calculate attendance count per member
    const memberAttendanceCounts = new Map<string, number>();
    data.members.forEach(member => {
        let count = 0;
        data.meetings.forEach(m => {
            if (m.attendance.get(member.id)?.present) count++;
        });
        memberAttendanceCounts.set(member.id, count);
    });

    // Helper to create 12pt text (size 24 half-points)
    const text12pt = (text: string, bold: boolean = false) =>
        new Paragraph({ children: [new TextRun({ text, bold, size: 24 })] });

    const text12ptCenter = (text: string, bold: boolean = false) =>
        new Paragraph({ children: [new TextRun({ text, bold, size: 24 })], alignment: "center" });

    // Header Row: 月 | Date1 日 | Date2 日 | ... | 個人出席次數
    const headerCells = [
        new TableCell({
            children: [text12ptCenter(`${data.month}月`, true)],
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: "E0E0E0" }
        }),
        ...data.meetings.map(m =>
            new TableCell({
                children: [text12ptCenter(`${m.date.getDate()}日`, true)],
                width: { size: 800, type: WidthType.DXA },
                shading: { fill: "E0E0E0" }
            })
        ),
        new TableCell({
            children: [text12ptCenter("個人出席次數", true)],
            width: { size: 1500, type: WidthType.DXA },
            shading: { fill: "E0E0E0" }
        }),
    ];

    // Data Rows - one per member
    const rows = data.members.map((member, idx) => {
        const attendanceCells = data.meetings.map(m => {
            const status = m.attendance.get(member.id);
            return new TableCell({
                children: [text12ptCenter(status?.present ? "V" : "")]
            });
        });

        const count = memberAttendanceCounts.get(member.id) || 0;

        return new TableRow({
            children: [
                new TableCell({ children: [text12pt(`${idx + 1} ${member.name}`)] }),
                ...attendanceCells,
                new TableCell({ children: [text12ptCenter(count.toString())] }),
            ],
        });
    });

    // Weekly attendance totals row
    const weeklyTotals = data.meetings.map(m => m.totalAttendance || 0);
    const totalRow = new TableRow({
        children: [
            new TableCell({ children: [text12pt("當週出席人數", true)] }),
            ...weeklyTotals.map(t => new TableCell({
                children: [text12ptCenter(t.toString())]
            })),
            new TableCell({ children: [new Paragraph("")] }),
        ],
    });

    // Collect status/summaries for "組員狀況" section
    const memberStatusList: { name: string; content: string }[] = [];

    data.members.forEach(member => {
        let content = "";

        if (data.useAiSummary && member.summary) {
            content = member.summary;
        } else {
            // Fallback to original logic: concatenate notes
            const notes: string[] = [];
            data.meetings.forEach(m => {
                const status = m.attendance.get(member.id);
                if (status?.prayerRequest && status.prayerRequest.trim()) {
                    notes.push(status.prayerRequest.trim());
                }
            });
            content = notes.join("\n");
        }

        if (content) {
            memberStatusList.push({ name: member.name, content });
        }
    });

    // Build member status table rows
    const memberStatusRows = memberStatusList.map((ms, idx) =>
        new TableRow({
            children: [
                new TableCell({
                    children: [text12pt(`${idx + 1}.${ms.name}`, true)],
                    width: { size: 1500, type: WidthType.DXA }
                }),
                new TableCell({
                    children: [text12pt(ms.content)]
                }),
            ],
        })
    );

    // New Visitors Section
    const allVisitors = data.meetings.flatMap(m => m.newVisitors.map(v => ({ ...v, date: m.date })));
    const visitorRows = allVisitors.map(v =>
        new TableRow({
            children: [
                new TableCell({ children: [text12pt(`${v.date.getDate()}日`)] }),
                new TableCell({ children: [text12pt(v.name)] }),
                new TableCell({ children: [text12pt(v.phone || "")] }),
                new TableCell({ children: [text12pt(v.notes || "")] }),
            ]
        })
    );

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Title - 20pt (size 40)
                new Paragraph({
                    children: [new TextRun({ text: title, bold: true, size: 40 })],
                    alignment: "center",
                    spacing: { after: 400 }
                }),

                // Attendance Table
                new Table({
                    rows: [
                        new TableRow({ children: headerCells }),
                        ...rows,
                        totalRow
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }),

                new Paragraph({ text: "", spacing: { after: 400 } }),

                // Member Status Section
                new Paragraph({
                    children: [new TextRun({ text: "組員狀況", bold: true, size: 32 })], // 16pt
                    spacing: { after: 200 },
                    border: { bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE } }
                }),

                memberStatusRows.length > 0 ? new Table({
                    rows: memberStatusRows,
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }) : text12pt("本月無特別狀況記錄"),

                new Paragraph({ text: "", spacing: { after: 400 } }),

                // New Visitors Section
                new Paragraph({
                    children: [new TextRun({ text: "本月新朋友", bold: true, size: 32 })], // 16pt
                    spacing: { after: 200 },
                    border: { bottom: { color: "000000", size: 6, style: BorderStyle.SINGLE } }
                }),
                allVisitors.length > 0 ? new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [text12pt("日期", true)], shading: { fill: "E0E0E0" } }),
                                new TableCell({ children: [text12pt("姓名", true)], shading: { fill: "E0E0E0" } }),
                                new TableCell({ children: [text12pt("電話", true)], shading: { fill: "E0E0E0" } }),
                                new TableCell({ children: [text12pt("備註", true)], shading: { fill: "E0E0E0" } }),
                            ]
                        }),
                        ...visitorRows
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }) : text12pt("本月無新朋友"),
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${data.year}年${data.month}月_信帆小組報表.docx`);
};

export const downloadMonthlyExcel = (data: MonthlyReportData) => {
    const title = `${data.year}年${data.month}月_信帆小組報表.xlsx`;
    const workbook = XLSX.utils.book_new();

    // Calculate attendance counts
    const memberAttendanceCounts = new Map<string, number>();
    data.members.forEach(member => {
        let count = 0;
        data.meetings.forEach(m => {
            if (m.attendance.get(member.id)?.present) count++;
        });
        memberAttendanceCounts.set(member.id, count);
    });

    // 1. Attendance Sheet
    const dates = data.meetings.map(m => `${m.date.getDate()}日`);
    const headers = ["編號", "姓名", ...dates, "個人出席次數"];

    const rows = data.members.map((member, idx) => {
        const attendance = data.meetings.map(m => m.attendance.get(member.id)?.present ? "V" : "");
        const count = memberAttendanceCounts.get(member.id) || 0;
        return [idx + 1, member.name, ...attendance, count];
    });

    // Add total row
    const weeklyTotals = data.meetings.map(m => m.totalAttendance || 0);
    const totalRow = ["", "當週出席人數", ...weeklyTotals, ""];

    const attendanceSheet = XLSX.utils.aoa_to_sheet([headers, ...rows, [], totalRow]);

    // Set column widths
    const wscols = [
        { wch: 5 },  // Id
        { wch: 10 }, // Name
        ...dates.map(() => ({ wch: 5 })), // Dates
        { wch: 12 }  // Count
    ];
    attendanceSheet['!cols'] = wscols;

    XLSX.utils.book_append_sheet(workbook, attendanceSheet, "出席記錄");

    // 2. Member Status Sheet (Consolidated Notes)
    const statusHeaders = ["編號", "姓名", "近況與代禱事項"];
    const statusRows: any[][] = [];

    data.members.forEach((member, idx) => {
        let content = "";

        if (data.useAiSummary && member.summary) {
            content = member.summary;
        } else {
            const notes: string[] = [];
            data.meetings.forEach(m => {
                const status = m.attendance.get(member.id);
                if (status?.prayerRequest && status.prayerRequest.trim()) {
                    notes.push(status.prayerRequest.trim());
                }
            });
            content = notes.join("\n");
        }

        if (content) {
            statusRows.push([idx + 1, member.name, content]);
        }
    });

    if (statusRows.length > 0) {
        const statusSheet = XLSX.utils.aoa_to_sheet([statusHeaders, ...statusRows]);
        statusSheet['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 100 }];
        XLSX.utils.book_append_sheet(workbook, statusSheet, "組員狀況");
    }

    // 3. Visitors Sheet
    const allVisitors = data.meetings.flatMap(m => m.newVisitors.map(v => ({ ...v, date: m.date })));
    if (allVisitors.length > 0) {
        const visitorHeaders = ["日期", "姓名", "電話", "備註"];
        const visitorRows = allVisitors.map(v => [
            `${v.date.getDate()}日`,
            v.name,
            v.phone || "",
            v.notes || ""
        ]);
        const visitorSheet = XLSX.utils.aoa_to_sheet([visitorHeaders, ...visitorRows]);
        visitorSheet['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 15 }, { wch: 30 }];
        XLSX.utils.book_append_sheet(workbook, visitorSheet, "新朋友");
    }

    XLSX.writeFile(workbook, title);
};

// --- Simple Report Downloads (used by app/reports/[id]) ---
export const downloadWord = async (title: string, content: string) => {
    const doc = new Document({
        sections: [
            {
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: title, bold: true, size: 32 })],
                        spacing: { after: 400 },
                    }),
                    new Paragraph({
                        text: content,
                        spacing: { after: 200 },
                    }),
                ],
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    downloadBlob(blob, `${title || "report"}.docx`);
};

export const downloadExcel = (title: string, content: string) => {
    const worksheet = XLSX.utils.aoa_to_sheet([
        ["標題", title],
        [],
        ["內容"],
        [content],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "報表");
    XLSX.writeFile(workbook, `${title || "report"}.xlsx`);
};
