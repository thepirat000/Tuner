/****** By ThePirat 2021 ***** 
- Use Android App "nRF Connect" to communicate via bluetooth BLE, and send the configuration freq text to the characteristic
  Or configure via serial port, format: "A,B,C,D" being A,B,C and D frequencies in hertz (0 for turn off)
- BLE Tutorial: https://randomnerdtutorials.com/esp32-bluetooth-low-energy-ble-arduino-ide/
- To upload sketch, press the RESET button on ESP32 when trying to update
- More info on the README.md file

Docs/Links:
- ESP Flash: https://github.com/DaleGia/ESPFlash
- BLE: https://randomnerdtutorials.com/esp32-bluetooth-low-energy-ble-arduino-ide
       https://www.arduino.cc/en/Reference/ArduinoBLE
       https://github.com/nkolban/esp32-snippets/blob/master/Documentation/BLE%20C%2B%2B%20Guide.pdf
*/

// BLE Includes
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <sstream>

// FS/FLASH Includes
#include <SPIFFS.h>
#include <ESPFlash.h>
#include <ESPFlashString.h>

#include <queue>

// Defines and Consts
#define SERVICE_NAME "Tuner by ThePirat"
#define SERVICE_UUID             "fe000000-fede-fede-0000-000000000000"       // Bluetooth Service ID
#define CHARACTERISTIC_CMDFREQ_UUID "ca000000-fede-fede-0000-000000000001"       // Bluetooth characteristic to get/set the frquencies of each oscillator
#define CHARACTERISTIC_DUTY_UUID "ca000000-fede-fede-0000-000000000002"       // Bluetooth characteristic to set the duties for the oscillators (0 to 1023, default is 512)
#define CONFIG_FREQS_FILE        "/config_freqs.txt"
#define CONFIG_DUTIES_FILE        "/config_duties.txt"
#define LED_PIN 2
#define MAX_OUTPUT 4
#define DUTY_RESOLUTION_BITS 10
#define DUTY_CYCLE_DEFAULT 512

// Connect each of these PINS to a MOSFET driving 12v to a coil/electromaget (i.e. D2, D4, D5, D18)

const int PINOUT[] = {2, 4, 5, 18}; 

// Global vars
std::vector<double> _freqs = {0, 0, 0, 0};
std::vector<double> _cacheFreqs = {0, 0, 0, 0};
std::vector<double> _duties = {DUTY_CYCLE_DEFAULT, DUTY_CYCLE_DEFAULT, DUTY_CYCLE_DEFAULT, DUTY_CYCLE_DEFAULT};
std::random_device _rnd;
BLECharacteristic *pCharacteristicFreqs, *pCharacteristicDuties;
std::queue<String> _bleCommandBuffer;

// Songs format: OriginalFrequencyMultipliersCSV:DurationInSeconds[:DutiesCSV]|...
std::vector<String> _songs = {
  "1,1,1,1:0:512,512,512,512|.5,.33:4|.33,.5:4|.25,2:2.5|2,.25:4|1.5,3:2|3,1.5:4|1,2:4|.125,.125:2|4,2:2|.5,4:2|1.5,3:2",
  "1,1,1,1:0:512,512,512,512|1,1:2:800,800|1,1:1:512,512|1.5,1.33:4|1.33,1.5:4|.25,1.25:3|2,.25:4|.5,3:2|3,.5:2|1,2:6|1.125,1.125:2|4,2:2|.5,2.5:2|2.5,.5:2",
  ".33,.33:1|.5,.5:1|.66,.66:1|1,1:1|2,2:1|3,3:1|4.02,4.02:1|5.02,5.02:1|6.03,6.03:1|7.05,7.05:1|10.14,10.14:1"
};

// Prototypes
void setup(void);
void loop(void);
std::vector<double> splitParseVector(String msg, std::vector<double> *completeWith=nullptr);
std::vector<String> splitString(String msg, const char delim);
const char* join(std::vector<double> &v);
void SetBLEFreqValue();
void SetBLEDutyValue();
void PrintValues(std::vector<double> &f, std::vector<double> &d);
void AttachOutputPins();
String GetConfigFreqs();
String GetConfigDuties();
void UpdateFrequencyValues(String newValue, bool isIncrement);
void UpdateDutyValues(String newValue, bool isIncrement);
void SetFreqsPWM();
void MultiplyFreqsPWM(std::vector<double> &mult);
void SetDutiesPWM();
void StoreConfigFreqs();
void StoreConfigDuties();
void ResetFreqDuty();
void ProcessPlayCommand(String command);
void PlaySong(int songIndex, int repeat, double tempoDivider, int variation);

// MAIN
void setup() {
  Serial.begin(115200);
  Serial.println("Initializing");

  //ESPFlashCounter flashCounter("/counter");
  //Serial.println(String(flashCounter.get()) + " executions");
  //flashCounter.increment();
  
  AttachOutputPins();
  StartBLEServer();

  String configValue = GetConfigFreqs();
  if (configValue.length() > 0 && isDigit(configValue.charAt(0))) {
    //Set the frequencies and initialize PWM
    UpdateFrequencyValues(configValue, false);
  }
  else {
    //Initialize PWM on 0hz
    Serial.println("No valid freqs config file " + configValue);
    SetFreqsPWM();
  }

  configValue = GetConfigDuties();
  if (configValue.length() > 0 && isDigit(configValue.charAt(0))) {
    //Set the duties
    UpdateDutyValues(configValue, false);
 } 
  else {
    Serial.println("No valid duties config file " + configValue);
  }
  PrintValues(_freqs, _duties);
}

// Loop
void loop() {
  // Process serial port
  if (Serial.available() > 0) {
    String recv = Serial.readStringUntil('\r');
    if (recv) {
      ProcessInput(recv);
    }
  }
  // Process BLE commands
  if (!_bleCommandBuffer.empty()) {
    String recv = _bleCommandBuffer.front();
    _bleCommandBuffer.pop();
    ProcessInput(recv);
  }
}

void ProcessInput(String recv) {
  recv.toLowerCase();
  if (recv.startsWith("/")) {
    // Duties
    recv = recv.substring(1);
    UpdateDutyValues(recv, false);
  }
  else if (recv.startsWith("*")) {
    // Frequencies (multipliers)
    recv = recv.substring(1);
    std::vector<double> mult = splitParseVector(recv);
    MultiplyFreqsPWM(mult);
    SetBLEFreqValue();
  }
  else if (recv.startsWith("+")) {
    // Frequencies (increments)
    recv = recv.substring(1);
    UpdateFrequencyValues(recv, true);
  }
  else if (recv.startsWith("reset")) {
    // RESET
    ResetFreqDuty();
  }
  else if (recv.startsWith("play")) {
    // PLAY
    ProcessPlayCommand(recv);
  }
  else if (isDigit(recv.charAt(0)) || recv.charAt(0) == '-') {
    // Frequencies (in hz)
    UpdateFrequencyValues(recv, false);
  }
  PrintValues(_freqs, _duties);  
}

// BLE Callbacks
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = String(pCharacteristic->getValue().c_str());
      _bleCommandBuffer.push(value);
    }
};

void ResetFreqDuty() {
  Serial.println("Will reset values");
  String configValue = GetConfigFreqs();
  if (configValue.length() > 0 && isDigit(configValue.charAt(0))) {
    UpdateFrequencyValues(configValue, false);
  }
  configValue = GetConfigDuties();
  if (configValue.length() > 0 && isDigit(configValue.charAt(0))) {
    //Set the duties
    UpdateDutyValues(configValue, false);
  } 
}

void StartBLEServer() {
  BLEDevice::init(SERVICE_NAME);
  BLEServer *pServer = BLEDevice::createServer();
  BLEService *pService = pServer->createService(SERVICE_UUID);
  pCharacteristicFreqs = pService->createCharacteristic(CHARACTERISTIC_CMDFREQ_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE);
  pCharacteristicDuties = pService->createCharacteristic(CHARACTERISTIC_DUTY_UUID, BLECharacteristic::PROPERTY_READ);
  pCharacteristicFreqs->setCallbacks(new MyCallbacks());
  SetBLEFreqValue();
  SetBLEDutyValue();
  pService->start();
  BLEAdvertising *pAdvertising = pServer->getAdvertising();
  pAdvertising->start();
}

// Helper methods
void AttachOutputPins() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    // assign pin[0] to channel 0, pin[1] to channel 2
    // only using even channels since 0-1, 2-3, 4-5 share the same timer
    ledcAttachPin(PINOUT[i], i*2);   
  }
}

// Freq newValue valid formats: d[,d,d,d]   d is a double
void UpdateFrequencyValues(String newValue, bool isIncrement) {
  Serial.println("New freq value received: " + newValue);
  if (isIncrement) {
    std::vector<double> increments = splitParseVector(newValue);
    for (size_t i = 0; i < increments.size(); ++i) {
      _freqs[i] = _freqs[i] + increments[i];
    }
  } else {
    _freqs = splitParseVector(newValue, &_freqs);
  }
  SetFreqsPWM();
  if (!isIncrement) {
    StoreConfigFreqs();
  }
  SetBLEFreqValue();
}

// Duty newValue valid formats: d[,d,d,d]   d is a double
void UpdateDutyValues(String newValue, bool isIncrement) {
  Serial.println("New duty value received: " + newValue);
  if (isIncrement) {
    std::vector<double> increments = splitParseVector(newValue);
    for (size_t i = 0; i < increments.size(); ++i) {
      _duties[i] = _duties[i] + increments[i];
    }
  } else {
    _duties = splitParseVector(newValue, &_duties);
  }
  SetDutiesPWM();
  StoreConfigDuties();
  SetBLEDutyValue();
}

void MultiplyFreqsPWM(std::vector<double> &mult) {
  for (size_t i = 0; i < mult.size(); ++i) {
    if (mult[i] < 0) {
      Serial.println("Will mutiply " + String(i) + ": " + String(_cacheFreqs[i]) + " by " + String(-mult[i]) + " = " + String(_cacheFreqs[i] * -mult[i]));
      _freqs[i] = _cacheFreqs[i] * -mult[i];
    }
    else {    
      Serial.println("Will mutiply " + String(i) + ": " + String(_freqs[i]) + " by " + String(mult[i]) + " = " + String(_freqs[i] * mult[i]));
      _freqs[i] = _freqs[i] * mult[i];
    }
    ledcWriteTone(i*2, _freqs[i]);
  }
}

void SetFreqsPWM() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    double freq = 0;
    if (i <= _freqs.size() - 1) {
      freq = (double)_freqs[i];
    }
    ledcSetup(i*2, freq, DUTY_RESOLUTION_BITS);
    ledcWriteTone(i*2, freq);
  }
}  

void SetDutiesPWM() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    uint32_t duty = DUTY_CYCLE_DEFAULT;
    if (i <= _duties.size() - 1) {
      duty = (uint32_t)_duties[i];
    }
    if (ledcRead(i*2) != duty) {
      ledcWrite(i*2, duty);
    }
  }
  SetBLEDutyValue();
  StoreConfigDuties();
}  

void PrintValues(std::vector<double> &f, std::vector<double> &d) {
  Serial.println("Freq values:");
  for (size_t i = 0; i < f.size(); i++) {
    Serial.println("  " + String(i) + ": " + String(f[i]) + " (Hz) Duty: " + String(d[i]));
  }
}

void SetBLEFreqValue() {
  const char* strconfigValue = join(_freqs);
  pCharacteristicFreqs->setValue(strconfigValue);
}

void SetBLEDutyValue() {
  const char* strconfigValue = join(_duties);
  pCharacteristicDuties->setValue(strconfigValue);
}

std::vector<String> splitString(String msg, const char delim) {
  std::vector<String> result;
  int j = 0;
  for (int i = 0; i < msg.length(); i++) {
    if (msg.charAt(i) == delim) {
      result.push_back(msg.substring(j, i));
      j = i + 1;
    }
  }
  result.push_back(msg.substring(j, msg.length())); //to grab the last value of the string  
  return result;
}

std::vector<double> splitParseVector(String msg, std::vector<double> *completeWith) {
  std::vector<double> result;
  int j = 0;
  for (int i = 0; i < msg.length(); i++) {
    if (msg.charAt(i) == ',') {
      result.push_back(msg.substring(j, i).toDouble());
      j = i + 1;
    }
  }
  result.push_back(msg.substring(j, msg.length()).toDouble()); //to grab the last value of the string
  if (completeWith != nullptr) {
    // Override negatives with current value
    for (int i = 0; i < result.size(); ++i) {
      if (result[i] < 0) {
        result[i] = (*completeWith)[i];
      }
    }
    // Complete with given vector, or remove additional values
    if (result.size() < MAX_OUTPUT) {
      for (size_t x = result.size(); x < MAX_OUTPUT; ++x) {
        result.push_back((*completeWith)[x]);
      }
    }
    else if (result.size() > MAX_OUTPUT) {
      for (size_t x = result.size(); x > MAX_OUTPUT; --x) {
        result.pop_back();
      }
    }
  }
  return result;
}

const char* join(std::vector<double> &v) {
  std::stringstream ss;
  for (size_t i = 0; i < v.size(); ++i)
  {
    if(i != 0)
      ss << ",";
    ss << v[i];
  }
  return ss.str().c_str();
}

void StoreConfigFreqs() {
  String configValue = join(_freqs);
  ESPFlashString espFlashString(CONFIG_FREQS_FILE);
  espFlashString.set(configValue);
  _cacheFreqs = _freqs;
}

String GetConfigFreqs() {
  ESPFlashString espFlashString(CONFIG_FREQS_FILE);
  String value = espFlashString.get();
  return value;
}

void StoreConfigDuties() {
  String configValue = join(_duties);
  ESPFlashString espFlashString(CONFIG_DUTIES_FILE);
  espFlashString.set(configValue);
}

String GetConfigDuties() {
  ESPFlashString espFlashString(CONFIG_DUTIES_FILE);
  String value = espFlashString.get();
  return value;
}

void ProcessPlayCommand(String command) {
  if (command.length() <= 5) {
    // Default params
    PlaySong(0, 1, 1, -1);
  } 
  else {
    std::vector<String> params = splitString(command.substring(5), ',');
    int song;
    int repeat = 1;
    double speed = 1.00;
    int variation = -1;
    if (params.size() > 0) {
      song = params[0].toInt();
    }
    if (params.size() > 1) {
      repeat = params[1].toInt();
    }
    if (params.size() > 2) {
      speed = params[2].toDouble();
    }
    if (params.size() > 3) {
      variation = params[3].toInt();
    }
    PlaySong(song, repeat, speed, variation);
  }
}

void PlaySong(int songIndex, int repeat, double speed, int variation) {
  String song = _songs[songIndex];
  std::default_random_engine rndSeeded(variation);
  String variationString = variation < 0 ? "original variation" : variation > 0 ? ("variation #" + String(variation)) : "random variation";
  Serial.println("Will play song '" + song + "' " + variationString + " on " + String(repeat) + " iterations at speed " + String(speed) + "x");
  if (song.length() > 0) {
    Serial.println("Begin song");
    std::vector<String> steps = splitString(song, '|');
    for(int times = 0; times < repeat; ++times) {
      Serial.println("Repeat " + String(times+1) + "/" + String(repeat));
      // Variation (randomize steps)
      if (variation > 0) {
        std::shuffle(steps.begin(), steps.end(), rndSeeded);
      } 
      else if (variation == 0) {
        std::shuffle(steps.begin(), steps.end(), _rnd);
      }
      // Read and play
      for(size_t i = 0; i < steps.size(); ++i) {
        Serial.println("  Step " + String(i+1) + "/" + String(steps.size()));
        std::vector<String> values = splitString(steps[i], ':');
        std::vector<double> freqMults;
        std::vector<double> duties;
        if (values.size() > 0) {
          // set frequencies 
          freqMults = splitParseVector(values[0]);
          for(size_t oscIndex = 0; oscIndex < freqMults.size(); ++oscIndex) {
            _freqs[oscIndex] = _cacheFreqs[oscIndex] * freqMults[oscIndex];
            Serial.println("    Set " + String(oscIndex) + " freq to " + String(_cacheFreqs[oscIndex]) + " * " + String(freqMults[oscIndex]) + " = " + String(_freqs[oscIndex]) + " Hz");
            ledcWriteTone(oscIndex*2, _freqs[oscIndex]);
          }
          SetBLEFreqValue();
        }
        if (values.size() > 2) {
          // Set duties
          duties = splitParseVector(values[2]);
          for(size_t oscIndex = 0; oscIndex < duties.size(); ++oscIndex) {
            if (duties[oscIndex] >= 0) {
              Serial.println("    Set " + String(oscIndex) + " duty to " + String(duties[oscIndex]));
              ledcWrite(oscIndex*2, (uint32_t)duties[oscIndex]);
            }
          }
          SetBLEDutyValue();
        }
        if (values.size() > 1) {
          // Delay
          double duration = values[1].toDouble() / speed;
          Serial.println("    Delay " + String(duration) + " secs.");
          delay(duration * 1000);
        }
      }
    }
    Serial.println("End song");
    // Restore cache freqs, duties
    ResetFreqDuty();
  }
}
