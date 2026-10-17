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

### 3. Docker

**What this is.** Docker is a program that runs other programs in sealed
boxes called containers, so they behave the same on every machine; Hatch is
delivered as containers. Docker Desktop is the app that provides Docker on
macOS and Windows, and Docker Engine is the background service that provides
it on Linux. Compose is the part of Docker that starts several containers
together, and Hatch needs it.

**Tell the person.** "Next I am going to make sure Docker is installed and
running. It is how Hatch will run on this machine. If it is not there yet,
this is a large download and takes about 5 to 15 minutes. There will be one
or two things only you can do: agree to Docker's terms, type your computer
password or approve an administrator prompt, and maybe restart the
computer. I will tell you exactly when."

**Do it.** First run the check below. If both commands pass, Docker is
installed and running: say so and go on to the next step.

```
docker version
docker compose version
```

Otherwise install it for this machine. On macOS and Windows, tell the person
what **The licence** paragraph below says before they install Docker Desktop.

macOS. This installs Docker Desktop. If `brew --version` works, use
Homebrew; do not install Homebrew just for this:

```
brew install --cask docker-desktop
```

If Homebrew is not installed, the person downloads the installer
themselves: they open the Docker Desktop page for Mac below, pick the
**Apple silicon** or **Intel** download to match what step 1 found, open the
`Docker.dmg` it saves and drag Docker into the Applications folder. Docker
Desktop needs at least 4 GB of memory and one of the three newest macOS
releases; the Homebrew cask itself requires macOS 14 or later. Then start it:

```
open -a Docker
```

> **Hand this to the person.** "Docker's own window just opened. Read its
> terms, click **Accept** to agree, and let it finish starting. If it asks
> for your Mac password so it can set itself up, type it there, in its
> window; I cannot and will not. Tell me when the window says Docker is
> running."

Windows PowerShell. This installs Docker Desktop. The `winget` route below
is the package manager's own and is not on Docker's page, which documents
only the installer download (**Docker Desktop Installer.exe**, from the
Docker Desktop page for Windows below). If `winget` fails, hand that
download to the person instead.

Docker Desktop on Windows needs WSL 2 (the Windows Subsystem for Linux, the
part of Windows that runs the Linux programs Docker is built on) at version 2.1.5 or
later, a 64-bit processor with second-level address translation, 8 GB of
memory, Windows 10 22H2 (build 19045) or newer or Windows 11 23H2 (build
22631) or newer, and hardware virtualization switched on. Check the ones
that can be checked first:

```
wsl --version
systeminfo
```

In the `systeminfo` output, the line "A hypervisor has been detected" means
virtualization is on. (In Task Manager, the **Performance** tab, **CPU**,
says "Virtualization: Enabled" when it is.) Then install:

```
winget install -e --id Docker.DockerDesktop
```

If `wsl --version` is not found, WSL is missing. Installing it needs an
administrator.

> **Hand this to the person.** "Please open the Start menu, type
> **PowerShell**, right-click **Windows PowerShell** and choose **Run as
> administrator**. Paste this line, press Enter, and tell me when it
> finishes. Then restart the computer, open Claude Code again, and tell me
> you are back."
>
> ```
> wsl --install
> ```

If `wsl --version` works but reports a version older than 2.1.5, the person
updates it the same way, with `wsl --update` in an administrator PowerShell.

If virtualization is off, it is a setting in the computer's firmware screen
(the BIOS or UEFI, reached while the computer starts up). The key that opens
that screen differs by maker, so do not guess one: tell the person the
maker's name and have them look up "enable virtualization" on that maker's
support page.

> **Hand this to the person.** "Virtualization is switched off on this
> computer. It is a setting in the firmware screen you reach while the
> computer starts up, and the key to press differs by maker, so please
> search for your computer maker's support page on enabling virtualization.
> Turn it on, start Windows again, and tell me when you are back."

The Docker Desktop installer asks whether to install for just the person or
for all users. For just the person needs no administrator prompt. If winget,
or the installer, shows a prompt, a licence agreement or an administrator
question, hand it to the person to answer and wait. When it finishes the new
program is not on this terminal's search path yet, so tell the person to
open a new terminal window, or restart Claude Code in one, and carry on from
there. Then start Docker Desktop from the Start menu.

> **Hand this to the person.** "Please open **Docker Desktop** from the Start
> menu, read its terms and click **Accept**, and let it finish starting. Tell
> me when the window says Docker is running."

Linux. This installs Docker Engine, the service, not Docker Desktop. Find out
which distribution this is:

```
. /etc/os-release && echo "$ID"
```

If it prints `debian` or `ubuntu`, use the matching block below. If it prints
`fedora`, use the Fedora block. If it prints anything else, including a
derivative such as Kali or Mint where the release name is not Docker's, stop
and ask the person: Docker publishes steps for other distributions at
[docs.docker.com/engine/install](https://docs.docker.com/engine/install/),
and this guide does not cover them.

Everything below needs `sudo`, so do not run any of it yourself. Hand each
block over whole, as one paste.

On Ubuntu:

> **Hand this to the person.** "Please open your own terminal window, paste
> all of this at once, type your password when it asks (nothing shows as you
> type, that is normal), and tell me when it finishes. It adds Docker's
> package source and installs Docker."
>
> ```
> sudo apt update
> sudo apt install ca-certificates curl
> sudo install -m 0755 -d /etc/apt/keyrings
> sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
> sudo chmod a+r /etc/apt/keyrings/docker.asc
> sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
> Types: deb
> URIs: https://download.docker.com/linux/ubuntu
> Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
> Components: stable
> Architectures: $(dpkg --print-architecture)
> Signed-By: /etc/apt/keyrings/docker.asc
> EOF
> sudo apt update
> sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> ```

On Debian, the same block with two differences, the `debian` address and the
plain `$VERSION_CODENAME`:

> **Hand this to the person.** "Please open your own terminal window, paste
> all of this at once, type your password when it asks (nothing shows as you
> type, that is normal), and tell me when it finishes. It adds Docker's
> package source and installs Docker."
>
> ```
> sudo apt update
> sudo apt install ca-certificates curl
> sudo install -m 0755 -d /etc/apt/keyrings
> sudo curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
> sudo chmod a+r /etc/apt/keyrings/docker.asc
> sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
> Types: deb
> URIs: https://download.docker.com/linux/debian
> Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
> Components: stable
> Architectures: $(dpkg --print-architecture)
> Signed-By: /etc/apt/keyrings/docker.asc
> EOF
> sudo apt update
> sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> ```

On Fedora (Debian and Ubuntu start the service by themselves when it is
installed, Fedora does not, which is the last line here):

> **Hand this to the person.** "Please paste all of this into your own
> terminal window, type your password when it asks, and tell me when it
> finishes. It adds Docker's package source, installs Docker and starts it."
>
> ```
> sudo dnf config-manager addrepo --from-repofile https://download.docker.com/linux/fedora/docker-ce.repo
> sudo dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
> sudo systemctl enable --now docker
> ```

Last, the person has to be allowed to use Docker without `sudo`. Adding an
account to the `docker` group gives it administrator-equivalent power on this
machine, because anything that can talk to Docker can ask it to act as root.
That is the person's decision, so tell them in one sentence and do not decide
for them. If they decline, stop and say that the rest of this guide needs
Docker to work without `sudo`.

> **Hand this to the person.** "Docker needs your account to be in a group
> called `docker`. That group gives your account administrator-equivalent
> power on this machine. If you are fine with that, paste this line, type
> your password, then log out of the computer and back in, and tell me when
> you are back."
>
> ```
> sudo usermod -aG docker $USER
> ```

A session that was already open does not see the new group. After they are
back, run the check from a fresh login, in a new terminal. The person can
also run `newgrp docker` in the terminal the session lives in. If the check
still says `permission denied`, say so and stop; do not reach for
`sudo docker` yourself.

**Check.** Run these two commands:

```
docker version
docker compose version
```

`docker version` prints a **Client** section and a **Server** section.
`docker compose version` prints a line such as `Docker Compose version
v2.40.0`; the exact number does not matter. Tell the person Docker is
installed and running.

If `docker version` shows a Client but says `Cannot connect to the Docker
daemon`, or there is no Server section, the engine is not running. On macOS
and Windows, start Docker Desktop and wait for it to say it is running, which
takes a minute or two. On Linux, hand the person this:

> **Hand this to the person.** "Please run this in your own terminal window,
> type your password, and tell me when it finishes: `sudo systemctl start
> docker`"

**The licence.** Docker Desktop is free for personal use, education,
non-commercial open source projects and small businesses (fewer than 250
employees and under $10 million in annual revenue), and needs a paid
subscription otherwise. Whether that covers the person is theirs to decide,
not yours; say it in a sentence, point them at
[Docker's licence terms](https://docs.docker.com/subscription/desktop-license/)
and wait for them to go ahead. Docker Engine on Linux has no such licence.

**If you see** `docker: command not found` straight after installing Docker
Desktop, the terminal has not picked up the new program: open a new terminal
window. On macOS also check that `/Applications/Docker.app` exists; if it
does not, the install did not finish.

**If you see** Docker Desktop installed but `docker version` shows no Server
section, Docker Desktop is not running, has not been opened since it was
installed, or its terms have not been accepted. Open it, hand the person the
terms window, and wait for it to say it is running.

**If you see** on Windows an error from `docker version` that mentions WSL
and an update or a version, WSL is out of date: hand the person `wsl
--update` to run in an administrator PowerShell, then have them restart
Docker Desktop.

**If you see** `permission denied while trying to connect to the Docker
daemon socket` on Linux, the `docker` group step has not applied to this
login. Have the person log out and in again, then check again from a new
terminal.

**If you see** that Docker Desktop's installer is blocked, or asks for
approval you cannot give, on a machine managed by a school or an employer,
that is an administrator's decision. Stop and say so.

Reference: Docker Desktop for
[Mac](https://docs.docker.com/desktop/setup/install/mac-install/) and
[Windows](https://docs.docker.com/desktop/setup/install/windows-install/);
Docker Engine on
[Ubuntu](https://docs.docker.com/engine/install/ubuntu/),
[Debian](https://docs.docker.com/engine/install/debian/) and
[Fedora](https://docs.docker.com/engine/install/fedora/), and its
[after-install steps](https://docs.docker.com/engine/install/linux-postinstall/);
[Compose on Linux](https://docs.docker.com/compose/install/linux/);
[Docker Desktop troubleshooting](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/);
[WSL](https://learn.microsoft.com/windows/wsl/install);
[Homebrew's Docker cask](https://formulae.brew.sh/cask/docker-desktop).
