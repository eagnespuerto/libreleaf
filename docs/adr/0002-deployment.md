# ADR 0002: Where LibreLeaf runs

*Status: **proposed** (2026-11-18). To be settled at the week-3 decision gate in
[ROADMAP.md](../ROADMAP.md). Prices are from third-party summaries checked on
2026-11-18; check Render's own pricing page before paying for anything.*

## The question

Where does the editor run, and above all, where does LaTeX get compiled to PDF?

## Options

| | A. Render | B. Desktop first | C. All in the browser |
|---|---|---|---|
| **Compiles on** | Our server (Docker, full TeX Live) | The user's computer (Tectonic, a Rust TeX engine) | The user's browser (a WASM TeX engine) |
| **Cost to us** | Free tier sleeps after 15 min idle and takes about a minute to wake. Paid: Starter $7/month (512 MB, 0.5 CPU), Standard $25/month (2 GB, 1 CPU). Postgres from about $6–7/month. Bandwidth over the limit $0.15/GB. | Nothing. GitHub Releases hosts the installers. | Nothing. GitHub Pages hosts it. |
| **Works offline** | No | Yes | After the first load |
| **Packages** | All of TeX Live | Downloaded on first use and cached | BusyTeX is TeX Live 2026, but about 175 MB of WASM. SwiftLaTeX is stuck at TeX Live 2020. |
| **Security work** | A lot: a sandbox with no network, no `\write18`, CPU, memory and time limits | Little: it is the user's own machine | Little: the browser sandbox |
| **Raspberry Pi** | Any browser | Yes: 64-bit `.deb` (Pi 4, Pi 5, Pi 400) | Too heavy for most Pis |
| **Hard part** | Paying for and running a sandboxed compile service | Installers, code signing, three builds | Very large download, slower, experimental |

## What already happened this week

The user asked for desktop releases for Windows, Linux and Raspberry Pi OS,
and for Rust where it helps speed and size. So we added the Tauri 2 shell
(`apps/web/src-tauri`) and a release workflow
(`.github/workflows/release.yml`) that builds:

- Windows x64: `.exe` (NSIS) and `.msi`
- Linux x64: `.deb`, `.AppImage` and `.rpm`
- Raspberry Pi OS 64-bit: `.deb` for arm64, built on GitHub's arm64 runners

Tauri uses a Rust core and the system's own web view (WebView2 on Windows,
WebKitGTK on Linux), so the app is a few MB, not the ~100 MB of an
Electron app. The release build is tuned for size (`opt-level = "s"`, LTO,
one codegen unit, `panic = "abort"`, stripped), which matters most on a Pi.

## Recommendation

**B now, with A later (the "A + B" row in the roadmap).**

1. v0.3.0 compiles on the desktop with Tectonic. It is written in Rust, so it
   links straight into the Tauri app and builds for arm64 too. This matches
   DESIGN §4 Release 1 and costs nothing to run.
2. GitHub Pages keeps the landing page, the word counter and the browser draft
   of the editor (no compile).
3. A hosted compile on Render comes with Release 2, once there are users who
   need it. Start on the free tier for a staging URL, and move the compile
   worker to Starter or Standard only when it has to stay awake.
4. Keep C under watch. If BusyTeX gets much smaller, it could give the
   browser version an offline compile without a server.

## Open questions for the gate

- Tectonic downloads packages on first use. Do we ship a starter bundle so the
  first compile works offline?
- Code signing: an Authenticode certificate for Windows costs money every
  year. Until then, the release notes explain the SmartScreen warning.
- The Pi build needs `libwebkit2gtk-4.1`, which is in Raspberry Pi OS
  Bookworm and later, but not in the older Bullseye.
