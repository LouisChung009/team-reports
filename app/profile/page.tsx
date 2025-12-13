"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import { updatePassword, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { User, LogOut, Lock } from "lucide-react";

export default function ProfilePage() {
    const { user } = useAuth();
    const router = useRouter();

    // Password change state
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword.length < 6) {
            setMessage({ type: "error", text: "密碼長度至少需 6 個字元" });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", text: "兩次輸入的密碼不符" });
            return;
        }

        setLoading(true);
        setMessage(null);

        try {
            await updatePassword(user, newPassword);
            setMessage({ type: "success", text: "密碼已成功更新！" });
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            console.error("Update password error:", error);
            if (error.code === 'auth/requires-recent-login') {
                setMessage({ type: "error", text: "為了安全起見，請先登出並重新登入後再嘗試更改密碼。" });
            } else {
                setMessage({ type: "error", text: "更新失敗: " + error.message });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push("/login");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    if (!user) {
        return <div className="p-8 text-center">請先登入</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="h-6 w-6" />
                會員中心
            </h1>

            {/* Profile Info */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    基本資料
                </h2>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">
                            Email
                        </label>
                        <div className="mt-1 text-gray-900 dark:text-white font-medium">
                            {user.email}
                        </div>
                    </div>
                </div>
            </div>

            {/* Change Password */}
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    更改密碼
                </h2>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            新密碼
                        </label>
                        <input
                            type="password"
                            required
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                            placeholder="至少 6 個字元"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            確認新密碼
                        </label>
                        <input
                            type="password"
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm p-2 border"
                        />
                    </div>

                    {message && (
                        <div className={`p-3 rounded-md text-sm ${message.type === 'success'
                                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`inline-flex justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${loading ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                        >
                            {loading ? "更新中..." : "更新密碼"}
                        </button>
                    </div>
                </form>
            </div>

            {/* Logout Section */}
            <div className="flex justify-center pt-4">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    登出帳號
                </button>
            </div>
        </div>
    );
}
