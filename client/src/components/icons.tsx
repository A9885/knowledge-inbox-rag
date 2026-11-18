import type { ReactNode } from "react";
import type { Item } from "../types";

// Small outline icons (24x24 grid, drawn with currentColor), so colour and size come from the surrounding text.
const base = (children: ReactNode, size = 18, fill = "none") => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const SparkleIcon = ({ size }: { size?: number }) => base(<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" />, size, "currentColor");
export const DocIcon = ({ size }: { size?: number }) => base(<><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>, size);
export const LinkIcon = ({ size }: { size?: number }) => base(<><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" /></>, size);
export const SearchIcon = ({ size }: { size?: number }) => base(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>, size);
export const UserIcon = ({ size }: { size?: number }) => base(<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0114 0" /></>, size, "currentColor");
export const DotsIcon = ({ size }: { size?: number }) => base(<><circle cx="5" cy="12" r="1.3" fill="currentColor" /><circle cx="12" cy="12" r="1.3" fill="currentColor" /><circle cx="19" cy="12" r="1.3" fill="currentColor" /></>, size);
export const ExternalIcon = ({ size }: { size?: number }) => base(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />, size ?? 14);
export const SendIcon = ({ size }: { size?: number }) => base(<path d="M4 12l16-8-6 16-3-7-7-1z" />, size, "currentColor");
export const PlusIcon = ({ size }: { size?: number }) => base(<path d="M12 5v14M5 12h14" />, size ?? 16);

/** The icon for a kind of saved thing: a page for notes and chats, a chain for links. */
export const TypeIcon = ({ type, size }: { type: Item["type"]; size?: number }) => (type === "url" ? <LinkIcon size={size} /> : <DocIcon size={size} />);
