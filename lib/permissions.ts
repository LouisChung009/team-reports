export const DASHBOARD_PERMISSIONS = {
    VIEW_QUICK_STATS: 'dashboard:quick_stats',
    VIEW_ATTENDANCE_CHART: 'dashboard:attendance_chart',
    VIEW_MONTHLY_REPORT: 'dashboard:monthly_report',
    VIEW_MEMBER_STATS: 'dashboard:member_stats',
    VIEW_CARE_LIST: 'dashboard:care_list',
} as const;

export type Permission = typeof DASHBOARD_PERMISSIONS[keyof typeof DASHBOARD_PERMISSIONS];

// 在這裡設定每位牧者/使用者的權限
// 格式: "email": ["權限1", "權限2", ...]
// 使用 "ALL" 可賦予所有權限
const USER_CONFIG: Record<string, (Permission | "ALL")[]> = {
    // 範例：給予超級管理員所有權限 (請替換為您的 Email)
    "admin@example.com": ["ALL"],

    // 範例：這是您的 Email (根據我所知)，暫時給予所有權限方便測試
    "louischung009@example.com": ["ALL"], // 請確認您的登入 Email

    // 範例：牧者A 只能看快速統計和關懷名單
    "pastor.a@example.com": [
        DASHBOARD_PERMISSIONS.VIEW_QUICK_STATS,
        DASHBOARD_PERMISSIONS.VIEW_CARE_LIST
    ],

    // 範例：牧者B 只能看報表下載
    "pastor.b@example.com": [
        DASHBOARD_PERMISSIONS.VIEW_MONTHLY_REPORT
    ]
};

// 預設權限 (當 Email 不在清單中時)
// 如果希望預設全開，可設為 ["ALL"]
// 如果希望預設全關，設為 []
const DEFAULT_PERMISSIONS: (Permission | "ALL")[] = ["ALL"];

export function checkPermission(email: string | null | undefined, permission: Permission): boolean {
    if (!email) return false;

    // 轉小寫以避免大小寫問題
    const normalizedEmail = email.toLowerCase();

    // 取得該使用者的權限設定，若無則使用預設值
    const userPerms = USER_CONFIG[normalizedEmail] || DEFAULT_PERMISSIONS;

    if (userPerms.includes("ALL")) return true;

    return userPerms.includes(permission);
}
