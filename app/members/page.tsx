"use client";

import { useState, useEffect } from "react";
import {
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    updateDoc,
    serverTimestamp,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Edit2, Save, X, Users, FileText } from "lucide-react";
import Link from "next/link";

interface Member {
    id: string;
    name: string;
    role: "leader" | "member" | "new";
    phone?: string;
    careNotes?: string;
    intro?: string;
}

export default function MembersPage() {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Form states
    const [newName, setNewName] = useState("");
    const [newRole, setNewRole] = useState<"leader" | "member" | "new">("member");
    const [newPhone, setNewPhone] = useState("");
    const [newCareNotes, setNewCareNotes] = useState("");
    const [newIntro, setNewIntro] = useState("");

    useEffect(() => {
        if (user) {
            fetchMembers();
        }
    }, [user]);

    const fetchMembers = async () => {
        try {
            const q = query(collection(db, "members"), orderBy("name"));
            const snapshot = await getDocs(q);
            const membersData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Member[];
            setMembers(membersData);
        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (member: Member) => {
        setEditingId(member.id);
        setNewName(member.name);
        setNewRole(member.role);
        setNewPhone(member.phone || "");
        setNewCareNotes(member.careNotes || "");
        setNewIntro(member.intro || "");
        setShowAddForm(true);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setNewName("");
        setNewRole("member");
        setNewPhone("");
        setNewCareNotes("");
        setNewIntro("");
        setShowAddForm(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        try {
            if (editingId) {
                await updateDoc(doc(db, "members", editingId), {
                    name: newName.trim(),
                    role: newRole,
                    phone: newPhone.trim(),
                    careNotes: newCareNotes.trim(),
                    intro: newIntro.trim(),
                    updatedAt: serverTimestamp(),
                });
                alert("更新成功");
            } else {
                await addDoc(collection(db, "members"), {
                    name: newName.trim(),
                    role: newRole,
                    phone: newPhone.trim(),
                    careNotes: newCareNotes.trim(),
                    intro: newIntro.trim(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                alert("新增成功");
            }
            handleCancelEdit();
            fetchMembers();
        } catch (error) {
            console.error("Error saving member:", error);
            alert("儲存失敗");
        }
    };

    const handleDeleteMember = async (id: string) => {
        if (!confirm("確定要刪除這位成員嗎？")) return;

        try {
            await deleteDoc(doc(db, "members", id));
            fetchMembers();
        } catch (error) {
            console.error("Error deleting member:", error);
            alert("刪除失敗");
        }
    };

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "leader":
                return (
                    <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                        組長
                    </span>
                );
            case "new":
                return (
                    <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        新朋友
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        成員
                    </span>
                );
        }
    };

    if (!user) {
        // ... existing auth check ...
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
        )
    }

    if (loading) {
        return <div className="text-center py-10">載入中...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        小組成員管理
                    </h1>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/import"
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                    >
                        <FileText className="w-4 h-4" />
                        匯入舊資料
                    </Link>
                    <button
                        onClick={() => {
                            handleCancelEdit(); // Reset form
                            setShowAddForm(true);
                        }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        新增成員
                    </button>
                </div>
            </div>

            {/* Add/Edit Member Form */}
            {showAddForm && (
                <div className="bg-white rounded-lg shadow p-6 dark:bg-gray-800">
                    <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                        {editingId ? "編輯成員" : "新增成員"}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* ... form fields ... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    姓名 *
                                </label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    required
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    角色
                                </label>
                                <select
                                    value={newRole}
                                    onChange={(e) =>
                                        setNewRole(e.target.value as "leader" | "member" | "new")
                                    }
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="leader">組長</option>
                                    <option value="member">成員</option>
                                    <option value="new">新朋友</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    電話
                                </label>
                                <input
                                    type="tel"
                                    value={newPhone}
                                    onChange={(e) => setNewPhone(e.target.value)}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    牧養備註
                                </label>
                                <input
                                    type="text"
                                    value={newCareNotes}
                                    onChange={(e) => setNewCareNotes(e.target.value)}
                                    placeholder="例如：需要關心工作狀況"
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    簡介
                                </label>
                                <textarea
                                    value={newIntro}
                                    onChange={(e) => setNewIntro(e.target.value)}
                                    placeholder="成員常態簡介..."
                                    rows={2}
                                    className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                {editingId ? "更新" : "新增"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Members List */}
            <div className="bg-white rounded-lg shadow overflow-hidden dark:bg-gray-800">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    姓名
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    角色
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    電話
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    牧養備註
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    簡介
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-300">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {members.map((member) => (
                                <tr key={member.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                        {member.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getRoleBadge(member.role)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                        {member.phone || "-"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {member.careNotes || "-"}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                                        {member.intro || "-"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <button
                                            onClick={() => handleEditClick(member)}
                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 mr-3"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteMember(member.id)}
                                            className="text-red-600 hover:text-red-900 dark:text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {members.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-6 py-10 text-center text-gray-500"
                                    >
                                        尚無成員，請點擊「新增成員」開始建立
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
                共 {members.length} 位成員
            </div>
        </div>
    );
}
