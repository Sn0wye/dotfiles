# Dotfiles

This repository contains my personal dotfiles, managed using GNU Stow.

## Installation

Make sure GNU Stow is installed on your system. If not, you can install it using your package manager:

```sh
# For Debian/Ubuntu
sudo apt-get install stow

# For macOS
brew install stow
```

## Usage

To set up the dotfiles, clone this repository and run the following commands:

```sh
git clone https://github.com/Sn0wye/dotfiles
cd dotfiles
stow --adopt .
```

## Wallpaper

`Pictures/wallpaper.jpeg` is stowed to `~/Pictures/wallpaper.jpeg`. Then:

```sh
scripts/wallpaper.sh
```

That only tells System Events to use the stowed file. `scripts/` stays out of `$HOME` via `.stow-local-ignore`.

## Aerial screensaver

The Geist clip is a GitHub release asset, not git. Aerials still wants Apple's UUID as the filename, so the script downloads `aerial-screensaver.mov` and installs it as that UUID.

```sh
scripts/aerial.sh
```

Pick Screen Saver → Aerials → Los Angeles once per Mac. Do not delete `~/Library/Application Support/com.apple.wallpaper/aerials`.

## IntelliJ IDEA

Ultimate 2026.2 settings are stowed from `Library/Application Support/JetBrains/IntelliJIdea2026.2/`. Editor options, the VS Code OSX keymap, Catppuccin/Dracula schemes, code style, and `idea.vmoptions` (`-Xmx4096m`). Plugins are listed in `plugins.txt`, not checked in.

Close IntelliJ before `stow --adopt .`. After a major upgrade the directory name changes; copy or restow into the new folder.

Restore plugins from a terminal with IntelliJ quit:

```sh
xargs "/Applications/IntelliJ IDEA.app/Contents/MacOS/idea" installPlugins < "Library/Application Support/JetBrains/IntelliJIdea2026.2/plugins.txt"
```
