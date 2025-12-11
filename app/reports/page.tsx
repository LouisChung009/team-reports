'use client';

import { useState } from 'react';
import { FileText, Loader2, Printer, Search } from 'lucide-react';

export default function ReportsPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    // Default to current month
    const today = new Date();
    const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

    const fetchReport = async () => {
        setLoading(true);
        try {
            // In a real app, this would be a dedicated API. 
            // For this MVP, I'll fetch raw meetings/members and filter client side or build a specific API.
            // Let's assume we build a specific API route for reporting to keep it clean.
            const res = await fetch(`/api/reports?month=${month}`);
            const json = await res.json();
            setData(json);
        } catch (e) {
            console.error(e);
            alert('產生報表失敗');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 print:p-0 print:max-w-none">
            {/* Control Bar - Hidden when printing */}
            <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <h1 className="text-xl font-bold">報表中心</h1>
                    <input
                        type="month"
                        value={month}
                        onChange={e => setMonth(e.target.value)}
                        className="border border-gray-300 rounded-lg p-2"
                    />
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin w-4 h-4" /> : <Search className="w-4 h-4" />}
                        產生報表
                    </button>
                </div>
                <button
                    onClick={() => window.print()}
                    disabled={!data}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                >
                    <Printer className="w-4 h-4" />
                    列印 / 存為 PDF
                </button>
            </div>

            {/* Report View */}
            {data ? (
                <div className="bg-white p-8 shadow-lg min-h-screen print:shadow-none print:p-0">
                    <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
                        <h1 className="text-3xl font-serif font-bold text-gray-900 mb-2">教會小組月報表</h1>
                        <p className="text-lg text-gray-600">{data.year} 年 {data.month} 月</p>
                        <div className="flex justify-center gap-8 mt-4 text-sm font-medium">
                            <span>填表人：{data.reporter || '小組長'}</span>
                            <span>列印日期：{new Date().toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Section 1: Meeting Stats */}
                    <div className="mb-8">
                        <h2 className="text-xl font-bold border-l-4 border-blue-600 pl-3 mb-4">一、聚會記錄</h2>
                        <table className="w-full border-collapse border border-gray-300 text-sm">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-300 p-2 text-left">日期</th>
                                    <th className="border border-gray-300 p-2 text-left">主題</th>
                                    <th className="border border-gray-300 p-2 text-center">出席人數</th>
                                    <th className="border border-gray-300 p-2 text-right">奉獻金額</th>
                                    <th className="border border-gray-300 p-2 text-left w-1/3">重點/備註</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.meetings.map((m: any) => (
                                    <tr key={m.id}>
                                        <td className="border border-gray-300 p-2">{m.date.slice(5)}</td>
                                        <td className="border border-gray-300 p-2">{m.topic}</td>
                                        <td className="border border-gray-300 p-2 text-center">{m.attendanceCount}</td>
                                        <td className="border border-gray-300 p-2 text-right">{m.offering_amount}</td>
                                        <td className="border border-gray-300 p-2 text-gray-600">{m.summary}</td>
                                    </tr>
                                ))}
                                <tr className="font-bold bg-gray-50">
                                    <td colSpan={2} className="border border-gray-300 p-2 text-right">總計 / 平均</td>
                                    <td className="border border-gray-300 p-2 text-center">{data.stats.avgAttendance}</td>
                                    <td className="border border-gray-300 p-2 text-right">{data.stats.totalOffering}</td>
                                    <td className="border border-gray-300 p-2"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 2: Member Attendance Grid */}
                    <div className="mb-8 break-inside-avoid">
                        <h2 className="text-xl font-bold border-l-4 border-green-600 pl-3 mb-4">二、組員出席狀況</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300 text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-300 p-2 text-left min-w-[100px]">姓名</th>
                                        <th className="border border-gray-300 p-2 text-center w-20">狀態</th>
                                        {data.meetings.map((m: any) => (
                                            <th key={m.id} className="border border-gray-300 p-2 text-center w-16 text-xs">
                                                {m.date.slice(5)}
                                            </th>
                                        ))}
                                        <th className="border border-gray-300 p-2 text-left">備註 (關懷狀況)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.members.map((member: any) => (
                                        <tr key={member.id}>
                                            <td className="border border-gray-300 p-2 font-medium">{member.name}</td>
                                            <td className="border border-gray-300 p-2 text-center text-xs text-gray-500">{member.status}</td>
                                            {data.meetings.map((m: any) => {
                                                const status = member.attendance[m.id] || '-';
                                                return (
                                                    <td key={m.id} className={`border border-gray-300 p-2 text-center ${status === '缺席' ? 'text-red-500 font-bold' : ''}`}>
                                                        {status === '出席' ? 'O' : status === '缺席' ? 'X' : status === '遲到' ? 'L' : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="border border-gray-300 p-2 text-gray-500 text-xs">
                                                {/* Show latest note or summary */}
                                                {member.recentLog}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-2 text-xs text-gray-500 text-right">
                            圖例： O=出席, X=缺席, L=遲到, -=無紀錄
                        </div>
                    </div>

                    {/* Section 3: Prayer / Special Notes */}
                    <div className="break-inside-avoid">
                        <h2 className="text-xl font-bold border-l-4 border-amber-600 pl-3 mb-4">三、特殊事項與代禱</h2>
                        <div className="border border-gray-300 rounded-lg p-4 min-h-[150px]">
                            <p className="text-gray-500 italic">請手寫補充或在系統中新增 general notes...</p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between text-sm text-gray-500">
                        <span>小組名稱：信帆小組</span>
                        <span>牧區：_____________</span>
                        <span>區長簽名：_____________</span>
                    </div>

                </div>
            ) : (
                <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-gray-100">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">請選擇月份並點擊「產生報表」查看預覽</p>
                </div>
            )}
        </div>
    );
}
