# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Go environment
export GOPATH="$HOME/go"
export PATH="$GOPATH/bin:$PATH"

# Docker path
export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin/docker"

# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# BAT settings
export BAT_THEME="Dracula"

# Editor configuration
export EDITOR='code'

# dotnet
export DOTNET_ROOT=$HOME/dotnet
export PATH=$PATH:$HOME/dotnet
. "$HOME/.cargo/env"

# node-kafka SSL
export CPPFLAGS=-I$(brew --prefix openssl)/include
export LDFLAGS=-L$(brew --prefix openssl)/lib

# pnpm
export PNPM_HOME="/Users/snowye/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# GPG
# export GPG_TTY=$(tty)