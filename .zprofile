# Login shell environment (PATH and toolchains).
# Non-login interactive shells (Cursor, VS Code) source this from ~/.zshrc.
if [[ -n "${ZSH_PROFILE_LOADED:-}" ]]; then
  return
fi
export ZSH_PROFILE_LOADED=1

eval "$(/opt/homebrew/bin/brew shellenv)"

source "$HOME/.orbstack/shell/init.zsh" 2>/dev/null || :

export DOTNET_ROOT="$HOME/dotnet"
export PATH="$PATH:$HOME/dotnet:$HOME/.dotnet/tools"

if [[ -f "$HOME/.cargo/env" ]]; then
  . "$HOME/.cargo/env"
fi

export GOPATH="$HOME/go"
export PATH="$PATH:/usr/local/go/bin:$GOPATH/bin"

export CPPFLAGS="-I$(brew --prefix openssl)/include"
export LDFLAGS="-L$(brew --prefix openssl)/lib"

export JAVA_HOME="$(/usr/libexec/java_home -v 21)"

export PATH="/Applications/Rider.app/Contents/MacOS:$PATH"
export PATH="$HOME/.local/bin:$PATH"
export PATH="$HOME/.opencode/bin:$PATH"
export PATH="$HOME/.bun/bin:$PATH"
export PATH="$HOME/.atuin/bin:$PATH"
