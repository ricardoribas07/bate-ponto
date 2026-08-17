/*
  BATE-PONTO ESCOLAR - Firmware ESP32
  ------------------------------------
  - Leitor RFID RC522: identifica quem encostou o cartao
  - Impressora termica Bluetooth: imprime comprovantes e a nota final
  - Botoes: escolha do tipo de pausa (urinar/defecar/agua/garrafa),
    retorno da pausa, e impressao da nota pelo professor

  Bibliotecas necessarias (Arduino IDE > Gerenciador de Bibliotecas):
    - MFRC522 (by GithubCommunity / miguelbalboa)
    - ArduinoJson (by Benoit Blanchon)
  (WiFi, HTTPClient, SPI e BluetoothSerial ja vem com o core do ESP32)
*/

#include <SPI.h>
#include <MFRC522.h>
#include <WiFi.h>
#include <ArduinoJson.h>

#include "config.h"
#include "api.h"
#include "printer.h"

MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);

// ---------------- ESTADOS ----------------
enum DeviceState {
  ESTADO_OCIOSO,              // esperando cartao para check-in normal
  ESTADO_AGUARDA_CARTAO_PAUSA,  // esperando cartao apos apertar um botao de pausa
  ESTADO_AGUARDA_CARTAO_RETORNO // esperando cartao apos apertar "retornar"
};

DeviceState estado = ESTADO_OCIOSO;
String tipoPausaSelecionada = "";
unsigned long estadoDesde = 0;

// ---------------- DEBOUNCE DE BOTOES ----------------
unsigned long lastPress[6] = {0, 0, 0, 0, 0, 0};

bool botaoApertado(int pin, int idx) {
  if (digitalRead(pin) == LOW) { // INPUT_PULLUP: LOW = pressionado
    unsigned long now = millis();
    if (now - lastPress[idx] > DEBOUNCE_MS) {
      lastPress[idx] = now;
      return true;
    }
  }
  return false;
}

// ---------------- FEEDBACK (LED/BUZZER) ----------------
void beep(int vezes, int duracaoMs) {
  for (int i = 0; i < vezes; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duracaoMs);
    digitalWrite(BUZZER_PIN, LOW);
    if (i < vezes - 1) delay(duracaoMs);
  }
}

void feedbackSucesso() {
  digitalWrite(LED_VERDE, HIGH);
  beep(1, 120);
  delay(400);
  digitalWrite(LED_VERDE, LOW);
}

void feedbackErro() {
  digitalWrite(LED_VERMELHO, HIGH);
  beep(2, 150);
  delay(300);
  digitalWrite(LED_VERMELHO, LOW);
}

// ---------------- LEITURA DO CARTAO ----------------
// Retorna o UID do cartao como string em hexadecimal (ex: "A1B2C3D4"),
// que deve ser o mesmo valor cadastrado como `card_id` na tabela `people` do backend.
String lerCartaoUID() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return "";

  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  return uid;
}

// ---------------- WI-FI ----------------
void conectarWiFi() {
  Serial.print("Conectando ao Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < 20000) {
    delay(400);
    Serial.print(".");
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado. IP: " + WiFi.localIP().toString());
  } else {
    Serial.println("\nNao foi possivel conectar ao Wi-Fi. Vai tentar de novo no loop.");
  }
}

// ---------------- ACOES ----------------
void tratarCheckin(const String &uid) {
  JsonDocument resp;
  bool ok = apiCheckin(uid, resp);

  const char* msg = resp["message"] | resp["error"] | "Sem resposta do servidor";
  const char* nome = resp["person"]["name"] | "";

  if (ok) {
    Serial.printf("OK: %s - %s\n", nome, msg);
    feedbackSucesso();
    printReceipt(String(nome), String(msg));
  } else {
    Serial.printf("NEGADO: %s\n", msg);
    feedbackErro();
    printReceipt("ACESSO NEGADO", String(msg));
  }
}

void tratarInicioPausa(const String &uid, const String &tipo) {
  JsonDocument resp;
  bool ok = apiBreakStart(uid, tipo, resp);
  const char* msg = resp["message"] | resp["error"] | "Sem resposta do servidor";

  if (ok) {
    int limite = resp["limit_seconds"] | 0;
    Serial.printf("PAUSA INICIADA: %s (limite %ds)\n", msg, limite);
    feedbackSucesso();
    printReceipt("SAIDA REGISTRADA", String(msg));
  } else {
    Serial.printf("ERRO NA PAUSA: %s\n", msg);
    feedbackErro();
    printReceipt("NAO FOI POSSIVEL SAIR", String(msg));
  }
}

void tratarFimPausa(const String &uid) {
  JsonDocument resp;
  bool ok = apiBreakEnd(uid, resp);
  const char* msg = resp["message"] | resp["error"] | "Sem resposta do servidor";

  if (ok) {
    bool excedeu = resp["exceeded"] | false;
    Serial.printf("RETORNO: %s (excedeu: %s)\n", msg, excedeu ? "sim" : "nao");
    if (excedeu) feedbackErro(); else feedbackSucesso();
    printReceipt("RETORNO REGISTRADO", String(msg));
  } else {
    Serial.printf("ERRO NO RETORNO: %s\n", msg);
    feedbackErro();
    printReceipt("ERRO NO RETORNO", String(msg));
  }
}

void tratarImpressaoNota() {
  JsonDocument resp;
  bool ok = apiPrintData(resp);

  if (!ok) {
    Serial.println("Erro ao buscar dados para impressao.");
    feedbackErro();
    printReceipt("ERRO", String((const char*)(resp["error"] | "Nao foi possivel gerar a nota")));
    return;
  }

  String room = resp["room"] | ROOM_LABEL;
  String subject = resp["subject"] | "";
  String date = resp["date"] | "";
  int total = resp["total"] | 0;
  int presentes = resp["presentes"] | 0;
  int atrasados = resp["atrasados"] | 0;
  int ausentes = resp["ausentes"] | 0;

  JsonArray linesArr = resp["lines"].as<JsonArray>();
  const int MAX_LINES = 60;
  String linhas[MAX_LINES];
  int n = 0;
  for (JsonVariant v : linesArr) {
    if (n >= MAX_LINES) break;
    linhas[n++] = v.as<String>();
  }

  feedbackSucesso();
  printAttendanceReport(room, subject, date, total, presentes, atrasados, ausentes, linhas, n);
  Serial.println("Nota impressa.");
}

// ---------------- SETUP ----------------
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(BTN_URINAR, INPUT_PULLUP);
  pinMode(BTN_DEFECAR, INPUT_PULLUP);
  pinMode(BTN_AGUA, INPUT_PULLUP);
  pinMode(BTN_GARRAFA, INPUT_PULLUP);
  pinMode(BTN_RETORNAR, INPUT_PULLUP);
  pinMode(BTN_IMPRIMIR, INPUT_PULLUP);

  pinMode(LED_VERDE, OUTPUT);
  pinMode(LED_VERMELHO, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  SPI.begin();
  rfid.PCD_Init();

  conectarWiFi();

  btPrinter.begin(ESP32_BT_NAME, true); // true = modo master (o ESP32 que conecta na impressora)
  printerConnect();

  Serial.println("Bate-Ponto pronto. Estado: OCIOSO (aguardando cartao).");
}

// ---------------- LOOP ----------------
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    conectarWiFi();
  }

  // Volta para o estado ocioso se ficar tempo demais esperando o cartao
  if (estado != ESTADO_OCIOSO && millis() - estadoDesde > AGUARDA_CARTAO_MS) {
    Serial.println("Tempo esgotado esperando o cartao. Voltando ao estado ocioso.");
    estado = ESTADO_OCIOSO;
    feedbackErro();
  }

  // ---- Botoes de pausa (so fazem sentido no estado ocioso) ----
  if (estado == ESTADO_OCIOSO) {
    if (botaoApertado(BTN_URINAR, 0)) { tipoPausaSelecionada = "urinar"; estado = ESTADO_AGUARDA_CARTAO_PAUSA; estadoDesde = millis(); Serial.println("Selecionado: urinar. Encoste o cartao."); }
    else if (botaoApertado(BTN_DEFECAR, 1)) { tipoPausaSelecionada = "defecar"; estado = ESTADO_AGUARDA_CARTAO_PAUSA; estadoDesde = millis(); Serial.println("Selecionado: defecar. Encoste o cartao."); }
    else if (botaoApertado(BTN_AGUA, 2)) { tipoPausaSelecionada = "agua"; estado = ESTADO_AGUARDA_CARTAO_PAUSA; estadoDesde = millis(); Serial.println("Selecionado: tomar agua. Encoste o cartao."); }
    else if (botaoApertado(BTN_GARRAFA, 3)) { tipoPausaSelecionada = "garrafa"; estado = ESTADO_AGUARDA_CARTAO_PAUSA; estadoDesde = millis(); Serial.println("Selecionado: encher garrafa. Encoste o cartao."); }
    else if (botaoApertado(BTN_RETORNAR, 4)) { estado = ESTADO_AGUARDA_CARTAO_RETORNO; estadoDesde = millis(); Serial.println("Retorno de pausa. Encoste o cartao."); }
    else if (botaoApertado(BTN_IMPRIMIR, 5)) { tratarImpressaoNota(); }
  }

  // ---- Leitura do cartao ----
  String uid = lerCartaoUID();
  if (uid.length() > 0) {
    Serial.println("Cartao lido: " + uid);

    switch (estado) {
      case ESTADO_OCIOSO:
        tratarCheckin(uid);
        break;
      case ESTADO_AGUARDA_CARTAO_PAUSA:
        tratarInicioPausa(uid, tipoPausaSelecionada);
        estado = ESTADO_OCIOSO;
        break;
      case ESTADO_AGUARDA_CARTAO_RETORNO:
        tratarFimPausa(uid);
        estado = ESTADO_OCIOSO;
        break;
    }
  }

  delay(LOOP_DELAY_MS);
}
