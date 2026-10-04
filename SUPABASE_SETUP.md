# Configuração do Supabase

O site usa o Supabase para autenticação, catálogo partilhado e armazenamento de imagens. A chave `anon` é pública; as políticas RLS abaixo protegem as operações. Nunca coloque a chave `service_role` no site.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, execute o conteúdo de `SUPABASE_SETUP.sql`.
3. Execute também `SUPABASE_BIRD_PHOTOS.sql` no SQL Editor para ativar galerias com várias fotografias por ave.
4. Execute `SUPABASE_BIRD_STATUS.sql` no SQL Editor para permitir marcar aves como disponíveis, reservadas ou vendidas.
5. Execute `SUPABASE_BIRD_MUTATION.sql` no SQL Editor para guardar mutações e ativar esse filtro.
6. Em Authentication, crie o seu utilizador com email e palavra-passe. Não ative registos públicos.
7. Copie o UUID desse utilizador e autorize apenas essa conta no SQL Editor:

   ```sql
   insert into public.catalog_admins (user_id)
   values ('UUID-DO-SEU-UTILIZADOR');
   ```

8. Em Project Settings > API, copie a Project URL e a chave `anon` para `supabase-config.js`.
9. Publique os ficheiros do site no alojamento ligado ao domínio. O acesso à gestão é feito em `/?gestao=1`; o separador de gestão só aparece após autenticação e autorização.

O catálogo e as imagens são públicos para consulta. Só os utilizadores registados em `catalog_admins` podem alterá-los. A autorização é aplicada no Supabase, não apenas na interface.

Para uma fotografia das instalações aparecer, carregue-a no formulário da área de gestão e preencha a legenda; enviar apenas o ficheiro para o Storage não cria o registo que o site usa para mostrar a imagem.