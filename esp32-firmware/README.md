# Firmware ESP32 — Bate-Ponto Escolar

Le o cartao RFID (RC522), fala com o backend do site via Wi-Fi/HTTP, e imprime
comprovantes e a nota final numa impressora termica Bluetooth.

## Bibliotecas (Arduino IDE → Ferramentas → Gerenciar Bibliotecas)
- **MFRC522** (Miguel Balboa / GithubCommunity)
- **ArduinoJson** (Benoit Blanchon, versão 7.x)
- WiFi, HTTPClient, SPI, BluetoothSerial → já incluídas no core do ESP32
  (instale o suporte a placas "esp32" pelo Gerenciador de Placas, se ainda não tiver)

> **Importante:** BluetoothSerial só existe nas variantes do ESP32 com Bluetooth
> Clássico (a maioria das placas DevKit). Se sua placa for ESP32-S3/C3, confirme
> se ela tem Bluetooth Classic (SPP) — algumas só têm BLE, que não conversa com
> impressoras térmicas comuns.

## Ligações (RC522 → ESP32, barramento SPI padrão)

| RC522 | ESP32 |
|---|---|
| SDA (SS) | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 22 |
| 3.3V | 3.3V |
| GND | GND |

## Botões (cada um entre o pino e o GND — o firmware usa `INPUT_PULLUP`)

| Função | Pino |
|---|---|
| Urinar (5 min) | GPIO 13 |
| Defecar (12 min) | GPIO 12 |
| Tomar água (4 min) | GPIO 14 |
| Encher garrafa (5 min) | GPIO 27 |
| Retornar da pausa | GPIO 26 |
| Imprimir nota (professor) | GPIO 25 |

## LED / Buzzer (feedback local)

| Componente | Pino |
|---|---|
| LED verde (sucesso) | GPIO 32 |
| LED vermelho (negado/erro) | GPIO 33 |
| Buzzer | GPIO 15 |

## Impressora térmica Bluetooth
O ESP32 se conecta como *master* SPP no nome Bluetooth da impressora
(`PRINTER_BT_NAME` em `config.h`). Emparelhe a impressora fisicamente antes,
se seu modelo exigir PIN de pareamento (geralmente `0000` ou `1234`).

Os comandos ESC/POS usados (`printer.h`) funcionam na maioria das mini
impressoras térmicas chinesas (58mm/80mm), mas o comando de corte de papel
(`GS V 1`) varia por modelo — se sua impressora não tiver guilhotina automática,
pode remover essa linha sem problema.

## Configuração antes de gravar
Edite `config.h`:
1. `WIFI_SSID` / `WIFI_PASSWORD`
2. `API_BASE_URL` — IP do computador rodando o backend na sua rede local
   (ex: `http://192.168.1.50:3001/api`). Use o IP da máquina, não `localhost`,
   porque o ESP32 é um dispositivo separado na rede.
3. `DEVICE_TOKEN` — precisa ser **exatamente igual** ao `device_token` cadastrado
   na tabela `rooms` do backend para aquela sala (ex: `ESP32-SALA101-TOKEN`)
4. `PRINTER_BT_NAME` — nome Bluetooth da sua impressora

## Cadastro dos cartões
O firmware lê o UID físico do cartão RFID (em hexadecimal, ex: `A1B2C3D4`) e
envia esse valor como `card_id` para o backend. Para o sistema reconhecer um
cartão, cadastre esse mesmo UID como `card_id` na tabela `people` do backend
(hoje isso é feito direto no banco/seed — dá pra criar uma tela de cadastro no
site depois).

Dica: grave o firmware, abra o Monitor Serial (115200 baud), encoste um cartão
novo e copie o UID impresso no log (`Cartao lido: ...`) para cadastrar no banco.

## Fluxo de uso no dispositivo
- **Entrar na sala:** encosta o cartão → check-in normal (presente/atrasado ou negado se professor estiver na sala errada)
- **Sair para o banheiro/água:** aperta o botão correspondente → encosta o cartão em até 10s → pausa iniciada com o tempo limite certo
- **Voltar da pausa:** aperta "Retornar" → encosta o cartão em até 10s
- **Imprimir a nota (professor):** aperta o botão de impressão a qualquer momento — não precisa de cartão, já que é o botão físico do dispositivo da sala
