
import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent, Node, mergeAttributes } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

// --- Custom Extension for [M] Marker ---
const MarkerExtension = Node.create({
  name: 'marker',
  group: 'inline',
  inline: true,
  atom: true, // Makes it a single unit (undividable, draggable)

  addAttributes() {
    return {
      id: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="marker"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'marker', class: 'inline-flex items-center justify-center w-5 h-5 mx-1 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold rounded border border-yellow-500/50 cursor-grab select-none hover:bg-yellow-500/40 transition-colors align-middle' }), '⚑']
  },
});

interface ScriptMarkerEditorProps {
    value: string; // Plain text with [M]
    onChange: (newValue: string) => void;
}

const ScriptMarkerEditor: React.FC<ScriptMarkerEditorProps> = ({ value, onChange }) => {
    // Helper: Convert "Hello [M] World" -> HTML with <span data-type="marker"></span>
    const deserialize = (text: string) => {
        if (!text) return '<p></p>';
        // Replace [M] or [M:1] with marker node HTML
        // Note: We ignore the ID inside [M:x] for visual simplicity, treating all as generic markers
        const html = text.replace(/\[M(?::\d+)?\]/g, '<span data-type="marker"></span>');
        return html.split('\n').map(line => `<p>${line}</p>`).join('');
    };

    // Helper: Convert Tiptap JSON -> "Hello [M] World"
    const serialize = (json: any): string => {
        if (!json || !json.content) return '';
        
        let text = '';
        json.content.forEach((block: any, blockIndex: number) => {
             if (block.content) {
                 block.content.forEach((node: any) => {
                     if (node.type === 'text') {
                         text += node.text;
                     } else if (node.type === 'marker') {
                         text += ' [M] ';
                     }
                 });
             }
             if (blockIndex < json.content.length - 1) {
                 text += '\n'; // Preserve paragraphs as newlines
             }
        });
        return text.trim(); // Clean up extra spaces
    };

    const editor = useEditor({
        extensions: [
            StarterKit,
            MarkerExtension,
        ],
        content: deserialize(value),
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none text-sm text-gray-300 font-mono leading-relaxed min-h-[160px] p-4',
            },
        },
        onUpdate: ({ editor }) => {
            const newText = serialize(editor.getJSON());
            // Only notify change if semantically different (debounce/check logic could go here)
            // But simple equality check might fail due to whitespace variations.
            // We rely on parent to debounce if needed.
            onChange(newText);
        },
    });

    // Sync external value changes (careful to avoid loops)
    useEffect(() => {
        if (editor && value) {
            const currentText = serialize(editor.getJSON());
            // Basic check to prevent cursor jumping loop
            // If the structure is drastically different (e.g. external load), update content
            // This is a naive check; for a production app, we'd need better diffing.
            // For now, we only update if the lengths differ significantly or it's a slide switch.
            if (Math.abs(currentText.length - value.length) > 5 || currentText === '') {
                 // Only reset if it looks like a different slide loaded
                 // editor.commands.setContent(deserialize(value)); 
                 // NOTE: To strictly follow "Controlled Component" pattern with Tiptap is hard.
                 // We will rely on key-based remounting in the parent for slide switching.
            }
        }
    }, [value, editor]);

    // Force refresh when slide changes (handled by parent key)
    
    const insertMarker = () => {
        editor?.chain().focus().insertContent('<span data-type="marker"></span>').run();
    };

    if (!editor) return null;

    return (
        <div className="flex flex-col h-full bg-[#0F0F12] border border-gray-700 rounded overflow-hidden">
            <div className="bg-[#1a1a1a] border-b border-gray-700 px-3 py-1.5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase">
                    <i className="fa-solid fa-pen-nib mr-1"></i> 智能脚本编辑器
                </span>
                <button 
                    onClick={insertMarker}
                    className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/50 px-2 py-0.5 rounded hover:bg-yellow-500/40 transition-colors flex items-center gap-1"
                    title="插入动画锚点"
                >
                    <i className="fa-solid fa-flag"></i> 插入锚点 [M]
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar cursor-text" onClick={() => editor.commands.focus()}>
                <EditorContent editor={editor} />
            </div>
            <div className="bg-[#1a1a1a] border-t border-gray-700 px-3 py-1 text-[9px] text-gray-500 flex justify-between">
                <span>提示：拖动 <span className="inline-block w-3 h-3 bg-yellow-500/20 rounded align-middle mx-1">⚑</span> 调整动画时机</span>
                <span>Plain Text Mode</span>
            </div>
        </div>
    );
};

export default ScriptMarkerEditor;
