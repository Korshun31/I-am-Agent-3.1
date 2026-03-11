#!/bin/bash
cd "$(dirname "$0")"

echo "=== Запуск через встроенный туннель Expo (ngrok) ==="
echo ""
echo "Если ngrok заблокирован, нужен EXPO_TOKEN:"
echo "  1. Зарегистрируйтесь на https://expo.dev (бесплатно)"
echo "  2. Account Settings → Access Tokens → Create token"
echo "  3. Выполните: export EXPO_TOKEN=ваш_токен"
echo ""
echo "Устанавливаем зависимости..."
npm install
echo ""
echo "Запускаю Expo с туннелем..."
echo "Подождите появления QR-кода (20-40 сек)..."
echo ""
npx expo start --tunnel --port 8082
