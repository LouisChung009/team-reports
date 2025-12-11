"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, FileText, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const navItems = [
        { name: "儀表板", href: "/dashboard" },
        { name: "出席記錄", href: "/attendance" },
        { name: "成員管理", href: "/members" },
        { name: "報表列表", href: "/reports" },
    ];

    return (
        <nav className="bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                    <div className="flex">
                        <div className="flex-shrink-0 flex items-center">
                            <Link href="/" className="flex items-center gap-2">
                                <FileText className="h-8 w-8 text-blue-600" />
                                <span className="font-bold text-xl text-gray-900 dark:text-white">
                                    Group Manager
                                </span>
                            </Link>
                        </div>
                        <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            {navItems.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-600"
                                >
                                    {item.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                    <div className="hidden sm:ml-6 sm:flex sm:items-center">
                        <button
                            type="button"
                            className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-900 dark:text-gray-300 dark:hover:text-white"
                        >
                            <span className="sr-only">View profile</span>
                            <User className="h-6 w-6" />
                        </button>
                    </div>
                    <div className="-mr-2 flex items-center sm:hidden">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isOpen ? (
                                <X className="block h-6 w-6" />
                            ) : (
                                <Menu className="block h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile menu */}
            <div className={cn("sm:hidden", isOpen ? "block" : "hidden")}>
                <div className="pt-2 pb-3 space-y-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="block pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 dark:hover:border-gray-600"
                            onClick={() => setIsOpen(false)}
                        >
                            {item.name}
                        </Link>
                    ))}
                </div>
            </div>
        </nav>
    );
}
