import { useEffect, useRef, useState } from "react";
import { Avatar, Button, Input, TextField } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  SentIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { formatTime } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

type LobbyChatPanelsProps = {
  generalMessages: ChatMessage[];
  teamMessages: ChatMessage[];
  onSendGeneral: (message: string) => Promise<void> | void;
  onSendTeam: (message: string) => Promise<void> | void;
  generalDisabled?: boolean;
  teamDisabled?: boolean;
  teamLabel?: string;
  teamHint?: string;
};

export function LobbyChatPanels({
  generalMessages,
  teamMessages,
  onSendGeneral,
  onSendTeam,
  generalDisabled,
  teamDisabled,
  teamLabel = "Team chat",
  teamHint,
}: LobbyChatPanelsProps) {
  const [generalOpen, setGeneralOpen] = useState(true);
  const [teamOpen, setTeamOpen] = useState(true);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <ChatSection
        title="General chat"
        open={generalOpen}
        onToggle={() => setGeneralOpen((value) => !value)}
        messages={generalMessages}
        emptyText="Say hi to the lobby."
        placeholder="Message everyone…"
        disabled={generalDisabled}
        onSend={onSendGeneral}
      />
      <ChatSection
        title={teamLabel}
        open={teamOpen}
        onToggle={() => setTeamOpen((value) => !value)}
        messages={teamMessages}
        emptyText={teamHint ?? "Join a team to chat with your side."}
        placeholder="Message your team…"
        disabled={teamDisabled}
        onSend={onSendTeam}
      />
    </div>
  );
}

function ChatSection({
  title,
  open,
  onToggle,
  messages,
  emptyText,
  placeholder,
  disabled,
  onSend,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  emptyText: string;
  placeholder: string;
  disabled?: boolean;
  onSend: (message: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, open]);

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || pending || disabled) return;
    setPending(true);
    try {
      await onSend(trimmed);
      setValue("");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-pf-line bg-white/70 ${
        open ? "flex-1" : "shrink-0"
      }`}
    >
      <button
        type="button"
        className="flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-black/3"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="font-display text-sm font-semibold tracking-tight">
          {title}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          className={`text-pf-muted transition-transform ${open ? "rotate-0" : "-rotate-90"}`}
        />
      </button>

      {open ? (
        <>
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 pb-2">
            {messages.length === 0 ? (
              <p className="text-xs text-pf-muted">{emptyText}</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="flex gap-2">
                  <Avatar size="sm">
                    {message.avatarUrl ? (
                      <Avatar.Image
                        src={message.avatarUrl}
                        alt={message.username}
                      />
                    ) : null}
                    <Avatar.Fallback>
                      <HugeiconsIcon icon={UserIcon} size={14} />
                    </Avatar.Fallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate text-sm font-semibold">
                        {message.username}
                      </span>
                      <span className="text-[11px] text-pf-muted">
                        {formatTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="wrap-break-word text-sm text-pf-ink/90">
                      {message.message}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex gap-2 border-t border-pf-line p-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSend();
            }}
          >
            <TextField className="flex-1" fullWidth isDisabled={disabled}>
              <Input
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder={placeholder}
                maxLength={500}
              />
            </TextField>
            <Button
              type="submit"
              variant="primary"
              isIconOnly
              aria-label="Send message"
              isPending={pending}
              isDisabled={disabled || !value.trim()}
            >
              <HugeiconsIcon icon={SentIcon} size={18} />
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
