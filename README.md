# Avalia SESI — Plataforma de Simulados

Plataforma de simulados para treinar o Avalia SESI no CE 303: familiariza o
aluno com o formato da prova (tempo cronometrado, navegação entre questões,
estilo de enunciado) e gera, a cada simulado, um retrato de desempenho por
habilidade para acompanhar a evolução da turma rumo à meta da etapa.

Mesmo padrão de stack do turma-ds, projeto novo e separado (público, ciclo de
vida e schema diferentes — ver detalhes no documento de especificação).

## Stack

- **Backend**: FastAPI + SQLAlchemy. SQLite em desenvolvimento, Postgres em
  produção (`DATABASE_URL`).
- **Frontend**: Next.js 14 (App Router) + TypeScript, sem dependências de UI
  externas (CSS puro com a identidade visual SESI/SENAI).
- **Deploy sugerido**: Vercel (frontend) + Coolify (backend/banco), mesma
  conta já usada no turma-ds.

## Status

**Fase 0 (fundação) implementada e testada localmente**: schema de
questão/simulado/tentativa/resposta, login do aluno por RM + turma, listagem
de simulados disponíveis, execução cronometrada (uma questão por tela, grade
de navegação, marcar para revisão, confirmação de envio), correção
automática e resultado com gabarito comentado e desempenho por habilidade, e
um painel simples do professor (quem fez, nota média, comparação com a meta
institucional, ranking de habilidades com mais erro).

Ainda não entraram: importação do banco de questões via upload (hoje o banco
é populado por `seed.py`, com dados de exemplo), autenticação real do
professor (usa um token fixo em variável de ambiente) e exportação de
relatório em PDF. Ver "Pontos em aberto" no documento de especificação.

## Rodando localmente

### Backend

```bash
cd backend
make venv && make install
cp .env.example .env      # ajuste os segredos se quiser
make seed                 # popula turmas, alunos, questões e 1 simulado de exemplo
make dev                  # http://localhost:8000
```

Login de teste após o seed: **RM `50001`, turma `5A`**.
Token do painel do professor: o valor de `PROFESSOR_TOKEN` no `.env`.

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev                # http://localhost:3001
```

Acesse `http://localhost:3001`, faça login com o RM/turma de teste e comece
o simulado. O painel do professor fica em `/professor`.

## Estrutura

```
backend/
  app/
    main.py           # app FastAPI, CORS, registro das rotas
    config.py          # variáveis de ambiente
    database.py        # engine/session SQLAlchemy
    models.py           # Turma, Aluno, Questao, Simulado, Tentativa, Resposta, MetaInstitucional
    schemas.py           # schemas Pydantic (request/response)
    auth.py               # JWT do aluno
    routers/
      auth.py              # POST /api/auth/login
      simulados.py          # GET /api/simulados
      tentativas.py          # iniciar / responder / enviar / resultado
      professor.py            # painel por turma
  seed.py                      # dados de exemplo

frontend/
  app/
    login/                    # login por RM + turma
    simulados/                 # lista de simulados disponíveis
    simulados/[id]/              # tela de instruções
    simulados/[id]/prova/         # execução cronometrada
    resultado/[tentativaId]/       # nota + gabarito comentado + desempenho por habilidade
    professor/                      # painel do professor (token + turma)
  lib/
    api.ts                          # cliente HTTP do backend
    session.ts                       # sessão do aluno (localStorage)
```

## Publicando no GitHub

Este repositório já foi criado e o código enviado via push direto (não é
necessário rodar `git init`/`git remote add` novamente). Para futuras
alterações, o fluxo normal é:

```bash
git add -A
git commit -m "sua mensagem"
git push origin main
```

## Deploy em produção (proposta)

Seguindo o mesmo padrão do turma-ds:

1. **Backend em Coolify**: novo app apontando para `backend/`, com
   `DATABASE_URL` de um Postgres gerenciado, `JWT_SECRET` e
   `PROFESSOR_TOKEN` fortes, e `CORS_ORIGINS` com o domínio do frontend em
   produção.
2. **Frontend na Vercel**: novo projeto apontando para `frontend/`, com
   `NEXT_PUBLIC_API_URL` apontando para o backend publicado no Coolify.
3. Rodar as migrações/seed inicial de questões reais assim que o banco de
   questões oficial do Avalia SESI for alimentado (ver Fase 1 no documento
   de especificação).

## Pontos em aberto

Ver a seção "Pontos em aberto" do documento de especificação original
(público real por etapa, acesso ao schema do turma-ds para validar o modelo
de dados linha a linha, formato do material histórico de provas/gabaritos,
tipo de questão, login do aluno reaproveitado ou próprio, nome definitivo do
projeto).
