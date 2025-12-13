"use client";

import { useState, useEffect } from "react";
import {
    collection,
    getDoc,
    updateDoc,
    doc,
    getDocs,
    query,
    orderBy,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Calendar, Check, X, UserPlus, Save, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

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

export default function EditMeetingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const meetingId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string | undefined);
    const [members, setMembers] = useState<Member[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [newVisitors, setNewVisitors] = useState<NewVisitor[]>([]);
    const [meetingDate, setMeetingDate] = useState("");
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
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        try {
            // 1. Fetch all current members to ensure we have the latest list
            // (Even members added after this meeting should be visible to be checked off)
            const q = query(collection(db, "members"), orderBy("name"));
            const membersSnapshot = await getDocs(q);
            const membersData = membersSnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Member[];
            setMembers(membersData);

            // 2. Fetch the specific meeting data
            if (!meetingId) return;

            const meetingDoc = await getDoc(doc(db, "meetings", meetingId));
            if (!meetingDoc.exists()) {
                alert("找不到此聚會記錄");
                router.push("/attendance/history");
                return;
            }
            const meetingData = meetingDoc.data();

            // 3. Set state
            setMeetingDate(
                meetingData.date?.toDate
                    ? new Date(meetingData.date.toDate()).toISOString().split("T")[0]
                    : ""
            );
            setNotes(meetingData.notes || "");
            setNewVisitors(meetingData.newVisitors || []);

            // Load special meeting state
            if (meetingData.type && meetingData.type !== "normal") {
                setIsSpecialMeeting(true);
                setMeetingType(meetingData.type);
                const reason = meetingData.skipReason || "";
                if (["區聚", "聚餐", "連假放假", "戶外活動"].includes(reason)) {
                    setSkipReason(reason);
                } else if (reason) {
                    setSkipReason("自訂");
                    setCustomReason(reason);
                }
            }

            // 4. Merge existing attendance with current member list
            // This ensures if new members were added to the group since the meeting, they appear unchecked.
            // And preserves the status of those who were present.
            const existingAttendance = (meetingData.attendance || []) as AttendanceRecord[];

            const mergedAttendance = membersData.map((m) => {
                const found = existingAttendance.find((a) => a.memberId === m.id);
                return {
                    memberId: m.id,
                    memberName: m.name,
                    present: found ? found.present : false,
                    prayerRequest: found ? found.prayerRequest : "",
                    careNote: found ? found.careNote : "",
                };
            });
            setAttendance(mergedAttendance);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleAttendance = (memberId: string) => {
        setAttendance((prev) =>
            prev.map((a) =>
                a.memberId === memberId
                    ? { ...a, present: !a.present, prayerRequest: !a.present ? "" : undefined, careNote: !a.present ? "" : undefined }
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

    const handleUpdate = async () => {
        if (!user) return;

        setSaving(true);
        try {
            if (!meetingId) return;
            if (!meetingDate) {
                alert("請選擇日期");
                setSaving(false);
                return;
            }
            const dateObj = new Date(meetingDate);
            if (isNaN(dateObj.getTime())) {
                alert("日期格式不正確");
                setSaving(false);
                return;
            }

            const sanitizedAttendance = attendance.map((a) => ({
                memberId: a.memberId,
                memberName: a.memberName,
                present: !!a.present,
                prayerRequest: a.prayerRequest || "",
                careNote: a.careNote || "",
            }));

            const sanitizedVisitors = newVisitors
                .filter((v) => v.name.trim())
                .map((v) => ({
                    name: v.name.trim(),
                    phone: (v.phone || "").trim(),
                    notes: (v.notes || "").trim(),
                }));

            const totalAttendance =
                sanitizedAttendance.filter((a) => a.present).length + sanitizedVisitors.length;

            await updateDoc(doc(db, "meetings", meetingId), {
                date: dateObj,
                attendance: isSpecialMeeting ? [] : sanitizedAttendance,
                newVisitors: isSpecialMeeting ? [] : sanitizedVisitors,
                totalAttendance: isSpecialMeeting ? 0 : totalAttendance,
                notes,
                type: isSpecialMeeting ? meetingType : "normal",
                skipReason: isSpecialMeeting ? (skipReason === "自訂" ? customReason : skipReason) : null,
                updatedAt: serverTimestamp(),
            });

            alert("更新成功！");
            router.push("/attendance/history");
        } catch (error) {
            console.error("Error updating attendance:", error);
            alert("更新失敗");
        } finally {
            setSaving(false);
        }
    };

    const presentCount = attendance.filter((a) => a.present).length;
    const totalCount = presentCount + newVisitors.filter((v) => v.name).length;

    if (!user) {
        return <div className="text-center py-10">請先登入</div>;
    }

    if (loading) {
        return <div className="text-center py-10">載入中...</div>;
    }

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Link href="/attendance/history" className="text-gray-500 hover:text-gray-700">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        編輯出席記錄
                    </h1>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">{totalCount}</div>
                    <div className="text-sm text-gray-500">總出席</div>
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
                                        {isPresent ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
                                    </div>
                                </button>
                                <div className={`${isPresent ? "bg-green-50 dark:bg-green-900/20" : "bg-gray-50 dark:bg-gray-800/60"} px-4 pb-4 space-y-2`}>
                                    <textarea
                                        value={record?.prayerRequest || ""}
                                        onChange={(e) => updatePrayerRequest(member.id, e.target.value)}
                                        placeholder={`請輸入 ${member.name} 的代禱事項...`}
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={2}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <textarea
                                        value={record?.careNote || ""}
                                        onChange={(e) => updateCareNote(member.id, e.target.value)}
                                        placeholder="需特別關懷：例如就醫/家庭/工作等"
                                        className="w-full p-2 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        rows={2}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            </div>
                        );
                    })}
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

            {/* Save Button */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t dark:bg-gray-800 dark:border-gray-700">
                <button
                    onClick={handleUpdate}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-4 rounded-lg text-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
                >
                    <Save className="w-5 h-5" />
                    {saving ? "更新中..." : "更新出席記錄"}
                </button>
            </div>
        </div>
    );
}
