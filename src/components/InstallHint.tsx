"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

/**
 * Offers to put Piper on the phone's home screen.
 *
 * Two browsers, two entirely different mechanisms. Chrome fires
 * `beforeinstallprompt` and hands over a prompt to call later; Safari has no
 * such event and never will, so iPhone users get told where the button is
 * instead. Nothing here pretends the two are the same.
 *
 * It hides itself when the app is already installed — a running standalone
 * window asking to be installed is the kind of detail that makes software feel
 * unmaintained. Once dismissed it stays dismissed, because a banner that comes
 * back is worse than no banner.
 */

type InstallEvent = Event & { prompt: () => Promise<void> };

const DISMISSED = "piper-install-dismissed";

export default function InstallHint() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Already installed: nothing to offer.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED) === "1";
    } catch {
      // Private browsing throws on access; treat that as "not dismissed" and
      // simply show it again next time.
    }
    if (dismissed) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIos(ios);
    if (ios) {
      setShow(true);
      return;
    }

    const onPrompt = (event: Event) => {
      // Chrome shows its own bar unless this is called.
      event.preventDefault();
      setPrompt(event as InstallEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      // Nothing to do; it will offer again next time, which is survivable.
    }
  }

  if (!show) return null;

  return (
    <div className="install-hint">
      <Icon name="sparkle" size={17} />
      <div className="install-hint-text">
        {isIos ? (
          <>
            <strong>Keep this on your phone.</strong> Tap Share, then{" "}
            <em>Add to Home Screen</em>.
          </>
        ) : (
          <>
            <strong>Keep this on your phone.</strong> It opens like an app, without the
            browser bars.
          </>
        )}
      </div>

      <div className="btn-row">
        {!isIos && prompt && (
          <button
            className="btn btn-sm btn-primary"
            type="button"
            onClick={async () => {
              await prompt.prompt();
              // The prompt is single-use whatever the person chose.
              setPrompt(null);
              dismiss();
            }}
          >
            Install
          </button>
        )}
        <button className="btn btn-sm" type="button" onClick={dismiss}>
          No thanks
        </button>
      </div>
    </div>
  );
}
