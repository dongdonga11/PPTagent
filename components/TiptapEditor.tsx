
import React, { useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { refineTextWithAI } from '../services/geminiService';

interface TiptapEditorProps {
    content: string;
    onChange: (html: string) => void;
}

const TiptapEditor: React.FC<TiptapEditorProps> = ({ content, onChange }) => {
    const [isAiProcessing, setIsAiProcessing] = useState(false);
    
    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "输入 '/' 唤起 AI 助手，或直接开始写作...",
            }),
        ],
        content: content,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[500px] px-8 py-6',
            },
        },
    });

    // Handle AI commands
    const handleAiCommand = async (command: string, instruction: string) => {
        if (!editor || isAiProcessing) return;

        // Determine selection or use current cursor position
        const { from, to } = editor.state.selection;
        const selectedText = editor.state.doc.textBetween(from, to);
        
        // If "Draft" mode (Floating Menu), we might not have selection, we use the instruction as prompt
        const textToProcess = selectedText.trim() || "（请根据指令生成内容）";

        setIsAiProcessing(true);
        try {
            const refinedText = await refineTextWithAI(textToProcess, instruction);
            
            // If it was a selection, replace it. If it was a cursor insert, append it.
            if (selectedText.trim()) {
                editor.chain().focus().deleteRange({ from, to }).insertContent(refinedText).run();
            } else {
                editor.chain().focus().insertContent(refinedText).run();
            }
                
        } catch (error) {
            console.error("AI refinement failed:", error);
            alert("AI 请求失败，请重试");
        } finally {
            setIsAiProcessing(false);
        }
    };

    if (!editor) {
        return null;
    }

    return (
        <div className="relative w-full h-full flex flex-col">
            {/* 1. BUBBLE MENU (Text Selection Context) */}
            {editor && (
                <BubbleMenu 
                    editor={editor} 
                    tippyOptions={{ duration: 100, placement: 'top' }}
                    className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden flex flex-col min-w-[200px] z-50"
                >
                    <div className="px-3 py-2 bg-blue-900/20 border-b border-gray-700 flex items-center justify-between">
                         <span className="text-xs font-bold text-blue-400">
                            <i className="fa-solid fa-wand-magic-sparkles mr-2"></i>AI 编辑
                         </span>
                         {isAiProcessing && <i className="fa-solid fa-circle-notch fa-spin text-xs text-gray-400"></i>}
                    </div>
                    
                    {!isAiProcessing && (
                        <div className="p-1 flex flex-col gap-0.5">
                            <button onClick={() => handleAiCommand('polish', '润色这段文字，使其更专业、流畅')} className="menu-item">
                                <i className="fa-solid fa-pen-fancy text-xs text-blue-400 w-4"></i> 润色优化
                            </button>
                            <button onClick={() => handleAiCommand('expand', '扩写这段文字，增加细节和论据')} className="menu-item">
                                <i className="fa-solid fa-align-left text-xs text-green-400 w-4"></i> 智能扩写
                            </button>
                            <button onClick={() => handleAiCommand('golden', '提炼出一句不超过20字的‘扎心金句’，适合做朋友圈卡片')} className="menu-item">
                                <i className="fa-solid fa-quote-left text-xs text-yellow-400 w-4"></i> 提炼金句
                            </button>
                            <div className="h-px bg-gray-700 my-1"></div>
                             <button onClick={() => handleAiCommand('style_jody', '将这段话改写为‘疯狂动物城朱迪警官’的语气，充满热血正义感')} className="menu-item">
                                <i className="fa-solid fa-user-police text-xs text-purple-400 w-4"></i> 风格：朱迪警官
                            </button>
                        </div>
                    )}
                </BubbleMenu>
            )}

            {/* 2. FLOATING MENU (Empty Line Context - "Slash Command" Sim) */}
            {editor && (
                <FloatingMenu 
                    editor={editor} 
                    tippyOptions={{ duration: 100, placement: 'right-start' }}
                    className="flex items-center gap-1 -ml-10"
                >
                    <button 
                        onClick={() => handleAiCommand('continue', '根据上文内容续写一段，保持逻辑连贯')}
                        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110"
                        title="AI 续写"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                    </button>
                    <button 
                         onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                         className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center shadow-lg"
                         title="二级标题"
                    >
                        H2
                    </button>
                     <button 
                         onClick={() => editor.chain().focus().toggleBlockquote().run()}
                         className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 text-gray-200 flex items-center justify-center shadow-lg"
                         title="引用"
                    >
                        <i className="fa-solid fa-quote-right text-xs"></i>
                    </button>
                </FloatingMenu>
            )}

            {/* 3. MAIN EDITOR */}
            <style>{`
                .menu-item {
                    @apply text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded flex items-center gap-2 w-full transition-colors;
                }
            `}</style>
            <EditorContent editor={editor} className="flex-1 overflow-y-auto outline-none custom-scrollbar" />
        </div>
    );
};

export default TiptapEditor;
