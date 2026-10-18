import { Plus, Search, Settings2, ShieldCheck } from 'lucide-react';
export default function ChatHeader({ onNewChat }) {
    return (<header className="chat-header">
      <div className="brand">
        <div className="brand-icon">
          <ShieldCheck size={19}/>
        </div>
        <div className="brand-copy">
          <strong>SADS</strong>
          <span>AI coding assistant</span>
        </div>
      </div>

      <div className="header-actions">
        <button className="icon-button" title="Search conversations" aria-label="Search conversations" onClick={() => window.dispatchEvent(new CustomEvent('sads:search'))}>
          <Search size={16}/>
        </button>

        <button className="icon-button" title="Settings" aria-label="Settings" onClick={() => window.dispatchEvent(new CustomEvent('sads:settings'))}>
          <Settings2 size={16}/>
        </button>

        <button className="icon-button primary-icon" title="New chat" aria-label="New chat" onClick={onNewChat}>
          <Plus size={18}/>
        </button>
      </div>
    </header>);
}
//# sourceMappingURL=ChatHeader.js.map