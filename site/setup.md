---
title: Set up Hatch with an agent
lede: A guide a coding agent on your own machine follows to install what Hatch needs, one plain-language step at a time.
permalink: /setup/
---

This page is written for Claude to read, not for you. You do not have to
follow it yourself. Open Claude Code on the machine you want Hatch on, paste
the line below into it, and put the address of this page in place of the
angle brackets:

```
Set me up with Hatch: <the address of this page>
```

Claude will read the rest of this page and then walk you through it, one step
at a time, doing the typing and asking you only for the few things that have
to be done by a person. If you would rather do the steps yourself, the
[Quick start](index.md) is the same path written for you.

## For the agent reading this

You are setting up Hatch, a self-hosted kanban board worked by AI agents, on
the machine you are running on. Read this whole section before step 1.

### Who you are talking to

- **The person is new to this and is not a developer.** They want to be
  walked through, not lectured. Go one step at a time.
- **Before each step, say what is about to happen, why, and roughly how long
  it takes.** After it, say what it meant in a sentence.
- **Explain any term the first time you use it, in one sentence**: terminal,
  Docker, repository, port, and so on. Do not assume they know any of them.
- **Never paste a wall of command output at them.** Say what it meant and
  quote only the line that matters.

### Read this page whole

If this page reached you through a fetch tool that summarises what it
fetches, a summary drops the commands, and the commands are the point. Fetch
it again verbatim before step 1, with the address the person gave you:

```
curl -fsSL <the address of this page>
```

On Windows PowerShell:

```
Invoke-WebRequest -UseBasicParsing <the address of this page> | Select-Object -ExpandProperty Content
```

or `irm <the address of this page>` in PowerShell 7. The `-UseBasicParsing`
flag is what Windows PowerShell 5.1 needs.

### If you cannot run commands here

If you are in a chat with no way to run commands on the person's machine
(claude.ai in a browser, for instance), say so plainly. Do not pretend to
install anything and do not turn the steps into a list for them to type.
Tell them to open Claude Code on the machine they want Hatch on and paste
the same line there.

### The rules

- **Check before you install anything.** Run the check a step names first;
  if it already passes, say so and move on.
- **Use the machine's own package manager**: Homebrew on macOS, winget on
  Windows, apt or dnf on Linux.
- **Never type a password.** Anything that needs `sudo`, an administrator
  prompt, a restart or a sign-in is handed to the person as one exact line
  or click to do themselves, in their own terminal window or browser. Wait
  for them to say it is done, then check it yourself.
- **Never put a credential into a file, a command or a message.** That covers
  passwords, tokens and keys, theirs and anyone else's.
- **Check every step with the check this page names before you move on.** A
  command that exited without an error has not passed a check.
- **When a step fails, stop.** Say which step, what you saw and what you
  suggest trying. Do not improvise past it.

### Where this page ends

At the board open in the person's browser. The sign-ins and the runner come
after that and are added to this guide once they are written. If the steps
below stop before the board is open, the guide is not finished yet: do the
steps that are there, then tell the person plainly that the rest is not
published yet, and stop.

### Which shell you are in

Claude Code on native Windows uses Git Bash when Git for Windows is
installed and PowerShell otherwise ([Claude Code setup](https://code.claude.com/docs/en/setup)).
So every Windows block below is written for PowerShell, and the few that
differ in Git Bash say so.

If your session is inside WSL (the Linux that runs within Windows), tell the
person to close it and start Claude Code from PowerShell instead. Docker
Desktop and the folder Hatch is cloned into are on the Windows side, and a
session in WSL cannot reach them cleanly.

## The steps

### 1. Work out the machine

**What this is.** Hatch needs to know which operating system (the software
that runs the whole computer, such as macOS, Windows or Linux) and which
kind of processor (the chip, which comes in an Arm kind and an Intel or AMD
kind) the person has, because some downloads come in one build per kind.

**Tell the person.** "First I am going to look at what kind of computer this
is, so I pick the right downloads later. It is one command and takes a
second."

**Do it.**

macOS:

```
sw_vers -productVersion; uname -m
```

Windows PowerShell:

```
[System.Environment]::OSVersion.Version; $env:PROCESSOR_ARCHITECTURE
```

Linux:

```
. /etc/os-release && echo "$PRETTY_NAME"; uname -m
```

**Check.** The command prints a version and an architecture. On macOS the
architecture is `arm64` (Apple silicon) or `x86_64` (Intel). On Windows it
is `AMD64` or `ARM64`. On Linux it is `x86_64` or `aarch64`. Tell the person
what you found in a sentence, such as "This is macOS 15 on an Apple silicon
chip."

Say two things now, so they are not a surprise later:

- The board runs on either kind of chip.
- The runner, the program that does the agent's work, is published for
  Windows on x64, macOS on Apple silicon and Intel, and Linux on x64. There
  is no build for Linux on Arm or for Windows on Arm. If the machine is one
  of those, say so now and stop, because the guide cannot finish on it.

**If you see** a version or architecture you do not recognise, or a command
that is not found, stop and say what you saw.

### 2. Git

**What this is.** Git is the program that keeps a history of a project's
files, and a repository is a folder it keeps that history for. Hatch is
downloaded as a repository, so git has to be installed to get it.

**Tell the person.** "Next I am going to make sure git is installed. It is a
small tool and the install takes about a minute, if it is not there already.
It is how I will download Hatch itself."

**Do it.** First run the check below. If it prints a version, git is
installed: say so and go on to the next step.

```
git --version
```

If it is not found, install it.

macOS. If `brew --version` works, use Homebrew:

```
brew install git
```

If Homebrew is not installed, do not install it just for git. Use the Xcode
Command Line Tools, which include git:

```
xcode-select --install
```

That opens a window on the person's screen with an **Install** button.

> **Hand this to the person.** "A window just opened asking to install the
> command line developer tools. Click **Install**, agree to the terms, and
> wait for it to finish. It can take several minutes. Tell me when it says
> it is done."

Wait for them, then run the check again.

Homebrew is only worth installing when a later step needs it. It is
installed by a line that asks for the person's password, which you must never
type.

> **Hand this to the person.** "Open the Terminal app, paste this one line,
> press Return, and type your Mac password when it asks (nothing shows as you
> type, that is normal). Tell me when it finishes."
>
> ```
> /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
> ```

Wait for them, then check `brew --version`. On Apple silicon the installer
ends with a "Next steps" section containing a line that starts
`eval "$(/opt/homebrew/bin/brew shellenv)"`. The person has to run that line
in their Terminal, or open a new Terminal window, before `brew` is found.

Windows PowerShell:

```
winget install --id Git.Git -e --source winget
```

When it finishes, the new program is not yet on this terminal's search path.
Tell the person to open a new terminal window, or restart Claude Code in
one, and carry on from there. If winget asks to accept an agreement, or
Windows shows an administrator prompt, hand that to the person to click and
wait.

Linux. On Debian and Ubuntu:

```
sudo apt-get install git
```

On Fedora and Red Hat:

```
sudo dnf install git
```

Both need `sudo`, so do not run them yourself.

> **Hand this to the person.** "Please run this line in your own terminal
> window, type your password when it asks, and tell me when it finishes:
> `sudo apt-get install git`" (or the `dnf` line, whichever matches the
> machine).

**Check.** `git --version` prints a line such as `git version 2.47.0`. The
exact number does not matter. Tell the person git is installed.

**If you see** `command not found` or `'git' is not recognized` right after
an install, the terminal has not picked up the new program: on Windows open
a new terminal; on macOS after Homebrew, run the `shellenv` line above. If it
still fails, stop and say what you saw.

Reference: [git-scm.com for macOS](https://git-scm.com/install/mac),
[Windows](https://git-scm.com/install/windows) and
[Linux](https://git-scm.com/install/linux); [Homebrew](https://brew.sh).
