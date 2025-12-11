export default function Home() {
    return (
        <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6 dark:bg-gray-800">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                    歡迎使用 Group Manager
                </h1>
                <p className="text-gray-600 dark:text-gray-300">
                    這是一個自動化的報表產生系統。請從上方選單選擇功能開始使用。
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-white shadow rounded-lg p-6 dark:bg-gray-800 border-l-4 border-blue-500">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        快速報表
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        建立新的報表並匯出為 Word 或 Excel。
                    </p>
                </div>
                <div className="bg-white shadow rounded-lg p-6 dark:bg-gray-800 border-l-4 border-green-500">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        報表管理
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        檢視與管理已建立的報表。
                    </p>
                </div>
                <div className="bg-white shadow rounded-lg p-6 dark:bg-gray-800 border-l-4 border-purple-500">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        會員中心
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                        管理您的帳號與權限。
                    </p>
                </div>
            </div>
        </div>
    );
}
