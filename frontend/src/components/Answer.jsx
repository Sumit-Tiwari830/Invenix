import React, { useMemo, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { FileText, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

export default function Answer({ markdown, citations = [] }) {
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);
  const [activeCitationIndex, setActiveCitationIndex] = useState(null);

  // Parse think logs and format citations
  const { parsedMarkdown, thinkingContent } = useMemo(() => {
    let thinking = "";
    let cleanMarkdown = markdown;

    // Extract content inside <think>...</think>
    const thinkMatch = markdown.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      thinking = thinkMatch[1].trim();
      cleanMarkdown = markdown.replace(/<think>[\s\S]*?<\/think>/, "").trim();
    } else if (markdown.includes("<think>")) {
      // Stream is currently thinking
      const parts = markdown.split("<think>");
      cleanMarkdown = parts[0].trim();
      thinking = parts[1].trim();
    }

    // Convert [citation:X] into markdown link syntax: [X](#citation-X)
    const formattedMarkdown = cleanMarkdown.replace(/\[citation:(\d+)\]/g, "[$1](#citation-$1)");

    return {
      parsedMarkdown: formattedMarkdown,
      thinkingContent: thinking,
    };
  }, [markdown]);

  // Render a custom link override for react-markdown
  const renderers = {
    a: ({ href, children }) => {
      const isCitation = href?.startsWith("#citation-");
      if (isCitation) {
        const citationNum = href.replace("#citation-", "");
        const index = parseInt(citationNum, 10) - 1;
        const hasInfo = citations && citations[index];

        return (
          <span className="relative inline-block mx-0.5">
            <button
              onClick={() => setActiveCitationIndex(activeCitationIndex === index ? null : index)}
              onMouseEnter={() => setActiveCitationIndex(index)}
              onMouseLeave={() => setActiveCitationIndex(null)}
              className="inline-flex items-center justify-center w-5 h-5 text-xs font-semibold rounded bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-400 border border-indigo-500/30 transition-all duration-200"
            >
              {children}
            </button>
            
            {/* Popover Tooltip */}
            {activeCitationIndex === index && hasInfo && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 max-w-sm glass-panel border border-white/10 rounded-xl p-4 shadow-xl z-50 text-left block text-xs leading-normal">
                <span className="flex items-center gap-2 font-medium text-indigo-300 border-b border-white/5 pb-2 mb-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">
                    {citations[index].metadata.file_name}
                  </span>
                  <span className="text-zinc-500 text-[10px] ml-auto">
                    Score: {Math.max(0, (1 - (citations[index].score || 0))).toFixed(2)}
                  </span>
                </span>
                <span className="text-zinc-300 line-clamp-4 overflow-y-auto block max-h-32 mb-1 scrollbar-thin">
                  "{citations[index].page_content}"
                </span>
              </span>
            )}
          </span>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
          {children}
        </a>
      );
    },
  };

  return (
    <div className="space-y-4 w-full">
      {/* Deep-Thinking Accordion */}
      {thinkingContent && (
        <div className="rounded-xl overflow-hidden bg-white/3 border border-white/5 glass-panel">
          <button
            onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
            className="flex items-center justify-between w-full px-4 py-3 bg-white/2 hover:bg-white/5 text-zinc-400 hover:text-white transition-all text-xs font-medium border-b border-white/5"
          >
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse-glow" />
              💭 Deep Thinking Log
            </span>
            {isThinkingExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          {isThinkingExpanded && (
            <div className="p-4 text-xs font-mono text-zinc-500 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed border-l-2 border-indigo-500/40">
              {thinkingContent}
            </div>
          )}
        </div>
      )}

      {/* Main Markdown Answer */}
      {parsedMarkdown ? (
        <div className="prose prose-invert prose-zinc max-w-none text-zinc-200 leading-relaxed text-sm">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={renderers}
          >
            {parsedMarkdown}
          </Markdown>
        </div>
      ) : (
        !thinkingContent && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm italic">
            <AlertCircle className="w-4 h-4 animate-pulse" />
            <span>Formulating response...</span>
          </div>
        )
      )}
    </div>
  );
}
