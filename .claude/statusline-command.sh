#!/usr/bin/env bash
# Format: Model (effort) | branch | ctx: X% (Yk) | s(Xh): Y% | w(Xh): Y%
#
# s(Xh)/w(Xh): Claude Code's actual rate-limit usage windows, taken directly
# from the statusline JSON payload's `rate_limits.five_hour` /
# `rate_limits.seven_day` fields (used_percentage + resets_at). These are
# only present for Claude.ai subscribers after the first API response of a
# session; if absent, the corresponding segment is omitted (never faked).
input=$(cat)

cwd=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
model=$(echo "$input" | jq -r '.model.display_name // empty')
repo=$(echo "$input" | jq -r '.workspace.repo | if . then .owner + "/" + .name else empty end')
branch=$(echo "$input" | jq -r '.worktree.branch // empty')
# Fall back to reading the branch from git if not supplied in JSON
if [ -z "$branch" ]; then
    _git_dir=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // empty')
    [ -n "$_git_dir" ] && branch=$(git -C "$_git_dir" --no-optional-locks branch --show-current 2>/dev/null || true)
fi
used=$(echo "$input" | jq -r '.context_window.used_percentage // empty')
total_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // empty')
window_size=$(echo "$input" | jq -r '.context_window.context_window_size // empty')
# Recompute the percentage ourselves from total_tokens / window_size instead of
# trusting the pre-calculated used_percentage field: that field has been
# observed to clamp to a stale/default window size (e.g. 200k) even when the
# active model's real context window is larger (e.g. Opus with the 1M-token
# beta enabled), which makes the bar show 100% far too early.
if [ -n "$total_tokens" ] && [ -n "$window_size" ] && [ "$window_size" -gt 0 ] 2>/dev/null; then
    used=$(awk -v t="$total_tokens" -v w="$window_size" 'BEGIN { printf "%.4f", (t / w) * 100 }')
fi
effort=$(echo "$input" | jq -r '.effort.level // empty')
pr_number=$(echo "$input" | jq -r '.pr.number // empty')
pr_state=$(echo "$input" | jq -r '.pr.review_state // empty')

# Session (5h) and weekly (7d) rate-limit usage, straight from the JSON.
session_pct=$(echo "$input" | jq -r '.rate_limits.five_hour.used_percentage // empty')
session_resets=$(echo "$input" | jq -r '.rate_limits.five_hour.resets_at // empty')
week_pct=$(echo "$input" | jq -r '.rate_limits.seven_day.used_percentage // empty')
week_resets=$(echo "$input" | jq -r '.rate_limits.seven_day.resets_at // empty')

now_epoch=$(date +%s)

session_hours=""
if [ -n "$session_resets" ]; then
    session_hours=$(awk -v r="$session_resets" -v n="$now_epoch" 'BEGIN { d=(r-n)/3600; if (d<0) d=0; printf "%.0f", d }')
fi

week_hours=""
if [ -n "$week_resets" ]; then
    week_hours=$(awk -v r="$week_resets" -v n="$now_epoch" 'BEGIN {
        d=(r-n)/3600; if (d<0) d=0;
        h=int(d+0.5);
        days=int(h/24); rem=h%24;
        if (days>0) {
            if (rem>0) printf "%dd%dh", days, rem; else printf "%dd", days
        } else {
            printf "%dh", h
        }
    }')
fi

# Shorten home directory
if [ -n "$cwd" ]; then
    home="$HOME"
    cwd="${cwd/#$home/~}"
fi

parts=()

# cwd (always first)
[ -n "$cwd" ] && parts+=("$cwd")

# Model (effort)
if [ -n "$model" ]; then
    if [ -n "$effort" ]; then
        parts+=("$model ($effort)")
    else
        parts+=("$model")
    fi
fi

# branch
[ -n "$branch" ] && parts+=("$branch")

# ctx: 69% (69k)
if [ -n "$total_tokens" ] && [ -n "$used" ]; then
    used_int=$(printf '%.0f' "$used")
    if [ "$total_tokens" -ge 1000 ]; then
        token_k=$(awk "BEGIN { printf \"%.0fk\", $total_tokens / 1000 }")
    else
        token_k="$total_tokens"
    fi
    parts+=("ctx: ${used_int}% (${token_k})")
fi

# s(Xh): Y% -- session (5-hour) rate-limit usage
if [ -n "$session_pct" ] && [ -n "$session_hours" ]; then
    session_int=$(printf '%.0f' "$session_pct")
    parts+=("s(${session_hours}h): ${session_int}%")
fi

# w(Xh): Y% -- weekly (7-day) rate-limit usage
if [ -n "$week_pct" ] && [ -n "$week_hours" ]; then
    week_int=$(printf '%.0f' "$week_pct")
    parts+=("w(${week_hours}): ${week_int}%")
fi

# Join with separator
line=""
for part in "${parts[@]}"; do
    if [ -z "$line" ]; then
        line="$part"
    else
        line="$line | $part"
    fi
done

printf '%s' "$line"
