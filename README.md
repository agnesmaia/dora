# 🧠 Dora — Do Routine Adaptively

> Trabalho de Conclusão de Curso (TCC) — MVP desenvolvido com Next.js

**Dora** (_Do Routine Adaptively_) é um assistente pessoal de produtividade que aprende com o comportamento do usuário ao longo do tempo usando **Q-Learning** (Aprendizado por Reforço) e **GPT-4o** para gerar rotinas completamente personalizadas.

---

## 📸 Visão Geral

O sistema permite que o usuário descreva sua rotina em linguagem natural. A IA interpreta essa descrição, cria atividades personalizadas e uma agenda semanal. A cada interação — completar, adiar ou rejeitar uma atividade — o modelo Q-Learning ajusta os pesos e passa a recomendar melhor no futuro.

---

## ✨ Funcionalidades

- **Onboarding inteligente via GPT-4o**: o usuário descreve sua rotina em texto livre, e o modelo gera atividades personalizadas + agenda semanal diferenciada por dia
- **Recomendação diária por Q-Learning**: sugere as melhores atividades com base no estado atual `(dia da semana, bloco horário, nível de energia)`
- **Feedback de atividades**: o usuário informa se completou, adiou, completou parcialmente ou rejeitou cada atividade — o Q-Value é atualizado em tempo real
- **Alternativas inteligentes**: ao ajustar uma atividade, o sistema sugere opções com Q-Values mais altos para aquele contexto
- **Visão semanal**: calendário visual com todas as atividades distribuídas nos 7 dias da semana (grid por hora)
- **Simulador de treinamento**: página que simula N episódios de Q-Learning e plota a curva de convergência dos Q-Values
- **Perfis pré-definidos**: Estudante Matutino, Profissional Noturno e Equilibrado — cada um com dataset CSV de treinamento inicial
- **Autenticação com Google** (NextAuth v5 + Prisma Adapter)
- **Streak e estatísticas** de adesão semanal

---

## 🏗️ Arquitetura

```
src/
├── components/          # Componentes reutilizáveis (BottomNav, SuggestionCard, etc.)
├── lib/
│   ├── qlearning.ts     # Núcleo do Q-Learning: estados, ações, recompensas, update
│   ├── datasets.ts      # Carregamento e parse dos datasets CSV de treinamento
│   ├── auth.ts          # NextAuth com provider Google
│   └── db.ts            # Instância singleton do Prisma Client
├── pages/
│   ├── index.tsx        # Login
│   ├── dashboard/       # Dashboard diário com recomendações
│   ├── semana.tsx       # Visão semanal (grid de calendário)
│   ├── simulate.tsx     # Simulador de treinamento Q-Learning
│   ├── onboarding/      # Fluxo de onboarding (perfil → rotina → GPT)
│   └── api/
│       ├── feedback.ts          # POST — registra feedback e atualiza Q-Value
│       ├── recommend/daily.ts   # GET — retorna atividades recomendadas para hoje
│       ├── weekly.ts            # GET — retorna agenda da semana inteira
│       ├── simulate.ts          # POST — simula episódios de Q-Learning
│       ├── model.ts             # GET — retorna o modelo Q do usuário
│       └── onboarding/gpt.ts    # POST — processa rotina com GPT e inicializa Q-Values
data/
└── datasets/
    ├── dataset_equilibrado.csv
    ├── dataset_estudante_matutino.csv
    └── dataset_profissional_noturno.csv
```

---

## 🤖 Como o Q-Learning funciona

O estado é representado como uma tupla `(dia_semana, bloco_horario, nivel_energia)`:

| Componente   | Valores possíveis                          |
| ------------ | ------------------------------------------ |
| `dia_semana` | `0` (Segunda) … `6` (Domingo)              |
| `bloco_hora` | `0` Manhã (6h–12h) · `1` Tarde · `2` Noite |
| `energia`    | `1` (baixa) … `5` (alta)                   |

**Recompensas:**

| Feedback        | Recompensa |
| --------------- | ---------- |
| Completou       | `+10`      |
| Parcialmente    | `+3`       |
| Adiou / Ignorou | `−1`       |
| Rejeitou        | `−5`       |

**Atualização (Q-Learning padrão):**

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ r + \gamma \cdot \max_{a'} Q(s, a') - Q(s, a) \right]$$

Com $\alpha = 0.1$ e $\gamma = 0.9$.

---

## 🛠️ Stack Tecnológica

| Camada         | Tecnologia                                             |
| -------------- | ------------------------------------------------------ |
| Framework      | [Next.js 16](https://nextjs.org/) (Pages Router)       |
| Linguagem      | TypeScript 5                                           |
| Banco de dados | PostgreSQL + [Prisma ORM](https://prisma.io/)          |
| Autenticação   | [NextAuth.js v5](https://authjs.dev/) + Google         |
| IA Generativa  | [OpenAI GPT-4o](https://openai.com/)                   |
| Estilos        | [Tailwind CSS v4](https://tailwindcss.com/)            |
| Ícones         | [Lucide React](https://lucide.dev/) + Material Symbols |

---

## 🚀 Como rodar localmente

### Pré-requisitos

- Node.js 18+
- PostgreSQL rodando localmente (ou Supabase/Neon)
- Conta Google para OAuth
- Chave de API da OpenAI

### 1. Clone e instale as dependências

```bash
git clone https://github.com/seu-usuario/mvp-next.git
cd mvp-next
npm install
```

### 2. Configure as variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/rotinia"

NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="seu-secret-aleatorio"

GOOGLE_CLIENT_ID="seu-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="seu-client-secret"

OPENAI_API_KEY="sk-..."
```

### 3. Aplique o schema no banco

```bash
npm run db:push
```

### 4. Rode o servidor de desenvolvimento

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

---

## 📊 Datasets

Os datasets CSV em `data/datasets/` contêm dados sintéticos de treinamento inicial para os três perfis. Cada linha representa uma interação histórica com colunas `dia_semana`, `hora`, `energia`, `atividade` e `resposta`. Esses dados são usados para pré-popular os Q-Values no onboarding antes que o modelo comece a aprender com as interações reais do usuário.

---

## 🗺️ Fluxo da Aplicação

```
Login (Google)
    └─► Onboarding
          ├─ Seleção de perfil (Estudante / Profissional / Equilibrado)
          ├─ Configuração de horários e energia matinal
          └─ Descrição livre da rotina → GPT gera atividades + agenda semanal
                └─► Dashboard Diário
                      ├─ Recomendações por Q-Learning
                      ├─ Feedback por atividade (atualiza Q-Values)
                      ├─ Alternativas inteligentes
                      └─► Visão Semanal (calendário)
                      └─► Simulador de treinamento
```

---

## 📄 Licença

Este projeto foi desenvolvido como MVP de Trabalho de Conclusão de Curso e é de uso acadêmico.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
