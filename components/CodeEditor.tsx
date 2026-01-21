import React, { useState, useEffect } from 'react';
import { Slide } from '../types';

interface CodeEditorProps {
    slide: Slide;
    onSave: (id: string, newHtml: string) => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ slide, onSave }) => {
    const [code, setCode] = useState(slide.content_html);

    useEffect(() => {
        setCode(slide.content_html);
    }, [slide.id, slide.content_html]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            // Simple tab insertion for MVP
            const target = e.target as HTMLTextAreaElement;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const value = target.value;
            const newValue = value.substring(0, start) + '  ' + value.substring(end);
            setCode(newValue);
            // Move caret
            setTimeout(() => {
                target.selectionStart = target.selectionEnd = start + 2;
            }, 0);
        }
    };

    const handleBlur = () => {
        if (code !== slide.content_html) {
            onSave(slide.id, code);
        }
    }

    return (
        <div className="flex flex-col h-full bg-gray-900 border-t border-gray-800">
            <div className="px-4 py-2 bg-gray-950 border-b border-gray-800 flex justify-between items-center">
                 <span className="text-xs font-mono text-gray-500">HTML 源码</span>
                 <button 
                    className="text-xs text-blue-400 hover:text-blue-300 uppercase font-bold"
                    onClick={() => onSave(slide.id, code)}
                 >
                    应用更改
                 </button>
            </div>
            <textarea
                className="flex-1 bg-[#0d1117] text-gray-300 font-mono text-xs p-4 focus:outline-none resize-none"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                spellCheck={false}
            />
        </div>
    );
}

export default CodeEditor;