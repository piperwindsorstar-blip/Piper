"use client";

import { useState } from "react";
import Icon from "./Icon";

export default function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions);
      // the input is selectable, so the link is still reachable by hand.
      setCopied(false);
    }
  }

  return (
    <div className="btn-row" style={{ flexWrap: "nowrap" }}>
      <input type="text" readOnly value={value} onFocus={(e) => e.currentTarget.select()} />
      <button className="btn btn-sm" type="button" onClick={copy}>
        <Icon name={copied ? "check" : "copy"} size={15} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
