#ifndef CONFIG_H
#define CONFIG_H

const char* WIFI_SSID     = "R1";
const char* WIFI_PASSWORD = "Cilongok46";

const char* API_SERVER = "https://iotapi.ump.ac.id";
const char* API_PATH   = "/api/v1";
const char* LOGIN_EMAIL    = "admin@example.com";
const char* LOGIN_PASSWORD = "password123";

#define DHTPIN       4
#define DHTTYPE      DHT22
#define MQ2_AOUT     34
#define MQ2_DOUT     35
#define BUZZER_PIN   18

#define SENSOR_READ_INTERVAL  10000
#define API_SEND_INTERVAL     30000

#define TEMP_WARNING    28.0
#define TEMP_CRITICAL   35.0
#define CO_WARNING       35
#define CO_CRITICAL     100

#define LCD_ADDR      0x27
#define LCD_COLS      16
#define LCD_ROWS      2

#define NTP_SERVER     "pool.ntp.org"
#define GMT_OFFSET     25200
#define DST_OFFSET     0

#endif
