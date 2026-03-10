---
name: github-issues
description: Retrieve open GitHub issues from the last 30 days for this project
allowed-tools: Bash(gh issue list *), Bash(gh issue view *), Bash(git remote get-url origin)
---

Fetch and display open GitHub issues from the last 30 days for this repository.

## Steps

1. Get the repo name from the git remote: `git remote get-url origin`
2. Run: `gh issue list --repo <owner/repo> --state open --limit 50 --json number,title,author,createdAt,labels,url --jq '.[] | select(.createdAt >= (now - 2592000 | strftime("%Y-%m-%dT%H:%M:%SZ")))'`
3. Present the issues in a clear, readable format with issue number, title, author, date, and labels
4. If there are no issues, let the user know
5. Ask the user if they'd like to see details on any specific issue
