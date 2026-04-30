# Spec Técnica — Painel de Upload de Skins (API Node/Express)

## Contexto do Projeto

Existe uma API Node/Express que serve um JSON de skins para um app mobile em React Native. Atualmente os dados estão num `db.json` local — isso precisa ser migrado para um banco de dados persistente, pois o filesystem é efêmero (arquivos somem a cada redeploy).

Cada skin tem a seguinte estrutura:

```json
{
  "id": 1,
  "nome": "Personagem - Recruta Urbano",
  "descricao": "Skin inicial com trajes militares táticos e camuflagem urbana.",
  "tipo": "PERSONAGEM",
  "banners": [
    "https://url-publica/banner1.jpg",
    "https://url-publica/banner2.jpg"
  ],
  "arquivoSkin": "https://url-publica/skin_recruta.png"
}
```

---

## Problema a Resolver

1. **Migrar o `db.json`** para o PostgreSQL do Railway
2. **Migrar o storage de imagens** para o bucket S3-compatible do Railway
3. **Criar um painel web de administração** onde o cliente pode cadastrar e remover skins sem depender do desenvolvedor

---

## Ambiente e Restrições

- **Hospedagem da API:** Railway ($5/mês)
- **Filesystem:** efêmero — nenhum arquivo pode ser salvo no disco do servidor
- **Banco de dados:** PostgreSQL nativo do Railway
- **Storage de imagens:** Bucket S3-compatible do Railway (`t3.storageapi.dev`)
- **Autenticação:** usuário único (só o admin acessa o painel)

---

## Arquitetura

```
App Mobile → API Express → PostgreSQL (Railway)
                  ↓
           S3 Bucket (Railway)
                  ↑
           (credenciais no .env)
```

O app mobile só faz requests para a API Express. A API Express acessa o banco e o bucket. Nenhum client externo tem credenciais diretas.

---

## Banco de Dados — PostgreSQL Railway

### Tabela `skins`

```sql
CREATE TABLE skins (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  descricao   TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('PERSONAGEM', 'MOTO')),
  banners     TEXT[] NOT NULL DEFAULT '{}',
  arquivo_skin TEXT NOT NULL,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
```

- `banners` é um array de strings com as URLs públicas do bucket Railway
- `arquivo_skin` é a URL pública do PNG de download

### Conexão com o banco

Usar o pacote `pg` com a `DATABASE_URL` fornecida pelo Railway.

```js
// src/lib/db.js
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

module.exports = pool
```

### Migração do db.json

Popular a tabela manualmente via Railway Database UI ou via script de seed. É uma operação única dado o volume atual de dados.

---

## Storage de Imagens — Railway S3 Bucket

O bucket do Railway é compatível com a API S3 da AWS. Usar o SDK `@aws-sdk/client-s3`.

### Configuração do cliente S3

```js
// src/lib/storage.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,       // https://t3.storageapi.dev
  region: process.env.S3_REGION,           // auto
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
})

module.exports = { s3 }
```

### Organização dos arquivos no bucket

```
assembled-carrier-bhiq7yd/
  banners/
    skin-1-banner-1.jpg
    skin-1-banner-2.jpg
    skin-2-banner-1.jpg
  skins/
    skin-1.png
    skin-2.png
```

### URL pública dos arquivos

```
https://t3.storageapi.dev/{bucket-name}/{path}
```

Exemplo:
```
https://t3.storageapi.dev/assembled-carrier-bhiq7yd/banners/skin-1-banner-1.jpg
```

> ⚠️ Confirmar nas configurações do bucket do Railway se o acesso público está habilitado para leitura. Caso contrário, os arquivos não serão acessíveis pelo app mobile diretamente via URL.

---

## Autenticação do Painel Admin

Autenticação simples de usuário único com JWT.

**Fluxo:**
1. Admin acessa `/admin/login` — página HTML com campo de senha
2. POST para `/admin/auth` com a senha
3. A API compara com `bcrypt.compare()` usando o hash armazenado em variável de ambiente
4. Se correto, retorna um JWT assinado com `JWT_SECRET`
5. Token armazenado no `localStorage` do browser
6. Todas as rotas de admin exigem o token no header `Authorization: Bearer <token>`

**Pacotes necessários:**
```bash
npm install bcrypt jsonwebtoken
```

**Geração do hash (rodar uma vez localmente):**
```js
const bcrypt = require('bcrypt')
console.log(await bcrypt.hash('sua-senha-aqui', 12))
// copiar o resultado para ADMIN_PASSWORD_HASH no .env
```

---

## Painel Admin — Página Web

Servida pela própria Express via `express.static`.

### Rotas

| Rota | Método | Auth | Descrição |
|---|---|---|---|
| `/admin/login` | GET | ❌ | Página de login (campo de senha) |
| `/admin/auth` | POST | ❌ | Valida senha, retorna JWT |
| `/admin` | GET | ✅ | Página principal do painel |
| `/admin/skins` | POST | ✅ | Cadastra nova skin |
| `/admin/skins/:id` | DELETE | ✅ | Remove uma skin |

### Funcionalidades da página `/admin`

- Listar todas as skins cadastradas (nome, tipo, thumbnail do primeiro banner)
- Formulário para cadastrar nova skin:
  - Campo: Nome
  - Campo: Descrição
  - Campo: Tipo (select: PERSONAGEM / MOTO)
  - Upload de banners (múltiplos arquivos JPG/PNG, máximo 4)
  - Upload do arquivo da skin (PNG 500x500)
- Botão de deletar skin

Edição de skin não é necessária — delete + recadastro é suficiente.

---

## Modal de Salvamento

Durante o cadastro de uma nova skin, exibir um **modal de progresso** que bloqueia a interação até a operação completar.

### Comportamento

- O modal abre imediatamente ao submeter o formulário
- Cada etapa é salva de forma independente e sequencial
- O status de cada etapa atualiza em tempo real conforme a API responde
- Ao finalizar tudo com sucesso, exibir botão "Fechar" e resetar o formulário
- Em caso de erro em qualquer etapa, indicar qual falhou com ícone de erro

### Checklist do modal

| Etapa | Estado inicial | Sucesso | Erro |
|---|---|---|---|
| Nome | ⏳ Salvando... | ✅ Nome salvo | ❌ Falha |
| Descrição | ⏳ Salvando... | ✅ Descrição salva | ❌ Falha |
| Tipo | ⏳ Salvando... | ✅ Tipo salvo | ❌ Falha |
| Arquivo da skin | ⏳ Enviando arquivo... | ✅ Skin enviada | ❌ Falha |
| Banners | ⏳ Enviando banners... | ✅ Banners enviados | ❌ Falha |

> As etapas de Nome, Descrição e Tipo são parte de uma única operação no banco — podem ser agrupadas visualmente em "Dados da skin" se preferir simplificar o checklist para 3 itens: **Dados**, **Arquivo da skin**, **Banners**.

### Fluxo de operações no backend ao receber o POST

```
1. Fazer upload dos banners para o S3 → receber URLs
2. Fazer upload do arquivoSkin para o S3 → receber URL
3. Inserir registro no PostgreSQL com todas as URLs
```

> O frontend pode fazer polling ou o backend pode responder de forma progressiva via SSE (Server-Sent Events) se quiser atualizar o modal em tempo real. Para simplicidade, uma solução aceitável é o backend responder só no final e o frontend simular progresso animado enquanto aguarda — deixar isso como decisão de implementação.

---

## Rota Pública da API

`GET /skins` deve continuar retornando exatamente o mesmo formato JSON atual. **Nenhuma mudança no app mobile deve ser necessária.**

```js
// Exemplo do retorno esperado
[
  {
    "id": 1,
    "nome": "Personagem - Recruta Urbano",
    "descricao": "Skin inicial com trajes militares táticos.",
    "tipo": "PERSONAGEM",
    "banners": ["https://t3.storageapi.dev/assembled-carrier-bhiq7yd/banners/skin-1-banner-1.jpg"],
    "arquivoSkin": "https://t3.storageapi.dev/assembled-carrier-bhiq7yd/skins/skin-1.png"
  }
]
```

---

## Pacotes Necessários

```bash
npm install pg multer bcrypt jsonwebtoken @aws-sdk/client-s3
```

- `pg` — cliente PostgreSQL
- `multer` — receber arquivos no request (usar `memoryStorage`, nunca salvar em disco)
- `bcrypt` — hash e comparação de senha
- `jsonwebtoken` — geração e verificação do JWT
- `@aws-sdk/client-s3` — upload para o bucket S3-compatible do Railway

> **Importante sobre o multer:** configurar com `multer.memoryStorage()` para que o arquivo fique em buffer na memória e seja enviado direto para o S3, sem tocar no disco.

---

## Estrutura de Pastas Sugerida

```
/
├── src/
│   ├── routes/
│   │   ├── skins.js        # GET /skins (pública)
│   │   └── admin.js        # Rotas /admin/*
│   ├── middleware/
│   │   └── auth.js         # Verificação do JWT
│   └── lib/
│       ├── db.js           # Instância do Pool PostgreSQL
│       └── storage.js      # Instância do cliente S3
├── public/
│   └── admin/
│       ├── login.html
│       └── index.html      # Inclui o modal de progresso
├── .env
└── index.js
```

---

## Variáveis de Ambiente

```env
# PostgreSQL Railway
DATABASE_URL=

# S3 Railway
S3_ENDPOINT=https://t3.storageapi.dev
S3_REGION=auto
S3_BUCKET_NAME=assembled-carrier-bhiq7yd
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# Auth do painel
ADMIN_PASSWORD_HASH=    # resultado de bcrypt.hash('senha', 12)
JWT_SECRET=
```

---

## O Que NÃO Fazer

- ❌ Salvar imagens ou qualquer arquivo no filesystem do servidor
- ❌ Manter o `db.json` como fonte de dados
- ❌ Expor `S3_SECRET_ACCESS_KEY` ou `JWT_SECRET` no frontend
- ❌ Comparar senha sem bcrypt
- ❌ Usar `multer.diskStorage()` — sempre `memoryStorage()`
- ❌ Mudar o formato do JSON retornado em `GET /skins`