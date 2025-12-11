import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle } from "docx";
// @ts-ignore
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";

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
    saveAs(blob, `${title}.docx`);
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
    members: { id: string; name: string }[];
}

export const downloadMonthlyWord = async (data: MonthlyReportData) => {
    const title = `${data.year}年${data.month}月 小組報表`;

    // Header Row: Member Name | Date 1 | Date 2 | ... | Prayer Requests
    const headerCells = [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "姓名", bold: true })] })], width: { size: 1500, type: WidthType.DXA } }),
        ...data.meetings.map(m =>
            new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: m.date.toLocaleDateString("zh-TW", { month: 'numeric', day: 'numeric' }), bold: true })], alignment: "center" })],
                width: { size: 1000, type: WidthType.DXA }
            })
        ),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "代禱事項 / 備註", bold: true })] })], width: { size: 3000, type: WidthType.DXA } }),
    ];

    // Data Rows
    const rows = data.members.map(member => {
        // Attendance cells
        const attendanceCells = data.meetings.map(m => {
            const status = m.attendance.get(member.id);
            return new TableCell({
                children: [new Paragraph({ text: status?.present ? "V" : "", alignment: "center" })]
            });
        });

        // Consolidated notes/prayer requests
        const notes = data.meetings
            .map(m => {
                const status = m.attendance.get(member.id);
                return status?.prayerRequest ? `[${m.date.getDate()}日] ${status.prayerRequest}` : null;
            })
            .filter(n => n)
            .join("\n");

        return new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(member.name)] }),
                ...attendanceCells,
                new TableCell({ children: [new Paragraph(notes)] }),
            ],
        });
    });

    // New Visitors Section
    const allVisitors = data.meetings.flatMap(m => m.newVisitors.map(v => ({ ...v, date: m.date })));
    const visitorRows = allVisitors.map(v =>
        new TableRow({
            children: [
                new TableCell({ children: [new Paragraph(`${v.date.toLocaleDateString("zh-TW", { month: 'numeric', day: 'numeric' })}`)] }),
                new TableCell({ children: [new Paragraph(v.name)] }),
                new TableCell({ children: [new Paragraph(v.phone || "")] }),
                new TableCell({ children: [new Paragraph(v.notes || "")] }),
            ]
        })
    );

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })], spacing: { after: 400 } }),

                // Attendance Table
                new Table({
                    rows: [
                        new TableRow({ children: headerCells }),
                        ...rows
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }),

                new Paragraph({ text: "", spacing: { after: 400 } }),

                // Visitors Table
                new Paragraph({ children: [new TextRun({ text: "本月新朋友", bold: true, size: 24 })], spacing: { after: 200 } }),
                allVisitors.length > 0 ? new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "日期", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "姓名", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "電話", bold: true })] })] }),
                                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "備註", bold: true })] })] }),
                            ]
                        }),
                        ...visitorRows
                    ],
                    width: { size: 100, type: WidthType.PERCENTAGE },
                }) : new Paragraph("本月無新朋友"),
            ]
        }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title}.docx`);
};

export const downloadMonthlyExcel = (data: MonthlyReportData) => {
    const title = `${data.year}年${data.month}月_小組報表.xlsx`;
    const workbook = XLSX.utils.book_new();

    // 1. Attendance Sheet
    const dates = data.meetings.map(m => m.date.toLocaleDateString("zh-TW", { month: 'numeric', day: 'numeric' }));
    const headers = ["姓名", ...dates, "代禱事項 / 備註"];

    const rows = data.members.map(member => {
        const attendance = data.meetings.map(m => m.attendance.get(member.id)?.present ? "V" : "");
        const notes = data.meetings
            .map(m => {
                const status = m.attendance.get(member.id);
                return status?.prayerRequest ? `[${m.date.getDate()}日] ${status.prayerRequest}` : null;
            })
            .filter(n => n)
            .join("\n");
        return [member.name, ...attendance, notes];
    });

    const attendanceSheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(workbook, attendanceSheet, "出席記錄");

    // 2. Visitors Sheet
    const allVisitors = data.meetings.flatMap(m => m.newVisitors.map(v => ({ ...v, date: m.date })));
    if (allVisitors.length > 0) {
        const visitorHeaders = ["日期", "姓名", "電話", "備註"];
        const visitorRows = allVisitors.map(v => [
            v.date.toLocaleDateString("zh-TW"),
            v.name,
            v.phone || "",
            v.notes || ""
        ]);
        const visitorSheet = XLSX.utils.aoa_to_sheet([visitorHeaders, ...visitorRows]);
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
    saveAs(blob, `${title || "report"}.docx`);
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
