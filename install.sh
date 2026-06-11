#!/bin/bash
# Open Skills — Plugin Installer
# Usage:
#   bash install.sh --target claude-code          # Install all plugins
#   bash install.sh --plugin trading-agents --target codex  # Install specific plugin
#   bash install.sh --target both                 # Install to both platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGINS_DIR="$SCRIPT_DIR/plugins"

# Defaults
TARGET=""
PLUGIN=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --plugin)
      PLUGIN="$2"
      shift 2
      ;;
    -h|--help)
      echo "Usage: bash install.sh [--plugin NAME] [--target claude-code|codex|both]"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [ -z "$TARGET" ]; then
  echo "Error: --target is required (claude-code, codex, or both)"
  exit 1
fi

install_claude_code() {
  local plugin_name=$1
  local plugin_dir="$PLUGINS_DIR/$plugin_name"
  local target_dir="$HOME/.claude/plugins/$plugin_name"

  if [ -d "$target_dir" ]; then
    echo "  ⚠️  Already exists: $target_dir (skipping)"
    return
  fi

  ln -s "$plugin_dir" "$target_dir"
  echo "  ✅ Installed to Claude Code: $target_dir"
}

install_codex() {
  local plugin_name=$1
  local plugin_dir="$PLUGINS_DIR/$plugin_name"
  local target_dir="$HOME/.codex/skills/$plugin_name"

  if [ -d "$target_dir" ]; then
    echo "  ⚠️  Already exists: $target_dir (skipping)"
    return
  fi

  ln -s "$plugin_dir" "$target_dir"
  echo "  ✅ Installed to Codex: $target_dir"
}

install_plugin() {
  local plugin_name=$1
  echo ""
  echo "📦 Installing: $plugin_name"

  case $TARGET in
    claude-code)
      install_claude_code "$plugin_name"
      ;;
    codex)
      install_codex "$plugin_name"
      ;;
    both)
      install_claude_code "$plugin_name"
      install_codex "$plugin_name"
      ;;
  esac
}

# Main
echo "🔧 Open Skills Installer"
echo "========================"
echo "Target: $TARGET"

if [ -n "$PLUGIN" ]; then
  # Install specific plugin
  if [ ! -d "$PLUGINS_DIR/$PLUGIN" ]; then
    echo "❌ Plugin not found: $PLUGIN"
    exit 1
  fi
  install_plugin "$PLUGIN"
else
  # Install all plugins
  for plugin_dir in "$PLUGINS_DIR"/*/; do
    plugin_name=$(basename "$plugin_dir")
    if [ "$plugin_name" = "_template" ]; then
      continue
    fi
    install_plugin "$plugin_name"
  done
fi

echo ""
echo "✅ Done!"
