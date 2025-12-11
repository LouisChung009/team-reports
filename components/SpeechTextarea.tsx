"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";

interface SpeechTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onSpeechInput?: (text: string) => void;
}

export default function SpeechTextarea({
    className = "",
    value,
    onChange,
    onSpeechInput,
    ...props
}: SpeechTextareaProps) {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            // @ts-ignore
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (SpeechRecognition) {
                setIsSupported(true);
                const recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = false;
                recognition.lang = "zh-TW";

                recognition.onstart = () => {
                    setIsListening(true);
                };

                recognition.onend = () => {
                    setIsListening(false);
                };

                recognition.onresult = (event: any) => {
                    const transcript = event.results[0][0].transcript;
                    if (onChange) {
                        // Create a synthetic event to trigger onChange
                        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                            window.HTMLTextAreaElement.prototype,
                            "value"
                        )?.set;

                        // If we have a ref to the textarea (we don't here directly without forwardRef),
                        // but we can trust the parent passed value and onChange.
                        // Best way is to append to current value or replace? 
                        // Usually voice input appends if there is space, or replaces.
                        // Let's prompt user or just append. 
                        // For simplicity, let's append if there's text, or set if empty.

                        const currentValue = String(value || "");
                        const newValue = currentValue ? `${currentValue} ${transcript}` : transcript;

                        // Call the custom onSpeechInput if provided, otherwise try to simulate onChange
                        if (onSpeechInput) {
                            onSpeechInput(newValue);
                        } else {
                            // Fallback if parent only passed onChange but we can't easily synthesize a React event without the DOM node
                            // We will assume onSpeechInput is passed or we'll handle it in the parent
                        }
                    }
                };

                recognitionRef.current = recognition;
            }
        }
    }, [value, onChange, onSpeechInput]);

    const toggleListening = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
        }
    };

    return (
        <div className="relative">
            <textarea
                value={value}
                onChange={onChange}
                className={`pr-10 ${className}`} // Add padding for the button
                {...props}
            />
            {isSupported && (
                <button
                    type="button"
                    onClick={toggleListening}
                    className={`absolute right-2 bottom-2 p-1.5 rounded-full transition-colors ${isListening
                            ? "bg-red-100 text-red-600 animate-pulse"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                    title="語音輸入"
                >
                    {isListening ? (
                        <MicOff className="w-4 h-4" />
                    ) : (
                        <Mic className="w-4 h-4" />
                    )}
                </button>
            )}
        </div>
    );
}
