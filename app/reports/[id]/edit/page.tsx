"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";

export default function EditReportPage() {
    const { user } = useAuth();
    const params = useParams();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchReport = async () => {
            if (!params?.id || typeof params.id !== "string") return;
            try {
                const ref = doc(db, "reports", params.id);
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data() as any;
                    setTitle(data.title || "");
                    setContent(data.content || "");
                } else {
                    alert("找不到此報表");
                    router.push("/reports");
                }
            } catch (error) {
                console.error("Error loading report:", error);
                alert("載入報表失敗");
            } finally {
                setLoading(false);
            }
        };
        if (user) {
            fetchReport();
        } else {
            setLoading(false);
        }
    }, [user, params, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !params?.id || typeof params.id !== "string") return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "reports", params.id), {
                title,
                content,
                updatedAt: serverTimestamp(),
            });
            router.push(`/reports/${params.id}`);
        } catch (error) {
            console.error("Error updating report:", error);
            alert("更新失敗，請稍後再試");
        } finally {
            setSaving(false);
        }
    };

    if (!user) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold mb-4">請先登入</h2>
            </div>
        );
    }

    if (loading) {
        return <div className="text-center py-10">載入中...</div>;
    }

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow dark:bg-gray-800">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">編輯報表</h1>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        報表標題
                    </label>
                    <input
                        type="text"
                        id="title"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                    />
                </div>

                <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        報表內容 (支援 Markdown)
                    </label>
                    <textarea
                        id="content"
                        rows={10}
                        required
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                    />
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {saving ? "儲存中..." : "儲存變更"}
                    </button>
                </div>
            </form>
        </div>
    );
}
