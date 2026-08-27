# Path to your oh-my-zsh installation.
export ZSH="$HOME/.oh-my-zsh"

# Docker path
export PATH="/Applications/OrbStack.app/Contents/MacOS/xbin/docker:$PATH"

# Homebrew (Ensure this is only in `.zshenv` if Homebrew is essential for all sessions)
eval "$(/opt/homebrew/bin/brew shellenv)"

# BAT settings
export BAT_THEME="Dracula"

# Editor configuration
export EDITOR='code'

# .NET environment
export DOTNET_ROOT=$HOME/dotnet
export PATH=$PATH:$HOME/dotnet

# Cargo (Ensure `$HOME/.cargo/env` exists before sourcing)
if [ -f "$HOME/.cargo/env" ]; then
  . "$HOME/.cargo/env"
fi

# node-kafka SSL settings (Only set if needed for builds)
export CPPFLAGS="-I$(brew --prefix openssl)/include"
export LDFLAGS="-L$(brew --prefix openssl)/lib"

# Go environment
export PATH=$PATH:/usr/local/go/bin
export GOPATH="$HOME/go"
export PATH=$PATH:$GOPATH/bin

# GPG (Uncomment if actively using GPG)
# export GPG_TTY=$(tty)
