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
       https://github.com/nkolban/ESP32_BLE_Arduino/blob/master/examples/BLE_notify/BLE_notify.ino
*/

// BLE Includes
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <sstream>

// FS/FLASH Includes
#include <SPIFFS.h>
#include <ESPFlash.h>
#include <ESPFlashString.h>

#include <queue>

// Defines and Consts
#define SERVICE_NAME "Tuner by ThePirat"
#define SERVICE_UUID             "fe000000-fede-fede-0000-000000000000"       // Bluetooth Service ID
#define CHARACTERISTIC_FREQ_UUID "ca000000-fede-fede-0000-000000000001"       // Bluetooth characteristic to get the current frequencies of the oscillators in Hertz
#define CHARACTERISTIC_DUTY_UUID "ca000000-fede-fede-0000-000000000002"       // Bluetooth characteristic to get the duties of the oscillators (0 to 1023)
#define CHARACTERISTIC_CMD_UUID  "ca000000-fede-fede-0000-000000000099"       // Bluetooth characteristic to send commands and get the current status 
#define CONFIG_FREQS_FILE        "/config_freqs.txt"
#define CONFIG_DUTIES_FILE       "/config_duties.txt"
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
std::vector<int> _switches = {1, 1, 1, 1};
std::random_device _rnd;
BLECharacteristic *pCharacteristicFreqs, *pCharacteristicDuties, *pCharacteristicCmd;
std::queue<String> _bleCommandBuffer;
BLEServer* bleServer = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
bool stop = false;  // Stop playing flag
bool debug_ble = false; // Debug via BLE

// Songs format: Check README.md
std::vector<String> _songs = {
  "M.5,.33,.5,.33:4|.33,.5,.33,.5:4|.25,2,.25,2:2.5|2,.25,2,.25:4|1.5,3,1.5,3:2|3,1.5,3,1.5:4|1,2,1,2:4|.125,.125,.125,.125:2|4,2,4,2:2|.5,4,.5,4:2|1.5,3,1.5,3:2",
  "M1.5,1.33,.25,1.25:4|1.33,1.5,1.5,1.33:4|.25,1.25,2,.25:3|2,.25,.5,3:4|.5,3,2,.25:2|3,.5,1,2:2|1,2,3,.5:6|1.125,1.125,4,2:2|4,2,1.125,1.125:2|.5,2.5,2.5,5:2|2.5,.5,.5,2.5:2",
  "a-1,-1,-1,-1:1|=1|=1|=1|=1|a1,1,1,1:1|=6|=6|=6|=6|=6|=6|=6|=6|=6|=1|=1|=1|=1|=1"
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
void DetachOutputPins();
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
void Log(String msg);
std::vector<std::string> SplitStringByNumber(const std::string &str, int len);
void SetFreqPWM(int oscIndex, double freq, bool setup=false);

// MAIN
void setup() {
  Serial.begin(115200);
  Log("Initializing");

  //ESPFlashCounter flashCounter("/counter");
  //Log(String(flashCounter.get()) + " executions");
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
    Log("Invalid freqs file " + configValue);
    SetFreqsPWM();
  }

  configValue = GetConfigDuties();
  if (configValue.length() > 0 && isDigit(configValue.charAt(0))) {
    //Set the duties
    UpdateDutyValues(configValue, false);
 } 
  else {
    Log("Invalid duties file " + configValue);
  }
  _cacheFreqs = _freqs;
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

  // Handle bluetooth reconnect
  if (!deviceConnected && oldDeviceConnected) {
      Log("Restart advertising");
      delay(500); // give time to bluetooth stack 
      bleServer->startAdvertising(); // restart advertising
      oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
      oldDeviceConnected = deviceConnected;
  }
}

// ************ PROCESS COMMAND ***************
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
  else if (recv.startsWith("set")) {
    // SET
    SetFreqDuty();
  }
  else if (recv.startsWith("play")) {
    // PLAY
    ProcessPlayCommand(recv);
  }
  else if (recv.startsWith("on") || recv.startsWith("off")) {
    ProcessOnOffCommand(recv);
  }
  else if (recv.startsWith("debug")) {
    if (recv.length() == 5) {
      Log(String(debug_ble ? "Disable" : "Enable") + " debug");
      debug_ble = !debug_ble;
    } else if (recv.length() > 6) {
      if (recv.substring(6).startsWith("1")) {
        debug_ble = true;
      } else {
        debug_ble = false;
      }
    }
  }
  else if (recv.startsWith("?")) {
    SetBLEFreqValue();
    SetBLEDutyValue();
  }
  else if (isOperand(recv)) {
    // Frequencies (in hz)
    UpdateFrequencyValues(recv, false);
  }
  PrintValues(_freqs, _duties);  
}

bool isOperand(String str) {
  return isDigit(str.charAt(0)) || str.charAt(0) == '-' || str.charAt(0) == '.';
}

// BLE characteristics Callbacks
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = String(pCharacteristic->getValue().c_str());
      if (value.startsWith("stop")) {
        stop = true;
      }
      else {
        _bleCommandBuffer.push(value);
      }
    }
};

// BLE Server callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* server) {
      Log("Client connected");
      deviceConnected = true;
      SetBLEFreqValue();
      SetBLEDutyValue();
    };
    void onDisconnect(BLEServer* server) {
      Log("Client disconnected");
      deviceConnected = false;
    }
};

// Load from config
void ResetFreqDuty() {
  Log("Load values");
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

// Save to config
void SetFreqDuty() {
  Log("Save values");
  StoreConfigFreqs();
  StoreConfigDuties();
}

void StartBLEServer() {
  BLEDevice::init(SERVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = bleServer->createService(SERVICE_UUID);
  pCharacteristicFreqs = pService->createCharacteristic(CHARACTERISTIC_FREQ_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicDuties = pService->createCharacteristic(CHARACTERISTIC_DUTY_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicCmd = pService->createCharacteristic(CHARACTERISTIC_CMD_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);

  // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.descriptor.gatt.client_characteristic_configuration.xml
  pCharacteristicFreqs->addDescriptor(new BLE2902());
  pCharacteristicDuties->addDescriptor(new BLE2902());
  pCharacteristicCmd->addDescriptor(new BLE2902());
  
  pCharacteristicCmd->setCallbacks(new MyCallbacks());
  pService->start();
  BLEAdvertising *pAdvertising = bleServer->getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  //pAdvertising->setScanResponse(false);
  //pAdvertising->setMinPreferred(0x0);  // set value to 0x00 to not advertise this parameter
  //BLEDevice::startAdvertising();
  pAdvertising->start();
}

// Helper methods
void AttachOutputPins() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    // assign pin[0] to channel 0, pin[1] to channel 2
    // only using even channels since 0-1, 2-3, 4-5 share the same timer
    TurnOn(i);
  }
}
void DetachOutputPins() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    TurnOff(i);
  }
}

// Freq newValue valid formats: d[,d,d,d]   d is a double
void UpdateFrequencyValues(String newValue, bool isIncrement) {
  Log("New freqs: " + newValue);
  if (isIncrement) {
    std::vector<double> increments = splitParseVector(newValue);
    for (size_t i = 0; i < increments.size(); ++i) {
      _freqs[i] = _freqs[i] + increments[i];
    }
  } else {
    _freqs = splitParseVector(newValue, &_freqs);
  }
  SetFreqsPWM();
  SetBLEFreqValue();
}

// Duty newValue valid formats: d[,d,d,d]   d is a double
void UpdateDutyValues(String newValue, bool isIncrement) {
  Log("New duties: " + newValue);
  if (isIncrement) {
    std::vector<double> increments = splitParseVector(newValue);
    for (size_t i = 0; i < increments.size(); ++i) {
      _duties[i] = _duties[i] + increments[i];
    }
  } else {
    _duties = splitParseVector(newValue, &_duties);
  }
  SetDutiesPWM();
  SetBLEDutyValue();
}

void MultiplyFreqsPWM(std::vector<double> &mult) {
  for (size_t i = 0; i < mult.size(); ++i) {
    if (mult[i] < 0) {
      Log("Mutiply " + String(i) + ": " + String(_cacheFreqs[i]) + " by " + String(-mult[i]) + " = " + String(_cacheFreqs[i] * -mult[i]));
      _freqs[i] = _cacheFreqs[i] * -mult[i];
    }
    else {    
      Log("Mutiply " + String(i) + ": " + String(_freqs[i]) + " by " + String(mult[i]) + " = " + String(_freqs[i] * mult[i]));
      _freqs[i] = _freqs[i] * mult[i];
    }
    SetFreqPWM(i, _freqs[i]);
  }
}

void SetFreqsPWM() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    double freq = 0;
    uint32_t duty = DUTY_CYCLE_DEFAULT;
    if (i <= _freqs.size() - 1) {
      freq = (double)_freqs[i];
      duty = (uint32_t)_duties[i];
    }
    SetFreqPWM(i, freq, true);
    // When changing freq, we have to re-set the duty
    if (duty != DUTY_CYCLE_DEFAULT) {
      ledcWrite(i*2, duty);
    }
  }
}  

void SetFreqPWM(int oscIndex, double freq, bool setup) {
  if (setup) {
    ledcSetup(oscIndex*2, freq, DUTY_RESOLUTION_BITS);
  }
  ledcWriteTone(oscIndex*2, freq);  
}

void SetDutiesPWM() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    uint32_t duty = DUTY_CYCLE_DEFAULT;
    if (i <= _duties.size() - 1) {
      duty = (uint32_t)_duties[i];
    }
    SetDutyPWM(i, duty);
  }
}  

void SetDutyPWM(int oscIndex, uint32_t duty) {
  if (ledcRead(oscIndex*2) != duty) {
    ledcWrite(oscIndex*2, duty);
  }
}

void PrintValues(std::vector<double> &f, std::vector<double> &d) {
  Log("Status");
  for (size_t i = 0; i < f.size(); i++) {
    Log(String(i) + ": " + String(f[i]) + " Hz. D: " + String(d[i]));
  }
}

void SetBLEFreqValue() {
  const char* strconfigValue = join(_freqs);
  pCharacteristicFreqs->setValue(strconfigValue);
  if (deviceConnected) {
    pCharacteristicFreqs->notify();
  }
}

void SetBLEDutyValue() {
  const char* strconfigValue = join(_duties);
  pCharacteristicDuties->setValue(strconfigValue);
  if (deviceConnected) {
    pCharacteristicDuties->notify();
  }
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

void Log(String msg) {
  Serial.println(msg);
  if (debug_ble) {
    msg = msg + "\n";
    if (msg.length() > 20) {
      std::vector<std::string> chunks = SplitStringByNumber(msg.c_str(), 20);
      for (size_t i = 0; i < chunks.size(); ++i) {
        pCharacteristicCmd->setValue(chunks[i]);
        if (deviceConnected) {
          pCharacteristicCmd->notify();
        }
      }
    } 
    else {
      pCharacteristicCmd->setValue(msg.c_str());
      if (deviceConnected) {
        pCharacteristicCmd->notify();
      }
    }
  }
}

std::vector<std::string> SplitStringByNumber(const std::string &str, int len)
{
    std::vector<std::string> entries;
    for(std::string::const_iterator it(str.begin()); it != str.end();)
    {
        int nbChar = std::min(len,(int)std::distance(it,str.end()));
        entries.push_back(std::string(it,it+nbChar));
        it=it+nbChar;
    };
    return entries;
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

void ProcessOnOffCommand(String cmd) {
  if (cmd.startsWith("on")) {
    if (cmd.length() <= 3) {
      Log("Turn on All");
      AttachOutputPins();
    }
    else if (cmd.length() > 3) {
      int oscIndex = cmd.substring(3).toInt() - 1;
      if (oscIndex >= 0 && oscIndex <= MAX_OUTPUT) {
        Log("Turn on " + String(oscIndex));
        TurnOn(oscIndex);
      }
    }
  }
  else if (cmd.startsWith("off")) {
    if (cmd.length() <= 4) {
      Log("Turn off All");
      DetachOutputPins();
    }
    else if (cmd.length() > 4) {
      int oscIndex = cmd.substring(4).toInt() - 1;
      if (oscIndex >= 0 && oscIndex <= MAX_OUTPUT) {
        Log("Turn off " + String(oscIndex));
        TurnOff(oscIndex);
      }
    }
  }

}

void TurnOn(int oscIndex) {
  ledcAttachPin(PINOUT[oscIndex], oscIndex*2);
  _switches[oscIndex] = 1;
}

void TurnOff(int oscIndex) {
  _switches[oscIndex] = 0;
  ledcDetachPin(PINOUT[oscIndex]);
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
  Log("Play song " + String(songIndex) + " " + variationString + " on " + String(repeat) + " it. @ " + String(speed) + "x");
  if (song.length() > 0) {
    Log("Begin song");
    stop = false;
    char defaultType = song.charAt(0);
    song = song.substring(1);
    
    std::vector<String> steps = splitString(song, '|');
    for(int times = 0; times < repeat; ++times) {
      Log("Repeat " + String(times+1) + "/" + String(repeat));
      // Variation (randomize steps)
      if (variation > 0) {
        std::shuffle(steps.begin(), steps.end(), rndSeeded);
      } 
      else if (variation == 0) {
        std::shuffle(steps.begin(), steps.end(), _rnd);
      }
      // Read and play
      for(size_t i = 0; i < steps.size(); ++i) {
        if (stop) {
          Log("Stopping");
          ResetFreqDuty();
          return;
        }
        
        std::vector<String> values;
        if (steps[i].charAt(0) == '=') {
          // Copy step
          int copyStep = steps[i].substring(1).toInt();
          Log(" Copy step at index " + String(copyStep-1));
          values = splitString(steps[copyStep-1], ':');
        } 
        else {
          values = splitString(steps[i], ':');
        }

        char stepType = defaultType;
        if (!isOperand(values[0])) {
          stepType = values[0].charAt(0);
          values[0] = values[0].substring(1);
        }    
        
        Log(" Step " + String(i+1) + "/" + String(steps.size()) + " " + stepType);
        
        std::vector<double> operands = splitParseVector(values[0]);
        // set frequencies 
        for(size_t oscIndex = 0; oscIndex < operands.size(); ++oscIndex) {
          switch (stepType) {
            case 'F': // Set base and current freq
              _cacheFreqs[oscIndex] = operands[oscIndex];
              _freqs[oscIndex] = operands[oscIndex];
              break;
            case 'f': // Set current freq
              _freqs[oscIndex] = operands[oscIndex];
              break;
            case 'M': // Multiply base
              _freqs[oscIndex] = _cacheFreqs[oscIndex] * operands[oscIndex];
              break;
            case 'm': // Multiply current
              _freqs[oscIndex] = _freqs[oscIndex] * operands[oscIndex];
              break;
            case 'A': // Add base
              _freqs[oscIndex] = _cacheFreqs[oscIndex] + operands[oscIndex];
              break;
            case 'a': // Add current
              _freqs[oscIndex] = _freqs[oscIndex] + operands[oscIndex];
              break;
            default:
              break;
          }
          Log("  Set " + String(oscIndex) + " freq to " + String(_freqs[oscIndex]) + " Hz");
          SetFreqPWM(oscIndex, _freqs[oscIndex]);
        }
        SetBLEFreqValue();

        std::vector<double> duties;
        if (values.size() > 2) {
          // Set duties
          duties = splitParseVector(values[2]);
          for(size_t oscIndex = 0; oscIndex < duties.size(); ++oscIndex) {
            if (duties[oscIndex] >= 0) {
              Log("    Set " + String(oscIndex) + " duty to " + String(duties[oscIndex]));
              ledcWrite(oscIndex*2, (uint32_t)duties[oscIndex]);
            }
          }
          SetBLEDutyValue();
        }
        if (values.size() > 1) {
          // Delay
          double duration = values[1].toDouble() / speed;
          Log("    Delay " + String(duration) + " secs.");
          delay(duration * 1000);
        }
      }
    }
    Log("End song");
    // Restore cache freqs, duties
    ResetFreqDuty();
  }
}
