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
       SourceCode: https://github.com/espressif/arduino-esp32/tree/master/libraries/BLE/src
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
#define SERVICE_UUID                "fe000000-fede-fede-0000-000000000000"       // Bluetooth Service ID
#define CHARACTERISTIC_FREQ_UUID    "ca000000-fede-fede-0000-000000000001"       // Bluetooth characteristic to get the current frequencies of the oscillators in Hertz
#define CHARACTERISTIC_DUTY_UUID    "ca000000-fede-fede-0000-000000000002"       // Bluetooth characteristic to get the duties of the oscillators (0 to 1023)
#define CHARACTERISTIC_SWITCH_UUID  "ca000000-fede-fede-0000-000000000003"       // Bluetooth characteristic to get the switched of the oscillators (0 or 1)
#define CHARACTERISTIC_PRESET_UUID  "ca000000-fede-fede-0000-000000000004"       // Bluetooth characteristic to get the preset loaded (preset index)
#define CHARACTERISTIC_CMD_UUID     "ca000000-fede-fede-0000-000000000099"       // Bluetooth characteristic to send commands and get the current status 

#define PRESET_FILE_PREFIX "/p"
#define PRESET_FILE_SUFFIX ".txt"

#define INIT_FILE "/init.cmd"

#define LED_PIN 2
#define MAX_PRESET 8  // Presets MAX count
#define MAX_OUTPUT 4  // Oscillators MAX count (up to 8)
#define MAX_FREQUENCY 40000
#define DUTY_RESOLUTION_BITS 10
#define DUTY_CYCLE_DEFAULT 512

// Connect each of these PINS to a MOSFET driving 12v to a coil/electromaget (i.e. D2, D4, D5, D18, etc)

const int PINOUT[] = {2, 4, 5, 18, 19, 21, 22, 23 }; 

// Global vars
std::vector<float> _freqs;
std::vector<float> _cacheFreqs;
std::vector<String> _cachePresets;
std::vector<float> _duties;
std::vector<byte> _switches;
std::random_device _rnd;
BLECharacteristic *pCharacteristicFreqs, *pCharacteristicDuties, *pCharacteristicSwitches, *pCharacteristicPresets, *pCharacteristicCmd;
std::queue<String> _commandBuffer;
BLEServer* bleServer = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;
bool stop = false;  // Stop playing flag
bool debug_ble = false; // Debug via BLE
int last_preset_loaded = 0;

// Songs format: Check README.md
std::vector<String> _songs = {
  "M.5,.33,.5,.33:4|.33,.5,.33,.5:4|.25,2,.25,2:2.5|2,.25,2,.25:4|1.5,3,1.5,3:2|3,1.5,3,1.5:4|1,2,1,2:4|.125,.125,.125,.125:2|4,2,4,2:2|.5,4,.5,4:2|1.5,3,1.5,3:2",
  "M1.5,1.33,.25,1.25:4|1.33,1.5,1.5,1.33:4|.25,1.25,2,.25:3|2,.25,.5,3:4|.5,3,2,.25:2|3,.5,1,2:2|1,2,3,.5:6|1.125,1.125,4,2:2|4,2,1.125,1.125:2|.5,2.5,2.5,5:2|2.5,.5,.5,2.5:2",
  "a-1,-1,-1,-1:1|=1|=1|=1|=1|a1,1,1,1:1|=6|=6|=6|=6|=6|=6|=6|=6|=6|=1|=1|=1|=1|=1"
};

// Prototypes
void setup(void);
void loop(void);
// def: default value to set when no value present (i.e. ,,440 means def,def,440). completeWith: vector to use to set the value when a negative value
std::vector<float> splitParseVector(String msg, float def, std::vector<float> *completeWith=nullptr);
std::vector<String> splitString(String msg, const char delim);
const char* join(std::vector<float> &v, bool mustRound=false);
void NotifyBLEFreqValue();
void NotifyBLEDutyValue();
void NotifyBLEPresetLoaded();
void PrintValues(std::vector<float> &f, std::vector<float> &d);
void AttachOutputPins();
void DetachOutputPins();
void UpdateFrequencyValues(String newValue, bool isIncrement);
void UpdateDutyValues(String newValue, bool isIncrement);
void SetFreqsPWM();
void MultiplyFreqsPWM(std::vector<float> &mult);
void SetDutiesPWM();
void ProcessPlayCommand(String command);
void ProcessSeqCommand(String command);
void PlaySong(int songIndex, int repeat, float tempoDivider, int variation);
void Log(String msg);
std::vector<std::string> SplitStringByNumber(const std::string &str, int len);
void SetFreqPWM(int oscIndex, float freq, bool setup=false);
std::vector<String> GetPreset(int pindex);
void StorePreset(int pindex, std::vector<String> preset);
void InitializeVectors();
void PlayPresetSequence(int startIndex, int endIndex, float interval, int repeat, int variation);
std::vector<int> GetPresetRange(int startIndex, int endIndex);
std::vector<String> GetInitCommand();
void StoreInitCommand(String cmd);

// MAIN
void setup() {
  Serial.begin(115200);
  Log("Initializing");
  InitializeVectors();
  
  AttachOutputPins();
  StartBLEServer();

  std::vector<String> initCmds = GetInitCommand();
  if (initCmds.size() > 0 && initCmds[0].length() > 0) {
    Log("Init with cmds: " + joinString(initCmds, '|'));
    for (size_t i = 0; i < initCmds.size(); ++i) {
      _commandBuffer.push(initCmds[i]);
    }
  } else {
    _commandBuffer.push("load 0");
  }

  _cacheFreqs = _freqs;
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
  if (!_commandBuffer.empty()) {
    String recv = _commandBuffer.front();
    _commandBuffer.pop();
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
  recv.trim();
  recv.toLowerCase();
  Log("Recv: '" + recv + "'");
  if (recv.startsWith("/")) {
    // Duties
    recv = recv.substring(1);
    UpdateDutyValues(recv, false);
  }
  else if (recv.startsWith("*")) {
    // Frequencies (multipliers)
    recv = recv.substring(1);
    std::vector<float> mult = splitParseVector(recv, 1.0);
    MultiplyFreqsPWM(mult);
    NotifyBLEFreqValue();
  }
  else if (recv.startsWith("+")) {
    // Frequencies (increments)
    recv = recv.substring(1);
    UpdateFrequencyValues(recv, true);
  }
  else if (recv.equals("load") || recv.equals("reset")) {
    // Reload last preset 
    Load(last_preset_loaded);
  }
  else if (recv.equals("save") || recv.equals("set")) {
    // Save last preset loaded
    Save(last_preset_loaded);
  }
  else if (recv.startsWith("load ")) {
    // Load preset x
    if (recv.length() > 5) {
      Load(recv.substring(5).toInt());
    }
  }
  else if (recv.startsWith("save ")) {
    // Save preset x
    if (recv.length() > 5) {
      Save(recv.substring(5).toInt());
    }
  }
  else if (recv.startsWith("play")) {
    // PLAY
    ProcessPlayCommand(recv);
  }
  else if (recv.startsWith("seq")) {
    // SEQ
    ProcessSeqCommand(recv);
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
  else if (recv.startsWith("init ")) {
    // INIT command
    if (recv.length() > 5) {
      StoreInitCommand(recv.substring(5));
    }
  }
  else if (recv.startsWith("?")) {
    NotifyBLEFreqValue();
    NotifyBLEDutyValue();
    NotifyBLESwitchesValue();
    NotifyBLEPresetLoaded();
  }
  else if (isOperand(recv)) {
    // Frequencies (in hz)
    UpdateFrequencyValues(recv, false);
  }
  PrintValues(_freqs, _duties);  
}

void InitializeVectors() {
  for(int i = 0; i < MAX_OUTPUT; ++i) {
    _freqs.push_back(0);
    _cacheFreqs.push_back(0);
    _duties.push_back(DUTY_CYCLE_DEFAULT);
    _switches.push_back(1);
  }
  for(int i = 0; i < MAX_PRESET; ++i) {
    _cachePresets.push_back("");
  }
}

bool isOperand(String str) {
  return isDigit(str.charAt(0)) || str.charAt(0) == '-' || str.charAt(0) == '.' || str.charAt(0) == ',';
}

// BLE characteristics Callbacks
class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      String value = String(pCharacteristic->getValue().c_str());
      if (value.startsWith("stop")) {
        stop = true;
      }
      else {
        _commandBuffer.push(value);
      }
    }
};

// BLE Server callbacks
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* server) {
      Log("Client connected");
      deviceConnected = true;
      NotifyBLEFreqValue();
      NotifyBLEDutyValue();
      NotifyBLESwitchesValue();
      NotifyBLEPresetLoaded();
    };
    void onDisconnect(BLEServer* server) {
      Log("Client disconnected");
      deviceConnected = false;
    }
};

void StartBLEServer() {
  BLEDevice::init(SERVICE_NAME);
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new MyServerCallbacks());
  BLEService *pService = bleServer->createService(BLEUUID(SERVICE_UUID), 30, 0);
  
  pCharacteristicFreqs = pService->createCharacteristic(CHARACTERISTIC_FREQ_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicDuties = pService->createCharacteristic(CHARACTERISTIC_DUTY_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicSwitches = pService->createCharacteristic(CHARACTERISTIC_SWITCH_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicPresets = pService->createCharacteristic(CHARACTERISTIC_PRESET_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharacteristicCmd = pService->createCharacteristic(CHARACTERISTIC_CMD_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_NOTIFY);
  
  // https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.descriptor.gatt.client_characteristic_configuration.xml
  pCharacteristicFreqs->addDescriptor(new BLE2902());
  pCharacteristicDuties->addDescriptor(new BLE2902());
  pCharacteristicSwitches->addDescriptor(new BLE2902());
  pCharacteristicPresets->addDescriptor(new BLE2902());
  pCharacteristicCmd->addDescriptor(new BLE2902());
  
  pCharacteristicCmd->setCallbacks(new MyCallbacks());
  pService->start();
  BLEAdvertising *pAdvertising = bleServer->getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  //pAdvertising->start();
}

// Helper methods
void AttachOutputPins() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    TurnOn(i);
  }
}
void DetachOutputPins() {
  for (int i = 0; i < MAX_OUTPUT; i++) { 
    TurnOff(i);
  }
}

void TurnOn(int oscIndex) {
  // assign pin[0] to channel 0, pin[1] to channel 2 (only using even channels since 0-1, 2-3, 4-5 share the same timer)
  ledcAttachPin(PINOUT[oscIndex], oscIndex*2);
  _switches[oscIndex] = 1;
}

void TurnOff(int oscIndex) {
  _switches[oscIndex] = 0;
  ledcDetachPin(PINOUT[oscIndex]);
}

// Freq newValue valid formats: d[,d,d,d]   d is a float
void UpdateFrequencyValues(String newValue, bool isIncrement) {
  Log("New freqs: " + newValue);
  if (isIncrement) {
    std::vector<float> increments = splitParseVector(newValue, 0.0);
    for (size_t i = 0; i < increments.size(); ++i) {
      _freqs[i] = _freqs[i] + increments[i];
    }
  } else {
    _freqs = splitParseVector(newValue, -1.0, &_freqs);
  }
  SetFreqsPWM();
  NotifyBLEFreqValue();
}

// Duty newValue valid formats: d[,d,d,d]   d is a float
void UpdateDutyValues(String newValue, bool isIncrement) {
  Log("New duties: " + newValue);
  if (isIncrement) {
    std::vector<float> increments = splitParseVector(newValue, 0.0);
    for (size_t i = 0; i < increments.size(); ++i) {
      _duties[i] = _duties[i] + increments[i];
    }
  } else {
    _duties = splitParseVector(newValue, -1.0, &_duties);
  }
  SetDutiesPWM();
  NotifyBLEDutyValue();
}

void MultiplyFreqsPWM(std::vector<float> &mult) {
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
    float freq = 0;
    uint32_t duty = DUTY_CYCLE_DEFAULT;
    if (i <= _freqs.size() - 1) {
      freq = (float)_freqs[i];
      duty = (uint32_t)_duties[i];
    }
    SetFreqPWM(i, freq, true);
    // When changing freq, we have to re-set the duty
    if (duty != DUTY_CYCLE_DEFAULT) {
      ledcWrite(i*2, duty);
    }
  }
}  

void SetFreqPWM(int oscIndex, float freq, bool setup) {
  if (freq < 0) {
    freq = 0;
  }
  if (freq > MAX_FREQUENCY) {
    freq = MAX_FREQUENCY;
  }
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

void PrintValues(std::vector<float> &f, std::vector<float> &d) {
  Log("Status");
  for (size_t i = 0; i < f.size(); i++) {
    Log(String(i) + ": " + String(f[i]) + " Hz. D: " + String(d[i]) + (_switches[i] == 1 ? "" : " (off)"));
  }
}

std::vector<byte> ToByteArray(std::vector<float> &v) {
  std::vector<byte> arr;
  for (size_t i = 0; i < v.size(); i++) {
    word value = (word)round(v[i]);
    byte low = lowByte(value);
    byte high = highByte(value);
    //Log("Value: " + String(value) + ". low: " + String(low) + ". high: " + String(high) + ".");
    arr.push_back(high);
    arr.push_back(low);
  }
  return arr;
}

void NotifyBLEFreqValue() {
  std::vector<byte> arr = ToByteArray(_freqs);
  pCharacteristicFreqs->setValue(&arr[0], arr.size());
  if (deviceConnected) {
    pCharacteristicFreqs->notify();
  }
}

void NotifyBLEDutyValue() {
  std::vector<byte> arr = ToByteArray(_duties);
  pCharacteristicDuties->setValue(&arr[0], arr.size());
  if (deviceConnected) {
    pCharacteristicDuties->notify();
  }
}

void NotifyBLESwitchesValue() {
  pCharacteristicSwitches->setValue(&_switches[0], _switches.size());
  if (deviceConnected) {
    pCharacteristicSwitches->notify();
  }
}

void NotifyBLEPresetLoaded() {
  byte msg[1] = {(byte)last_preset_loaded};
  pCharacteristicPresets->setValue(&msg[0], 1);
  if (deviceConnected) {
    pCharacteristicPresets->notify();
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

std::vector<float> splitParseVector(String msg, float def, std::vector<float> *completeWith) {
  std::vector<float> result;
  int j = 0;
  String value;
  for (int i = 0; i < msg.length(); i++) {
    if (msg.charAt(i) == ',') {
      value = msg.substring(j, i);
      result.push_back(value.length() > 0 ? value.toFloat() : def);
      j = i + 1;
    }
  }
  value = msg.substring(j, msg.length());
  result.push_back(value.length() > 0 ? value.toFloat() : def); //to grab the last value of the string
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

std::vector<std::string> SplitStringByNumber(const std::string &str, int len) {
    std::vector<std::string> entries;
    for(std::string::const_iterator it(str.begin()); it != str.end();)
    {
        int nbChar = std::min(len,(int)std::distance(it,str.end()));
        entries.push_back(std::string(it,it+nbChar));
        it=it+nbChar;
    };
    return entries;
}

const char* join(std::vector<float> &v, bool mustRound) {
  std::stringstream ss;
  for (size_t i = 0; i < v.size(); ++i)
  {
    if(i != 0)
      ss << ",";
    ss << (mustRound ? round(v[i]) : v[i]);
  }
  return ss.str().c_str();
}

String joinString(std::vector<String> &s, const char delim) {
  String result = "";
  for (size_t i = 0; i < s.size(); i++) {
    result += s[i] + delim;
  }
  return result.substring(0, result.length() - 1);
}

void Load(int pindex) {
  std::vector<String> preset = GetPreset(pindex);
  Log("Load P" + String(pindex) + "=" + joinString(preset, '|'));
  if (preset.size() > 0 && isDigit(preset[0].charAt(0))) {
    // preset[0] are frequencies (d,d,d,d)
    UpdateFrequencyValues(preset[0], false);
  }
  if (preset.size() > 1) {
    if (isDigit(preset[1].charAt(0))) {
      // preset[1] are duties (d,d,d,d)
      UpdateDutyValues(preset[1], false);
    }
  }
  else {
    // Default duties
    for (size_t d = 0; d < _duties.size(); ++d) {
      _duties[d] = DUTY_CYCLE_DEFAULT;
    }
  }
  if (preset.size() > 2 && isDigit(preset[2].charAt(0))) {
    // preset[2] are switches (bbbb)
    for (int i = 0; (i < preset[2].length() && i < _switches.size()); ++i) {
      if (preset[2].charAt(i) == '0') {
        TurnOff(i);
      } 
      else {
        TurnOn(i);
      }
    }
  }
  else {
    // Default switches all on
    AttachOutputPins();
  }
  NotifyBLESwitchesValue();
  last_preset_loaded = pindex;
  NotifyBLEPresetLoaded();
}

void Save(int pindex) {
  std::vector<String> preset;
  preset.push_back(join(_freqs, false));
  preset.push_back(join(_duties, false));
  String switches = "";
  for(size_t i = 0; i < _switches.size(); ++i) {
    switches += String(_switches[i]);
  }
  if (switches.length() > 0) {
    preset.push_back(switches);
  }
  StorePreset(pindex, preset);
}

std::vector<String> GetPreset(int pindex) {
  if (pindex < 0 || pindex > (MAX_PRESET-1)) {
    return {};
  }
  String value = _cachePresets[pindex];
  if (value.length() == 0) {
    ESPFlashString espFlashString((PRESET_FILE_PREFIX + String(pindex) + PRESET_FILE_SUFFIX).c_str(), "");
    _cachePresets[pindex] = espFlashString.get();
    value = _cachePresets[pindex];
  }
  if (value.length() == 0) {
    return {};
  }
  Log("Read P" + String(pindex) + "=" + value);
  return splitString(value, '|');
}

void StorePreset(int pindex, std::vector<String> preset) {
  if (pindex < 0 || pindex > (MAX_PRESET-1)) {
    return;
  }
  ESPFlashString espFlashString((PRESET_FILE_PREFIX + String(pindex) + PRESET_FILE_SUFFIX).c_str());
  String value = joinString(preset, '|');
  Log("Store P" + String(pindex) + "=" + value);
  _cachePresets[pindex] = value;
  espFlashString.set(value);
}

std::vector<String> GetInitCommand() {
  ESPFlashString espFlashString(INIT_FILE, "load 0");
  return splitString(espFlashString.get(), '|');
}
void StoreInitCommand(String cmd) {
  ESPFlashString espFlashString(INIT_FILE);
  Log("Store Init: " + cmd);
  espFlashString.set(cmd);
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
  NotifyBLESwitchesValue();
}

// Format: play SongIndex[,Iterations[,Speed[,Variation]]]
void ProcessPlayCommand(String command) {
  if (command.length() <= 5) {
    // Default params
    PlaySong(0, 1, 1, -1);
  } 
  else {
    std::vector<String> params = splitString(command.substring(5), ',');
    int song;
    int repeat = 1;
    float speed = 1.00;
    int variation = -1;
    if (params.size() > 0) {
      song = params[0].toInt();
    }
    if (params.size() > 1) {
      repeat = params[1].toInt();
    }
    if (params.size() > 2) {
      speed = params[2].toFloat();
    }
    if (params.size() > 3) {
      variation = params[3].toInt();
    }
    PlaySong(song, repeat, speed, variation);
  }
}

//Format: seq [StartIndex[,EndIndex[,Interval[,Iterations[,Variation]]]]]
void ProcessSeqCommand(String command) {
  if (command.length() <= 4) {
    // Default params
    PlayPresetSequence(0, 3, 1.0, 0, -1);
  } 
  else {
    std::vector<String> params = splitString(command.substring(4), ',');
    int startIndex = 0;
    int endIndex = 3;
    float interval = 1.0;
    int repeat = 0;
    int variation = -1;
    if (params.size() > 0) {
      startIndex = params[0].toInt();
    }
    if (params.size() > 1) {
      endIndex = params[1].toInt();
    }
    if (params.size() > 2) {
      interval = params[2].toFloat();
    }
    if (params.size() > 3) {
      repeat = params[3].toInt();
    }
    if (params.size() > 4) {
      variation = params[4].toInt();
    }
    PlayPresetSequence(startIndex, endIndex, interval, repeat, variation);
  }
}

void PlaySong(int songIndex, int repeat, float speed, int variation) {
  String song = _songs[songIndex];
  std::default_random_engine rndSeeded(variation);
  String variationString = variation < 0 ? "original variation" : variation > 0 ? ("variation #" + String(variation)) : "random variation";
  Log("Play song " + String(songIndex) + " " + variationString + " " + (repeat <= 0 ? "infinite" : String(repeat)) + " times @ " + String(speed) + "x");
  if (song.length() > 0) {
    Log("Begin song");
    stop = false;
    char defaultType = song.charAt(0);
    song = song.substring(1);
    
    std::vector<String> steps = splitString(song, '|');
    int times = 0;
    while(times < repeat || repeat <= 0) {
      if (repeat > 0) {
        times++;
        Log("Repeat " + String(times) + "/" + String(repeat));
      } else {
        Log("Repeat");
      }
      
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
          Load(last_preset_loaded);
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
        std::vector<float> operands = splitParseVector(values[0], -1.0);
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
        NotifyBLEFreqValue();

        std::vector<float> duties;
        if (values.size() > 2) {
          // Set duties
          duties = splitParseVector(values[2], -1.0);
          for(size_t oscIndex = 0; oscIndex < duties.size(); ++oscIndex) {
            if (duties[oscIndex] >= 0) {
              Log("    Set " + String(oscIndex) + " duty to " + String(duties[oscIndex]));
              ledcWrite(oscIndex*2, (uint32_t)duties[oscIndex]);
            }
          }
          NotifyBLEDutyValue();
        }
        if (values.size() > 1) {
          // Delay
          if (speed > 0) {
            float duration = values[1].toFloat() / speed;
            Log("    Delay " + String(duration) + " secs.");
            delay(duration * 1000);
          }
        }
      }
    }
    Log("End song");
    // Restore cache freqs, duties
    Load(last_preset_loaded);
  }
}

void PlayPresetSequence(int startIndex, int endIndex, float interval, int repeat, int variation) {
  std::default_random_engine rndSeeded(variation);
  String variationString = variation < 0 ? "original variation" : variation > 0 ? ("variation #" + String(variation)) : "random variation";
  Log("Play preset loop " + String(startIndex) + "-" + String(endIndex) + " " + variationString + " " + (repeat <= 0 ? "infinite" : String(repeat)) + " times @ " + String(interval) + "s interval");

  if(startIndex >= 0 && endIndex >= 0 && endIndex >= startIndex && endIndex + 1 <= MAX_PRESET) {
    stop = false;
    int times = 0;
    while(times < repeat || repeat <= 0) {
      if (repeat > 0) {
        times++;
        Log("Repeat " + String(times) + "/" + String(repeat));
      } else {
        Log("Repeat");
      }
      std::vector<int> range = GetPresetRange(startIndex, endIndex);
      // Variation (randomize steps)
      if (variation > 0) {
        std::shuffle(range.begin(), range.end(), rndSeeded);
      } 
      else if (variation == 0) {
        std::shuffle(range.begin(), range.end(), _rnd);
      }
      // Play
      for(size_t i = 0; i < range.size(); ++i) {
        if (stop) {
          Log("Stopping");
          Load(0);
          return;
        }
        Load(range[i]);
        if (interval > 0) {
          Log("    Delay " + String(interval) + " secs.");
          delay(interval * 1000);
        }
      }
    }
    Log("End sequence");
    Load(0);
  }
}

std::vector<int> GetPresetRange(int startIndex, int endIndex) {
  std::vector<int> range;
  for(int i = startIndex; i <= endIndex; ++i) {
    range.push_back(i);
  }
  return range;
}
