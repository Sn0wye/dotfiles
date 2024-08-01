# Aliases
alias c="code"
alias pa="php artisan"
alias htdocs="cd /Applications/MAMP/htdocs"
alias zshconfig="code ~/.zshrc"
alias reload="source ~/.zshrc"
alias lines="git ls-files | xargs wc -l"
alias docker="/Applications/Docker.app/Contents/Resources/bin/docker"
alias cat="bat"
alias p="pnpm"
alias g="git"
alias cls="clear"
alias hosts="sudo code /etc/hosts /Applications/MAMP/conf/apache/extra/httpd-vhosts.conf"
alias ssh-oracle="command ssh ubuntu@164.152.43.166 -i ~/.ssh/oracle.key"
alias ssh-mi="command ssh ubuntu@ec2-54-80-122-187.compute-1.amazonaws.com -i ~/.ssh/MundoInvestDev.pem"
alias bun-tsconfig="generate_bun_tsconfig; true"

# Functions
generate_bun_tsconfig() {
    if [ -f "tsconfig.json" ]; then
        echo "❌ Failed: tsconfig.json already exists"
    else
        echo "{
  \"compilerOptions\": {
    // Enable latest features
    \"lib\": [\"ESNext\", \"DOM\"],
    \"target\": \"ESNext\",
    \"module\": \"ESNext\",
    \"moduleDetection\": \"force\",
    \"jsx\": \"react-jsx\",
    \"allowJs\": true,

    // Bundler mode
    \"moduleResolution\": \"bundler\",
    \"allowImportingTsExtensions\": true,
    \"verbatimModuleSyntax\": true,
    \"noEmit\": true,

    // Best practices
    \"strict\": true,
    \"skipLibCheck\": true,
    \"noFallthroughCasesInSwitch\": true,

    // Some stricter flags
    \"noUnusedLocals\": true,
    \"noUnusedParameters\": true,
    \"noPropertyAccessFromIndexSignature\": true
  }
}" > tsconfig.json
        echo "✅ Success: tsconfig.json created"
    fi
}

killport() {
    if [ -z "$1" ]; then
        echo "Usage: killport <port>"
    else
        sudo lsof -t -i tcp:"$1" | xargs kill -9
    fi
}

# Oh My Zsh settings
autoload -Uz compinit
compinit -i
source $ZSH/oh-my-zsh.sh

# Shell integrations
eval "$(starship init zsh)"
source <(fzf --zsh)
eval "$(zoxide init --cmd cd zsh)"


# sst
export PATH=/Users/snowye/.sst/bin:$PATH
