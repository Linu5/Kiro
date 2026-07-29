import { open } from "@tauri-apps/plugin-dialog";
import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent, type ReactNode } from "react";
import clsx from "clsx";
import { Button } from "./ui";
import { useApp } from "@/state/AppStore";
import { detectFormat } from "@/lib/parsing";
import { isDesktop } from "@/lib/env";

/**
 * Report upload. Drag-and-drop is handled by the webview (the File object gives
 * us the bytes directly); the browse button uses the native dialog on desktop so
 * the Rust core does the read, and a hidden input in browser preview mode.
 */
export function UploadZone(): ReactNode {
  const { ingestFile, ingestPath, busy } = useApp();
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      if (!detectFormat(file.name)) {
        setLocalError(`${file.name} is not a supported format. Use PDF, DOCX, TXT or MD.`);
        return;
      }
      setLocalError(null);
      await ingestFile(file);
    },
    [ingestFile],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragging(false);
      void handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const browse = useCallback(async () => {
    if (!isDesktop()) {
      inputRef.current?.click();
      return;
    }
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Report", extensions: ["pdf", "docx", "txt", "md"] }],
    });
    if (typeof selected === "string") await ingestPath(selected);
  }, [ingestPath]);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={clsx(
        "rounded-2xl border bg-panel px-8 py-16 text-center transition-colors",
        dragging ? "border-brand bg-brand-soft" : "border-dashed border-hairline-strong shadow-panel",
      )}
    >
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand">
          {busy ? <Loader2 size={24} className="animate-spin" /> : <FileUp size={24} />}
        </span>
        <h2 className="text-[22px] font-semibold tracking-tight text-ink">
          {busy ? busy.message : "Drop your literature review here"}
        </h2>
        <p className="text-[13px] leading-relaxed text-ink-soft">
          PDF, DOCX, TXT or Markdown. Parsing happens on this device: the file is never uploaded, and
          only citation metadata such as a DOI or title is ever sent anywhere.
        </p>
        {busy?.total ? (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${Math.round(((busy.done ?? 0) / busy.total) * 100)}%` }}
            />
          </div>
        ) : null}
        <Button onClick={() => void browse()} disabled={Boolean(busy)} className="px-5 py-2 text-[13px]">
          Choose a file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.md"
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
        {localError && <p className="text-xs text-rose-600">{localError}</p>}
      </div>
    </div>
  );
}
