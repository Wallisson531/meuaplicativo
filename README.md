# Meu Caixa — controle financeiro pessoal (PWA + Supabase)

App instalável no celular. Front-end em HTML/CSS/JavaScript puro; login e banco de dados no Supabase.

## Arquivos
- `index.html` — estrutura (menu, botão +, folha de lançamento, aviso)
- `style.css` — visual e tema claro/escuro
- `app.js` — lógica, em seções comentadas (constantes, estado, Supabase, gráficos, telas, eventos)
- `config.js` — **onde você cola a URL e a chave do seu Supabase**
- `supabase.sql` — cria a tabela e as regras de segurança (cole no SQL Editor)
- `sw.js`, `manifest.webmanifest`, `icons/` — instalação no celular

## Passo a passo no Supabase
1. Crie uma conta em supabase.com e um **New project** (nome, senha do banco — guarde-a — e a região mais próxima, ex.: South America/São Paulo).
2. No menu **SQL Editor**, abra uma consulta nova, cole o conteúdo de `supabase.sql` e clique em **Run**. Confira em **Table Editor** se a tabela `transacoes` apareceu.
3. Em **Project Settings > API Keys**, copie a **Project URL** e a chave **Publishable** (`sb_publishable_...`) e cole em `config.js`. Nunca use a chave `secret`/`service_role` no app.
4. Em **Authentication > Sign In / Providers > Email**, decida sobre **Confirm email**:
   - Ligado (padrão): quem cria conta precisa clicar no link do e-mail. Mais seguro, mas o e-mail padrão do Supabase tem limite baixo de envios.
   - Desligado: a conta entra direto. Mais prático para uso pessoal.
5. Em **Authentication > URL Configuration**, coloque em **Site URL** o endereço onde o app estará publicado e, em **Redirect URLs**, adicione esse endereço e `http://localhost:8000/**`. Sem isso, os links de confirmar e-mail e redefinir senha não voltam para o app.
6. Teste: abra o app, toque em **Criar conta**, entre e faça um lançamento. Ele deve aparecer em **Table Editor > transacoes**, e o usuário em **Authentication > Users**.
7. Teste a segurança: crie uma segunda conta e confirme que ela não vê os lançamentos da primeira (é o RLS funcionando).

## Rodar no computador
Não abra o `index.html` com duplo clique. Na pasta do projeto:

    python -m http.server 8000

Abra http://localhost:8000.

## Instalar no celular
1. Publique a pasta em um host HTTPS gratuito (GitHub Pages, Netlify, Vercel) e use esse endereço no passo 5 acima.
2. No Android (Chrome): menu ⋮ > “Instalar app”. No iPhone (Safari): Compartilhar > “Adicionar à Tela de Início”.

## Segurança em 3 linhas
- A chave publishable fica visível no código e isso é normal: quem protege os dados é o RLS (as regras do `supabase.sql`).
- Nunca remova o `enable row level security` nem crie policies com `using (true)`.
- Nunca coloque a chave `secret`/`service_role` no app.

## Trazer dados da versão antiga
Se você usou a versão sem Supabase no mesmo endereço, aparecerá em Perfil o botão “Enviar lançamentos salvos neste aparelho”. Backups em JSON também entram por Perfil > Importar.

## Ideias para evoluir
Orçamento por categoria, gastos recorrentes, categorias personalizadas, várias contas/cartões, exportar CSV, login com Google.
