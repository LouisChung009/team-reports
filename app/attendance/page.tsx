"use client";

import { useState, useEffect } from "react";
import {
    collection,
    addDoc,
    getDocs,
    serverTimestamp,
    query,
    orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Check, X, UserPlus, Save, AlertCircle } from "lucide-react";
import Link from "next/link";
import SpeechTextarea from "@/components/SpeechTextarea";

interface Member {
    id: string;
    name: string;
    role: string;
}

interface AttendanceRecord {
    memberId: string;
    memberName: string;
    present: boolean;
    prayerRequest?: string;
    careNote?: string;
}

interface NewVisitor {
    name: string;
    phone: string;
    notes: string;
}

export default function AttendancePage() {
    const { user } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [newVisitors, setNewVisitors] = useState<NewVisitor[]>([]);
    const [meetingDate, setMeetingDate] = useState(
        new Date().toISOString().split("T")[0]
    );
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 特殊聚會狀態
    const [isSpecialMeeting, setIsSpecialMeeting] = useState(false);
    const [meetingType, setMeetingType] = useState<"normal" | "holiday" | "special">("normal");
    const [skipReason, setSkipReason] = useState("");
    const [customReason, setCustomReason] = useState("");

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

            // Initialize attendance records
            const initialAttendance = membersData.map((m) => ({
                memberId: m.id,
                memberName: m.name,
                present: false,
            }));
            setAttendance(initialAttendance);
        } catch (error) {
            console.error("Error fetching members:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAttendance = (memberId: string) => {
        setAttendance((prev) =>
            prev.map((a) =>
                a.memberId === memberId
                    ? {
                        ...a,
                        present: !a.present,
                    }
                    : a
            )
        );
    };

    const updatePrayerRequest = (memberId: string, text: string) => {
        setAttendance((prev) =>
            prev.map((a) =>
                a.memberId === memberId ? { ...a, prayerRequest: text } : a
            )
        );
    };

    const updateCareNote = (memberId: string, text: string) => {
        setAttendance((prev) =>
            prev.map((a) =>
                a.memberId === memberId ? { ...a, careNote: text } : a
            )
        );
    };

    const addNewVisitor = () => {
        setNewVisitors((prev) => [...prev, { name: "", phone: "", notes: "" }]);
    };

    const updateNewVisitor = (
        index: number,
        field: keyof NewVisitor,
        value: string
    ) => {
        setNewVisitors((prev) =>
            prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
        );
    };

    const removeNewVisitor = (index: number) => {
        setNewVisitors((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const validVisitors = newVisitors.filter((v) => v.name.trim());
            const totalAttendance =
                attendance.filter((a) => a.present).length + validVisitors.length;

            await addDoc(collection(db, "meetings"), {
                date: new Date(meetingDate),
                attendance: isSpecialMeeting ? [] : attendance,
                newVisitors: isSpecialMeeting ? [] : validVisitors,
                totalAttendance: isSpecialMeeting ? 0 : totalAttendance,
                notes,
                type: isSpecialMeeting ? meetingType : "normal",
                skipReason: isSpecialMeeting ? (skipReason === "自訂" ? customReason : skipReason) : null,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
            });

            // Add new visitors as members
            for (const visitor of validVisitors) {
                await addDoc(collection(db, "members"), {
                    name: visitor.name.trim(),
                    role: "new",
                    phone: visitor.phone.trim(),
                    careNotes: visitor.notes.trim(),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
            }

            alert("出席記錄已儲存！");
            // Reset form
            setNewVisitors([]);
            setNotes("");
            fetchMembers();
        } catch (error) {
            console.error("Error saving attendance:", error);
            alert("儲存失敗");
        } finally {
            setSaving(false);
        }
    };

    const presentCount = attendance.filter((a) => a.present).length;
    const totalCount = presentCount + newVisitors.filter((v) => v.name).length;

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
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        出席記錄
                    </h1>
                </div>
                <div className="text-right">
                    <Link
                        href="/attendance/history"
                        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
                    >
                        查看歷史記錄
                    </Link>
                    <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                    <div className="text-sm text-gray-500">今日出席</div>
                </div>
            </div>

            {/* Date Selector */}
            <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    聚會日期
                </label>
                <input
                    type="date"
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className="w-full p-3 border rounded-lg text-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
            </div>

            {/* Special Meeting Toggle */}
            <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        本週為特殊狀況（不計出席）
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setIsSpecialMeeting(!isSpecialMeeting);
                            if (!isSpecialMeeting) {
                                setMeetingType("special");
                            } else {
                                setMeetingType("normal");
                                setSkipReason("");
                                setCustomReason("");
                            }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSpecialMeeting ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-600"
                            }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSpecialMeeting ? "translate-x-6" : "translate-x-1"
                                }`}
                        />
                    </button>
                </div>

                {isSpecialMeeting && (
                    <div className="space-y-3 pt-3 border-t dark:border-gray-700">
                        <div>
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                                選擇原因
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {["區聚", "聚餐", "連假放假", "戶外活動", "自訂"].map((reason) => (
                                    <button
                                        key={reason}
                                        type="button"
                                        onClick={() => {
                                            setSkipReason(reason);
                                            if (reason === "連假放假") {
                                                setMeetingType("holiday");
                                            } else {
                                                setMeetingType("special");
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-full text-sm transition ${skipReason === reason
                                            ? "bg-amber-500 text-white"
                                            : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                                            }`}
                                    >
                                        {reason}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {skipReason === "自訂" && (
                            <input
                                type="text"
                                placeholder="請輸入原因..."
                                value={customReason}
                                onChange={(e) => setCustomReason(e.target.value)}
                                className="w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        )}

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            ⚠️ 標記為特殊狀況後，本週將不計入出席統計，月報表會顯示原因而非出席數
                        </p>
                    </div>
                )}
            </div>

            {/* Members Attendance */}
            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                <div className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        小組成員 ({presentCount}/{members.length})
                    </h2>
                </div>
                <div className="divide-y dark:divide-gray-700">
                    {members.map((member) => {
                        const record = attendance.find((a) => a.memberId === member.id);
                        const isPresent = record?.present || false;

                        return (
                            <div key={member.id} className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden border dark:border-gray-700">
                                <button
                                    onClick={() => toggleAttendance(member.id)}
                                    className={`w-full p-4 flex items-center justify-between transition ${isPresent
                                        ? "bg-green-50 dark:bg-green-900/20"
                                        : "bg-white dark:bg-gray-800"
                                        }`}
                                >
                                    <span className="text-lg font-medium text-gray-900 dark:text-white">
                                        {member.name}
                                    </span>
                                    <div
                                        className={`w-12 h-12 rounded-full flex items-center justify-center ${isPresent
                                            ? "bg-green-500 text-white"
                                            : "bg-gray-200 dark:bg-gray-600 text-gray-400"
                                            }`}
                                    >
                                        {isPresent ? (
                                            <Check className="w-6 h-6" />
                                        ) : (
                                            <X className="w-6 h-6" />
                                        )}
                                    </div>
                                </button>
                                <div className={`${isPresent ? "bg-green-50 dark:bg-green-900/20" : "bg-gray-50 dark:bg-gray-800/60"} px-4 pb-4 space-y-2`}>
                                    <SpeechTextarea
                                        value={record?.prayerRequest || ""}
                                        onChange={(e) => updatePrayerRequest(member.id, e.target.value)}
                                        onSpeechInput={(text) => updatePrayerRequest(member.id, text)}
                                        placeholder={`請輸入 ${member.name} 的代禱事項...`}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={2}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <SpeechTextarea
                                        value={record?.careNote || ""}
                                        onChange={(e) => updateCareNote(member.id, e.target.value)}
                                        onSpeechInput={(text) => updateCareNote(member.id, text)}
                                        placeholder={`需特別關懷：例如 就醫、家庭狀況...`}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={2}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {members.length === 0 && (
                        <div className="p-6 text-center text-gray-500">
                            尚無成員，請先到
                            <Link href="/members" className="text-blue-600 hover:underline">
                                成員管理
                            </Link>
                            新增成員
                        </div>
                    )}
                </div>
            </div>

            {/* New Visitors */}
            <div className="bg-white rounded-lg shadow dark:bg-gray-800">
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        新朋友 ({newVisitors.filter((v) => v.name).length})
                    </h2>
                    <button
                        onClick={addNewVisitor}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                        <UserPlus className="w-5 h-5" />
                        新增
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    {newVisitors.map((visitor, index) => (
                        <div
                            key={index}
                            className="flex gap-2 items-start p-3 bg-gray-50 rounded-lg dark:bg-gray-700"
                        >
                            <div className="flex-1 space-y-2">
                                <input
                                    type="text"
                                    placeholder="姓名 *"
                                    value={visitor.name}
                                    onChange={(e) =>
                                        updateNewVisitor(index, "name", e.target.value)
                                    }
                                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                                <input
                                    type="tel"
                                    placeholder="電話"
                                    value={visitor.phone}
                                    onChange={(e) =>
                                        updateNewVisitor(index, "phone", e.target.value)
                                    }
                                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                                <input
                                    type="text"
                                    placeholder="備註"
                                    value={visitor.notes}
                                    onChange={(e) =>
                                        updateNewVisitor(index, "notes", e.target.value)
                                    }
                                    className="w-full p-2 border rounded dark:bg-gray-600 dark:border-gray-500 dark:text-white"
                                />
                            </div>
                            <button
                                onClick={() => removeNewVisitor(index)}
                                className="p-2 text-red-500 hover:text-red-700"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                    {newVisitors.length === 0 && (
                        <div className="text-center text-gray-500 py-4">
                            點擊「新增」來記錄新朋友
                        </div>
                    )}
                </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-lg shadow p-4 dark:bg-gray-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    聚會備註
                </label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="例如：今天分享了...、需要代禱事項..."
                    rows={3}
                    className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
            </div>

            {/* Save Button - Fixed at bottom */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t dark:bg-gray-800 dark:border-gray-700">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                    <Save className="w-5 h-5" />
                    {saving ? "儲存中..." : "儲存出席記錄"}
                </button>
            </div>
        </div>
    );
}
