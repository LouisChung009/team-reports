export function Footer() {
    return (
        <footer className="bg-white border-t border-gray-200 mt-auto dark:bg-gray-900 dark:border-gray-800">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                    &copy; {new Date().getFullYear()} Group Manager. All rights reserved.
                </p>
            </div>
        </footer>
    );
}
