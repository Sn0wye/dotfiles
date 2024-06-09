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
