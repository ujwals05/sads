import { ArrowUp, Square } from 'lucide-react';
import { useState } from 'react';
export default function PromptComposer({ busy, onSend, onCancel, }) {
    const [text, setText] = useState('');
    function submit() {
        const prompt = text.trim();
        if (!prompt || busy) {
            return;
        }
        onSend(prompt);
        setText('');
    }
    return (<footer className="composer-area">
      <form className="composer" onSubmit={(event) => {
            event.preventDefault();
            submit();
        }}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => {
            if (event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing) {
                event.preventDefault();
                submit();
            }
        }} placeholder="Describe what you want to build..." aria-label="Message SADS" rows={3}/>

        <div className="composer-footer">
          <span className="composer-hint">
            Enter to send · Shift+Enter for newline
          </span>

          {busy ? (<button type="button" className="send-button" onClick={onCancel} title="Cancel request" aria-label="Cancel request">
              <Square size={15}/>
            </button>) : (<button type="submit" className="send-button" disabled={!text.trim()} title="Send message" aria-label="Send message">
              <ArrowUp size={18}/>
            </button>)}
        </div>
      </form>

      <p className="composer-disclaimer">
        Review proposed changes and dependency decisions before execution.
      </p>
    </footer>);
}
//# sourceMappingURL=PromptComposer.js.map