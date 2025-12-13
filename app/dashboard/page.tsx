"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import {
    BarChart3,
    TrendingUp,
    AlertTriangle,
    Users,
    Calendar,
    Heart,
    FileText,
    FileDown,
    FileSpreadsheet,
} from "lucide-react";
import Link from "next/link";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
} from "recharts";
import {
    downloadMeetingWord,
    downloadMeetingExcel,
    downloadMonthlyWord,
    downloadMonthlyExcel
} from "@/lib/download";
import { checkPermission, DASHBOARD_PERMISSIONS } from "@/lib/permissions";

interface Member {
    id: string;
    name: string;
    role: string;
    careNotes?: string;
}

interface Meeting {
    id: string;
    date: any;
    attendance: { memberId: string; memberName: string; present: boolean; prayerRequest?: string; careNote?: string }[];
    newVisitors: { name: string; phone?: string; notes?: string }[];
    totalAttendance: number;
    notes?: string;
    type?: "normal" | "holiday" | "special";
}

interface AttendanceStats {
    memberId: string;
    memberName: string;
    totalMeetings: number;
    attendedMeetings: number;
    attendanceRate: number;
    consecutiveAbsences: number;
}

export default function DashboardPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [stats, setStats] = useState<AttendanceStats[]>([]);
    const [loading, setLoading] = useState(true);

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

            // Fetch meetings (last 12 weeks)
            const meetingsQuery = query(
                collection(db, "meetings"),
                orderBy("date", "desc"),
                limit(12)
            );
            const meetingsSnapshot = await getDocs(meetingsQuery);
            const meetingsData = meetingsSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Meeting[];
            setMeetings(meetingsData);

            // Calculate stats
            calculateStats(membersData, meetingsData);
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const calculateStats = (members: Member[], meetings: Meeting[]) => {
        const statsMap = new Map<string, AttendanceStats>();

        // Filter out holiday meetings for stats calculation
        const countableMeetings = meetings.filter(m => m.type !== 'holiday');

        // Initialize stats for each member
        members.forEach((member) => {
            statsMap.set(member.id, {
                memberId: member.id,
                memberName: member.name,
                totalMeetings: countableMeetings.length,
                attendedMeetings: 0,
                attendanceRate: 0,
                consecutiveAbsences: 0,
            });
        });

        // Count attendance
        countableMeetings.forEach((meeting) => {
            meeting.attendance?.forEach((record) => {
                const stat = statsMap.get(record.memberId);
                if (stat && record.present) {
                    stat.attendedMeetings++;
                }
            });
        });

        // Calculate rates and consecutive absences
        // Sort countable meetings descending by date
        const sortedMeetings = [...countableMeetings].sort(
            (a, b) =>
                b.date?.toDate?.()?.getTime?.() - a.date?.toDate?.()?.getTime?.()
        );

        statsMap.forEach((stat) => {
            stat.attendanceRate =
                stat.totalMeetings > 0
                    ? Math.round((stat.attendedMeetings / stat.totalMeetings) * 100)
                    : 0;

            // Calculate consecutive absences from most recent
            let consecutive = 0;
            for (const meeting of sortedMeetings) {
                const record = meeting.attendance?.find(
                    (a) => a.memberId === stat.memberId
                );
                if (record && !record.present) {
                    consecutive++;
                } else {
                    break;
                }
            }
            stat.consecutiveAbsences = consecutive;
        });

        setStats(Array.from(statsMap.values()));
    };

    // Helper to format date for display
    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) return "N/A";
        return new Date(timestamp.toDate()).toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    const handleDownloadWord = (meeting: Meeting) => {
        const meetingData = {
            date: meeting.date?.toDate ? meeting.date.toDate() : new Date(),
            attendance: meeting.attendance || [],
            newVisitors: meeting.newVisitors || [],
            totalAttendance: meeting.totalAttendance || 0,
            notes: meeting.notes,
        };
        downloadMeetingWord(meetingData);
    };

    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    const handleDownloadExcel = (meeting: Meeting) => {
        const meetingData = {
            date: meeting.date?.toDate ? meeting.date.toDate() : new Date(),
            attendance: meeting.attendance || [],
            newVisitors: meeting.newVisitors || [],
            totalAttendance: meeting.totalAttendance || 0,
            notes: meeting.notes,
        };
        downloadMeetingExcel(meetingData);
    };

    const handleMonthlyDownload = async (type: "word" | "excel") => {
        const [year, month] = selectedMonth.split("-").map(Number);

        // Filter meetings for the selected month
        const monthlyMeetings = meetings.filter(m => {
            if (!m.date?.toDate) return false;
            const d = m.date.toDate();
            return d.getFullYear() === year && (d.getMonth() + 1) === month;
        }).sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime()); // Sort by date ascending

        if (monthlyMeetings.length === 0) {
            alert("該月份無聚會記錄");
            return;
        }

        const reportData = {
            year,
            month,
            members: members.map(m => ({ id: m.id, name: m.name })),
            meetings: monthlyMeetings.map(m => ({
                date: m.date.toDate(),
                attendance: new Map(m.attendance.map(a => [a.memberId, { present: a.present, prayerRequest: a.prayerRequest }])),
                totalAttendance: m.totalAttendance || 0,
                newVisitors: m.newVisitors || [],
                notes: m.notes
            }))
        };

        if (type === "word") {
            await downloadMonthlyWord(reportData);
        } else {
            downloadMonthlyExcel(reportData);
        }
    };

    // Prepare chart data
    const chartData = [...meetings]
        .reverse()
        .map((meeting) => ({
            date: meeting.date?.toDate?.()
                ? new Date(meeting.date.toDate()).toLocaleDateString("zh-TW", {
                    month: "short",
                    day: "numeric",
                })
                : "N/A",
            出席人數: meeting.totalAttendance || 0,
        }));

    // Get members needing care: only那些填了「需關懷」(careNote) 的紀錄
    const needsCare = stats
        .map((stat) => {
            const member = members.find((m) => m.id === stat.memberId);

            // 找出最近一次填寫 careNote 的聚會
            const latestCare = meetings
                .map((m) => {
                    const record = m.attendance?.find((a) => a.memberId === stat.memberId);
                    if (record?.careNote) {
                        return { date: m.date, careNote: record.careNote };
                    }
                    return null;
                })
                .filter(Boolean)
                .sort((a: any, b: any) => (b?.date?.toDate?.()?.getTime?.() ?? 0) - (a?.date?.toDate?.()?.getTime?.() ?? 0))[0] as any;

            return {
                ...stat,
                careNote: latestCare?.careNote,
                careDate: latestCare?.date,
                needsCare: !!latestCare?.careNote,
            };
        })
        .filter((s) => s.needsCare);

    // Average attendance
    const avgAttendance =
        meetings.length > 0
            ? Math.round(
                meetings.reduce((sum, m) => sum + (m.totalAttendance || 0), 0) /
                meetings.length
            )
            : 0;

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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        牧養儀表板
                    </h1>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700">
                    目前身份：{user?.email}
                </div>
            </div>

            {/* Quick Stats */}
            {checkPermission(user?.email, DASHBOARD_PERMISSIONS.VIEW_QUICK_STATS) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Users className="w-4 h-4" />
                            <span className="text-sm">總成員</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {members.length}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">聚會次數</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                            {meetings.length}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <TrendingUp className="w-4 h-4" />
                            <span className="text-sm">平均出席</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mt-1">
                            {avgAttendance} 人
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm">需關懷</span>
                        </div>
                        <div className="text-2xl font-bold text-orange-500 mt-1">
                            {needsCare.length} 人
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Chart */}
            {checkPermission(user?.email, DASHBOARD_PERMISSIONS.VIEW_ATTENDANCE_CHART) && (
                <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        出席人數趨勢
                    </h2>
                    {chartData.length > 0 ? (
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={chartData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="date" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line
                                        type="monotone"
                                        dataKey="出席人數"
                                        stroke="#3B82F6"
                                        strokeWidth={2}
                                        dot={{ fill: "#3B82F6" }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500">
                            尚無出席記錄，請先
                            <Link href="/attendance" className="text-blue-600 hover:underline">
                                記錄出席
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {/* Monthly Report Download */}
            {checkPermission(user?.email, DASHBOARD_PERMISSIONS.VIEW_MONTHLY_REPORT) && (
                <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                                月報表匯出
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">
                                匯出包含整月出席記錄與代禱事項的整合報表
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button
                                onClick={() => handleMonthlyDownload("word")}
                                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                            >
                                <FileDown className="w-4 h-4" />
                                Word
                            </button>
                            <button
                                onClick={() => handleMonthlyDownload("excel")}
                                className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                            >
                                <FileDown className="w-4 h-4" />
                                Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Members Attendance Rate */}
            {checkPermission(user?.email, DASHBOARD_PERMISSIONS.VIEW_MEMBER_STATS) && (
                <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        成員出席率
                    </h2>
                    {stats.length > 0 ? (
                        <div style={{ height: `${Math.max(stats.length * 50, 300)}px` }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={stats}
                                    layout="vertical"
                                    margin={{ left: 60 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis dataKey="memberName" type="category" width={80} />
                                    <Tooltip formatter={(value) => `${value}%`} />
                                    <Bar dataKey="attendanceRate" fill="#10B981" barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="text-center py-10 text-gray-500">尚無數據</div>
                    )}
                </div>
            )}

            {/* Needs Care List */}
            {checkPermission(user?.email, DASHBOARD_PERMISSIONS.VIEW_CARE_LIST) && (
                <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                    <div className="p-4 border-b dark:border-gray-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                            牧養關懷名單
                        </h2>
                    </div>
                    <div className="divide-y dark:divide-gray-700">
                        {needsCare.length > 0 ? (
                            needsCare.map((member) => (
                                <div
                                    key={member.memberId}
                                    className="p-4 flex flex-col gap-3"
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="font-medium text-gray-900 dark:text-white text-lg">
                                                {member.memberName}
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                出席率: {member.attendanceRate}%
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-end">
                                            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs dark:bg-purple-900 dark:text-purple-200">
                                                需特別關懷
                                            </span>
                                        </div>
                                    </div>

                                    {/* Details Section */}
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3 space-y-2 text-sm">
                                        {member.careNote && (
                                            <div className="flex gap-2">
                                                <Heart className="w-4 h-4 text-pink-500 shrink-0 mt-0.5" />
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    {member.careDate?.toDate
                                                        ? `${formatDate(member.careDate)}：${member.careNote}`
                                                        : member.careNote}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-6 text-center text-gray-500">
                                太棒了！目前沒有需要特別關心的成員 🎉
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
