# Integração da câmara Mercusys

A área Segurança do site incorpora o visualizador local em `http://127.0.0.1:3021`. Esse visualizador liga à câmara por RTSP e faz a conversão necessária para vídeo no browser. A conta e a palavra-passe da câmara são introduzidas no próprio visualizador, não no site nem no Supabase.

## Confirmar o modelo

A tua câmara é a MC200. A Mercusys inclui este modelo na documentação de RTSP/ONVIF, pelo que a câmara pode fornecer o stream local. O viewer comunitário indicado abaixo foi criado para a MC210 e poderá funcionar com a MC200 por usar RTSP/ONVIF, mas essa combinação ainda precisa de ser testada.

## Preparar a câmara

1. No app Mercusys, abre a câmara e vai a **Definições do dispositivo > Definições avançadas > Conta da câmara**. Cria um utilizador e palavra-passe exclusivos para a câmara; não reutilizes a palavra-passe da conta Mercusys.
2. Obtém o endereço IP da câmara no app ou na lista de dispositivos do router. Mantém a câmara e o computador na mesma rede local.
3. Os endereços RTSP documentados são `rtsp://IP_DA_CAMERA:554/stream1` (qualidade superior) e `rtsp://IP_DA_CAMERA:554/stream2` (menor consumo). O serviço ONVIF usa normalmente a porta `2020`.

## Preparar o visualizador local

O site estático não converte RTSP por si só. O viewer comunitário [Mercusys MC210 Viewer](https://github.com/johnbarsoum77/mercusys-mc210-viewer) converte RTSP para HLS/MJPEG no próprio computador e serve o painel em `http://127.0.0.1:3021`. Embora o projeto seja direcionado à MC210, pode funcionar com a MC200 por esta suportar RTSP/ONVIF; confirma a ligação antes de depender dele.

Instala Node.js e Git, revê o código-fonte do projeto e, no PowerShell, executa:

```powershell
git clone https://github.com/johnbarsoum77/mercusys-mc210-viewer.git
Set-Location mercusys-mc210-viewer
npm install
npm run open
```

No visualizador, abre as definições e introduz o IP, a conta da câmara, a porta RTSP `554` e `stream1` ou `stream2`. Inicia o stream. Depois, abre a área **Gestão > Segurança** neste site e seleciona **Abrir visualizador neste painel**. O visualizador tem de estar a correr no mesmo computador em que o gestor está a usar o site.

## Segurança

- Não coloques a conta da câmara, a URL RTSP com credenciais, nem a chave `service_role` no site, neste repositório ou numa conversa.
- Não encaminhes as portas RTSP `554`, ONVIF `2020` ou `3021` para a Internet. Para acesso remoto, usa uma VPN.
- O visualizador local é um projeto de terceiros e, por predefinição, só escuta em `127.0.0.1`. Revê o projeto antes de o instalar.
- A integração no site apenas carrega o visualizador depois da autenticação de gestor e descarrega o frame ao sair da área ou terminar sessão. O serviço local continua a ser uma aplicação separada.

Referências: [FAQ oficial Mercusys RTSP/ONVIF](https://www.mercusys.com/en/faq-1168/) · [Visualizador comunitário MC210/RTSP](https://github.com/johnbarsoum77/mercusys-mc210-viewer)
