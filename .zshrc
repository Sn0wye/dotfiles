# Aliases
alias c="code"
alias zshconfig="code ~/.zshrc"
alias reload="source ~/.zshrc"
alias lines="git ls-files | xargs wc -l"
alias cat="bat"
alias cls="clear && (tmux info >/dev/null 2>&1 && tmux clear-history || true)"
alias ssh-oracle="command ssh ubuntu@164.152.43.166 -i ~/.ssh/oracle.key"

# Functions

killport() {
    if [ -z "$1" ]; then
        echo "Usage: killport <port>"
    else
        sudo lsof -t -i tcp:"$1" | xargs kill -9
    fi
}

get_secret() {
  aws secretsmanager get-secret-value \
    --secret-id "$1" \
    --query SecretString \
    --output text | jq -r .
}

# Oh My Zsh settings
autoload -Uz compinit
compinit -i
source $ZSH/oh-my-zsh.sh

# Shell integrations
eval "$(starship init zsh)"
source <(fzf --zsh)
# Only initialize zoxide if we're in an interactive shell
if [[ $- == *i* ]]; then
    eval "$(zoxide init --cmd cd zsh)"
fi

. "$HOME/.atuin/bin/env"

eval "$(atuin init zsh)"

# Rider
export PATH="/Applications/Rider.app/Contents/MacOS:$PATH"

export JAVA_HOME=$(/usr/libexec/java_home -v 21)

# node via n (prefix /usr/local), packages via bun
# bun completions
[ -s "/Users/snowye/.bun/_bun" ] && source "/Users/snowye/.bun/_bun"

# claude code
export PATH="$HOME/.local/bin:$PATH"

# opencode
export PATH=/Users/snowye/.opencode/bin:$PATH

# pi
export PATH="/Users/snowye/.bun/bin:$PATH"

# Machine-local secrets and overrides (not in git)
[ -f "$HOME/.zshrc.local" ] && source "$HOME/.zshrc.local"