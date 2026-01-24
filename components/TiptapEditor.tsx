
import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/extension-bubble-menu';
import { FloatingMenu } from '@tiptap/extension-floating-menu';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import { refineTextWithAI } from '../services/geminiService';

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
    onEditorReady?: (editor: Editor) => void;
    onSelectionChange?: (text: string) => void;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange, onEditorReady, onSelectionChange }) => {
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    
    const editor = useEditor({
        extensions: [
            StarterKit,
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'article-image',
                },
            }),
            Placeholder.configure({
                placeholder: "输入 '/' 唤起 AI 助手，或在左侧聊天框输入 '/image' 生成配图...",
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        onSelectionUpdate: ({ editor }) => {
             const { from, to } = editor.state.selection;
             const text = editor.state.doc.textBetween(from, to, ' ');
             if (onSelectionChange) onSelectionChange(text);
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
            },
        },
    });

    useEffect(() => {
        if (editor && onEditorReady) {
            onEditorReady(editor);
        }
    }, [editor, onEditorReady]);

    // Handle AI commands (Direct Bubble Menu)
    const handleAiCommand = async (command: string, instruction: string) => {
        if (!editor || isAiProcessing) return;
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        const textToProcess = selectedText.trim() || "（请根据指令生成内容）";

        setIsAiProcessing(true);
        try {
            const refinedText = await refineTextWithAI(textToProcess, instruction);
            if (selectedText.trim()) {
                editor.chain().focus().deleteRange({ from, to }).insertContent(refinedText).run();
            } else {
                editor.chain().focus().insertContent(refinedText).run();
            }    
        } catch (error) {
            console.error("AI refinement failed:", error);
        } finally {
            setIsAiProcessing(false);
        }
    };

    if (!editor) return null;

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* BUBBLE MENU */}
            <BubbleMenu 
                editor={editor} 
                tippyOptions={{ duration: 100, placement: 'top' }}
                className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[200px] z-50"
            >
                {/* Simplified Bubble Menu */}
                <div className="p-1 flex flex-col gap-0.5">
                    <button onClick={() => handleAiCommand('polish', '润色这段文字')} className="menu-item">
                        <i className="fa-solid fa-pen-fancy text-xs text-blue-400 w-4"></i> 快速润色
                    </button>
                    <div className="text-[10px] text-gray-500 px-3 py-1">Tip: 可在左侧对话框输入 "/image" 生成配图</div>
                </div>
            </BubbleMenu>

            {/* FLOATING MENU */}
            <FloatingMenu 
                editor={editor} 
                tippyOptions={{ duration: 100, placement: 'right-start' }}
                className="flex items-center gap-1 -ml-10"
            >
                <button 
                     onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                     className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center shadow-lg"
                >H2</button>
            </FloatingMenu>

            <style>{`.menu-item { @apply text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded flex items-center gap-2 w-full transition-colors; }`}</style>
            <EditorContent editor={editor} className="flex-1 overflow-y-auto outline-none custom-scrollbar" />
        </div>
    );
};
export default TiptapEditor;
