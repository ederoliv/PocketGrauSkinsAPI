# Spec Técnica — Painel de Upload de Skins (API Node/Express)

## Contexto do Projeto

Existe uma API Node/Express que serve um JSON de skins para um app mobile em React Native. Atualmente os dados estão num `db.json` local — isso precisa ser migrado para um banco de dados persistente, pois o filesystem da Vercel é efêmero (arquivos somem a cada redeploy).

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

1. **Migrar o `db.json`** para um banco de dados persistente (Supabase)
2. **Migrar o storage de imagens** para o Supabase Storage
3. **Criar um painel web de administração** onde o cliente pode cadastrar e remover skins sem depender do desenvolvedor

---

## Ambiente e Restrições

- **Hospedagem da API:** Vercel (agora) → Railway ($5/mês, em breve)
- **Filesystem:** efêmero em ambos — nenhum arquivo pode ser salvo no disco do servidor
- **Banco de dados:** Supabase (PostgreSQL, free tier)
- **Storage de imagens:** Supabase Storage (1GB free — suficiente para o volume esperado de ~250 imagens)
- **Autenticação:** usuário único (só o admin acessa o painel)

---

## Segurança — Supabase

O acesso ao Supabase será feito **exclusivamente pela API Express**, usando a `service_role key` armazenada em variável de ambiente. Essa chave nunca é exposta ao app mobile nem ao frontend do painel.

O app mobile só faz requests para a API Express. A API Express faz requests para o Supabase. Nenhum client externo tem credenciais para acessar o banco diretamente.

A `anon key` do Supabase **não será utilizada**. O RLS (Row Level Security) não é crítico nesse modelo, mas pode ser configurado como camada extra de proteção se desejado.

```
App Mobile → API Express → Supabase
                 ↑
           (service_role key no .env)
```

---

## Banco de Dados — Supabase

### Tabela `skins`

```sql
create table skins (
  id serial primary key,
  nome text not null,
  descricao text not null,
  tipo text not null check (tipo in ('PERSONAGEM', 'MOTO')),
  banners text[] not null default '{}',
  arquivo_skin text not null,
  criado_em timestamptz default now()
);
```

- `banners` é um array de strings com as URLs públicas do Supabase Storage
- `arquivo_skin` é a URL pública do PNG de download

### Migração do db.json

Popular a tabela manualmente via interface do Supabase (Table Editor) colando os dados existentes do `db.json`. É uma operação única e simples dado o volume atual de dados.

---

## Storage de Imagens — Supabase Storage

### Buckets necessários

| Bucket | Conteúdo | Acesso |
|---|---|---|
| `banners` | Imagens JPG/PNG de preview das skins | Público |
| `skins` | Arquivos PNG 500x500 para download | Público |

Ambos os buckets precisam ser configurados como **públicos** para que as URLs funcionem diretamente no app mobile.

### Organização dos arquivos

```
banners/
  skin-1-banner-1.jpg
  skin-1-banner-2.jpg
  skin-2-banner-1.jpg

skins/
  skin-1.png
  skin-2.png
```

---

## Autenticação do Painel Admin

Autenticação simples de usuário único com JWT.

**Fluxo:**
1. Admin acessa `/admin/login` — página HTML com formulário (usuário + senha)
2. POST para `/admin/auth` com as credenciais
3. A API compara a senha com `bcrypt.compare()` usando o hash armazenado em variável de ambiente
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
| `/admin/login` | GET | ❌ | Página de login |
| `/admin/auth` | POST | ❌ | Valida credenciais, retorna JWT |
| `/admin` | GET | ✅ | Página principal do painel |
| `/admin/skins` | POST | ✅ | Cadastra nova skin |
| `/admin/skins/:id` | DELETE | ✅ | Remove uma skin |

### Funcionalidades da página `/admin`

- Listar todas as skins cadastradas (nome, tipo, thumbnail do primeiro banner)
- Formulário para cadastrar nova skin:
  - Campo: Nome
  - Campo: Descrição
  - Campo: Tipo (select: PERSONAGEM / MOTO)
  - Upload de banners (múltiplos arquivos, JPG/PNG, máximo 4)
  - Upload do arquivo da skin (PNG 500x500)
- Botão de deletar skin

Edição de skin não é necessária — delete + recadastro é suficiente.

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
    "banners": ["https://...supabase.co/storage/v1/object/public/banners/skin-1-banner-1.jpg"],
    "arquivoSkin": "https://...supabase.co/storage/v1/object/public/skins/skin-1.png"
  }
]
```

---

## Pacotes Necessários

```bash
npm install @supabase/supabase-js multer bcrypt jsonwebtoken
```

- `@supabase/supabase-js` — cliente Supabase (banco + storage)
- `multer` — receber arquivos no request (usar `memoryStorage`, nunca salvar em disco)
- `bcrypt` — hash e comparação de senha
- `jsonwebtoken` — geração e verificação do JWT

> **Importante sobre o multer:** configurar com `multer.memoryStorage()` para que o arquivo fique em buffer na memória e seja enviado direto para o Supabase Storage, sem tocar no disco.

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
│       └── supabase.js     # Instância do cliente Supabase
├── public/
│   └── admin/
│       ├── login.html
│       └── index.html
├── .env
└── index.js
```

---

## Variáveis de Ambiente

```env
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Auth do painel
ADMIN_USERNAME=
ADMIN_PASSWORD_HASH=    # resultado de bcrypt.hash('senha', 12)
JWT_SECRET=
```

---

## O Que NÃO Fazer

- ❌ Salvar imagens ou qualquer arquivo no filesystem do servidor
- ❌ Manter o `db.json` como fonte de dados
- ❌ Usar a `anon key` do Supabase em qualquer lugar
- ❌ Expor `SUPABASE_SERVICE_ROLE_KEY` ou `JWT_SECRET` no frontend
- ❌ Comparar senha sem bcrypt
- ❌ Mudar o formato do JSON retornado em `GET /skins`
