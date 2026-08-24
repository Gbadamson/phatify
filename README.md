# Phathand Tech — Certificate Verification Terminal

A single interactive page with a 3D avatar ("Ada") that verifies a student's
name against your training records — no database required.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Visual design (colors, fonts, layout) |
| `script.js` | 3D avatar (three.js) + search/verification logic |
| `students.json` | **Your data.** Just names — edit this to add/remove students |

## How it works

1. A student scans the QR code on their physical certificate.
2. The QR code should simply link to wherever you host this page (no ID or
   name needs to be encoded in the QR — keep it generic, e.g.
   `https://verify.yourdomain.com`).
3. The student types their full name into the box.
4. Ada "thinks" for a moment, then confirms or apologizes, matching the
   flavor of a real check-in with the trainer.

## Editing the student list

Open `students.json`. It looks like this:

```json
{
  "course": "Phathand Tech Summer Coaching",
  "motto": "Innovation · Service · Excellence",
  "trainer": "Phathand Tech",
  "students": [
    "Rex Efosa Uhunoma | Web Development",
    "Favour Adesuwa Obazee | Graphic Design"
  ]
}
```

Each line is `Full Name | Skill Trained On`. When a name is verified, the
skill shows up in the result card and Ada mentions it in her confirmation
message (e.g. "Confirmed! Favour's certificate checks out, verified in
Graphic Design.").

- Add a new cohort member: add a new line with their **exact full name**,
  a pipe `|`, then the skill — with a comma after the previous line.
- Remove someone: delete their line.
- The pipe/skill is optional — a line with just a name (no `|`) still works,
  it just won't show a skill on the result card.
- Reuse this for a future cohort: change `course` and update the `students`
  list — everything else (avatar, styling) stays the same.

The matching is whitespace/case-insensitive, and if someone mistypes a name
slightly, Ada will try to suggest the closest real match rather than just
failing silently.

**Note:** the `students.json` in this download currently has **placeholder
skills** (Web Development / Graphic Design / UI/UX Design, assigned round-
robin) since I don't have your actual name-to-skill mapping yet — send that
over and I'll drop in the real data.

**Also:** one entry in your original list had a stray apostrophe
("Ohenhen Abraham'") — I cleaned it to "Ohenhen Abraham" in the JSON. Let me
know if that wasn't intentional.

## Hosting

This is a fully static site — three files load a friend (three.js + GSAP)
from a CDN, and everything else is self-contained. You can host it for free
on any of these (drag-and-drop, no build step):

- **Netlify Drop** — netlify.com/drop, drag the `cert-verify` folder in
- **GitHub Pages** — push the folder to a repo, enable Pages
- **Vercel** — vercel.com, drag-and-drop deploy
- Any regular web host / cPanel — upload the 4 files via FTP

Once hosted, point your QR code generator at that URL.

## Responsive behavior

The layout and the 3D scene both adapt across three breakpoints:

- **Mobile (< 640px):** the camera pulls back and the avatar lifts higher in
  frame so it stays fully visible above the search panel, which takes up
  more relative screen height on phones. A separate short-landscape
  variant (e.g. a phone rotated sideways) tightens spacing further and
  hides non-essential text (subtitle, motto) so the avatar and input stay
  in view.
- **Tablet (640–1024px):** slightly wider panels, more breathing room.
- **Desktop (1024px+):** the full composition with the most generous
  spacing; panels cap out around 560–600px wide so lines of text don't get
  too long to read comfortably.

Other details handled: the input uses a 16px font (prevents iOS Safari from
auto-zooming when focused), buttons/inputs meet the ~48px touch-target
minimum, safe-area insets are respected on notched phones, and the 3D
canvas re-frames itself when the on-screen keyboard opens/closes or the
device is rotated.

## Customizing

- **Colors/fonts:** edit the CSS variables at the top of `styles.css`.
- **Ada's greeting/messages:** edit the strings inside `script.js` in the
  `greet()` function and the form submit handler.
- **Course name shown to students:** edit `course` in `students.json`.
