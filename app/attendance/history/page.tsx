"use client";

import { useState, useEffect } from "react";
import {
    collection,
    getDocs,
    deleteDoc,
    doc,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Trash2, Edit2, ArrowLeft, History } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Meeting {
    id: string;
    date: any;
    totalAttendance: number;
    notes?: string;
    newVisitors?: any[];
}

export default function MeetingHistoryPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchMeetings();
        }
    }, [user]);

    const fetchMeetings = async () => {
        try {
            const q = query(collection(db, "meetings"), orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            const meetingsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Meeting[];
            setMeetings(meetingsData);
        } catch (error) {
            console.error("Error fetching meetings:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除這筆聚會記錄嗎？此動作無法復原。")) return;

        try {
            await deleteDoc(doc(db, "meetings", id));
            fetchMeetings();
        } catch (error) {
            console.error("Error deleting meeting:", error);
            alert("刪除失敗");
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp?.toDate) return "N/A";
        return new Date(timestamp.toDate()).toLocaleDateString("zh-TW", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "short",
        });
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
                    <History className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        聚會歷史記錄
                    </h1>
                </div>
                <Link
                    href="/attendance"
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回記錄出席
                </Link>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    日期
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    出席人數
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    新朋友
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    備註
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {meetings.map((meeting) => (
                                <tr key={meeting.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {formatDate(meeting.date)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {meeting.totalAttendance} 人
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {meeting.newVisitors?.length || 0} 位
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {meeting.notes || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => router.push(`/attendance/${meeting.id}`)}
                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 mr-3"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(meeting.id)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {meetings.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-6 py-10 text-center text-gray-500"
                                    >
                                        尚無聚會記錄
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
