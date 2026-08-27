# Interactive shell. PATH lives in ~/.zprofile; load it here for non-login
# terminals (Cursor, VS Code) that skip .zprofile.
if [[ -z "${ZSH_PROFILE_LOADED:-}" ]]; then
  source "$HOME/.zprofile"
fi

# Aliases
alias c="code"
alias zshconfig="code ~/.zshrc"
alias reload="source ~/.zprofile && source ~/.zshrc"
alias lines="git ls-files | xargs wc -l"
alias cat="bat"
alias cls="clear && (tmux info >/dev/null 2>&1 && tmux clear-history || true)"
alias ssh-oracle="command ssh ubuntu@164.152.43.166 -i ~/.ssh/oracle.key"

# Functions
killport() {
  if [[ -z "$1" ]]; then
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

export ZSH="$HOME/.oh-my-zsh"
source "$ZSH/oh-my-zsh.sh"

eval "$(starship init zsh)"
source <(fzf --zsh)
eval "$(zoxide init --cmd cd zsh)"
eval "$(atuin init zsh)"

[[ -s "$HOME/.bun/_bun" ]] && source "$HOME/.bun/_bun"

[[ -f "$HOME/.zshrc.local" ]] && source "$HOME/.zshrc.local"
