"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Plus, Calendar, Download } from "lucide-react";
import Link from "next/link";
import { downloadMonthlyWord, downloadMonthlyExcel } from "@/lib/download";

interface Member {
    id: string;
    name: string;
}

interface Meeting {
    id: string;
    date: any;
    attendance: { memberId: string; memberName: string; present: boolean; prayerRequest?: string }[];
    newVisitors: { name: string; phone?: string; notes?: string }[];
    totalAttendance: number;
    notes?: string;
}

export default function ReportsPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
    const [exporting, setExporting] = useState(false);

    const [useAiSummary, setUseAiSummary] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            // Fetch members
            const membersSnapshot = await getDocs(collection(db, "members"));
            const membersData = membersSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Member[];
            setMembers(membersData);

            // Fetch meetings
            const meetingsQuery = query(
                collection(db, "meetings"),
                orderBy("date", "desc")
            );
            const meetingsSnapshot = await getDocs(meetingsQuery);
            const meetingsData = meetingsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Meeting[];
            setMeetings(meetingsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (type: "word" | "excel") => {
        if (exporting || generating) return;
        setExporting(true);
        try {
            const [year, month] = selectedMonth.split("-").map(Number);

            // Filter meetings for the selected month
            const monthlyMeetings = meetings.filter(m => {
                if (!m.date?.toDate) return false;
                const d = m.date.toDate();
                return d.getFullYear() === year && (d.getMonth() + 1) === month;
            }).sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());

            if (monthlyMeetings.length === 0) {
                alert("該月份無聚會記錄");
                setExporting(false);
                return;
            }

            let processedMembers: { id: string; name: string; summary: string }[] = members.map(m => ({ id: m.id, name: m.name, summary: "" }));

            // AI Summarization
            if (useAiSummary) {
                setGenerating(true);
                try {
                    const response = await fetch("/api/summarize", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            members: members,
                            meetings: monthlyMeetings.map(m => ({
                                ...m,
                                date: m.date.toDate(),
                                attendance: m.attendance
                            })),
                            month: `${year}年${month}月`
                        })
                    });

                    if (response.ok) {
                        const data = await response.json();
                        // Map summaries back to members
                        if (Array.isArray(data.summaries)) {
                            // Create a map for easier lookup
                            const summaryMap = new Map<string, string>(data.summaries.map((s: any) => [s.name, String(s.summary)]));
                            processedMembers = processedMembers.map(m => ({
                                id: m.id,
                                name: m.name,
                                summary: summaryMap.get(m.name) || ""
                            }));
                        }
                    } else {
                        console.error("AI API Error");
                        alert("AI摘要生成失敗，將使用原始紀錄匯出。");
                    }
                } catch (e) {
                    console.error("AI Generation failed", e);
                    alert("AI摘要生成失敗，將使用原始紀錄匯出。");
                } finally {
                    setGenerating(false);
                }
            }

            const reportData = {
                year,
                month,
                members: processedMembers,
                meetings: monthlyMeetings.map(m => ({
                    date: m.date.toDate(),
                    attendance: new Map(m.attendance.map(a => [a.memberId, { present: a.present, prayerRequest: a.prayerRequest }])),
                    totalAttendance: m.totalAttendance || 0,
                    newVisitors: m.newVisitors || [],
                    notes: m.notes
                })),
                useAiSummary // Pass this flag to download function
            };

            if (type === "word") {
                await downloadMonthlyWord(reportData);
            } else {
                downloadMonthlyExcel(reportData);
            }
        } catch (error) {
            console.error("Export error:", error);
            alert("匯出失敗");
        } finally {
            setExporting(false);
        }
    };

    if (!user) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold mb-4">請先登入</h2>
                <Link
                    href="/login"
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    前往登入
                </Link>
            </div>
        );
    }

    if (loading) {
        return <div className="text-center py-10">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        報表中心
                    </h1>
                </div>
                <Link
                    href="/reports/new"
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="w-5 h-5" />
                    新建報表
                </Link>
            </div>

            {/* Monthly Export Section */}
            <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
                <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    月報表匯出
                </h2>
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 dark:text-gray-400">選擇月份:</label>
                        <input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-100 dark:border-blue-800">
                        <input
                            type="checkbox"
                            id="useAiSummary"
                            checked={useAiSummary}
                            onChange={(e) => setUseAiSummary(e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div className="flex flex-col">
                            <label htmlFor="useAiSummary" className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                使用 AI 智慧摘要
                                <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full">Beta (Gemini)</span>
                            </label>
                            <span className="text-xs text-gray-500 dark:text-gray-400">自動整合並潤飾每位組員的月度代禱事項</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport("word")}
                            disabled={exporting || generating}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            {generating ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    AI 生成中...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    匯出 Word
                                </>
                            )}
                        </button>
                        <button
                            onClick={() => handleExport("excel")}
                            disabled={exporting || generating}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            匯出 Excel
                        </button>
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                    匯出包含整月出席記錄與代禱事項的整合報表
                </p>
            </div>

            {/* Recent Meetings Summary */}
            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        近期聚會記錄 ({meetings.length})
                    </h2>
                </div>
                <div className="divide-y dark:divide-gray-700">
                    {meetings.slice(0, 10).map((meeting) => {
                        const date = meeting.date?.toDate?.();
                        const dateStr = date
                            ? date.toLocaleDateString("zh-TW", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                            })
                            : "N/A";
                        return (
                            <div
                                key={meeting.id}
                                className="p-4 flex justify-between items-center"
                            >
                                <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                        {dateStr}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        出席: {meeting.totalAttendance} 人
                                        {meeting.newVisitors?.length > 0 && (
                                            <span className="ml-2 text-green-600">
                                                + {meeting.newVisitors.length} 新朋友
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    href={`/attendance/${meeting.id}`}
                                    className="text-blue-600 hover:underline text-sm"
                                >
                                    查看詳情
                                </Link>
                            </div>
                        );
                    })}
                    {meetings.length === 0 && (
                        <div className="p-6 text-center text-gray-500">
                            尚無聚會記錄
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
