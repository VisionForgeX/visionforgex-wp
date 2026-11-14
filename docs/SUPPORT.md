# Support on WordPress.org: the routine

The plugin's forum is at `https://wordpress.org/support/plugin/visionforgex/` once it is live. WordPress.org shows
how many threads were answered in the last two months, and unanswered ones count against the plugin, so the routine is
built around answering quickly.

## Every working day (10 minutes)

1. Open the forum (or the e-mails WordPress.org sends when you "subscribe" to the plugin's forum, the link at the
   bottom of the forum page).
2. Every new thread gets an answer the same day, even if the answer is "We are looking at this, back tomorrow".
3. Mark a thread **resolved** when the person says it works, or after 7 days without a reply (say so in a last post).

## Rules of the forum (WordPress.org's, strictly applied)

- **Never ask for logins, admin access or FTP**, and never ask people to e-mail credentials. Ask for the plugin's
  diagnostics (VisionForgeX → Settings → Diagnostics → **Copy for support**) or `wp visionforgex diagnostics`: it has no key and no secret.
- **No selling in the forum.** Account, payments and earnings questions are answered with: "That is about your
  VisionForgeX account rather than the plugin: please write to support@visionforgex.com and we will help there."
  That is allowed; pushing an upgrade is not.
- Answer as **VisionForgeX**, never under a personal name in the text.
- Be kind to bad reviews: answer once, factually, with what was fixed.

## Answers that come up often

| Question | Answer |
|---|---|
| "No ads show" | Is the site approved (Home says Live or In review)? Ads only show once VisionForgeX approves the site. Then: Go live checklist; a speed plugin delaying the tag (Site tools shows it); "Where ads show" rules; is the visitor logged in with "Anyone logged in" on? |
| "ads.txt is not complete" | ads.txt tab: which mode (served, file or by hand) and the missing lines. A real file the plugin cannot write: add the lines by hand, or make it writable. A network: only the main site keeps the file. |
| "In-content ads do not show" | Placements: is VisionForgeX placing ads automatically? The warning on top switches to "your own spots". Is the post long enough (at least N paragraphs)? |
| "My cookie banner…" | Privacy & signals → Consent bridge on; the chips show which banner the plugin found. TCF banners talk to Google directly. |
| "The page jumps when ads load" | Placements → "Keep the ad's space" on (it is by default). |
| "Remove everything" | Deactivate and delete the plugin: uninstall takes out its settings, jobs and ads.txt lines, nothing else. |

## When it is a bug

1. Ask for the diagnostics and the WordPress and PHP versions (both in the diagnostics).
2. Bring it here (to Claude) with the thread's link: it is reproduced in a test WordPress, fixed, tested, released.
3. Answer in the thread with the version that fixes it once it is on WordPress.org.

## Once a month

Look at the questions that came twice or more: each becomes a line in the FAQ of `readme.txt`, or a clearer word in
the plugin itself.
