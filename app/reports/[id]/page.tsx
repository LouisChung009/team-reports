"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Download, Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { downloadWord, downloadExcel } from "@/lib/download";

interface Report {
    id: string;
    title: string;
    content: string;
    createdAt: any;
    userEmail: string;
}

export default function ReportDetailPage() {
    const { id } = useParams();
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReport = async () => {
            if (!id || typeof id !== "string") return;

            try {
                const docRef = doc(db, "reports", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    setReport({ id: docSnap.id, ...docSnap.data() } as Report);
                } else {
                    alert("報表不存在");
                    router.push("/reports");
                }
            } catch (error) {
                console.error("Error fetching report:", error);
            } finally {
                setLoading(false);
            }
        };

        if (!authLoading) {
            if (!user) {
                // Redirect or show login prompt handled by render
                setLoading(false);
            } else {
                fetchReport();
            }
        }
    }, [id, user, authLoading, router]);

    const handleShare = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            alert("連結已複製到剪貼簿！");
        });
    };

    if (authLoading || loading) {
        return <div className="text-center py-10">載入中...</div>;
    }

    if (!user) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold mb-4">請先登入以檢視此報表</h2>
                <Link
                    href={`/login?redirect=/reports/${id}`}
                    className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                    前往登入
                </Link>
            </div>
        );
    }

    if (!report) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <Link
                href="/reports"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回列表
            </Link>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden dark:bg-gray-800">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                            {report.title}
                        </h1>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            建立者: {report.userEmail} | 建立時間:{" "}
                            {report.createdAt?.toDate().toLocaleString("zh-TW")}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleShare}
                            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
                        >
                            <Share2 className="w-4 h-4 mr-2" />
                            分享
                        </button>
                        <div className="relative group">
                            <button
                                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                <Download className="w-4 h-4 mr-2" />
                                下載
                            </button>
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block dark:bg-gray-700">
                                <button
                                    onClick={() => downloadWord(report.title, report.content)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
                                >
                                    下載 Word (.docx)
                                </button>
                                <button
                                    onClick={() => downloadExcel(report.title, report.content)}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-600"
                                >
                                    下載 Excel (.xlsx)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    <div className="prose max-w-none dark:prose-invert whitespace-pre-wrap">
                        {report.content}
                    </div>
                </div>
            </div>
        </div>
    );
}
