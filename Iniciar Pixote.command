#!/bin/zsh
set -e
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  print 'Instale Node.js 22.12 ou superior antes de iniciar.'
  read 'reply?Pressione Enter para fechar.'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
print 'Abra http://localhost:5173 e clique em Explorar demonstração (Pixote CRM).'
print 'Para encerrar, pressione Control+C nesta janela.'
npm run dev
