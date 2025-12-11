"use client";

import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function NewReportPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            alert("請先登入");
            return;
        }

        setLoading(true);

        try {
            const docRef = await addDoc(collection(db, "reports"), {
                title,
                content,
                userId: user.uid,
                userEmail: user.email,
                createdAt: serverTimestamp(),
            });
            router.push(`/reports/${docRef.id}`);
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("儲存失敗，請稍後再試");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow dark:bg-gray-800">
            <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">建立新報表</h1>
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
                        disabled={loading}
                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? "儲存中..." : "建立報表"}
                    </button>
                </div>
            </form>
        </div>
    );
}
