#ifndef CONFIG_H
#define CONFIG_H

// ================== WI-FI ==================
#define WIFI_SSID       "NOME_DA_SUA_REDE"
#define WIFI_PASSWORD   "SENHA_DA_SUA_REDE"

// ================== BACKEND (API do site) ==================
// Ex: "http://192.168.1.50:3001/api"  (IP do computador rodando o backend na sua rede)
#define API_BASE_URL    "http://192.168.1.50:3001/api"

// Token desta sala especifico (deve bater com o cadastrado na tabela `rooms` do backend)
#define DEVICE_TOKEN    "ESP32-SALA101-TOKEN"
#define ROOM_LABEL      "Sala 101"

// ================== IMPRESSORA TERMICA BLUETOOTH ==================
// Nome Bluetooth (SPP) da impressora, normalmente vem no manual/etiqueta do aparelho
#define PRINTER_BT_NAME "MPT-II"
// Nome que este ESP32 vai anunciar via Bluetooth (não precisa mudar)
#define ESP32_BT_NAME   "BatePontoESP32"

// ================== PINOS - LEITOR RFID RC522 (SPI) ==================
#define RFID_SS_PIN     5
#define RFID_RST_PIN    22
// SCK=18, MOSI=23, MISO=19 (pinos padrao do barramento SPI do ESP32, nao precisam ser definidos aqui)

// ================== PINOS - BOTOES ==================
// Botoes de pausa (ligar cada botao entre o pino e o GND; usamos INPUT_PULLUP)
#define BTN_URINAR      13
#define BTN_DEFECAR     12
#define BTN_AGUA        14
#define BTN_GARRAFA     27
#define BTN_RETORNAR    26   // aluno/professor aperta ao voltar da pausa
#define BTN_IMPRIMIR    25   // botao do professor para imprimir a nota final

// ================== PINOS - FEEDBACK (LED/BUZZER) ==================
#define LED_VERDE       32   // presenca OK
#define LED_VERMELHO    33   // negado / falta / erro
#define BUZZER_PIN      15

// ================== TEMPOS ==================
#define DEBOUNCE_MS            250
#define AGUARDA_CARTAO_MS      10000   // tempo para encostar o cartao apos apertar um botao de pausa/retorno/impressao
#define LOOP_DELAY_MS           50

#endif
