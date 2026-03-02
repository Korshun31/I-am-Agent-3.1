#!/bin/bash
cd "$(dirname "$0")"
echo "Устанавливаем зависимости (если ещё не установлены)..."
npm install
echo ""
echo "Запускаю сервер для телефона..."
echo "Отсканируйте QR-код камерой iPhone или в приложении Expo Go на Android."
echo ""
npx expo start --port 8082
