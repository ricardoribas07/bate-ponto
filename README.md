# Bate-Ponto Escolar — Site (Frontend + Backend)

Sistema web que recebe os eventos do dispositivo ESP32 (cartão na entrada da sala,
saídas para banheiro/água) e mostra em tempo real quem está presente, atrasado ou
ausente — alunos e professores — com bloqueio automático de professor fora de sala
e alerta de professor ausente.

## Estrutura

```
bate-ponto/
├── backend/     API (Node.js + Express + libSQL/SQLite)
└── frontend/    Site (React + Vite)
```

## Como rodar

### 1. Backend (API)
```bash
cd backend
npm install
npm start          # roda em http://localhost:3001
```
Na primeira execução, o banco `backend/data/bateponto.db` é criado e populado
automaticamente com dados de exemplo (2 salas, 2 professores, 5 alunos, horários
de hoje). Para recomeçar do zero, apague o arquivo `.db` e reinicie.

### 2. Frontend (site)
```bash
cd frontend
npm install
npm run dev         # roda em http://localhost:5173
```

Login de demonstração:
- Coordenação: `coordenacao` / `admin123`
- Professora Maria (Sala 101 - Matemática): `maria` / `123456`
- Professor João (Sala 102 - História): `joao` / `123456`

> Os horários de exemplo estão cadastrados para hoje, 08:00–09:40. Para testar
> fora desse horário, ajuste os horários pela própria tela de Cadastros > Aulas.

## Banco de dados: local (arquivo) ou nuvem (Turso)

O backend usa [libSQL](https://turso.tech) como driver do banco. Por padrão, sem nenhuma
configuração extra, ele salva num arquivo local em `backend/data/bateponto.db` — funciona
exatamente como um SQLite comum, sem precisar de conta em lugar nenhum.

Se você definir as variáveis `TURSO_DATABASE_URL` e `TURSO_AUTH_TOKEN` (num arquivo `.env`
dentro de `backend/`, ou como variáveis de ambiente no serviço de hospedagem), o backend passa
a usar automaticamente um banco Turso na nuvem — grátis, persistente, sem precisar reescrever
nada. Veja `backend/.env.example`.

## Colocando o site no ar (deploy gratuito e persistente)

Essa combinação não perde dados mesmo no plano grátis: **Turso** guarda os dados (fora do
servidor), e o servidor em si pode "dormir" sem problema.

1. **Banco (Turso)** — crie uma conta grátis em turso.tech, crie um banco, copie a
   `Database URL` e gere um `Auth Token`.
2. **Backend (Render)** — crie um "Web Service" gratuito no Render apontando pro repositório/
   pasta `backend`. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Variáveis de ambiente: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET` (qualquer
     texto secreto que você escolher)
   - Anote a URL pública que o Render gerar (ex: `https://bate-ponto-api.onrender.com`)
3. **Frontend (Render ou Vercel)** — crie um "Static Site" apontando pra pasta `frontend`:
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - Variável de ambiente: `VITE_API_URL` = `https://bate-ponto-api.onrender.com/api` (a URL
     do passo anterior, com `/api` no final)
4. **ESP32** — no `config.h` do firmware, troque `API_BASE_URL` pela URL pública do backend
   (a mesma do passo 2, com `/api` no final).

No plano gratuito do Render, o backend "dorme" depois de 15 minutos sem uso e demora uns
segundos pra "acordar" na primeira requisição seguinte — isso é normal e não afeta os dados,
já que eles moram no Turso, não no Render.

## Como o ESP32 conversa com este backend

O ESP32 deve chamar estes endpoints (JSON, via Wi-Fi/HTTP) usando o
`device_token` da sala (cadastrado na tabela `rooms`):

| Endpoint | Uso |
|---|---|
| `POST /api/device/checkin` | Cartão passado na entrada — registra presença/atraso ou barra professor fora de sala |
| `POST /api/device/break/start` | Aluno/professor sai (urinar, defecar, água, garrafa) — retorna o limite de tempo |
| `POST /api/device/break/end` | Retorno da pausa — informa se excedeu o tempo |
| `POST /api/device/print-data` | Dados prontos para o botão de impressão do professor (nome, status, horário de cada aluno) |

Todos recebem `{ "device_token": "...", "card_id": "...", ... }` no corpo.

## Próximos passos sugeridos
- Firmware do ESP32 (leitor RC522 + impressora térmica Bluetooth) consumindo estes endpoints
- Job agendado para marcar falta automática assim que a tolerância expirar (hoje isso é calculado "on the fly" ao consultar)
- Cadastro de alunos/professores/salas pela própria interface (hoje é via seed/banco)
