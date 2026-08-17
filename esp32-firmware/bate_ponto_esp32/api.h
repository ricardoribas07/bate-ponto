#ifndef API_H
#define API_H

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Faz um POST JSON para o backend e devolve o corpo da resposta em `outBody`.
// Retorna o codigo HTTP (ou -1 em caso de erro de conexao).
int apiPost(const String &path, const String &jsonBody, String &outBody) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Sem Wi-Fi, nao foi possivel chamar a API.");
    return -1;
  }

  HTTPClient http;
  String url = String(API_BASE_URL) + path;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(6000);

  int code = http.POST(jsonBody);
  outBody = http.getString();
  http.end();
  return code;
}

// -------- Check-in (entrada na sala) --------
bool apiCheckin(const String &cardId, JsonDocument &result) {
  String body = String("{\"device_token\":\"") + DEVICE_TOKEN + "\",\"card_id\":\"" + cardId + "\"}";
  String resp;
  int code = apiPost("/device/checkin", body, resp);
  Serial.printf("[checkin] HTTP %d: %s\n", code, resp.c_str());
  deserializeJson(result, resp);
  return code == 200;
}

// -------- Inicio de pausa (banheiro/agua) --------
bool apiBreakStart(const String &cardId, const String &type, JsonDocument &result) {
  String body = String("{\"device_token\":\"") + DEVICE_TOKEN + "\",\"card_id\":\"" + cardId + "\",\"type\":\"" + type + "\"}";
  String resp;
  int code = apiPost("/device/break/start", body, resp);
  Serial.printf("[break/start] HTTP %d: %s\n", code, resp.c_str());
  deserializeJson(result, resp);
  return code == 200;
}

// -------- Fim de pausa (retorno) --------
bool apiBreakEnd(const String &cardId, JsonDocument &result) {
  String body = String("{\"device_token\":\"") + DEVICE_TOKEN + "\",\"card_id\":\"" + cardId + "\"}";
  String resp;
  int code = apiPost("/device/break/end", body, resp);
  Serial.printf("[break/end] HTTP %d: %s\n", code, resp.c_str());
  deserializeJson(result, resp);
  return code == 200;
}

// -------- Dados para impressao da nota final --------
bool apiPrintData(JsonDocument &result) {
  String body = String("{\"device_token\":\"") + DEVICE_TOKEN + "\"}";
  String resp;
  int code = apiPost("/device/print-data", body, resp);
  Serial.printf("[print-data] HTTP %d: %s\n", code, resp.c_str());
  deserializeJson(result, resp);
  return code == 200;
}

#endif
