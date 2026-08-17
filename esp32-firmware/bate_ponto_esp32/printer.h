#ifndef PRINTER_H
#define PRINTER_H

#include "BluetoothSerial.h"
#include "config.h"

// A maioria das mini impressoras térmicas Bluetooth (ESC/POS) aceita estes comandos.
// Se sua impressora usar um dialeto diferente, ajuste os bytes abaixo conforme o manual.

BluetoothSerial btPrinter;
bool printerConnected = false;

bool printerConnect() {
  Serial.println("Conectando na impressora Bluetooth: " PRINTER_BT_NAME);
  printerConnected = btPrinter.connect(PRINTER_BT_NAME);
  if (printerConnected) {
    Serial.println("Impressora conectada.");
  } else {
    Serial.println("Falha ao conectar na impressora (vai tentar de novo quando precisar imprimir).");
  }
  return printerConnected;
}

void printerInitLine() {
  btPrinter.write(0x1B); btPrinter.write('@'); // ESC @ -> reset da impressora
}

void printerAlignCenter() {
  btPrinter.write(0x1B); btPrinter.write('a'); btPrinter.write((byte)1);
}

void printerAlignLeft() {
  btPrinter.write(0x1B); btPrinter.write('a'); btPrinter.write((byte)0);
}

void printerBoldOn() {
  btPrinter.write(0x1B); btPrinter.write('E'); btPrinter.write((byte)1);
}

void printerBoldOff() {
  btPrinter.write(0x1B); btPrinter.write('E'); btPrinter.write((byte)0);
}

void printerFeedAndCut() {
  btPrinter.println();
  btPrinter.println();
  btPrinter.println();
  // GS V 1 -> corte parcial (varia por modelo; algumas impressoras nao tem guilhotina)
  btPrinter.write(0x1D); btPrinter.write('V'); btPrinter.write((byte)1);
}

// Imprime a "nota" de presenca recebida do backend (ja formatada em linhas)
void printAttendanceReport(const String &roomName, const String &subject, const String &date,
                            int total, int presentes, int atrasados, int ausentes,
                            const String linesRaw[], int lineCount) {
  if (!printerConnected && !printerConnect()) {
    Serial.println("Nao foi possivel imprimir: impressora indisponivel.");
    return;
  }

  printerInitLine();
  printerAlignCenter();
  printerBoldOn();
  btPrinter.println("BATE-PONTO ESCOLAR");
  printerBoldOff();
  btPrinter.println(roomName);
  btPrinter.println(subject);
  btPrinter.println(date);
  btPrinter.println("--------------------------------");
  printerAlignLeft();

  for (int i = 0; i < lineCount; i++) {
    btPrinter.println(linesRaw[i]);
  }

  btPrinter.println("--------------------------------");
  printerAlignCenter();
  printerBoldOn();
  btPrinter.print("Total: "); btPrinter.println(total);
  btPrinter.print("Presentes: "); btPrinter.println(presentes);
  btPrinter.print("Atrasados: "); btPrinter.println(atrasados);
  btPrinter.print("Ausentes: "); btPrinter.println(ausentes);
  printerBoldOff();

  printerFeedAndCut();
}

// Imprime um comprovante curto (usado no check-in e nas pausas)
void printReceipt(const String &title, const String &message) {
  if (!printerConnected && !printerConnect()) return;

  printerInitLine();
  printerAlignCenter();
  printerBoldOn();
  btPrinter.println(title);
  printerBoldOff();
  printerAlignLeft();
  btPrinter.println(message);
  printerFeedAndCut();
}

#endif
