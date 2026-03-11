#!/bin/bash
cd "$(dirname "$0")"

# Проверка cloudflared
if ! command -v cloudflared &>/dev/null; then
    echo "❌ cloudflared не установлен."
    echo ""
    echo "Установите его командой:"
    echo "  brew install cloudflared"
    echo ""
    echo "Если brew не установлен: https://brew.sh"
    echo ""
    read -p "Нажмите Enter для выхода..."
    exit 1
fi

echo "Устанавливаем зависимости (если ещё не установлены)..."
npm install
echo ""
echo "Запускаю Metro на порту 443 (совпадает с туннелем)..."
echo "Введите пароль Mac при запросе (символы не отображаются — это нормально):"
EXPO_OFFLINE=1 nohup sudo npx expo start --port 443 --offline > /tmp/expo-tunnel.log 2>&1 &
EXPO_PID=$!
echo "Ждём запуска Metro (25 сек)..."
sleep 25
echo ""
echo "Запускаю Cloudflare Tunnel (подождите 5–10 сек)..."
echo ""

# Запуск cloudflared — туннель на 443, Metro тоже на 443
cloudflared tunnel --url http://localhost:443 2>&1 | while IFS= read -r line; do
    echo "$line"
    if [[ "$line" == *"trycloudflare.com"* ]]; then
        url=$(echo "$line" | grep -oE 'https://[a-zA-Z0-9][-a-zA-Z0-9.]*\.trycloudflare\.com' | head -1)
        if [ -n "$url" ]; then
            exp_url="exp://${url#https://}"
            echo ""
            echo "=========================================="
            echo "В Expo Go: Enter URL manually → $exp_url"
            echo "=========================================="
            echo ""
            npx qrcode-terminal "$exp_url" 2>/dev/null || true
        fi
    fi
done

wait $EXPO_PID 2>/dev/null || true
