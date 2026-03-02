#!/bin/bash
cd "$(dirname "$0")"
echo "Устанавливаем зависимости (первый раз может занять минуту)..."
npm install
echo ""
echo "Открываю приложение в браузере..."
npx expo start --web
