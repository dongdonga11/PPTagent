
import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
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
            {/* Toolbar - 简化版工具栏 */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-900">
                <button 
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    className={`px-3 py-1 text-sm rounded ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                    H2
                </button>
                <button 
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`px-3 py-1 text-sm rounded ${editor.isActive('bold') ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                >
                    <i className="fa-solid fa-bold"></i>
                </button>
                <div className="flex-1"></div>
                <button 
                    onClick={() => handleAiCommand('polish', '润色选中的文字')}
                    disabled={isAiProcessing}
                    className="px-3 py-1 text-sm rounded bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
                >
                    {isAiProcessing ? '处理中...' : 'AI 润色'}
                </button>
            </div>

            <EditorContent editor={editor} className="flex-1 overflow-y-auto outline-none custom-scrollbar" />
        </div>
    );
};
export default TiptapEditor;
